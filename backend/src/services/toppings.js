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

// Tất cả topping đang bán, theo thứ tự hiển thị (cho màn hình tạo đơn của nhân viên)
async function listActiveToppings() {
    const [rows] = await pool.execute(
        "SELECT name, price FROM toppings WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
    );

    return rows.map((row) => ({ name: row.name, price: Number(row.price) }));
}

module.exports = {
    loadActiveToppingPrices,
    findUnavailableTopping,
    unavailableToppingMessage,
    listActiveToppings,
};
