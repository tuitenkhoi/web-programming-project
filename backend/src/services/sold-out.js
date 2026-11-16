// "Hết món theo ngày": món bị đánh dấu hết chỉ có hiệu lực trong ngày đó (giờ Việt Nam), sang ngày mới tự bán lại.
// Mọi hàm ĐỌC đều chịu lỗi: bảng chưa có (chưa chạy migration 009) hoặc DB lỗi thì coi như không món nào hết,
// để không làm hỏng việc xem thực đơn hay đặt món.
const pool = require("../../../config/db");

// Ngày hôm nay theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. Không dùng CURDATE() vì DB có thể chạy giờ UTC.
function todayVn(now = Date.now()) {
    return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function listSoldOutIds() {
    try {
        const [rows] = await pool.execute(
            "SELECT product_id FROM product_sold_out WHERE sold_date = ?",
            [todayVn()]
        );
        return new Set((Array.isArray(rows) ? rows : []).filter((r) => r && r.product_id != null).map((r) => Number(r.product_id)));
    } catch (_error) {
        return new Set();
    }
}

// Trả tên món đầu tiên đang hết trong danh sách id, hoặc null
async function findSoldOut(productIds) {
    const ids = [...new Set(productIds.map(Number))].filter(Number.isSafeInteger);
    if (!ids.length) return null;
    try {
        const [rows] = await pool.execute(
            `SELECT s.product_id, p.name
               FROM product_sold_out AS s
               INNER JOIN products AS p ON p.id = s.product_id
              WHERE s.sold_date = ? AND s.product_id IN (${ids.map(() => "?").join(", ")})
              LIMIT 1`,
            [todayVn(), ...ids]
        );
        const row = (Array.isArray(rows) ? rows : []).find((r) => r && r.product_id != null);
        return row ? { id: Number(row.product_id), name: row.name } : null;
    } catch (_error) {
        return null;
    }
}

function soldOutMessage(product) {
    return `Món "${product.name}" đã hết trong hôm nay. Vui lòng bỏ món này khỏi giỏ hàng.`;
}

// Ghi: lỗi được ném ra cho route xử lý (cần báo rõ khi chưa chạy migration)
async function setSoldOut(productId, soldOut, userId) {
    if (soldOut) {
        await pool.execute(
            `INSERT INTO product_sold_out (product_id, sold_date, marked_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE sold_date = VALUES(sold_date), marked_by = VALUES(marked_by), marked_at = CURRENT_TIMESTAMP`,
            [productId, todayVn(), userId || null]
        );
    } else {
        await pool.execute("DELETE FROM product_sold_out WHERE product_id = ?", [productId]);
    }
}

module.exports = { todayVn, listSoldOutIds, findSoldOut, soldOutMessage, setSoldOut };
