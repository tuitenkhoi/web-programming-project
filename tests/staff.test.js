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
let moveTables = [];
let moveOrders = [];
let productExists = true;
let soldOutHit = null;
function answer(sql) {
    sqlLog.push(sql);
    if (/FROM coffee_tables WHERE table_code IN/.test(sql)) return [moveTables];
    if (/FROM orders[\s\S]*AND order_type = 'at_table'/.test(sql)) return [moveOrders];
    if (/FROM product_sold_out AS s/.test(sql)) return [soldOutHit ? [soldOutHit] : []];
    if (/INSERT INTO product_sold_out|DELETE FROM product_sold_out/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT id, name FROM products WHERE id = \? AND status = 1/.test(sql)) return [productExists ? [{ id: 1, name: 'Cà phê sữa đá' }] : []];
    if (missingColumn && /FROM users/.test(sql) && /staff_position/.test(sql)) {
        throw Object.assign(new Error("Unknown column 'staff_position'"), { code: 'ER_BAD_FIELD_ERROR' });
    }
    if (/FROM users WHERE id = \? AND role = 'staff'/.test(sql)) {
        return [[{ id: 55, full_name: 'Nhân viên A', email: 'a@moccoffee.local', phone: null, staff_position: 'waiter', status: 1 }]];
    }
    if (/FROM users[\s\S]*WHERE id = \?/.test(sql) && !/password_hash/.test(sql)) return [[current]];
    if (/SELECT password_hash FROM users/.test(sql)) return [[{ password_hash: PASSWORD_HASH }]];
    if (/SELECT id, full_name, role FROM users WHERE email/.test(sql)) return [dupEmail ? [{ id: 3, full_name: 'Dương Đình Đức', role: 'staff' }] : []];
    if (/SELECT id, full_name, role FROM users WHERE phone/.test(sql)) return [dupPhone ? [{ id: 4, full_name: 'Trần Thị B', role: 'customer' }] : []];
    if (/SELECT id FROM users WHERE email/.test(sql)) return [[]];
    if (/FROM users WHERE email = \?/.test(sql) && /password_hash/.test(sql)) return [loginRow ? [loginRow] : []];
    if (/FROM users WHERE role = 'staff'|WHERE role = 'staff'/.test(sql)) return [[]];
    if (/INSERT INTO users/.test(sql)) return [{ insertId: 55 }];
    if (/AS item_count/.test(sql)) return [[{ id: 1, order_code: 'MC1', total_amount: '1', subtotal: '1', discount_amount: '0', service_fee: '0', order_type: 'takeaway', payment_method: 'cash', payment_status: 'pending', status: 'pending', item_count: '2' }]];
    if (/COUNT\(\*\) AS total FROM orders/.test(sql)) return [[{ total: 1 }]];
    if (/AS all_orders/.test(sql)) return [[{ all_orders: 1, today_orders: 1, today_revenue: 0 }]];
    if (/FROM products AS p/.test(sql)) return [[{ id: 1, name: 'Cà phê sữa đá', price: '29000.00', image: '/uploads/products/a.jpg' }]];
    // Topping đang bán (bảng toppings do admin quản lý): chỉ có Trân châu 10.000đ
    if (/FROM toppings/.test(sql)) return [[{ name: 'Trân châu', price: '10000' }]];
    if (/FROM coffee_tables[\s\S]*WHERE table_code/.test(sql)) return [[{ id: 1, status: tableStatus }]];
    if (/FROM coffee_tables[\s\S]*WHERE id = \?/.test(sql)) return [[{ id: 1, table_code: 'T01', status: tableStatus }]];
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
let tableStatus = 'available';
let dupEmail = false;
let dupPhone = false;
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
    // Cả ba vị trí đều xem được bàn; bếp không đổi được
    for (const user of [waiter, cashier, kitchen]) assert.equal(permissions.can(user, 'tables.view'), true);
    assert.equal(permissions.can(waiter, 'tables.update'), true);
    assert.equal(permissions.can(cashier, 'tables.update'), true);
    assert.equal(permissions.can(kitchen, 'tables.update'), false);
    assert.equal(permissions.can(cashier, 'tables.bill'), true);
    assert.equal(permissions.can(waiter, 'tables.bill'), false);
    // Bếp không tạo/sửa đơn
    assert.equal(permissions.can(kitchen, 'orders.create'), false);
    assert.equal(permissions.can(kitchen, 'orders.edit'), false);
    assert.equal(permissions.can(waiter, 'orders.create'), true);
    assert.equal(permissions.can(cashier, 'orders.create'), true);
    // Chuyển trạng thái bàn theo vị trí
    assert.equal(permissions.canTableTransition(waiter, 'available', 'occupied'), true);
    assert.equal(permissions.canTableTransition(waiter, 'available', 'maintenance'), true);
    assert.equal(permissions.canTableTransition(waiter, 'occupied', 'available'), false);
    assert.equal(permissions.canTableTransition(cashier, 'available', 'occupied'), false);
    assert.equal(permissions.canTableTransition(cashier, 'available', 'maintenance'), true);
    assert.equal(permissions.canTableTransition(kitchen, 'available', 'maintenance'), false);
    assert.equal(permissions.mustReceiveGuestsFirst(waiter), true);
    assert.equal(permissions.mustReceiveGuestsFirst(cashier), false);
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
    assert.ok(!res.body.data.permissions.includes('orders.create'));
    assert.deepEqual(res.body.data.table_transitions, {});
    assert.ok(!res.body.data.permissions.includes('orders.payment'));
    assert.deepEqual(res.body.data.order_statuses, ['confirmed', 'preparing', 'ready']);

    assert.equal((await call('GET', '/api/staff/me', as('customer'))).status, 403);
    assert.equal((await call('GET', '/api/staff/me', { 'Content-Type': 'application/json' })).status, 401);
});

