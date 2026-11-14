// Tài khoản nhân viên: đăng nhập, phân quyền theo vị trí, tạo/sửa đơn tại quầy, admin quản lý nhân viên.
// KHÔNG cần MySQL: file này thay kết nối DB bằng bản giả.
process.env.JWT_SECRET = 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let current = { id: 1, full_name: 'Admin', email: 'a@a.vn', role: 'admin', status: 1, staff_position: null };
const sqlLog = [];
const PASSWORD_HASH = bcrypt.hashSync('matkhau-tam-1', 4);
let loginRow = null;
let orderRow = { id: 1, status: 'confirmed', payment_status: 'pending', order_type: 'takeaway', table_code: null };

let missingColumn = false; // mô phỏng database chưa chạy migration 007
function answer(sql) {
    sqlLog.push(sql);
    if (missingColumn && /FROM users/.test(sql) && /staff_position/.test(sql)) {
        throw Object.assign(new Error("Unknown column 'staff_position'"), { code: 'ER_BAD_FIELD_ERROR' });
    }
    if (/FROM users WHERE id = \? AND role = 'staff'/.test(sql)) {
        return [[{ id: 55, full_name: 'Nhân viên A', email: 'a@moccoffee.local', phone: null, staff_position: 'waiter', status: 1 }]];
    }
    if (/FROM users[\s\S]*WHERE id = \?/.test(sql) && !/password_hash/.test(sql)) return [[current]];
    if (/SELECT password_hash FROM users/.test(sql)) return [[{ password_hash: PASSWORD_HASH }]];
    if (/SELECT id FROM users WHERE email/.test(sql)) return [[]];
    if (/FROM users WHERE email = \?/.test(sql) && /password_hash/.test(sql)) return [loginRow ? [loginRow] : []];
    if (/FROM users WHERE role = 'staff'|WHERE role = 'staff'/.test(sql)) return [[]];
    if (/INSERT INTO users/.test(sql)) return [{ insertId: 55 }];
    if (/AS item_count/.test(sql)) return [[{ id: 1, order_code: 'MC1', total_amount: '1', subtotal: '1', discount_amount: '0', service_fee: '0', order_type: 'takeaway', payment_method: 'cash', payment_status: 'pending', status: 'pending', item_count: '2' }]];
    if (/COUNT\(\*\) AS total FROM orders/.test(sql)) return [[{ total: 1 }]];
    if (/AS all_orders/.test(sql)) return [[{ all_orders: 1, today_orders: 1, today_revenue: 0 }]];
    if (/FROM products AS p/.test(sql)) return [[{ id: 1, name: 'Cà phê sữa đá', price: '29000.00', image: '/uploads/products/a.jpg' }]];
    if (/FROM coffee_tables[\s\S]*WHERE table_code/.test(sql)) return [[{ id: 1, status: 'available' }]];
    if (/FROM coffee_tables[\s\S]*WHERE id = \?/.test(sql)) return [[{ id: 1, table_code: 'T01', status: 'available' }]];
    if (/SELECT id, status, payment_status, order_type, table_code FROM orders/.test(sql)) return [[orderRow]];
    if (/FROM orders WHERE id = \? FOR UPDATE/.test(sql)) {
        return [[{ id: 1, order_code: 'MC1', order_type: 'takeaway', status: 'confirmed', payment_status: 'pending', coupon_code: null, discount_amount: 0, total_amount: 29000 }]];
    }
    if (/INSERT INTO orders/.test(sql)) return [{ insertId: 9 }];
    if (/UPDATE orders\s+SET payment_status/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) {
        return [[{ id: 1, order_code: 'MC1', status: 'confirmed', payment_status: 'paid', order_type: 'takeaway', payment_method: 'cash', total_amount: '29000' }]];
    }
    return [[]];
}
const fakeDb = {
    execute: async (sql) => answer(sql),
    query: async (sql) => answer(sql),
    getConnection: async () => ({
        beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
        execute: async (sql) => answer(sql),
        query: async (sql) => answer(sql),
    }),
    end: async () => {},
};
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');
const permissions = require('../middleware/permissions');
let server;
let baseUrl;

