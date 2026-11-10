// Luồng quên mật khẩu bằng OTP. DB giả có TRẠNG THÁI (nhớ OTP/ticket/mật khẩu) để chạy trọn luồng.
process.env.JWT_SECRET = 'password-reset-test-secret-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const EMAIL = 'quenmk@moc.vn';
const state = {
    id: 50, email: EMAIL, full_name: 'Khách Quên', phone: null, role: 'customer', status: 1,
    password_hash: bcrypt.hashSync('MatKhauCu@123', 4),
    reset_otp: null, reset_attempts: 0, reset_ticket: null,
};

async function execute(sql, params = []) {
    const text = String(sql).replace(/\s+/g, ' ');
    if (/SELECT id FROM users WHERE email = \? AND status = 1/.test(text)) {
        return [params[0] === state.email ? [{ id: state.id }] : []];
    }
    if (/UPDATE users SET reset_otp = \?/.test(text)) {
        state.reset_otp = params[0]; state.reset_attempts = 0; state.reset_ticket = null;
        return [{ affectedRows: 1 }];
    }
    if (/SELECT id, reset_otp, reset_attempts/.test(text)) {
        return [params[0] === state.email ? [{ id: state.id, reset_otp: state.reset_otp, reset_attempts: state.reset_attempts, otp_valid: 1 }] : []];
    }
    if (/SET reset_attempts = reset_attempts \+ 1/.test(text)) { state.reset_attempts++; return [{ affectedRows: 1 }]; }
    if (/UPDATE users SET reset_ticket = \?/.test(text)) {
        state.reset_ticket = params[0]; state.reset_otp = null; state.reset_attempts = 0;
        return [{ affectedRows: 1 }];
    }
    if (/WHERE reset_ticket = \?/.test(text)) {
        return [state.reset_ticket && params[0] === state.reset_ticket ? [{ id: state.id }] : []];
    }
    if (/UPDATE users SET password_hash = \?/.test(text)) {
        state.password_hash = params[0]; state.reset_ticket = null; state.reset_otp = null;
        return [{ affectedRows: 1 }];
    }
    if (/FROM users WHERE email = \?/.test(text)) return [params[0] === state.email ? [state] : []];
    if (/FROM users[\s\S]*WHERE id = \?/.test(text)) return [[state]];
    return [[]];
}
const fakeDb = { execute, query: execute, getConnection: async () => ({ execute, query: execute, release() {} }), end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');
const json = { 'Content-Type': 'application/json' };
let server; let base;
test.before(() => { server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = async (path, body, headers = json) => {
    const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
};
const login = (password) => post('/api/auth/customer/login', { email: EMAIL, password });

test('forgot-password không lộ email nào đã đăng ký (cùng phản hồi)', async () => {
    const known = await post('/api/auth/forgot-password', { email: EMAIL });
    const unknown = await post('/api/auth/forgot-password', { email: 'khongco@moc.vn' });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(known.body, unknown.body);
});

test('Full luồng: forgot -> verify-otp -> reset -> đăng nhập bằng mật khẩu mới', async () => {
    const oldSession = await login('MatKhauCu@123');
    assert.equal(oldSession.status, 200);
    const oldAuth = { Authorization: 'Bearer ' + oldSession.body.data.token };

    await post('/api/auth/forgot-password', { email: 'flow@moc.vn' }); // email khác: tránh dồn hạn mức của EMAIL
    await post('/api/auth/forgot-password', { email: EMAIL });
    assert.match(state.reset_otp, /^\d{6}$/);

    const wrong = await post('/api/auth/verify-otp', { email: EMAIL, otp: state.reset_otp === '000000' ? '111111' : '000000' });
    assert.equal(wrong.status, 400);

    const verified = await post('/api/auth/verify-otp', { email: EMAIL, otp: state.reset_otp });
    assert.equal(verified.status, 200);
    const ticket = verified.body.data.reset_ticket;
    assert.match(ticket, /^[0-9a-f]{32}$/);

    const mismatch = await post('/api/auth/reset-password', { reset_ticket: ticket, password: 'MatKhauMoi@123', confirm_password: 'Khac@12345' });
    assert.equal(mismatch.status, 400);

    const reset = await post('/api/auth/reset-password', { reset_ticket: ticket, password: 'MatKhauMoi@123', confirm_password: 'MatKhauMoi@123' });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data, undefined, 'reset-password không được trả token');

    assert.equal((await login('MatKhauCu@123')).status, 401);
    assert.equal((await login('MatKhauMoi@123')).status, 200);

    // phiên đăng nhập trước khi đổi mật khẩu bị thu hồi
    const me = await fetch(base + '/api/auth/customer/me', { headers: oldAuth });
    assert.equal(me.status, 401);

    // ticket đã dùng rồi thì không dùng lại được
    const reuse = await post('/api/auth/reset-password', { reset_ticket: ticket, password: 'MatKhauMoi@123', confirm_password: 'MatKhauMoi@123' });
    assert.equal(reuse.status, 400);
});

test('verify-otp khóa sau 5 lần nhập sai, kể cả khi sau đó nhập đúng', async () => {
    state.reset_otp = '123456'; state.reset_attempts = 0; state.reset_ticket = null;
    for (let i = 0; i < 5; i++) {
        const bad = await post('/api/auth/verify-otp', { email: EMAIL, otp: '654321' });
        assert.equal(bad.status, 400);
    }
    const locked = await post('/api/auth/verify-otp', { email: EMAIL, otp: '123456' });
    assert.equal(locked.status, 429);
    assert.equal(state.reset_ticket, null);
});

test('forgot-password giới hạn 5 yêu cầu / 15 phút cho mỗi email', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await post('/api/auth/forgot-password', { email: 'spam@moc.vn' })).status);
    assert.deepEqual(results, [200, 200, 200, 200, 200, 429]);
});