// ---------- Bàn ----------
test('bàn: phục vụ chỉ nhận khách/bảo trì; thu ngân chỉ bảo trì; bếp không đổi được', async () => {
    const patch = (who, status) => call('PATCH', '/api/tables/1/status', who, { status });
    tableStatus = 'available';
    assert.equal((await patch(as('staff', 'waiter'), 'occupied')).status, 200);
    assert.equal((await patch(as('staff', 'waiter'), 'maintenance')).status, 200);
    assert.equal((await patch(as('staff', 'cashier'), 'maintenance')).status, 200);
    assert.equal((await patch(as('staff', 'cashier'), 'occupied')).status, 403);
    assert.equal((await patch(as('staff', 'kitchen'), 'maintenance')).status, 403);
    assert.equal((await patch(as('admin'), 'occupied')).status, 200);
    tableStatus = 'occupied';
    assert.equal((await patch(as('staff', 'waiter'), 'available')).status, 403);
    tableStatus = 'maintenance';
    assert.equal((await patch(as('staff', 'waiter'), 'available')).status, 200);
    assert.equal((await patch(as('staff', 'cashier'), 'available')).status, 200);
    tableStatus = 'available';
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
test('tạo đơn: bếp bị chặn; phục vụ tạo đơn mang đi; thu ngân tạo được', async () => {
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'kitchen'), ORDER_BODY)).status, 403);
    sqlLog.length = 0;
    const res = await call('POST', '/api/staff/orders', as('staff', 'waiter'), ORDER_BODY);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'confirmed');
    assert.equal(res.body.data.total_amount, 58000); // 2 x 29.000, mang đi nên không có phí phục vụ
    assert.ok(sqlLog.some((sql) => /INSERT INTO orders/.test(sql) && /'staff'/.test(sql)));
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'cashier'), ORDER_BODY)).status, 201);
});