test.before(() => { server = app.listen(0); baseUrl = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

// Mỗi lần gọi dùng một id riêng: test đổi mật khẩu thu hồi mọi token của id đó nên không được dùng chung id
let nextId = 100;
function as(role, position) {
    current = { id: role === 'admin' ? 1 : nextId++, full_name: 'Người dùng', email: 'u@moccoffee.local', role, status: 1, staff_position: position || null };
    const token = jwt.sign({ id: current.id, jti: 'j' + Math.random() }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
async function call(method, path, headers, body) {
    const response = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => null) };
}
const ORDER_BODY = {
    order_type: 'takeaway',
    items: [{ product_id: 1, quantity: 2, size: 'M', sugar_level: '70%', ice_level: '70%', toppings: [] }],
};

// ---------- Bảng quyền ----------
test('permissions: bảng quyền theo vị trí đúng như thiết kế', () => {
    const waiter = { role: 'staff', staff_position: 'waiter' };
    const cashier = { role: 'staff', staff_position: 'cashier' };
    const kitchen = { role: 'staff', staff_position: 'kitchen' };
    // Thu ngân và bếp đều xem được bàn
    for (const user of [waiter, cashier, kitchen]) assert.equal(permissions.can(user, 'tables.view'), true);
    assert.equal(permissions.can(waiter, 'tables.update'), true);
    assert.equal(permissions.can(cashier, 'tables.update'), false);
    assert.equal(permissions.can(kitchen, 'tables.update'), false);
    // Bếp tạo và sửa được đơn
    assert.equal(permissions.can(kitchen, 'orders.create'), true);
    assert.equal(permissions.can(kitchen, 'orders.edit'), true);
    assert.equal(permissions.can(kitchen, 'orders.payment'), false);
    assert.equal(permissions.can(cashier, 'orders.payment'), true);
    assert.equal(permissions.can(kitchen, 'bookings.view'), false);
    assert.equal(permissions.can({ role: 'admin' }, 'orders.payment'), true);
    assert.equal(permissions.can({ role: 'customer' }, 'orders.view'), false);
    assert.equal(permissions.canSetOrderStatus(kitchen, 'preparing'), true);
    assert.equal(permissions.canSetOrderStatus(kitchen, 'cancelled'), false);
    assert.equal(permissions.canSetOrderStatus(waiter, 'preparing'), false);
});

// ---------- Đăng nhập ----------
test('nhân viên đăng nhập được bằng /api/auth/login và nhận staff_position', async () => {
    loginRow = { id: 7, email: 'a@moccoffee.local', full_name: 'Nhân viên A', password_hash: PASSWORD_HASH, role: 'staff', status: 1, staff_position: 'cashier' };
    const res = await call('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, { email: 'a@moccoffee.local', password: 'matkhau-tam-1' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'staff');
    assert.equal(res.body.data.user.staff_position, 'cashier');
});

test('nhân viên bị khóa hoặc khách hàng không đăng nhập được cổng quản trị', async () => {
    loginRow = { id: 7, email: 'a@moccoffee.local', full_name: 'A', password_hash: PASSWORD_HASH, role: 'staff', status: 0, staff_position: 'waiter' };
    let res = await call('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, { email: 'a@moccoffee.local', password: 'matkhau-tam-1' });
    assert.equal(res.status, 401);
    loginRow = { ...loginRow, role: 'customer', status: 1 };
    res = await call('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, { email: 'a@moccoffee.local', password: 'matkhau-tam-1' });
    assert.equal(res.status, 401);
});

// ---------- /api/staff/me ----------
test('GET /api/staff/me trả quyền theo vị trí; khách hàng bị chặn', async () => {
    const res = await call('GET', '/api/staff/me', as('staff', 'kitchen'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.position_text, 'Bếp');
    assert.ok(res.body.data.permissions.includes('orders.create'));
    assert.ok(!res.body.data.permissions.includes('orders.payment'));
    assert.deepEqual(res.body.data.order_statuses, ['confirmed', 'preparing', 'ready']);

    assert.equal((await call('GET', '/api/staff/me', as('customer'))).status, 403);
    assert.equal((await call('GET', '/api/staff/me', { 'Content-Type': 'application/json' })).status, 401);
});

// ---------- Bàn ----------
test('bàn: phục vụ đổi được trạng thái; thu ngân và bếp thì không', async () => {
    assert.equal((await call('PATCH', '/api/tables/1/status', as('staff', 'waiter'), { status: 'occupied' })).status, 200);
    assert.equal((await call('PATCH', '/api/tables/1/status', as('staff', 'cashier'), { status: 'occupied' })).status, 403);
    assert.equal((await call('PATCH', '/api/tables/1/status', as('staff', 'kitchen'), { status: 'occupied' })).status, 403);
    assert.equal((await call('PATCH', '/api/tables/1/status', as('admin'), { status: 'occupied' })).status, 200);
});

// ---------- Đặt bàn ----------
test('đặt bàn: phục vụ và thu ngân xem được, bếp không; chỉ phục vụ được duyệt', async () => {
    assert.equal((await call('GET', '/api/bookings', as('staff', 'waiter'))).status, 200);
    assert.equal((await call('GET', '/api/bookings', as('staff', 'cashier'))).status, 200);
    assert.equal((await call('GET', '/api/bookings', as('staff', 'kitchen'))).status, 403);
    assert.equal((await call('PATCH', '/api/bookings/1/status', as('staff', 'cashier'), { status: 'confirmed' })).status, 403);
});

// ---------- Đơn hàng ----------
test('đơn hàng: mọi nhân viên xem được; khách hàng bị chặn', async () => {
    for (const position of ['waiter', 'cashier', 'kitchen']) {
        assert.equal((await call('GET', '/api/orders', as('staff', position))).status, 200, position);
    }
    assert.equal((await call('GET', '/api/orders', as('customer'))).status, 403);
});

test('đơn hàng: bếp chuyển được sang đang làm/xong nhưng không được hủy; phục vụ không được chuyển sang đang làm', async () => {
    assert.equal((await call('PATCH', '/api/orders/1/status', as('staff', 'kitchen'), { status: 'preparing' })).status, 200);
    assert.equal((await call('PATCH', '/api/orders/1/status', as('staff', 'kitchen'), { status: 'cancelled' })).status, 403);
    assert.equal((await call('PATCH', '/api/orders/1/status', as('staff', 'waiter'), { status: 'preparing' })).status, 403);
    assert.equal((await call('PATCH', '/api/orders/1/status', as('staff', 'cashier'), { status: 'cancelled' })).status, 200);
});

test('đơn hàng: chỉ thu ngân (và admin) xác nhận thanh toán', async () => {
    assert.equal((await call('PATCH', '/api/orders/1/payment', as('staff', 'cashier'))).status, 200);
    assert.equal((await call('PATCH', '/api/orders/1/payment', as('staff', 'waiter'))).status, 403);
    assert.equal((await call('PATCH', '/api/orders/1/payment', as('staff', 'kitchen'))).status, 403);
    assert.equal((await call('PATCH', '/api/orders/1/payment', as('admin'))).status, 200);
});

test('hành động đổi trạng thái đơn được ghi vào nhật ký', async () => {
    sqlLog.length = 0;
    await call('PATCH', '/api/orders/1/status', as('staff', 'kitchen'), { status: 'preparing' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(sqlLog.some((sql) => /INSERT INTO staff_activity_logs/.test(sql)));
});

// ---------- Tạo / sửa đơn tại quầy ----------
test('tạo đơn tại quầy: bếp tạo được, đơn vào thẳng trạng thái confirmed', async () => {
    sqlLog.length = 0;
    const res = await call('POST', '/api/staff/orders', as('staff', 'kitchen'), ORDER_BODY);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'confirmed');
    assert.equal(res.body.data.total_amount, 58000); // 2 x 29.000, mang đi nên không có phí phục vụ
    assert.ok(sqlLog.some((sql) => /INSERT INTO orders/.test(sql) && /'staff'/.test(sql)));
});

test('tạo đơn tại bàn: tính phí phục vụ 5% và bắt buộc chọn bàn', async () => {
    const ok = await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, order_type: 'at_table', table_code: 't01' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.service_fee, 3000); // 5% của 58.000 = 2.900 làm tròn 3.000
    assert.equal(ok.body.data.total_amount, 61000);

    const noTable = await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, order_type: 'at_table' });
    assert.equal(noTable.status, 400);
});

test('tạo đơn tại quầy: dữ liệu sai bị từ chối, khách hàng bị chặn', async () => {
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, items: [] })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, customer_phone: '123' })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, items: [{ product_id: 1, quantity: 1, toppings: ['Kim cương'] }] })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('customer'), ORDER_BODY)).status, 403);
});

