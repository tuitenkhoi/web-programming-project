// Các API quản lý đơn hàng dành cho ADMIN:
//   - xem danh sách, xem chi tiết
//   - đổi trạng thái xử lý đơn
//   - xác nhận thanh toán
// (API khách đặt món nằm ở order.controller.js)
const pool = require("../../../config/db");
const { dbErrorMessage } = require("../../../middleware/dbError");
const { logActivity } = require("../../../services/audit");
const { buildXlsx } = require("../../../services/xlsx");
const { buildCsv } = require("../../../services/csv");

// ===== Hằng số =====
const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const PAYMENT_STATUSES = ["pending", "pending_verification", "paid", "failed", "refunded"];
const ORDER_TYPES = ["at_table", "takeaway"];
const PAYMENT_METHODS = ["cash", "bank_transfer"];

// Trạng thái hóa đơn = suy ra từ đơn (chỉ dùng chuỗi có sẵn, không ghép dữ liệu người dùng)
const INVOICE_STATUS_SQL = {
    cancelled: "o.status = 'cancelled'",
    paid: "o.status <> 'cancelled' AND o.payment_status = 'paid'",
    failed: "o.status <> 'cancelled' AND o.payment_status = 'failed'",
    refunded: "o.status <> 'cancelled' AND o.payment_status = 'refunded'",
    pending: "o.status <> 'cancelled' AND o.payment_status IN ('pending', 'pending_verification')",
};

const STATUS_TEXT = {
    pending: "Đơn mới",
    confirmed: "Đã xác nhận",
    preparing: "Đang chế biến",
    ready: "Sẵn sàng phục vụ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
};

const PAYMENT_STATUS_TEXT = {
    pending: "Chưa thanh toán",
    pending_verification: "Chờ xác nhận chuyển khoản",
    paid: "Đã thanh toán",
    failed: "Thanh toán thất bại",
    refunded: "Đã hoàn tiền",
};

// Từ trạng thái hiện tại, được phép chuyển sang những trạng thái nào
const NEXT_STATUSES = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

// Các kiểu sắp xếp cho phép (chỉ dùng chuỗi có sẵn, không ghép dữ liệu người dùng vào SQL)
const SORTS = {
    newest: "o.created_at DESC, o.id DESC",
    oldest: "o.created_at ASC, o.id ASC",
    amount_desc: "o.total_amount DESC, o.id DESC",
    amount_asc: "o.total_amount ASC, o.id ASC",
};