test('tạo đơn tại bàn: phục vụ phải nhận khách trước; tính phí phục vụ 5%', async () => {
    const body = { ...ORDER_BODY, order_type: 'at_table', table_code: 't01' };
    tableStatus = 'available';
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), body)).status, 409);
    tableStatus = 'occupied';
    const ok = await call('POST', '/api/staff/orders', as('staff', 'waiter'), body);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.service_fee, 3000); // 5% của 58.000 = 2.900 làm tròn 3.000
    assert.equal(ok.body.data.total_amount, 61000);
    const noTable = await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, order_type: 'at_table' });
    assert.equal(noTable.status, 400);
    tableStatus = 'available';
});

test('tạo đơn tại quầy: dữ liệu sai bị từ chối, khách hàng bị chặn', async () => {
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, items: [] })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, customer_phone: '123' })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), { ...ORDER_BODY, items: [{ product_id: 1, quantity: 1, toppings: ['Kim cương'] }] })).status, 400);
    assert.equal((await call('POST', '/api/staff/orders', as('customer'), ORDER_BODY)).status, 403);
});

test('sửa đơn: bếp bị chặn; thu ngân sửa được món của đơn chưa thanh toán', async () => {
    assert.equal((await call('PUT', '/api/staff/orders/1', as('staff', 'kitchen'), { items: [] })).status, 403);
    const res = await call('PUT', '/api/staff/orders/1', as('staff', 'cashier'), {
        items: [{ product_id: 1, quantity: 3, size: 'L', sugar_level: '50%', ice_level: '50%', toppings: ['Trân châu'] }],
    });
    assert.equal(res.status, 200);
    // (29.000 + 10.000 size L + 10.000 trân châu) x 3 = 147.000, mang đi
    assert.equal(res.body.data.total_amount, 147000);
    assert.equal((await call('PUT', '/api/staff/orders/abc', as('staff', 'cashier'), { items: [] })).status, 400);
});

