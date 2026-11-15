// Kiểm tra API topping, tính giá topping khi đặt hàng và xuất hóa đơn (Excel / CSV / JSON).
// KHÔNG cần MySQL: thay kết nối DB bằng bản giả (cùng cách với smoke.test.js).
process.env.JWT_SECRET = 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const jwt = require('jsonwebtoken');

// ----- DB giả: dữ liệu trả về thay đổi theo `state` của từng test -----
const calls = [];
const state = {};
const resetState = () => {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, {
        role: 'admin',
        toppings: [],           // dòng trả về cho SELECT ... FROM toppings
        orders: [],             // dòng trả về cho SELECT o.* FROM orders o
        items: [],              // dòng trả về cho SELECT ... FROM order_items
        existingTopping: false, // true: truy vấn kiểm tra trùng tên topping tìm thấy
        updatedRows: 1,         // affectedRows của UPDATE / DELETE
    });
};
resetState();

function answer(sql, params) {
    if (/FROM users/.test(sql)) return [[{ id: 1, full_name: 'Admin', email: 'a@a.vn', role: state.role, status: 1 }]];
    if (/COALESCE\(MAX\(sort_order\)/.test(sql)) return [[{ next_order: 13 }]];
    if (/SELECT id FROM toppings WHERE name = \? AND id <> \?/.test(sql)) return [state.existingTopping ? [{ id: 99 }] : []];
    if (/SELECT id FROM toppings WHERE name = \?/.test(sql)) return [state.existingTopping ? [{ id: 99 }] : []];
    if (/SELECT id FROM toppings WHERE id = \?/.test(sql)) return [state.updatedRows ? [{ id: 5 }] : []];
    if (/INSERT INTO toppings/.test(sql)) return [{ insertId: 21 }];
    if (/UPDATE toppings|DELETE FROM toppings/.test(sql)) return [{ affectedRows: state.updatedRows }];
    if (/FROM toppings/.test(sql)) return [state.toppings];
    if (/FROM orders o/.test(sql)) return [state.orders];
    if (/FROM order_items/.test(sql)) return [state.items];
    if (/FROM coffee_tables[\s\S]*WHERE table_code/.test(sql)) return [[{ id: 1, status: 'available' }]];
    if (/FROM products AS p/.test(sql)) return [[{ id: 1, name: 'Cà phê sữa đá', price: '29000.00', image: '/uploads/products/a.jpg' }]];
    if (/INSERT INTO orders/.test(sql)) return [{ insertId: 7 }];
    if (/INSERT INTO order_items/.test(sql)) return [{ affectedRows: 1 }];
    return [[]];
}
const record = (kind) => async (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ');
    calls.push({ kind, sql: text, params });
    return answer(text, params);
};
const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    execute: record('conn.execute'), query: record('conn.query'),
};
const fakeDb = { execute: record('execute'), query: record('query'), getConnection: async () => connection, end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');
const AUTH = { Authorization: 'Bearer ' + jwt.sign({ id: 1 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }) };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let server;
let base;
test.before(() => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => server.close());
test.beforeEach(() => { resetState(); calls.length = 0; });

const send = async (method, url, body, headers = AUTH) => {
    const res = await fetch(base + url, {
        method,
        headers: { ...JSON_HEADERS, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
};
const lastSql = (pattern) => calls.filter((c) => pattern.test(c.sql)).pop();

// Giải nén file .xlsx (ZIP): đọc các mục trong "central directory", giải nén deflate
function unzip(buffer) {
    const files = {};
    const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buffer.readUInt16LE(end + 10);
    let pos = buffer.readUInt32LE(end + 16);
    for (let i = 0; i < count; i += 1) {
        const method = buffer.readUInt16LE(pos + 10);
        const compressed = buffer.readUInt32LE(pos + 20);
        const nameLength = buffer.readUInt16LE(pos + 28);
        const extraLength = buffer.readUInt16LE(pos + 30);
        const commentLength = buffer.readUInt16LE(pos + 32);
        const localOffset = buffer.readUInt32LE(pos + 42);
        const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
        const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(dataStart, dataStart + compressed);
        files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
        pos += 46 + nameLength + extraLength + commentLength;
    }
    return files;
}

const order = (overrides = {}) => ({
    id: 12, order_code: 'MC202611140001', created_at: '2026-11-14T03:30:00.000Z',
    customer_name: 'Nguyễn Văn A', customer_phone: '0901234567', order_type: 'takeaway', table_code: null,
    payment_method: 'cash', payment_status: 'paid', status: 'completed', coupon_code: null,
    subtotal: '100000', discount_amount: '10000', service_fee: '0', total_amount: '90000', note: null,
    ...overrides,
});
const item = (overrides = {}) => ({
    order_id: 12, product_name: 'Cà phê sữa đá', size: 'L', sugar_level: '70%', ice_level: '50%',
    toppings: JSON.stringify(['Trân châu', 'Kem sữa']), quantity: 2, unit_price: '45000', line_total: '90000', note: null,
    ...overrides,
});

// ================= API topping =================
test('GET /api/toppings: ai cũng xem được, chỉ lấy topping đang bán', async () => {
    state.toppings = [{ id: 1, name: 'Trân châu', price: 10000, is_active: 1, sort_order: 1 }];
    const res = await send('GET', '/api/toppings', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, [{ id: 1, name: 'Trân châu', price: 10000, is_active: true, sort_order: 1 }]);
    assert.match(lastSql(/FROM toppings/).sql, /WHERE is_active = 1/);
});

test('GET /api/toppings/admin: cần đăng nhập admin và trả cả topping đang tắt', async () => {
    assert.equal((await send('GET', '/api/toppings/admin', undefined, {})).status, 401);
    state.role = 'customer';
    assert.equal((await send('GET', '/api/toppings/admin')).status, 403);
    state.role = 'admin';
    state.toppings = [{ id: 2, name: 'Kem sữa', price: 12000, is_active: 0, sort_order: 2 }];
    const res = await send('GET', '/api/toppings/admin');
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].is_active, false);
    assert.doesNotMatch(lastSql(/FROM toppings/).sql, /is_active = 1/);
});

test('POST /api/toppings: thêm topping mới (xếp cuối danh sách)', async () => {
    const res = await send('POST', '/api/toppings', { name: '  Hạt   é ', price: '5000' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, 'Hạt é'); // gọn khoảng trắng thừa
    assert.equal(res.body.data.sort_order, 13);
    assert.deepEqual(lastSql(/INSERT INTO toppings/).params, ['Hạt é', 5000, 1, 13]);
});

test('POST /api/toppings: từ chối dữ liệu sai và tên trùng', async () => {
    for (const body of [
        { name: '', price: 1000 }, { name: 'x'.repeat(51), price: 1000 }, { price: 1000 },
        { name: 'A', price: -1 }, { name: 'A', price: 1.5 }, { name: 'A', price: 'abc' }, { name: 'A', price: '' },
        { name: 'A', price: 2000000 }, { name: 'A', price: 1000, is_active: 'x; DROP TABLE toppings' },
    ]) {
        assert.equal((await send('POST', '/api/toppings', body)).status, 400, JSON.stringify(body));
    }
    assert.equal(calls.some((c) => /INSERT INTO toppings/.test(c.sql)), false);

    state.existingTopping = true;
    const dup = await send('POST', '/api/toppings', { name: 'Trân châu', price: 1000 });
    assert.equal(dup.status, 409);
    assert.equal((await send('POST', '/api/toppings', { name: 'A', price: 1 }, {})).status, 401);
});

test('PATCH /api/toppings/:id: sửa giá, tên, bật/tắt bán', async () => {
    const price = await send('PATCH', '/api/toppings/5', { price: 11000 });
    assert.equal(price.status, 200);
    assert.deepEqual(lastSql(/UPDATE toppings/).params, [11000, 5]);

    const off = await send('PATCH', '/api/toppings/5', { is_active: false });
    assert.equal(off.status, 200);
    assert.deepEqual(lastSql(/UPDATE toppings/).params, [0, 5]);
    assert.match(lastSql(/UPDATE toppings/).sql, /SET is_active = \? WHERE id = \?/);
});

test('PATCH /api/toppings/:id: id sai, không có gì để sửa, không tìm thấy, tên trùng', async () => {
    assert.equal((await send('PATCH', '/api/toppings/abc', { price: 1 })).status, 400);
    assert.equal((await send('PATCH', '/api/toppings/5', {})).status, 400);
    state.updatedRows = 0;
    assert.equal((await send('PATCH', '/api/toppings/5', { price: 1 })).status, 404);
    state.updatedRows = 1;
    state.existingTopping = true;
    assert.equal((await send('PATCH', '/api/toppings/5', { name: 'Kem sữa' })).status, 409);
});

test('DELETE /api/toppings/:id', async () => {
    assert.equal((await send('DELETE', '/api/toppings/5')).status, 200);
    assert.deepEqual(lastSql(/DELETE FROM toppings/).params, [5]);
    state.updatedRows = 0;
    assert.equal((await send('DELETE', '/api/toppings/5')).status, 404);
    assert.equal((await send('DELETE', '/api/toppings/0')).status, 400);
    assert.equal((await send('DELETE', '/api/toppings/5', undefined, {})).status, 401);
});

// ================= Đặt hàng: giá topping lấy từ DB =================
const placeOrder = (toppings) => send('POST', '/api/orders', {
    customer_name: 'Khach Test', customer_phone: '0901234567', order_type: 'takeaway', payment_method: 'cash',
    items: [{ product_id: 1, quantity: 2, size: 'L', toppings }],
}, {});

test('Đặt hàng: đơn giá = giá món + size L + giá topping lấy từ bảng toppings', async () => {
    state.toppings = [{ name: 'Trân châu', price: '11000' }, { name: 'Kem sữa', price: '12000' }];
    const res = await placeOrder(['Trân châu', 'Kem sữa']);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items[0].unit_price, 29000 + 10000 + 11000 + 12000);
    assert.equal(res.body.data.total_amount, (29000 + 10000 + 11000 + 12000) * 2);
    assert.match(lastSql(/FROM toppings/).sql, /is_active = 1 AND name IN \(\?, \?\)/);
});

test('Đặt hàng: topping đã tắt / không tồn tại bị từ chối kèm thông báo rõ', async () => {
    state.toppings = []; // DB không có topping nào đang bán khớp tên
    const res = await placeOrder(['Vàng 24k']);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Topping "Vàng 24k" không còn được bán/);
    assert.equal(calls.some((c) => /INSERT INTO orders/.test(c.sql)), false);
});

test('Đặt hàng không chọn topping thì không cần hỏi bảng toppings', async () => {
    const res = await placeOrder([]);
    assert.equal(res.status, 201);
    assert.equal(calls.some((c) => /FROM toppings/.test(c.sql)), false);
});

// ================= Xuất hóa đơn =================
test('GET /api/orders/export: cần admin, kiểm tra định dạng và bộ lọc', async () => {
    assert.equal((await send('GET', '/api/orders/export', undefined, {})).status, 401);
    state.role = 'customer';
    assert.equal((await send('GET', '/api/orders/export')).status, 403);
    state.role = 'admin';
    assert.equal((await send('GET', '/api/orders/export?format=pdf')).status, 400);
    assert.equal((await send('GET', '/api/orders/export?status=abc')).status, 400);
});

test('Xuất: bộ lọc giống danh sách và xuất tất cả (không phân trang)', async () => {
    await send('GET', '/api/orders/export?format=csv&invoice_status=paid&date_from=2026-11-01&q=Nguyen');
    const query = lastSql(/FROM orders o/);
    assert.match(query.sql, /payment_status = 'paid'/);
    assert.ok(query.params.includes('2026-11-01'));
    assert.ok(query.params.some((p) => String(p).includes('Nguyen')));
    assert.equal(query.params.at(-1), 5001); // giới hạn 5000 + 1 dòng để phát hiện vượt giới hạn
});

test('Xuất CSV: có BOM, đúng tiêu đề, giờ Việt Nam, chống công thức Excel', async () => {
    state.orders = [order({ customer_name: '=HYPERLINK("http://x")', note: 'Giao nhanh, "gấp"' })];
    const res = await fetch(base + '/api/orders/export?format=csv', { headers: AUTH });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="hoa-don-\d{8}-\d{4}\.csv"$/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const lines = bytes.toString('utf8').slice(1).split('\r\n');
    assert.match(lines[0], /^Mã hóa đơn,Mã đơn,Ngày giờ,Khách hàng,/);
    assert.match(lines[1], /^HD0012,MC202611140001,14\/11\/2026 10:30,/); // 03:30 UTC = 10:30 giờ Việt Nam
    assert.ok(lines[1].includes(`"'=HYPERLINK(""http://x"")"`), 'ô bắt đầu bằng = phải được thêm dấu nháy');
    assert.ok(lines[1].includes('"Giao nhanh, ""gấp"""'));
    assert.ok(lines[1].endsWith(',100000,10000,0,90000,"Giao nhanh, ""gấp"""'));
});

test('Xuất CSV kèm món: mỗi món một dòng', async () => {
    state.orders = [order()];
    state.items = [item(), item({ product_name: 'Trà đào', toppings: '[]', quantity: 1, unit_price: '35000', line_total: '35000' })];
    const res = await fetch(base + '/api/orders/export?format=csv&include_items=1', { headers: AUTH });
    const lines = (await res.text()).slice(1).trim().split('\r\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[0].endsWith('Món,Size,Đường,Đá,Topping,Số lượng,Đơn giá,Thành tiền,Ghi chú món'));
    assert.ok(lines[1].includes('Cà phê sữa đá,L,70%,50%,"Trân châu, Kem sữa",2,45000,90000'));
    assert.ok(lines[2].includes('Trà đào'));
});

test('Xuất Excel: file .xlsx hợp lệ, có bảng Hóa đơn và dòng tổng', async () => {
    state.orders = [
        order({ customer_name: 'Công ty A & B <test>' }),
        order({ id: 13, status: 'cancelled', total_amount: '50000', subtotal: '50000', discount_amount: '0' }),
    ];
    const res = await fetch(base + '/api/orders/export?format=xlsx', { headers: AUTH });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /spreadsheetml\.sheet/);
    assert.match(res.headers.get('content-disposition'), /filename="hoa-don-\d{8}-\d{4}\.xlsx"/);

    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.toString('latin1', 0, 2), 'PK');
    const files = unzip(bytes);
    assert.deepEqual(Object.keys(files).sort(), [
        '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
    ]);
    assert.match(files['xl/workbook.xml'], /<sheet name="Hóa đơn" sheetId="1"/);
    const sheet = files['xl/worksheets/sheet1.xml'];
    assert.ok(sheet.includes('Công ty A &amp; B &lt;test&gt;'), 'ký tự đặc biệt phải được mã hóa XML');
    assert.ok(sheet.includes('<v>90000</v>'), 'tiền là số để Excel cộng được');
    // Dòng tổng chỉ cộng hóa đơn chưa hủy: 90000 (không cộng 50000 của hóa đơn đã hủy)
    assert.match(sheet, /Tổng cộng \(không tính hóa đơn đã hủy\)[\s\S]*<v>90000<\/v>/);
    assert.ok(!sheet.includes('<v>140000</v>'));
});