// ===== Hàm hỗ trợ =====
const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Chuyển một dòng orders trong DB thành dữ liệu trả về (số tiền là số, thêm chữ tiếng Việt)
const formatOrder = (row) => ({
    id: row.id,
    order_code: row.order_code,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    order_type: row.order_type,
    order_type_text: row.order_type === "at_table" ? "Dùng tại bàn" : "Mang đi",
    table_code: row.table_code,
    note: row.note,
    coupon_code: row.coupon_code,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    service_fee: Number(row.service_fee),
    total_amount: Number(row.total_amount),
    payment_method: row.payment_method,
    payment_method_text: row.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
    payment_status: row.payment_status,
    payment_status_text: PAYMENT_STATUS_TEXT[row.payment_status],
    status: row.status,
    status_text: STATUS_TEXT[row.status],
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const parseToppings = (value) => {
    try {
        const list = JSON.parse(value || "[]");
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
};

const sendError = (res, httpStatus, message) =>
    res.status(httpStatus).json({ success: false, message });

// Đọc bộ lọc từ query string (dùng chung cho danh sách và xuất file).
// Trả { where, params, orderBy } hoặc { error } nếu có bộ lọc không hợp lệ.
// Lọc: ?status= &payment_status= &order_type= &date=YYYY-MM-DD &date_from= &date_to= &invoice_status= &payment_method= &q=từ khóa
// Sắp xếp: ?sort=newest|oldest|amount_desc|amount_asc
const buildOrderFilter = (query) => {
    const { status, payment_status, order_type, date, q, sort } = query;
    const conditions = [];
    const params = [];

    if (status) {
        // Cho phép nhiều trạng thái cách nhau bằng dấu phẩy, ví dụ ?status=confirmed,preparing
        const list = String(status).split(",").map((item) => item.trim()).filter(Boolean);
        if (!list.length || list.some((item) => !ORDER_STATUSES.includes(item))) {
            return { error: "Trạng thái đơn không hợp lệ" };
        }
        conditions.push(`o.status IN (${list.map(() => "?").join(", ")})`);
        params.push(...list);
    }

    // ?awaiting_payment=1 : đơn chưa thanh toán và chưa hủy (tab "Chờ thanh toán")
    if (query.awaiting_payment === "1") {
        conditions.push("o.payment_status IN ('pending', 'pending_verification') AND o.status <> 'cancelled'");
    }

    // ?payment_method=cash|bank_transfer
    if (query.payment_method) {
        if (!PAYMENT_METHODS.includes(query.payment_method)) return { error: "Phương thức thanh toán không hợp lệ" };
        conditions.push("o.payment_method = ?");
        params.push(query.payment_method);
    }

    // ?invoice_status=pending|paid|cancelled|failed|refunded : trạng thái hóa đơn suy ra từ đơn
    if (query.invoice_status) {
        const clause = INVOICE_STATUS_SQL[query.invoice_status];
        if (!clause) return { error: "Trạng thái hóa đơn không hợp lệ" };
        conditions.push(clause);
    }

    if (payment_status) {
        if (!PAYMENT_STATUSES.includes(payment_status)) return { error: "Trạng thái thanh toán không hợp lệ" };
        conditions.push("o.payment_status = ?");
        params.push(payment_status);
    }

    if (order_type) {
        if (!ORDER_TYPES.includes(order_type)) return { error: "Loại đơn không hợp lệ" };
        conditions.push("o.order_type = ?");
        params.push(order_type);
    }

    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Ngày phải có dạng YYYY-MM-DD" };
        // Dùng khoảng thời gian thay vì DATE(cột) để MySQL dùng được index idx_orders_created_at
        conditions.push("o.created_at >= ? AND o.created_at < ? + INTERVAL 1 DAY");
        params.push(date, date);
    }

    // Khoảng ngày cho trang hóa đơn: ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (query.date_from) {
        if (!DATE_RE.test(query.date_from)) return { error: "Ngày phải có dạng YYYY-MM-DD" };
        conditions.push("o.created_at >= ?");
        params.push(query.date_from);
    }
    if (query.date_to) {
        if (!DATE_RE.test(query.date_to)) return { error: "Ngày phải có dạng YYYY-MM-DD" };
        conditions.push("o.created_at < ? + INTERVAL 1 DAY");
        params.push(query.date_to);
    }

    if (q) {
        const keyword = `%${String(q).trim().slice(0, 50).replace(/[\\%_]/g, "\\$&")}%`;
        const invoiceMatch = /^hd0*(\d+)$/i.exec(String(q).trim()); // gõ "HD0012" thì tìm đơn id = 12
        conditions.push("(o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.table_code LIKE ?" + (invoiceMatch ? " OR o.id = ?" : "") + ")");
        params.push(keyword, keyword, keyword, keyword);
        if (invoiceMatch) params.push(Number(invoiceMatch[1]));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    return { where, params, orderBy: SORTS[sort] || SORTS.newest };
};

// ===== GET /api/orders : danh sách đơn =====
// Bộ lọc: xem buildOrderFilter.   Phân trang: ?page= &limit=
const getOrders = async (req, res) => {
    const filter = buildOrderFilter(req.query);
    if (filter.error) return sendError(res, 400, filter.error);
    const { where, params, orderBy } = filter;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    try {
        // 3 truy vấn độc lập -> chạy song song thay vì chờ lần lượt.
        // item_count dùng subquery nên chỉ tính cho đúng các dòng của trang hiện tại
        // (trước đây JOIN + GROUP BY trên toàn bộ đơn rồi mới LIMIT).
        const [[rows], [[totalRow]], [[summary]]] = await Promise.all([
            pool.query(
                `SELECT o.*,
                        (SELECT COALESCE(SUM(oi.quantity), 0)
                           FROM order_items oi
                          WHERE oi.order_id = o.id) AS item_count
                   FROM orders o
                   ${where}
                  ORDER BY ${orderBy}
                  LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM orders o ${where}`,
                params
            ),
            // Số liệu cho các thẻ thống kê đầu trang (tính trên tất cả đơn, không phụ thuộc bộ lọc)
            pool.query(
                `SELECT
                    COUNT(*) AS all_orders,
                    SUM(created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY) AS today_orders,
                    SUM(status = 'pending') AS pending_orders,
                    SUM(status IN ('confirmed', 'preparing')) AS preparing_orders,
                    SUM(status = 'ready') AS ready_orders,
                    SUM(status = 'completed') AS completed_orders,
                    SUM(status = 'cancelled') AS cancelled_orders,
                    SUM(payment_status IN ('pending', 'pending_verification') AND status <> 'cancelled') AS awaiting_payment,
                    SUM(payment_status = 'paid' AND status <> 'cancelled') AS paid_invoices,
                    SUM(status <> 'cancelled' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY) AS today_invoices,
                    COALESCE(SUM(CASE WHEN payment_status = 'paid' AND status <> 'cancelled'
                                      AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
                                 THEN total_amount END), 0) AS today_revenue
                   FROM orders`
            ),
        ]);

        // Doanh thu chỉ hiện cho admin và thu ngân
        if (req.user && req.user.role === "staff" && req.user.staff_position !== "cashier") {
            delete summary.today_revenue;
        }

        return res.json({
            success: true,
            count: rows.length,
            total: totalRow.total,
            page,
            limit,
            total_pages: Math.max(1, Math.ceil(totalRow.total / limit)),
            summary: Object.fromEntries(
                Object.entries(summary).map(([key, value]) => [key, Number(value || 0)])
            ),
            data: rows.map((row) => ({ ...formatOrder(row), item_count: Number(row.item_count) })),
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn hàng:", error);
        return sendError(res, 500, dbErrorMessage(error, "Lỗi máy chủ khi lấy danh sách đơn hàng"));
    }
};

// ===== GET /api/orders/:id : chi tiết một đơn (kèm các món) =====
const getOrderById = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");

    try {
        const [orders] = await pool.execute("SELECT * FROM orders WHERE id = ?", [id]);
        if (!orders.length) return sendError(res, 404, "Không tìm thấy đơn hàng");

        const [items] = await pool.execute(
            `SELECT product_id, product_name, product_image, unit_price, quantity, line_total,
                    size, sugar_level, ice_level, toppings, note
               FROM order_items WHERE order_id = ? ORDER BY id`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                ...formatOrder(orders[0]),
                items: items.map((item) => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    image: item.product_image,
                    unit_price: Number(item.unit_price),
                    quantity: item.quantity,
                    line_total: Number(item.line_total),
                    size: item.size,
                    sugar_level: item.sugar_level,
                    ice_level: item.ice_level,
                    toppings: parseToppings(item.toppings),
                    note: item.note,
                })),
            },
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết đơn hàng:", error);
        return sendError(res, 500, "Lỗi máy chủ khi lấy chi tiết đơn hàng");
    }
};

// ===== PATCH /api/orders/:id/status : đổi trạng thái xử lý =====
// Body: { "status": "confirmed" }
const updateOrderStatus = async (req, res) => {
    const id = parseId(req.params.id);
    const newStatus = req.body && req.body.status;

    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");
    if (!ORDER_STATUSES.includes(newStatus)) return sendError(res, 400, "Trạng thái đơn không hợp lệ");

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Khóa dòng đơn để hai người cùng bấm một lúc không ghi đè nhau
        const [rows] = await connection.execute(
            "SELECT id, status, payment_status, order_type, table_code FROM orders WHERE id = ? FOR UPDATE",
            [id]
        );

        if (!rows.length) {
            await connection.rollback();
            return sendError(res, 404, "Không tìm thấy đơn hàng");
        }

        const order = rows[0];

        if (!NEXT_STATUSES[order.status].includes(newStatus)) {
            await connection.rollback();
            return sendError(res, 409, `Không thể chuyển đơn từ "${STATUS_TEXT[order.status]}" sang "${STATUS_TEXT[newStatus]}"`);
        }

        if (newStatus === "completed" && order.payment_status !== "paid") {
            await connection.rollback();
            return sendError(res, 409, "Cần xác nhận thanh toán trước khi hoàn thành đơn");
        }

        if (newStatus === "cancelled" && order.payment_status === "paid") {
            await connection.rollback();
            return sendError(res, 409, "Đơn đã thanh toán nên không thể hủy");
        }

        await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [newStatus, id]);

        // Trả bàn khi đơn kết thúc/hủy, nhưng chỉ khi bàn không còn đơn mở
        // và cũng không có booking đang phục vụ.
        if (
            order.order_type === "at_table" &&
            order.table_code &&
            (newStatus === "completed" || newStatus === "cancelled")
        ) {
            const [openOrders] = await connection.execute(
                `SELECT id
                   FROM orders
                  WHERE table_code = ?
                    AND id <> ?
                    AND status <> 'cancelled'
                    AND (status <> 'completed' OR payment_status NOT IN ('paid', 'refunded'))
                  LIMIT 1
                  FOR UPDATE`,
                [order.table_code, id]
            );
            const [seatedBookings] = await connection.execute(
                `SELECT b.id
                   FROM bookings b
                   INNER JOIN coffee_tables t ON t.id = b.table_id
                  WHERE t.table_code = ? AND b.status = 'seated'
                  LIMIT 1
                  FOR UPDATE`,
                [order.table_code]
            );

            if (!openOrders.length && !seatedBookings.length) {
                await connection.execute(
                    `UPDATE coffee_tables
                        SET status = 'available'
                      WHERE table_code = ? AND status = 'occupied'`,
                    [order.table_code]
                );
            }
        }
        await connection.commit();

        logActivity(req.user, "order.status", "order", id, `${order.status} -> ${newStatus}`);

        require("../../../realtime").emit("order:updated", {
            id,
            status: newStatus,
            payment_status: order.payment_status,
        });

        return res.json({
            success: true,
            message: `Đã chuyển đơn sang "${STATUS_TEXT[newStatus]}"`,
            data: { id, status: newStatus, status_text: STATUS_TEXT[newStatus], payment_status: order.payment_status },
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Lỗi đổi trạng thái đơn hàng:", error);
        return sendError(res, 500, "Lỗi máy chủ khi đổi trạng thái đơn hàng");
    } finally {
        if (connection) connection.release();
    }
};

// ===== PATCH /api/orders/:id/payment : xác nhận đã thanh toán =====
// Chỉ đổi được khi đơn đang "chưa thanh toán" hoặc "chờ xác nhận chuyển khoản" và chưa bị hủy.
// Câu UPDATE có điều kiện nên bấm hai lần (hoặc hai người cùng bấm) chỉ ghi nhận MỘT lần.
const confirmOrderPayment = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");

    try {
        const [result] = await pool.execute(
            `UPDATE orders
                SET payment_status = 'paid'
              WHERE id = ?
                AND payment_status IN ('pending', 'pending_verification')
                AND status <> 'cancelled'`,
            [id]
        );

        if (result.affectedRows === 0) {
            // Không cập nhật được: tìm lý do để báo cho admin
            const [rows] = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [id]);

            if (!rows.length) return sendError(res, 404, "Không tìm thấy đơn hàng");
            if (rows[0].status === "cancelled") return sendError(res, 409, "Đơn đã bị hủy, không thể xác nhận thanh toán");
            if (rows[0].payment_status === "paid") return sendError(res, 409, "Đơn hàng này đã được thanh toán");
            return sendError(res, 409, `Không thể xác nhận thanh toán khi đơn đang ở trạng thái "${PAYMENT_STATUS_TEXT[rows[0].payment_status]}"`);
        }

        const [rows] = await pool.execute("SELECT * FROM orders WHERE id = ?", [id]);

        logActivity(req.user, "order.payment", "order", id, `Xác nhận thanh toán ${rows[0].order_code} (${Number(rows[0].total_amount)}đ)`);

        require("../../../realtime").emit("order:updated", {
            id,
            status: rows[0].status,
            payment_status: "paid",
        });

        return res.json({
            success: true,
            message: "Đã xác nhận thanh toán",
            data: formatOrder(rows[0]),
        });
    } catch (error) {
        console.error("Lỗi xác nhận thanh toán:", error);
        return sendError(res, 500, "Lỗi máy chủ khi xác nhận thanh toán");
    }
};

