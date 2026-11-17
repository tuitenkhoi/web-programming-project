// Giá topping lấy từ bảng toppings (admin quản lý ở trang Quản lý món).
// Dùng chung cho đơn KHÁCH đặt (order.controller.js) và đơn NHÂN VIÊN tạo (order-items.js)
// nên hai nơi không bao giờ lệch giá.
const pool = require("../../../config/db");

// Trả Map tên -> giá của các topping ĐANG BÁN trong danh sách names (topping đã tắt / không có thì không nằm trong Map)
async function loadActiveToppingPrices(names) {
    const prices = new Map();

    if (!names.length) {
        return prices;
    }

    const [rows] = await pool.execute(
        `SELECT name, price
           FROM toppings
          WHERE is_active = 1
            AND name IN (${names.map(() => "?").join(", ")})`,
        names
    );

    rows.forEach((row) => prices.set(row.name, Number(row.price)));

    return prices;
}

// Tên topping đầu tiên không còn bán (undefined nếu tất cả đều bán được)
const findUnavailableTopping = (names, prices) => names.find((name) => !prices.has(name));

const unavailableToppingMessage = (name) =>
    `Topping "${name}" không còn được bán. Vui lòng chọn lại topping trong giỏ hàng.`;

// ----- Phạm vi áp dụng của topping (migration 010) -----
// scope = { categories: [id], include: [productId], exclude: [productId] }
// Không có danh mục / món riêng -> áp dụng mọi món (trừ món bị loại trừ).
function toppingAppliesTo(scope, productId, categoryId) {
    if (!scope) return true;
    const categories = scope.categories || [];
    const include = scope.include || [];
    const exclude = scope.exclude || [];
    if (exclude.includes(Number(productId))) return false;
    if (!categories.length && !include.length) return true;
    return include.includes(Number(productId)) || categories.includes(Number(categoryId));
}

// Map tên topping -> scope. Chịu lỗi: chưa chạy migration 010 thì coi như mọi topping áp dụng cho mọi món.
async function loadToppingScopes() {
    const scopes = new Map();
    try {
        const [rows] = await pool.execute(
            `SELECT t.id, t.name, 'c' AS kind, tc.category_id AS ref, 1 AS allowed
               FROM topping_categories AS tc INNER JOIN toppings AS t ON t.id = tc.topping_id
             UNION ALL
             SELECT t.id, t.name, 'p' AS kind, tp.product_id AS ref, tp.allowed
               FROM topping_products AS tp INNER JOIN toppings AS t ON t.id = tp.topping_id`
        );
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            if (!row || !row.name) return;
            const scope = scopes.get(row.name) || { id: Number(row.id), categories: [], include: [], exclude: [] };
            const ref = Number(row.ref);
            if (row.kind === "c") scope.categories.push(ref);
            else if (Number(row.allowed) === 1) scope.include.push(ref);
            else scope.exclude.push(ref);
            scopes.set(row.name, scope);
        });
    } catch (_error) {
        return new Map();
    }
    return scopes;
}

// Topping đầu tiên không áp dụng cho món của nó: { topping, product } hoặc null.
// items: [{ productId, toppings: [tên] }]; productMap: Map(productId -> { name, category_id })
async function findToppingNotForProduct(items, productMap) {
    const names = new Set(items.flatMap((item) => item.toppings || []));
    if (!names.size) return null;
    const scopes = await loadToppingScopes();
    for (const item of items) {
        const product = productMap.get(item.productId) || {};
        for (const name of item.toppings || []) {
            if (!toppingAppliesTo(scopes.get(name), item.productId, product.category_id)) {
                return { topping: name, product: product.name || "này" };
            }
        }
    }
    return null;
}

const toppingNotForProductMessage = ({ topping, product }) =>
    `Topping "${topping}" không áp dụng cho món "${product}". Vui lòng chọn lại topping.`;

// Tất cả topping đang bán, theo thứ tự hiển thị (cho màn hình tạo đơn của nhân viên)
async function listActiveToppings() {
    const [rows] = await pool.execute(
        "SELECT name, price FROM toppings WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
    );

    const scopes = await loadToppingScopes();
    return rows.map((row) => {
        const scope = scopes.get(row.name);
        const base = { name: row.name, price: Number(row.price) };
        return scope ? { ...base, scope: { categories: scope.categories, include: scope.include, exclude: scope.exclude } } : base;
    });
}

module.exports = {
    loadActiveToppingPrices,
    findUnavailableTopping,
    unavailableToppingMessage,
    listActiveToppings,
    toppingAppliesTo,
    loadToppingScopes,
    findToppingNotForProduct,
    toppingNotForProductMessage,
};