test('tùy chọn tạo đơn: danh sách topping lấy từ bảng toppings (đang bán)', async () => {
    const res = await call('GET', '/api/staff/order-options', as('staff', 'waiter'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.toppings, [{ name: 'Trân châu', price: 10000 }]);
    assert.deepEqual(res.body.data.sizes.map((size) => size.code), ['S', 'M', 'L']);
    assert.equal((await call('GET', '/api/staff/order-options', as('customer'))).status, 403);
});

test('tạo đơn tại quầy: topping đã tắt/không còn bán bị từ chối kèm thông báo rõ', async () => {
    const res = await call('POST', '/api/staff/orders', as('staff', 'waiter'), {
        ...ORDER_BODY,
        items: [{ product_id: 1, quantity: 1, toppings: ['Kem cheese'] }], // DB giả chỉ bán Trân châu
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Topping "Kem cheese" không còn được bán/);
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

test('admin tạo nhân viên: báo rõ email hoặc SĐT đã thuộc tài khoản nào', async () => {
    const good = { full_name: 'Đình Đức', email: 'dinhduc@moccoffee.local', phone: '0123456789', staff_position: 'cashier', password: 'matkhau-tam-1' };
    dupEmail = true;
    const e = await call('POST', '/api/admin/staff', as('admin'), good);
    dupEmail = false;
    assert.equal(e.status, 409);
    assert.match(e.body.message, /Dương Đình Đức/);
    dupPhone = true;
    const p = await call('POST', '/api/admin/staff', as('admin'), good);
    dupPhone = false;
    assert.equal(p.status, 409);
    assert.match(p.body.message, /Trần Thị B/);
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

test('trang tạo đơn nhân viên: có QR chuyển khoản dùng chung bộ tạo VietQR có sẵn số tiền', () => {
    const fs = require('node:fs');
    const html = fs.readFileSync('staff/new-order.html', 'utf8');
    assert.match(html, /id="pos-qr"/);
    assert.ok(html.indexOf('vendor/qrcode.js') < html.indexOf('payment-qr.js') && html.indexOf('payment-qr.js') < html.indexOf('staff-pos.js'));
    const { buildPayload } = require('../assets/js/payment-qr.js');
    const payload = buildPayload(61000, 'MC123');
    assert.ok(payload.includes('540561000'), 'số tiền nằm trong mã QR');
    assert.ok(payload.includes('MC123'));
});

test('thu ngân xem được dashboard/doanh thu; phục vụ và bếp thì không', async () => {
    assert.equal(permissions.can({ role: 'staff', staff_position: 'cashier' }, 'revenue.view'), true);
    assert.equal(permissions.can({ role: 'staff', staff_position: 'waiter' }, 'revenue.view'), false);
    assert.equal(permissions.can({ role: 'staff', staff_position: 'kitchen' }, 'revenue.view'), false);
    assert.equal((await call('GET', '/api/dashboard/stats?period=7-days', as('staff', 'waiter'))).status, 403);
    assert.equal((await call('GET', '/api/dashboard/stats?period=7-days', as('staff', 'kitchen'))).status, 403);
    assert.equal((await call('GET', '/api/dashboard/stats?period=7-days', as('customer'))).status, 403);
    assert.equal((await call('GET', '/api/dashboard/stats?period=bad', as('staff', 'cashier'))).status, 400);
    const me = await call('GET', '/api/staff/me', as('staff', 'cashier'));
    assert.ok(me.body.data.permissions.includes('revenue.view'));
});

test('QR theo bàn: trang khách nạp table-context.js, giỏ hàng tự chọn bàn đã quét, admin in được mã QR', () => {
    const fs = require('node:fs');
    for (const f of ['pages/menu.html', 'pages/cart.html', 'pages/product-detail.html', 'index.html']) {
        assert.ok(fs.readFileSync(f, 'utf8').includes('table-context.js'), f);
    }
    assert.match(fs.readFileSync('assets/js/cart.js', 'utf8'), /MocTable\?\.get/);
    const tables = fs.readFileSync('admin/tables.html', 'utf8');
    assert.ok(tables.includes('print-table-qr-button') && tables.includes('admin-table-qr.js'));
    assert.ok(fs.readFileSync('assets/js/admin-table-qr.js', 'utf8').includes('/pages/menu.html?table='));
});

test('điện thoại: trang menu/chi tiết/trang chủ có thanh giỏ hàng cố định; trang giỏ có nút thanh toán dính đáy', () => {
    const fs = require('node:fs');
    for (const f of ['pages/menu.html', 'pages/product-detail.html', 'index.html']) {
        assert.ok(fs.readFileSync(f, 'utf8').includes('cart-bar.js'), f);
    }
    assert.ok(fs.readFileSync('pages/cart.html', 'utf8').includes('cart-pay-bar.js'));
    assert.match(fs.readFileSync('assets/js/cart-bar.js', 'utf8'), /cart\.html/);
});


// ---------- Hết món theo ngày ----------
test('hết món: ai trong nhân viên cũng đánh dấu được; khách bị chặn; dữ liệu sai bị từ chối', async () => {
    productExists = true;
    for (const position of ['waiter', 'cashier', 'kitchen']) {
        const res = await call('PUT', '/api/staff/products/1/sold-out', as('staff', position), { sold_out: true });
        assert.equal(res.status, 200, position);
        assert.match(res.body.message, /hết trong hôm nay/);
    }
    assert.equal((await call('PUT', '/api/staff/products/1/sold-out', as('staff', 'waiter'), { sold_out: false })).status, 200);
    assert.equal((await call('PUT', '/api/staff/products/1/sold-out', as('customer'), { sold_out: true })).status, 403);
    assert.equal((await call('PUT', '/api/staff/products/1/sold-out', as('staff', 'waiter'), { sold_out: 'yes' })).status, 400);
    assert.equal((await call('PUT', '/api/staff/products/abc/sold-out', as('staff', 'waiter'), { sold_out: true })).status, 400);
    productExists = false;
    assert.equal((await call('PUT', '/api/staff/products/1/sold-out', as('staff', 'waiter'), { sold_out: true })).status, 404);
    productExists = true;
    assert.ok(sqlLog.some((sql) => /INSERT INTO product_sold_out/.test(sql)));
    assert.ok(sqlLog.some((sql) => /DELETE FROM product_sold_out/.test(sql)));
});

test('hết món: món đang hết không đặt được (nhân viên lẫn khách), ngày tính theo giờ Việt Nam', async () => {
    const { todayVn } = require('../backend/src/services/sold-out');
    assert.equal(todayVn(Date.UTC(2026, 10, 15, 18, 0)), '2026-11-16'); // 18:00 UTC = 01:00 ngày hôm sau ở Việt Nam
    assert.equal(todayVn(Date.UTC(2026, 10, 15, 10, 0)), '2026-11-15');

    soldOutHit = { product_id: 1, name: 'Cà phê sữa đá' };
    const staff = await call('POST', '/api/staff/orders', as('staff', 'waiter'), ORDER_BODY);
    assert.equal(staff.status, 400);
    assert.match(staff.body.message, /Cà phê sữa đá.*hết/);
    const guest = await call('POST', '/api/orders', { 'Content-Type': 'application/json' }, {
        ...ORDER_BODY, customer_name: 'Khách', customer_phone: '0901234567', payment_method: 'cash',
    });
    assert.equal(guest.status, 400);
    assert.match(guest.body.message, /hết/);
    soldOutHit = null;
    assert.equal((await call('POST', '/api/staff/orders', as('staff', 'waiter'), ORDER_BODY)).status, 201);
});

// ---------- Chuyển / gộp / tách bàn ----------
test('chuyển / gộp / tách bàn: đúng chế độ theo bàn đích và số đơn chọn', async () => {
    const move = (who, body) => call('POST', '/api/staff/tables/move', who, body);
    moveOrders = [{ id: 1 }, { id: 2 }];

    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }, { id: 2, table_code: 'T02', status: 'available' }];
    let res = await move(as('staff', 'waiter'), { from: 'T01', to: 'T02' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.mode, 'move');
    assert.equal(res.body.data.moved_orders, 2);

    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }, { id: 2, table_code: 'T02', status: 'occupied' }];
    res = await move(as('staff', 'cashier'), { from: 'T01', to: 'T02' });
    assert.equal(res.body.data.mode, 'merge');

    res = await move(as('staff', 'waiter'), { from: 'T01', to: 'T02', order_ids: [2] });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.mode, 'split');
    assert.equal(res.body.data.moved_orders, 1);

    // Bàn chưa có đơn: chỉ chuyển khách
    moveOrders = [];
    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }, { id: 2, table_code: 'T02', status: 'available' }];
    res = await move(as('admin'), { from: 'T01', to: 'T02' });
    assert.equal(res.body.data.mode, 'move');
    assert.equal(res.body.data.moved_orders, 0);
});