test('Xuất Excel kèm món: có thêm bảng Chi tiết món', async () => {
    state.orders = [order()];
    state.items = [item()];
    const res = await fetch(base + '/api/orders/export?format=xlsx&include_items=1', { headers: AUTH });
    const files = unzip(Buffer.from(await res.arrayBuffer()));
    assert.match(files['xl/workbook.xml'], /<sheet name="Chi tiết món" sheetId="2"/);
    assert.ok(files['xl/worksheets/sheet2.xml'].includes('Trân châu, Kem sữa'));
    assert.match(lastSql(/FROM order_items/).sql, /WHERE order_id IN \(\?\)/);
});

test('Xuất JSON (dùng cho PDF/In): kèm món và trạng thái chữ', async () => {
    state.orders = [order({ payment_status: 'pending', status: 'pending' })];
    state.items = [item()];
    const res = await send('GET', '/api/orders/export?format=json');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    const data = res.body.data[0];
    assert.equal(data.invoice_code, 'HD0012');
    assert.equal(data.invoice_status_text, 'Chờ thanh toán');
    assert.equal(data.created_text, '14/11/2026 10:30');
    assert.equal(data.items[0].toppings, 'Trân châu, Kem sữa');
});

test('Xuất: quá 5000 hóa đơn thì báo thu hẹp bộ lọc', async () => {
    state.orders = Array.from({ length: 5001 }, (_, i) => order({ id: i + 1 }));
    const res = await send('GET', '/api/orders/export?format=csv');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /hơn 5000 hóa đơn/);
});

test('Xuất không có hóa đơn nào vẫn ra file hợp lệ (chỉ có tiêu đề)', async () => {
    const csv = await (await fetch(base + '/api/orders/export?format=csv', { headers: AUTH })).text();
    assert.equal(csv.slice(1).trim().split('\r\n').length, 1);
    const xlsx = Buffer.from(await (await fetch(base + '/api/orders/export?format=xlsx', { headers: AUTH })).arrayBuffer());
    assert.ok(unzip(xlsx)['xl/worksheets/sheet1.xml'].includes('Mã hóa đơn'));
});