test('sửa đơn: nhân viên (cả bếp) sửa được món của đơn chưa thanh toán', async () => {
    const res = await call('PUT', '/api/staff/orders/1', as('staff', 'kitchen'), {
        items: [{ product_id: 1, quantity: 3, size: 'L', sugar_level: '50%', ice_level: '50%', toppings: ['Trân châu'] }],
    });
    assert.equal(res.status, 200);
    // (29.000 + 10.000 size L + 10.000 trân châu) x 3 = 147.000, mang đi
    assert.equal(res.body.data.total_amount, 147000);
    assert.equal((await call('PUT', '/api/staff/orders/abc', as('staff', 'kitchen'), { items: [] })).status, 400);
});

// ---------- Màn hình bếp ----------
test('màn hình bếp: nhân viên xem được, khách hàng thì không', async () => {
    assert.equal((await call('GET', '/api/staff/kitchen', as('staff', 'kitchen'))).status, 200);
    assert.equal((await call('GET', '/api/staff/kitchen', as('customer'))).status, 403);
});

// ---------- Đổi mật khẩu ----------
test('nhân viên tự đổi mật khẩu: sai mật khẩu hiện tại trả 400 (không phải 401)', async () => {
    const wrong = await call('POST', '/api/staff/change-password', as('staff', 'waiter'), {
        current_password: 'sai-mat-khau', new_password: 'matkhau-moi-2', confirm_password: 'matkhau-moi-2',
    });
    assert.equal(wrong.status, 400);
    const ok = await call('POST', '/api/staff/change-password', as('staff', 'waiter'), {
        current_password: 'matkhau-tam-1', new_password: 'matkhau-moi-2', confirm_password: 'matkhau-moi-2',
    });
    assert.equal(ok.status, 200);
});