test('chuyển / gộp / tách bàn: từ chối đầu vào sai, bàn không hợp lệ và người không có quyền', async () => {
    const move = (who, body) => call('POST', '/api/staff/tables/move', who, body);
    moveOrders = [{ id: 1 }, { id: 2 }];
    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }, { id: 2, table_code: 'T02', status: 'available' }];

    assert.equal((await move(as('staff', 'kitchen'), { from: 'T01', to: 'T02' })).status, 403);
    assert.equal((await move(as('customer'), { from: 'T01', to: 'T02' })).status, 403);
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T01' })).status, 400);
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01' })).status, 400);
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T02', order_ids: [] })).status, 400);
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T02', order_ids: ['x'] })).status, 400);
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T02', order_ids: [99] })).status, 400); // đơn không thuộc bàn

    moveTables = [{ id: 1, table_code: 'T01', status: 'available' }, { id: 2, table_code: 'T02', status: 'available' }];
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T02' })).status, 409); // bàn nguồn không có khách
    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }, { id: 2, table_code: 'T02', status: 'maintenance' }];
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T02' })).status, 409); // bàn đích bảo trì
    moveTables = [{ id: 1, table_code: 'T01', status: 'occupied' }];
    assert.equal((await move(as('staff', 'waiter'), { from: 'T01', to: 'T09' })).status, 404);
});

