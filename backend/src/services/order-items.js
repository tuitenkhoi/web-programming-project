// Kiểm tra và tính tiền các món trong đơn do NHÂN VIÊN tạo/sửa.
// Giá size lấy từ order.controller.js, giá topping lấy từ bảng toppings (services/toppings.js):
// cùng nguồn với đơn khách đặt nên không bao giờ lệch giá.
const pool = require("../../../config/db");
const {
    SIZE_PRICES,
    LEVELS,
    cleanText,
} = require("../controllers/order.controller");
const {
    loadActiveToppingPrices,
    findUnavailableTopping,
    unavailableToppingMessage,
} = require("./toppings");
const { findSoldOut, soldOutMessage } = require("./sold-out");

// Trả { items } hoặc { error }
function parseItems(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { error: "Đơn hàng phải có ít nhất một sản phẩm" };
    }
    if (rawItems.length > 50) {
        return { error: "Đơn hàng không được vượt quá 50 dòng sản phẩm" };
    }

    const items = [];

    for (const raw of rawItems) {
        const productId = Number(raw && raw.product_id);
        const quantity = Number(raw && raw.quantity);
        const size = cleanText((raw && raw.size) || "M", 10).toUpperCase();
        const sugarLevel = cleanText((raw && raw.sugar_level) || "70%", 10);
        const iceLevel = cleanText((raw && raw.ice_level) || "70%", 10);
        const note = cleanText(raw && raw.note, 200);
        const toppings = Array.isArray(raw && raw.toppings)
            ? [...new Set(raw.toppings.map((name) => cleanText(name, 50)).filter(Boolean))]
            : [];

        if (!Number.isInteger(productId) || productId <= 0) return { error: "ID sản phẩm không hợp lệ" };
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: "Số lượng sản phẩm phải từ 1 đến 99" };
        if (!(size in SIZE_PRICES)) return { error: "Kích thước sản phẩm không hợp lệ" };
        if (!LEVELS.has(sugarLevel) || !LEVELS.has(iceLevel)) return { error: "Mức đường hoặc mức đá không hợp lệ" };
        // Topping có còn bán hay không sẽ kiểm tra với bảng toppings ở priceItems
        if (toppings.length > 20) return { error: "Mỗi món chỉ được chọn tối đa 20 topping" };

        items.push({ productId, quantity, size, sugarLevel, iceLevel, toppings, note: note || null });
    }

    return { items };
}

// Lấy giá thật từ DB (không tin giá client gửi) và tính thành tiền từng dòng
async function priceItems(items) {
    const ids = [...new Set(items.map((item) => item.productId))];
    const [rows] = await pool.execute(
        `SELECT p.id, p.name, p.price, p.image
           FROM products AS p
          INNER JOIN categories AS c ON c.id = p.category_id
          WHERE p.id IN (${ids.map(() => "?").join(", ")})
            AND p.status = 1
            AND c.status = 1`,
        ids
    );
    const map = new Map(rows.map((row) => [Number(row.id), row]));

    if (map.size !== ids.length) {
        const error = new Error("Có sản phẩm không tồn tại hoặc đã ngừng bán");
        error.httpStatus = 400;
        throw error;
    }

    // Món đã hết trong hôm nay thì không đặt được (cả khách lẫn nhân viên)
    const soldOutProduct = await findSoldOut(ids);
    if (soldOutProduct) {
        const error = new Error(soldOutMessage(soldOutProduct));
        error.httpStatus = 400;
        throw error;
    }

    // Giá topping lấy từ DB (cùng nguồn với đơn khách đặt); topping đã tắt / bị xóa thì từ chối
    const toppingNames = [...new Set(items.flatMap((item) => item.toppings))];
    const toppingPrices = await loadActiveToppingPrices(toppingNames);
    const unavailableTopping = findUnavailableTopping(toppingNames, toppingPrices);

    if (unavailableTopping) {
        const error = new Error(unavailableToppingMessage(unavailableTopping));
        error.httpStatus = 400;
        throw error;
    }

    const priced = items.map((item) => {
        const product = map.get(item.productId);
        const toppingPrice = item.toppings.reduce((total, name) => total + toppingPrices.get(name), 0);
        const unitPrice = Math.max(0, Number(product.price) + SIZE_PRICES[item.size] + toppingPrice);
        return {
            ...item,
            productName: product.name,
            productImage: product.image,
            unitPrice,
            lineTotal: unitPrice * item.quantity,
        };
    });

    const subtotal = priced.reduce((total, item) => total + item.lineTotal, 0);
    return { items: priced, subtotal };
}

// Phí phục vụ 5% cho đơn tại bàn (cùng công thức với đơn khách đặt)
const serviceFeeFor = (orderType, subtotal) =>
    orderType === "at_table" ? Math.round((subtotal * 0.05) / 1000) * 1000 : 0;

const itemRowsFor = (orderId, items) =>
    items.map((item) => [
        orderId,
        item.productId,
        item.productName,
        item.productImage,
        item.unitPrice,
        item.quantity,
        item.lineTotal,
        item.size,
        item.sugarLevel,
        item.iceLevel,
        JSON.stringify(item.toppings),
        item.note,
    ]);

const INSERT_ITEMS_SQL = `INSERT INTO order_items (
    order_id, product_id, product_name, product_image, unit_price, quantity,
    line_total, size, sugar_level, ice_level, toppings, note
 ) VALUES ?`;

module.exports = {
    parseItems,
    priceItems,
    serviceFeeFor,
    itemRowsFor,
    INSERT_ITEMS_SQL,
    SIZE_PRICES,
    LEVELS,
};