// ---------- Admin quản lý nhân viên ----------
test('admin quản lý nhân viên: chỉ admin vào được', async () => {
    assert.equal((await call('GET', '/api/admin/staff', as('admin'))).status, 200);
    assert.equal((await call('GET', '/api/admin/staff', as('staff', 'cashier'))).status, 403);
    assert.equal((await call('GET', '/api/admin/staff', as('customer'))).status, 403);
    assert.equal((await call('GET', '/api/admin/staff/logs', as('staff', 'waiter'))).status, 403);
});

test('admin tạo nhân viên: kiểm tra dữ liệu và tạo thành công', async () => {
    const admin = as('admin');
    const good = { full_name: 'Nguyễn Văn A', email: 'nguyenvana@moccoffee.local', staff_position: 'waiter', password: 'matkhau-tam-1' };
    assert.equal((await call('POST', '/api/admin/staff', admin, { ...good, email: 'khong-phai-email' })).status, 400);
    assert.equal((await call('POST', '/api/admin/staff', admin, { ...good, staff_position: 'boss' })).status, 400);
    assert.equal((await call('POST', '/api/admin/staff', admin, { ...good, password: '123' })).status, 400);
    assert.equal((await call('POST', '/api/admin/staff', admin, { ...good, phone: '12345' })).status, 400);
    sqlLog.length = 0;
    const res = await call('POST', '/api/admin/staff', admin, good);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.staff_position, 'waiter');
    // Mật khẩu phải được băm, không lưu dạng chữ thường
    assert.ok(sqlLog.some((sql) => /INSERT INTO users/.test(sql) && /'staff'/.test(sql)));
});

test('admin khóa, mở khóa, đặt lại mật khẩu nhân viên', async () => {
    const admin = as('admin');
    assert.equal((await call('PATCH', '/api/admin/staff/55/status', admin, { status: 0 })).status, 200);
    assert.equal((await call('PATCH', '/api/admin/staff/55/status', admin, { status: 1 })).status, 200);
    assert.equal((await call('PATCH', '/api/admin/staff/55/status', admin, { status: 5 })).status, 400);
    assert.equal((await call('POST', '/api/admin/staff/55/reset-password', admin, { password: 'ngan' })).status, 400);
    assert.equal((await call('POST', '/api/admin/staff/55/reset-password', admin, { password: 'matkhau-tam-9' })).status, 200);
    assert.equal((await call('PATCH', '/api/admin/staff/55', admin, { staff_position: 'cashier' })).status, 200);
    assert.equal((await call('PATCH', '/api/admin/staff/55', admin, { staff_position: 'boss' })).status, 400);
});

// ---------- Trang tĩnh ----------
test('các trang /staff được phục vụ và các trang admin có menu nhân viên', async () => {
    for (const page of ['index', 'orders', 'new-order', 'kitchen', 'bookings']) {
        const response = await fetch(`${baseUrl}/staff/${page}.html`);
        assert.equal(response.status, 200, page);
    }
    const staffAdmin = await fetch(`${baseUrl}/admin/staff.html`);
    assert.equal(staffAdmin.status, 200);
    const dashboard = await (await fetch(`${baseUrl}/admin/dashboard.html`)).text();
    assert.match(dashboard, /href="staff\.html"/);
});

// ---------- Database chưa chạy migration 007 ----------
test('database chưa có cột staff_position: khách/admin vẫn xác thực và admin vẫn đăng nhập được', async () => {
    missingColumn = true;
    try {
        assert.equal((await call('GET', '/api/admin/me', as('admin'))).status, 200);
        assert.equal((await call('GET', '/api/customer/orders', as('customer'))).status, 200);
        loginRow = { id: 1, email: 'a@a.vn', full_name: 'Admin', password_hash: PASSWORD_HASH, role: 'admin', status: 1 };
        const login = await call('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, { email: 'a@a.vn', password: 'matkhau-tam-1' });
        assert.equal(login.status, 200);
    } finally {
        missingColumn = false;
    }
});

test('trang tạo đơn nhân viên tìm ảnh món theo cùng quy tắc với trang khách', async () => {
    const js = await (await fetch(`${baseUrl}/assets/js/staff-pos.js`)).text();
    assert.match(js, /\.\.\/assets\/images\/products\//);
});
