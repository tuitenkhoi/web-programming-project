// Kiểm tra MocAuthGuard (assets/js/client-api.js) bằng cách chạy file trong một "trình duyệt giả" tối giản.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; },
    };
}

// Nạp client-api.js với trạng thái trình duyệt giả; trả về các thứ cần kiểm tra
function loadClient({ token = null, pathname = '/pages/cart.html', search = '?a=1', saved = null, fetchImpl = null } = {}) {
    const local = makeStorage(token ? { mocCoffeeCustomerToken: token } : {});
    const session = makeStorage(saved ? { mocAfterLogin: saved } : {});
    const toasts = [];
    const location = { origin: 'http://localhost:5000', pathname, search, href: '' };
    const timers = [];
    const sandbox = {
        window: null,
        localStorage: local,
        sessionStorage: session,
        document: {
            createElement: () => ({ style: {}, setAttribute() {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }),
            body: { appendChild: (el) => toasts.push(el) },
        },
        setTimeout: (fn) => { timers.push(fn); return 1; },
        fetch: fetchImpl || (async () => ({})),
        atob: (text) => Buffer.from(text, 'base64').toString('binary'),
        URLSearchParams,
        FormData: class {},
        console,
    };
    sandbox.window = { location, ...sandbox };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/client-api.js'), 'utf8'), sandbox);
    return { guard: sandbox.window.MocAuthGuard, api: sandbox.window.MocCoffeeApi, local, location, session, toasts, timers };
}

test('Guard: đã đăng nhập thì cho qua, không chuyển trang', () => {
    const { guard, location, timers } = loadClient({ token: 'abc' });
    assert.equal(guard.requireLogin(), true);
    assert.equal(timers.length, 0);
    assert.equal(location.href, '');
});

test('Guard: chưa đăng nhập -> lưu mocAfterLogin, báo toast, chuyển tới account.html?login=1&next=', () => {
    const { guard, location, session, toasts, timers } = loadClient();
    assert.equal(guard.requireLogin(), false);
    assert.equal(session.getItem('mocAfterLogin'), '/pages/cart.html?a=1');
    assert.equal(toasts[0].textContent, 'Bạn cần đăng nhập để tiếp tục');
    timers.forEach((fn) => fn());
    assert.equal(location.href, '/pages/account.html?login=1&next=' + encodeURIComponent('/pages/cart.html?a=1'));
});

test('Guard: sau đăng nhập quay lại đúng trang đã lưu và xóa mocAfterLogin (chỉ dùng 1 lần)', () => {
    const { guard, session } = loadClient({ saved: '/pages/payment.html', search: '?login=1&next=%2Fpages%2Fpayment.html' });
    assert.equal(guard.afterLoginUrl('../index.html'), '/pages/payment.html');
    assert.equal(session.getItem('mocAfterLogin'), null);
});

test('Guard: không có mocAfterLogin thì dùng tham số ?next= trên địa chỉ', () => {
    const { guard } = loadClient({ search: '?login=1&next=%2Fpages%2Fcart.html' });
    assert.equal(guard.afterLoginUrl('../index.html'), '/pages/cart.html');
});

test('Guard: chặn open redirect (//evil.com, http://, javascript:)', () => {
    for (const bad of ['//evil.com', 'https://evil.com/x', 'javascript:alert(1)', '/\\evil.com']) {
        const { guard } = loadClient({ saved: bad, search: '?login=1' });
        assert.equal(guard.afterLoginUrl('../index.html'), '../index.html', bad);
    }
});

test('Guard: mocAfterLogin cũ không bị dùng khi vào thẳng trang tài khoản (không có ?login=1)', () => {
    const { guard, session } = loadClient({ saved: '/pages/payment.html', pathname: '/pages/account.html', search: '' });
    assert.equal(guard.afterLoginUrl('../index.html'), '../index.html');
    assert.equal(session.getItem('mocAfterLogin'), null); // vẫn xóa để không tồn đọng
});

// Tạo JWT giả (chỉ cần payload; client không kiểm tra chữ ký)
const fakeJwt = (payload) => 'x.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.y';
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

test('Guard: token đã hết hạn bị coi là chưa đăng nhập và bị xóa', () => {
    const expired = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    const { guard, local, timers } = loadClient({ token: expired });
    assert.equal(guard.requireLogin(), false);
    assert.equal(local.getItem('mocCoffeeCustomerToken'), null);
    assert.equal(timers.length, 1);
});

test('Guard: token còn hạn thì cho qua', () => {
    const valid = fakeJwt({ exp: inAnHour() });
    const { guard, local } = loadClient({ token: valid });
    assert.equal(guard.requireLogin(), true);
    assert.equal(local.getItem('mocCoffeeCustomerToken'), valid);
});

const revokedResponse = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ success: false, message: 'Phiên đăng nhập đã kết thúc', code: 'TOKEN_REVOKED' }),
});

test('API trả 401 TOKEN_REVOKED: xóa phiên và chuyển sang đăng nhập (không bị kẹt ở trang thanh toán)', async () => {
    const { api, local, timers, location } = loadClient({ token: fakeJwt({ exp: inAnHour() }), pathname: '/pages/payment.html', search: '', fetchImpl: revokedResponse });
    await assert.rejects(() => api.createOrder({}), /Phiên đăng nhập đã kết thúc/);
    assert.equal(local.getItem('mocCoffeeCustomerToken'), null);
    timers.forEach((fn) => fn());
    assert.equal(location.href, '/pages/account.html?login=1&next=' + encodeURIComponent('/pages/payment.html'));
});

test('API trả 401 TOKEN_REVOKED ở trang tài khoản: chỉ xóa phiên, không chuyển trang', async () => {
    const { api, local, timers } = loadClient({ token: fakeJwt({ exp: inAnHour() }), pathname: '/pages/account.html', search: '', fetchImpl: revokedResponse });
    await assert.rejects(() => api.getMe(), /Phiên đăng nhập đã kết thúc/);
    assert.equal(local.getItem('mocCoffeeCustomerToken'), null);
    assert.equal(timers.length, 0);
});

test('Đăng nhập sai mật khẩu (401 không có code) không xóa phiên đang có', async () => {
    const valid = fakeJwt({ exp: inAnHour() });
    const bad = async () => ({ ok: false, status: 401, json: async () => ({ success: false, message: 'Email hoặc mật khẩu không chính xác.' }) });
    const { api, local, timers } = loadClient({ token: valid, fetchImpl: bad });
    await assert.rejects(() => api.customerLogin('a@b.c', 'sai'), /không chính xác/);
    assert.equal(local.getItem('mocCoffeeCustomerToken'), valid);
    assert.equal(timers.length, 0);
});

// Chốt hợp đồng: trang tài khoản phải dùng guard để quay lại trang cũ (từng mất khi account-ui.js bị xóa)
test('account.js dùng MocAuthGuard.afterLoginUrl sau đăng nhập và đăng ký', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/js/account.js'), 'utf8');
    assert.ok((source.match(/MocAuthGuard\.afterLoginUrl\(/g) || []).length >= 2);
});