// ===== GET /api/orders/export : xuất danh sách hóa đơn ra file =====
// ?format=xlsx|csv|json   (mặc định xlsx; json dùng cho nút "PDF / In" ở trang hóa đơn)
// ?include_items=1        kèm chi tiết từng món
// Ngoài ra nhận đúng các bộ lọc của GET /api/orders (status, invoice_status, date_from, q...), xuất TẤT CẢ trang.
const MAX_EXPORT_ROWS = 5000;
const EXPORT_FORMATS = ["xlsx", "csv", "json"];
const EXPORT_TIMEZONE = process.env.EXPORT_TIMEZONE || "Asia/Ho_Chi_Minh";

const invoiceCode = (id) => `HD${String(id).padStart(4, "0")}`;

// Trạng thái hóa đơn suy ra từ đơn (giống cách trang hóa đơn hiển thị)
const invoiceStatusText = (row) => {
    if (row.status === "cancelled") return "Đã hủy";
    if (row.payment_status === "paid") return "Đã thanh toán";
    if (row.payment_status === "failed") return "Thất bại";
    if (row.payment_status === "refunded") return "Đã hoàn tiền";
    return "Chờ thanh toán";
};

// Ngày giờ dạng 14/11/2026 20:30 theo giờ Việt Nam
const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: EXPORT_TIMEZONE,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(date)
            .map((part) => [part.type, part.value])
    );

    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const toppingText = (value) =>
    parseToppings(value)
        .map((item) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean)
        .join(", ");

