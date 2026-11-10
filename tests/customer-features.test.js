process.env.JWT_SECRET = 'customer-feature-test-secret-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hash = bcrypt.hashSync('Customer@123', 4);
const customer = { id: 21, full_name: 'Khách Mộc', email: 'khach@moc.vn', phone: '0901234567', password_hash: hash, role: 'customer', status: 1 };

let activateMode = 'valid'; // 'valid' | 'expired' | 'unknown' — điều khiển câu trả lời của DB giả khi test /activate
const sqlLog = [];
async function execute(sql) {
    const text = String(sql);
    sqlLog.push(text.replace(/\s+/g, ' '));
    if (/FROM users WHERE verification_token/.test(text)) {
        if (activateMode === 'unknown') return [[]];
        return [[{ id: 21, still_valid: activateMode === 'valid' ? 1 : 0 }]];
    }
    if (/UPDATE users SET email_verified_at/.test(text)) return [{ affectedRows: 1 }];
    if (/FROM users[\s\S]*WHERE id/.test(text)) return [[customer]];
    if (/SELECT id FROM users WHERE email/.test(text)) return [[]];
    if (/FROM users WHERE email/.test(text)) return [[customer]];
    if (/INSERT INTO users/.test(text)) return [{ insertId: 21 }];
    if (/UPDATE orders SET user_id/.test(text)) return [{ affectedRows: 1 }];
    if (/FROM orders[\s\S]*WHERE user_id/.test(text)) return [[{
        id: 31, order_code: 'MC-CUSTOMER-31', subtotal: '50000', discount_amount: '5000',
        service_fee: '0', total_amount: '45000', status: 'completed', created_at: new Date().toISOString(),
    }]];
    if (/FROM order_items[\s\S]*WHERE order_id IN/.test(text)) return [[{
        order_id: 31, product_id: 1, product_name: 'Cà phê', unit_price: '50000', quantity: 1,
        line_total: '50000', toppings: '[]',
    }]];
    if (/FROM vouchers[\s\S]*ORDER BY/.test(text)) return [[{
        code: 'MOCCOFFEE10', name: 'Giảm 10%', discount_type: 'percent', value: '10',
        min_order: '50000', max_discount: '50000',
    }]];
    if (/FROM vouchers[\s\S]*WHERE code/.test(text)) return [[{
        code: 'MOCCOFFEE10', name: 'Giảm 10%', discount_type: 'percent', value: '10',
        min_order: '50000', max_discount: '50000', usage_limit: 100, used_count: 0,
    }]];
    if (/FROM product_reviews r/.test(text)) return [[{ id: 1, rating: 5, comment: 'Ngon', full_name: 'Khách Mộc' }]];
    if (/COUNT\(\*\) AS total[\s\S]*product_reviews/.test(text)) return [[{ total: 1, average: '5' }]];
    if (/FROM orders o[\s\S]*JOIN order_items/.test(text)) return [[{ ok: 1 }]];
    if (/INSERT INTO product_reviews/.test(text)) return [{ insertId: 1 }];
    return [[]];
}

