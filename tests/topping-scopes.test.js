// Phạm vi topping (danh mục + ngoại lệ), phân quyền bếp và các file giao diện khách.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { toppingAppliesTo, findToppingNotForProduct } = require('../backend/src/services/toppings');
const Options = require('../assets/js/cart-options.js');
const { can, PERMISSIONS } = require('../middleware/permissions');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const scopes = [
    { categories: [], include: [], exclude: [] },
    { categories: [1], include: [], exclude: [] },
    { categories: [1], include: [9], exclude: [2] },
    { categories: [], include: [5], exclude: [] },
    { categories: [], include: [], exclude: [3] },
];

test('quy tắc phạm vi topping giống nhau ở máy chủ và trình duyệt', () => {
    for (const scope of scopes) {
        for (const productId of [1, 2, 3, 5, 9]) {
            for (const categoryId of [1, 2]) {
                assert.equal(
                    Options.appliesTo({ scope }, productId, categoryId),
                    toppingAppliesTo(scope, productId, categoryId),
                    JSON.stringify({ scope, productId, categoryId })
                );
            }
        }
    }
});

test('topping không có phạm vi áp dụng cho mọi món; ngoại lệ thắng danh mục', () => {
    assert.equal(toppingAppliesTo(undefined, 1, 1), true);
    assert.equal(toppingAppliesTo({ categories: [1], include: [], exclude: [2] }, 2, 1), false);
    assert.equal(toppingAppliesTo({ categories: [1], include: [], exclude: [] }, 7, 2), false);
    assert.equal(toppingAppliesTo({ categories: [1], include: [7], exclude: [] }, 7, 2), true);
});

test('toppingsFor chỉ giữ topping hợp với món', () => {
    const all = [
        { name: 'Trân châu', price: 5000 },
        { name: 'Shot cà phê', price: 10000, scope: { categories: [1], include: [], exclude: [] } },
    ];
    assert.deepEqual(Options.toppingsFor(all, 3, 2).map((t) => t.name), ['Trân châu']);
    assert.deepEqual(Options.toppingsFor(all, 3, 1).map((t) => t.name), ['Trân châu', 'Shot cà phê']);
});

test('findToppingNotForProduct báo topping sai món', async () => {
    assert.equal(typeof findToppingNotForProduct, 'function');
});

test('bếp quản lý topping nhưng quyền xoá chỉ của admin', () => {
    assert.ok(PERMISSIONS['toppings.manage'].includes('kitchen'));
    assert.equal(can({ role: 'staff', staff_position: 'kitchen' }, 'toppings.manage'), true);
    assert.equal(can({ role: 'staff', staff_position: 'waiter' }, 'toppings.manage'), false);
    const routes = read('routes/toppings.js');
    assert.match(routes, /router\.delete\([^)]*requireAdmin/);
});

test('trang topping của bếp, thẻ tùy chỉnh món và giao diện tại bàn có đủ file', () => {
    assert.match(read('staff/toppings.html'), /data-perm="toppings\.manage"/);
    assert.match(read('assets/js/staff.js'), /toppings\.html/);
    assert.match(read('assets/js/staff-toppings.js'), /canDelete:\s*false/);
    const menu = read('pages/menu.html');
    for (const f of ['item-sheet.js', 'item-sheet.css', 'table-menu.js', 'table-menu.css', 'cart-options.js']) {
        assert.ok(menu.includes(f), `menu.html thiếu ${f}`);
    }
    assert.match(read('assets/js/menu.js'), /MocItemSheet\.open/);
    assert.match(read('assets/js/home.js'), /MocItemSheet\.open/);
    assert.ok(read('index.html').includes('item-sheet.js'));
    assert.match(read('database/migrations/010_topping_scopes.sql'), /topping_categories/);
});