const INVOICE_COLUMNS = [
    { header: "Mã hóa đơn", width: 13 },
    { header: "Mã đơn", width: 24 },
    { header: "Ngày giờ", width: 18 },
    { header: "Khách hàng", width: 24 },
    { header: "Số điện thoại", width: 15 },
    { header: "Hình thức", width: 14 },
    { header: "Bàn", width: 9 },
    { header: "Thanh toán", width: 14 },
    { header: "Trạng thái", width: 17 },
    { header: "Mã giảm giá", width: 14 },
    { header: "Tạm tính", width: 14, type: "money" },
    { header: "Giảm giá", width: 14, type: "money" },
    { header: "Phí phục vụ", width: 14, type: "money" },
    { header: "Tổng tiền", width: 15, type: "money" },
    { header: "Ghi chú", width: 30 },
];

const ITEM_COLUMNS = [
    { header: "Mã hóa đơn", width: 13 },
    { header: "Mã đơn", width: 24 },
    { header: "Món", width: 28 },
    { header: "Size", width: 7 },
    { header: "Đường", width: 9 },
    { header: "Đá", width: 9 },
    { header: "Topping", width: 28 },
    { header: "Số lượng", width: 10 },
    { header: "Đơn giá", width: 13, type: "money" },
    { header: "Thành tiền", width: 14, type: "money" },
    { header: "Ghi chú món", width: 26 },
];

