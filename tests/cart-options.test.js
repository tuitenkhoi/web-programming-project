// Kiểm tra tính giá và sửa size/topping trong giỏ hàng (assets/js/cart-options.js). Không cần trình duyệt.
const test = require('node:test');
const assert = require('node:assert/strict');
const Options = require('../assets/js/cart-options.js');

const { calcUnitPrice, getBasePrice, makeCartKey, applyOptions, reconcile, normalizeToppings, SIZE_EXTRA } = Options;

// Dòng giỏ hàng mẫu: Cà phê 29.000đ, size M, không topping
function line(overrides = {}) {
    const item = { id: '1', name: 'Cà phê sữa đá', price: 29000, basePrice: 29000, quantity: 1, size: 'M', sugar: '70%', ice: '70%', toppings: [], note: '', ...overrides };
    item.cartKey = makeCartKey(item);
    return item;
}
const pearl = { name: 'Trân châu', price: 10000 };
const cream = { name: 'Kem sữa', price: 12000 };

test('Phụ thu size khớp server (S -5000, M 0, L +10000)', () => {
    assert.deepEqual(SIZE_EXTRA, { S: -5000, M: 0, L: 10000 });
});

test('calcUnitPrice: giá gốc + size + topping, không bao giờ âm', () => {
    assert.equal(calcUnitPrice(29000, 'M', []), 29000);
    assert.equal(calcUnitPrice(29000, 'L', [pearl, cream]), 29000 + 10000 + 22000);
    assert.equal(calcUnitPrice(29000, 'S', [pearl]), 29000 - 5000 + 10000);
    assert.equal(calcUnitPrice(3000, 'S', []), 0);
});

test('getBasePrice: dùng basePrice đã lưu, giỏ cũ thì suy ngược từ đơn giá', () => {
    assert.equal(getBasePrice({ basePrice: 29000, price: 99999 }), 29000);
    // Giỏ cũ: 29.000 + L 10.000 + Trân châu 10.000 = 49.000, chưa có basePrice
    assert.equal(getBasePrice({ price: 49000, size: 'L', toppings: [pearl] }), 29000);
    // Topping cũ dạng chữ: tra giá trong bảng giá hiện tại
    assert.equal(getBasePrice({ price: 39000, size: 'M', toppings: ['Trân châu'] }, new Map([['Trân châu', 10000]])), 29000);
    assert.equal(getBasePrice({ price: 1000, size: 'L', toppings: [] }), 0);
});

test('normalizeToppings: nhận chữ hoặc đối tượng, bỏ phần tử rỗng', () => {
    assert.deepEqual(normalizeToppings(['Trân châu', { name: 'Kem sữa', price: 12000 }, '', null], new Map([['Trân châu', 10000]])),
        [{ name: 'Trân châu', price: 10000 }, { name: 'Kem sữa', price: 12000 }]);
    assert.deepEqual(normalizeToppings(undefined), []);
});

test('makeCartKey: thứ tự topping không ảnh hưởng', () => {
    assert.equal(makeCartKey(line({ toppings: [pearl, cream] })), makeCartKey(line({ toppings: [cream, pearl] })));
    assert.notEqual(makeCartKey(line({ size: 'L' })), makeCartKey(line({ size: 'M' })));
});

test('applyOptions: đổi size và thêm topping thì tính lại đơn giá và khóa dòng', () => {
    const cart = [line({ quantity: 2 })];
    const { cart: next, item } = applyOptions(cart, cart[0].cartKey, { size: 'L', toppings: [pearl, cream] });
    assert.equal(next.length, 1);
    assert.equal(item.size, 'L');
    assert.equal(item.price, 29000 + 10000 + 22000);
    assert.equal(item.quantity, 2); // số lượng giữ nguyên
    assert.deepEqual(item.toppings, [pearl, cream]);
    assert.equal(item.cartKey, makeCartKey(item));
    assert.notEqual(item.cartKey, cart[0].cartKey);
    assert.equal(cart[0].size, 'M', 'không sửa dữ liệu gốc');
});