test('bếp bấm "Xong món": báo riêng cho phục vụ và admin (order:ready)', async () => {
    const realtime = require('../realtime');
    const calls = [];
    const original = realtime.emitToPositions;
    realtime.emitToPositions = (positions, event, payload) => calls.push({ positions, event, payload });
    orderRow = { id: 1, status: 'preparing', payment_status: 'pending', order_type: 'at_table', table_code: 'T05' };
    try {
        const res = await call('PATCH', '/api/orders/1/status', as('staff', 'kitchen'), { status: 'ready' });
        assert.equal(res.status, 200);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].positions, ['waiter', 'admin']);
        assert.equal(calls[0].event, 'order:ready');
        assert.equal(calls[0].payload.table_code, 'T05');
    } finally {
        realtime.emitToPositions = original;
        orderRow = { id: 1, status: 'confirmed', payment_status: 'pending', order_type: 'takeaway', table_code: null };
    }
});

test('giao diện: trang Hết món, hộp chuyển/tách bàn và khách thấy "Hết hôm nay"', () => {
    const fs = require('node:fs');
    assert.ok(fs.readFileSync('staff/menu.html', 'utf8').includes('staff-menu.js'));
    assert.ok(fs.readFileSync('assets/js/staff.js', 'utf8').includes("'products.soldout'"));
    assert.match(fs.readFileSync('assets/js/staff-tables.js', 'utf8'), /\/api\/staff\/tables\/move/);
    assert.match(fs.readFileSync('assets/js/menu.js', 'utf8'), /soldOut/);
    assert.match(fs.readFileSync('assets/js/client-api.js', 'utf8'), /soldOut: Boolean\(product\.sold_out\)/);
});

test('admin thêm bàn: chỉ admin, kiểm tra dữ liệu, trùng mã báo 409', async () => {
    const body = { table_code: 't09', table_name: 'Bàn T09', area: 'Tầng trệt', capacity: 4 };
    assert.equal((await call('POST', '/api/tables', as('staff', 'waiter'), body)).status, 403);

    const ok = await call('POST', '/api/tables', as('admin'), body);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.table_code, 'T09');
    assert.equal(ok.body.data.status, 'available');

    assert.equal((await call('POST', '/api/tables', as('admin'), { ...body, table_code: 'bad code!' })).status, 400);
    assert.equal((await call('POST', '/api/tables', as('admin'), { ...body, table_name: '' })).status, 400);
    assert.equal((await call('POST', '/api/tables', as('admin'), { ...body, capacity: 0 })).status, 400);
    assert.equal((await call('POST', '/api/tables', as('admin'), { ...body, capacity: 21 })).status, 400);
});

test('giao diện admin: nút Thêm bàn không bị gỡ và gọi POST /api/tables', () => {
    const fs = require('node:fs');
    const js = fs.readFileSync('assets/js/admin-tables.js', 'utf8');
    assert.ok(!/addBtn\.remove\(\)/.test(js));
    assert.match(js, /\/api\/tables'/);
    assert.match(fs.readFileSync('admin/tables.html', 'utf8'), /id="open-add-table-button"/);
});

test('giao diện: chạm vào bàn có khách mở danh sách đơn của bàn', () => {
    const fs = require('node:fs');
    const js = fs.readFileSync('assets/js/staff-tables.js', 'utf8');
    assert.match(js, /is-clickable/);
    assert.match(js, /openTableOrders/);
    assert.match(js, /\/api\/orders\/' \+ encodeURIComponent\(o\.id\)/);
    assert.match(fs.readFileSync('assets/css/staff.css', 'utf8'), /\.table-tile\.is-clickable/);
});
