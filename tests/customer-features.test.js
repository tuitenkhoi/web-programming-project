process.env.JWT_SECRET = 'customer-feature-test-secret-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hash = bcrypt.hashSync('Customer@123', 4);
const customer = { id: 21, full_name: 'Khách Mộc', email: 'khach@moc.vn', phone: '0901234567', password_hash: hash, role: 'customer', status: 1 };

async function execute(sql) {
    const text = String(sql);
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
        body: JSON.stringify({ full_name: 'Khách Mộc', email: 'new@moc.vn', phone: '0909876543', password: 'Customer@123' }),
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