const fakeDb = { execute, query: execute, getConnection: async () => ({ execute, query: execute, release() {} }), end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');
const token = jwt.sign({ id: 21, role: 'customer' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const auth = { Authorization: `Bearer ${token}` };
const json = { 'Content-Type': 'application/json' };
let server;
let base;

test.before(() => { server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

async function call(path, options = {}) {
    const response = await fetch(base + path, options);
    return { status: response.status, body: await response.json() };
}

test('Khách hàng đăng ký và nhận token', async () => {
    const response = await call('/api/auth/customer/register', {
        method: 'POST', headers: json,
        body: JSON.stringify({ full_name: 'Khách Mộc', email: 'new@moc.vn', phone: '0909876543', password: 'Customer@123', confirm_password: 'Customer@123' }),
    });
    assert.equal(response.status, 201);
    assert.ok(response.body.data.token);
});

test('Khách hàng đăng nhập thành công', async () => {
    const response = await call('/api/auth/customer/login', {
        method: 'POST', headers: json,
        body: JSON.stringify({ email: customer.email, password: 'Customer@123' }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, 'customer');
});

test('Lịch sử đơn hàng chỉ mở khi có token customer', async () => {
    assert.equal((await call('/api/customer/orders')).status, 401);
    const response = await call('/api/customer/orders', { headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].items[0].product_name, 'Cà phê');
});

test('Voucher được đọc và tính từ database', async () => {
    const response = await call('/api/vouchers/validate', {
        method: 'POST', headers: json,
        body: JSON.stringify({ code: 'MOCCOFFEE10', subtotal: 100000 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.discount_amount, 10000);
});

test('Danh sách đánh giá sản phẩm là API công khai', async () => {
    const response = await call('/api/reviews/product/1');
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.average, 5);
});

test('Khách đã mua có thể gửi đánh giá', async () => {
    const response = await call('/api/reviews', {
        method: 'POST', headers: { ...json, ...auth },
        body: JSON.stringify({ product_id: 1, order_id: 31, rating: 5, comment: 'Ngon' }),
    });
    assert.equal(response.status, 201);
});

// ----- S9 + S15: phone tùy chọn, nhập lại mật khẩu -----
test('Đăng ký không cần số điện thoại vẫn trả 201 + token', async () => {
    const response = await call('/api/auth/customer/register', {
        method: 'POST', headers: json,
        body: JSON.stringify({ full_name: 'Khách Không SĐT', email: 'nophone@moc.vn', password: 'Customer@123', confirm_password: 'Customer@123' }),
    });
    assert.equal(response.status, 201);
    assert.ok(response.body.data.token);
    assert.equal(response.body.data.user.phone, '');
});

test('Đăng ký có SĐT sai định dạng vẫn bị chặn', async () => {
    const response = await call('/api/auth/customer/register', {
        method: 'POST', headers: json,
        body: JSON.stringify({ full_name: 'Khách Mộc', email: 'bad@moc.vn', phone: '123', password: 'Customer@123', confirm_password: 'Customer@123' }),
    });
    assert.equal(response.status, 400);
});

test('Đăng ký với confirm_password không khớp trả 400', async () => {
    const response = await call('/api/auth/customer/register', {
        method: 'POST', headers: json,
        body: JSON.stringify({ full_name: 'Khách Mộc', email: 'mismatch@moc.vn', password: 'Customer@123', confirm_password: 'Khac@12345' }),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'Mật khẩu nhập lại không khớp');
});

// ----- S10: kích hoạt email -----
const TOKEN32 = 'a'.repeat(32);
const activate = (t) => fetch(base + '/api/auth/activate?token=' + t, { redirect: 'manual' });

test('Link kích hoạt hợp lệ -> redirect về trang tài khoản và ghi email_verified_at', async () => {
    activateMode = 'valid';
    const res = await activate(TOKEN32);
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /\/pages\/account\.html\?verified=1/);
});

test('Link kích hoạt hết hạn / sai bị từ chối bằng thông báo tiếng Việt', async () => {
    activateMode = 'expired';
    const expired = await call('/api/auth/activate?token=' + TOKEN32);
    assert.equal(expired.status, 400);
    assert.match(expired.body.message, /hết hạn/);

    activateMode = 'unknown';
    const unknown = await call('/api/auth/activate?token=' + TOKEN32);
    assert.equal(unknown.status, 400);

    const malformed = await call('/api/auth/activate?token=abc');
    assert.equal(malformed.status, 400);
    activateMode = 'valid';
});

test('/customer/me trả thêm email_verified_at, theme, font_size, avatar', async () => {
    const res = await fetch(base + '/api/auth/customer/me', { headers: auth });
    assert.equal(res.status, 200);
    const selectSql = sqlLog.filter((q) => /SELECT id, full_name, email, phone, created_at/.test(q)).pop();
    for (const column of ['email_verified_at', 'theme', 'font_size', 'avatar']) {
        assert.match(selectSql, new RegExp(column), 'thiếu cột ' + column);
    }
});

// ----- S12: sửa hồ sơ + avatar -----
const fs = require('node:fs');
const path = require('node:path');
const avatarDir = path.join(__dirname, '../backend/uploads/avatars');
const listAvatars = () => fs.readdirSync(avatarDir).filter((f) => f !== '.gitkeep');
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

const patchMe = async (form) => {
    const res = await fetch(base + '/api/auth/customer/me', { method: 'PATCH', headers: auth, body: form });
    return { status: res.status, body: await res.json() };
};

test('PATCH hồ sơ: sửa họ tên, không cần gửi ảnh', async () => {
    const form = new FormData();
    form.append('full_name', 'Tên Mới');
    const res = await patchMe(form);
    assert.equal(res.status, 200);
    assert.ok(sqlLog.some((q) => /UPDATE users SET full_name = \? WHERE id = \?/.test(q)));
});

test('PATCH hồ sơ: họ tên quá ngắn bị 400, SĐT sai bị 400', async () => {
    const shortName = new FormData(); shortName.append('full_name', 'A');
    assert.equal((await patchMe(shortName)).status, 400);
    const badPhone = new FormData(); badPhone.append('phone', '12345');
    assert.equal((await patchMe(badPhone)).status, 400);
    assert.equal((await patchMe(new FormData())).status, 400); // không có gì để cập nhật
});

test('Upload avatar: file giả ảnh (khai image/png nhưng nội dung là chữ) bị từ chối và không để lại file', async () => {
    const before = listAvatars().length;
    const form = new FormData();
    form.append('avatar', new Blob(['day la file van ban, khong phai anh'], { type: 'image/png' }), 'gia.png');
    const res = await patchMe(form);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /không phải ảnh/);
    assert.equal(listAvatars().length, before);
});

test('Upload avatar: sai loại (gif) bị từ chối; ảnh PNG thật được nhận và lưu', async () => {
    const gif = new FormData();
    gif.append('avatar', new Blob([PNG_BYTES], { type: 'image/gif' }), 'a.gif');
    assert.equal((await patchMe(gif)).status, 400);

    const before = listAvatars();
    const form = new FormData();
    form.append('avatar', new Blob([PNG_BYTES], { type: 'image/png' }), 'that.png');
    const res = await patchMe(form);
    assert.equal(res.status, 200);
    const created = listAvatars().filter((f) => !before.includes(f));
    assert.equal(created.length, 1);
    created.forEach((f) => fs.unlinkSync(path.join(avatarDir, f))); // dọn file test
});

test('Upload avatar: file quá 2 MB bị từ chối với thông báo tiếng Việt', async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);
    const form = new FormData();
    form.append('avatar', new Blob([big], { type: 'image/png' }), 'lon.png');
    const res = await patchMe(form);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /2 MB/);
});

test('/uploads/avatars chặn file không phải ảnh và đường dẫn lạ', async () => {
    for (const url of ['/uploads/avatars/.gitkeep', '/uploads/avatars/a.php', '/uploads/avatars/%2e%2e/products/x.png']) {
        const res = await fetch(base + url);
        assert.ok([400, 404].includes(res.status), url + ' -> ' + res.status);
    }
});

// ----- S13: đổi mật khẩu -----
const changePw = (body, headers = auth) => call('/api/auth/customer/change-password', {
    method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body),
});

test('Đổi mật khẩu: sai mật khẩu hiện tại -> 401', async () => {
    const res = await changePw({ current_password: 'Sai@123456', new_password: 'MoiMoi@123', confirm_password: 'MoiMoi@123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Mật khẩu hiện tại không đúng');
});

test('Đổi mật khẩu: mật khẩu mới phải 8-72 ký tự, khớp confirm và khác mật khẩu cũ', async () => {
    assert.equal((await changePw({ current_password: 'Customer@123', new_password: 'ngan', confirm_password: 'ngan' })).status, 400);
    assert.equal((await changePw({ current_password: 'Customer@123', new_password: 'MoiMoi@123', confirm_password: 'Khac@12345' })).status, 400);
    assert.equal((await changePw({ current_password: 'Customer@123', new_password: 'Customer@123', confirm_password: 'Customer@123' })).status, 400);
});

test('Đổi mật khẩu thành công: không kèm token và thu hồi phiên cũ', async () => {
    const session = jwt.sign({ id: 21, role: 'customer', iat_ms: Date.now() }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const headers = { Authorization: `Bearer ${session}` };

    const res = await changePw({ current_password: 'Customer@123', new_password: 'MoiMoi@123', confirm_password: 'MoiMoi@123' }, headers);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Đổi mật khẩu thành công, vui lòng đăng nhập lại');
    assert.equal(res.body.data, undefined);

    const after = await fetch(base + '/api/auth/customer/me', { headers });
    assert.equal(after.status, 401, 'phiên cũ phải bị thu hồi');
});

// ----- S14: tùy chọn giao diện -----
// Test S13 ở trên đã thu hồi mọi phiên cũ của user 21, nên ở đây dùng token mới (ký sau thời điểm thu hồi)
const freshAuth = () => ({
    Authorization: 'Bearer ' + jwt.sign({ id: 21, role: 'customer', iat_ms: Date.now() + 1 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }),
});
const patchPrefs = (body) => call('/api/auth/customer/preferences', {
    method: 'PATCH', headers: { ...json, ...freshAuth() }, body: JSON.stringify(body),
});

test('PATCH preferences nhận giá trị hợp lệ', async () => {
    const res = await patchPrefs({ theme: 'dark', font_size: 18 });
    assert.equal(res.status, 200);
    assert.ok(sqlLog.some((q) => /UPDATE users SET theme = \?, font_size = \? WHERE id = \?/.test(q)));
});

test('PATCH preferences chặn giá trị ngoài danh sách', async () => {
    assert.equal((await patchPrefs({ theme: 'neon', font_size: 16 })).status, 400);
    assert.equal((await patchPrefs({ theme: 'dark', font_size: 17 })).status, 400);
    assert.equal((await patchPrefs({ theme: 'dark', font_size: 'abc' })).status, 400);
    assert.equal((await patchPrefs({})).status, 400);
});

test('PATCH preferences cần đăng nhập', async () => {
    const res = await call('/api/auth/customer/preferences', { method: 'PATCH', headers: json, body: JSON.stringify({ theme: 'dark' }) });
    assert.equal(res.status, 401);
});