test('applyOptions: bớt topping, trở về size M thì giá về lại giá gốc', () => {
    const start = line({ size: 'L', toppings: [pearl], price: 49000 });
    const { item } = applyOptions([start], start.cartKey, { size: 'M', toppings: [] });
    assert.equal(item.price, 29000);
    assert.deepEqual(item.toppings, []);
});

test('applyOptions: dùng giá gốc mới nhất nếu được truyền vào', () => {
    const start = line();
    const { item } = applyOptions([start], start.cartKey, { size: 'M', toppings: [pearl], basePrice: 32000 });
    assert.equal(item.basePrice, 32000);
    assert.equal(item.price, 42000);
});

test('applyOptions: hai dòng trở thành cùng một món thì gộp số lượng (tối đa 99)', () => {
    const plain = line({ quantity: 3 });
    const large = line({ size: 'L', price: 39000, quantity: 97 });
    const { cart, item } = applyOptions([plain, large], plain.cartKey, { size: 'L', toppings: [] });
    assert.equal(cart.length, 1);
    assert.equal(item.quantity, 99);
    assert.equal(item.size, 'L');
});

test('applyOptions: size lạ giữ size cũ; không tìm thấy dòng thì không đổi', () => {
    const start = line({ size: 'L', price: 39000 });
    assert.equal(applyOptions([start], start.cartKey, { size: 'XL', toppings: [] }).item.size, 'L');
    const missing = applyOptions([start], 'khong-co', { size: 'S', toppings: [] });
    assert.equal(missing.item, null);
    assert.deepEqual(missing.cart, [start]);
});

test('applyOptions: xóa chữ mô tả tùy chọn cũ (options) để giao diện dựng lại', () => {
    const start = line({ options: 'Size M' });
    assert.equal(applyOptions([start], start.cartKey, { size: 'L', toppings: [] }).item.options, '');
});

test('reconcile: topping đã ngừng bán bị bỏ khỏi giỏ và trừ lại tiền', () => {
    const start = line({ toppings: [pearl, cream], price: 51000 });
    const result = reconcile([start], [{ name: 'Trân châu', price: 10000 }]);
    assert.equal(result.changed, true);
    assert.deepEqual(result.removed, ['Kem sữa']);
    assert.equal(result.cart[0].price, 39000);
    assert.deepEqual(result.cart[0].toppings, [pearl]);
});

test('reconcile: giá topping đổi thì tính lại đơn giá (và báo priceChanged)', () => {
    const start = line({ toppings: [pearl], price: 39000 });
    const result = reconcile([start], [{ name: 'Trân châu', price: 12000 }]);
    assert.equal(result.priceChanged, true);
    assert.deepEqual(result.removed, []);
    assert.equal(result.cart[0].price, 41000);
});

test('reconcile: không có gì đổi thì trả đúng giỏ cũ', () => {
    const cart = [line({ toppings: [pearl], price: 39000 })];
    const result = reconcile(cart, [{ name: 'Trân châu', price: 10000 }]);
    assert.equal(result.changed, false);
    assert.equal(result.cart, cart);
});

test('reconcile: giỏ cũ chưa có basePrice được bổ sung mà không đổi giá', () => {
    const old = { id: '1', name: 'Cà phê', price: 39000, quantity: 1, size: 'M', sugar: '70%', ice: '70%', toppings: [pearl], note: '' };
    old.cartKey = makeCartKey(old);
    const result = reconcile([old], [{ name: 'Trân châu', price: 10000 }]);
    assert.equal(result.cart[0].basePrice, 29000);
    assert.equal(result.cart[0].price, 39000);
    assert.equal(result.priceChanged, false);
});

test('reconcile: hai dòng thành cùng món sau khi bỏ topping thì gộp lại', () => {
    const a = line({ quantity: 1 });
    const b = line({ toppings: [cream], price: 41000, quantity: 2 });
    const result = reconcile([a, b], []);
    assert.equal(result.cart.length, 1);
    assert.equal(result.cart[0].quantity, 3);
});