const invoiceRow = (order) => [
    invoiceCode(order.id),
    order.order_code,
    formatDateTime(order.created_at),
    order.customer_name,
    order.customer_phone,
    order.order_type === "at_table" ? "Dùng tại bàn" : "Mang đi",
    order.table_code || "",
    order.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
    invoiceStatusText(order),
    order.coupon_code || "",
    Number(order.subtotal),
    Number(order.discount_amount),
    Number(order.service_fee),
    Number(order.total_amount),
    order.note || "",
];

const itemRow = (order, item) => [
    invoiceCode(order.id),
    order.order_code,
    item.product_name,
    item.size,
    item.sugar_level,
    item.ice_level,
    toppingText(item.toppings),
    Number(item.quantity),
    Number(item.unit_price),
    Number(item.line_total),
    item.note || "",
];

const exportOrders = async (req, res) => {
    const format = String(req.query.format || "xlsx").toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) return sendError(res, 400, "Định dạng xuất không hợp lệ (chọn xlsx, csv hoặc json)");

    const filter = buildOrderFilter(req.query);
    if (filter.error) return sendError(res, 400, filter.error);
    const { where, params, orderBy } = filter;

    // JSON (dùng để in / lưu PDF) luôn kèm món; xlsx và csv chỉ kèm khi người dùng chọn
    const includeItems = format === "json" || req.query.include_items === "1";

    try {
        // Lấy dư 1 dòng để biết có vượt giới hạn hay không
        const [orders] = await pool.query(
            `SELECT o.* FROM orders o ${where} ORDER BY ${orderBy} LIMIT ?`,
            [...params, MAX_EXPORT_ROWS + 1]
        );

        if (orders.length > MAX_EXPORT_ROWS) {
            return sendError(res, 400, `Có hơn ${MAX_EXPORT_ROWS} hóa đơn phù hợp. Hãy thu hẹp bộ lọc (ví dụ chọn khoảng ngày) rồi xuất lại.`);
        }

        // Gom các món theo mã đơn
        const itemsByOrder = new Map();
        if (includeItems && orders.length) {
            const [items] = await pool.query(
                `SELECT order_id, product_name, size, sugar_level, ice_level, toppings, quantity, unit_price, line_total, note
                   FROM order_items
                  WHERE order_id IN (?)
                  ORDER BY order_id ASC, id ASC`,
                [orders.map((order) => order.id)]
            );
            items.forEach((item) => {
                if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
                itemsByOrder.get(item.order_id).push(item);
            });
        }

        res.setHeader("Cache-Control", "no-store");

        if (format === "json") {
            return res.json({
                success: true,
                count: orders.length,
                data: orders.map((order) => ({
                    ...formatOrder(order),
                    invoice_code: invoiceCode(order.id),
                    invoice_status_text: invoiceStatusText(order),
                    created_text: formatDateTime(order.created_at),
                    items: (itemsByOrder.get(order.id) || []).map((item) => ({
                        product_name: item.product_name,
                        size: item.size,
                        sugar_level: item.sugar_level,
                        ice_level: item.ice_level,
                        toppings: toppingText(item.toppings),
                        quantity: Number(item.quantity),
                        unit_price: Number(item.unit_price),
                        line_total: Number(item.line_total),
                        note: item.note || "",
                    })),
                })),
            });
        }

        // Tên file dạng hoa-don-20261114-2030.xlsx (ngày-giờ lúc xuất)
        const [datePart, timePart] = formatDateTime(new Date()).split(" ");
        const stamp = `${datePart.split("/").reverse().join("")}-${timePart.replace(":", "")}`;
        const fileName = `hoa-don-${stamp}.${format}`;
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        if (format === "csv") {
            let rows;

            if (includeItems) {
                // CSV không có nhiều bảng tính, nên mỗi MÓN là một dòng (kèm thông tin hóa đơn)
                const header = [...INVOICE_COLUMNS, ...ITEM_COLUMNS.slice(2)].map((column) => column.header);
                rows = [header];
                orders.forEach((order) => {
                    const items = itemsByOrder.get(order.id) || [];
                    const emptyItem = new Array(ITEM_COLUMNS.length - 2).fill("");
                    if (!items.length) rows.push([...invoiceRow(order), ...emptyItem]);
                    items.forEach((item) => rows.push([...invoiceRow(order), ...itemRow(order, item).slice(2)]));
                });
            } else {
                rows = [INVOICE_COLUMNS.map((column) => column.header), ...orders.map(invoiceRow)];
            }

            res.type("text/csv; charset=utf-8");
            return res.send(buildCsv(rows));
        }

        // xlsx: bảng "Hóa đơn" (+ bảng "Chi tiết món" nếu được chọn)
        // Dòng tổng không tính hóa đơn đã hủy
        const counted = orders.filter((order) => order.status !== "cancelled");
        const sum = (key) => counted.reduce((total, order) => total + Number(order[key]), 0);
        const totalRow = new Array(INVOICE_COLUMNS.length).fill("");
        totalRow[0] = "Tổng cộng (không tính hóa đơn đã hủy)";
        totalRow[10] = sum("subtotal");
        totalRow[11] = sum("discount_amount");
        totalRow[12] = sum("service_fee");
        totalRow[13] = sum("total_amount");

        const sheets = [{ name: "Hóa đơn", columns: INVOICE_COLUMNS, rows: orders.map(invoiceRow), totalRow }];

        if (includeItems) {
            const itemRows = [];
            orders.forEach((order) => (itemsByOrder.get(order.id) || []).forEach((item) => itemRows.push(itemRow(order, item))));
            sheets.push({ name: "Chi tiết món", columns: ITEM_COLUMNS, rows: itemRows });
        }

        res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buildXlsx(sheets));
    } catch (error) {
        console.error("Lỗi xuất hóa đơn:", error);
        return sendError(res, 500, dbErrorMessage(error, "Lỗi máy chủ khi xuất hóa đơn"));
    }
};

module.exports = {
    exportOrders,
    getOrders,
    getOrderById,
    updateOrderStatus,
    confirmOrderPayment,
};
