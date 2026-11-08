const crypto = require("crypto");
// Dùng chung kết nối DB của server chính
const pool = require("../../../config/db");
const { dbErrorMessage } = require("../../../middleware/dbError");

const SIZE_PRICES = {
    S: -5000,
    M: 0,
    L: 10000,
};

const TOPPING_PRICES = {
    "Trân châu": 10000,
    "Thạch cà phê": 10000,
    "Kem sữa": 12000,
    "Thêm shot cà phê": 15000,
};

const LEVELS = new Set(["0%", "30%", "50%", "70%", "100%"]);
const ORDER_TYPES = new Set(["at_table", "takeaway"]);
const PAYMENT_METHODS = new Set(["cash", "bank_transfer"]);

const cleanText = (value, maxLength) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, maxLength);
};

const createOrderCode = () => {
    const timestamp = new Date()
        .toISOString()
        .replace(/\D/g, "")
        .slice(0, 14);

    const random = crypto
        .randomInt(0, 10000)
        .toString()
        .padStart(4, "0");

    return `MC${timestamp}${random}`;
};

const createImageUrl = (req, image) => {
    if (
        typeof image === "string" &&
        image.startsWith("/uploads/")
    ) {
        return `${req.protocol}://${req.get("host")}${image}`;
    }

    return null;
};

const validateRequest = (body) => {
    const customerName = cleanText(body.customer_name, 100);
    const customerPhone = cleanText(body.customer_phone, 20);
    const customerEmail = cleanText(body.customer_email, 150);
    const orderType = cleanText(body.order_type, 20);
    const tableCode = cleanText(body.table_code, 20).toUpperCase();
    const note = cleanText(body.note, 300);
    const couponCode = cleanText(body.coupon_code, 30).toUpperCase();
    const rawPaymentMethod = cleanText(body.payment_method, 30);
    const paymentMethod = rawPaymentMethod === "bank-transfer"
        ? "bank_transfer"
        : rawPaymentMethod;

    if (customerName.length < 2) {
        return { error: "Họ tên khách hàng phải có ít nhất 2 ký tự" };
    }

    if (!/^0\d{9}$/.test(customerPhone)) {
        return { error: "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0" };
    }

    if (
        customerEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    ) {
        return { error: "Email không hợp lệ" };
    }

    if (!ORDER_TYPES.has(orderType)) {
        return { error: "Hình thức nhận món không hợp lệ" };
    }

    if (
        orderType === "at_table" &&
        !/^[A-Z0-9-]{1,20}$/.test(tableCode)
    ) {
        return { error: "Mã bàn không hợp lệ" };
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
        return { error: "Phương thức thanh toán không hợp lệ" };
    }

    if (couponCode && !/^[A-Z0-9-]{3,30}$/.test(couponCode)) {
        return { error: "Mã giảm giá không hợp lệ" };
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
        return { error: "Đơn hàng phải có ít nhất một sản phẩm" };
    }

    if (body.items.length > 50) {
        return { error: "Đơn hàng không được vượt quá 50 dòng sản phẩm" };
    }

    const items = [];

    for (const rawItem of body.items) {
        const productId = Number(rawItem.product_id);
        const quantity = Number(rawItem.quantity);
        const size = cleanText(rawItem.size || "M", 10).toUpperCase();
        const sugarLevel = cleanText(rawItem.sugar_level || "70%", 10);
        const iceLevel = cleanText(rawItem.ice_level || "70%", 10);
        const itemNote = cleanText(rawItem.note, 200);
        const toppings = Array.isArray(rawItem.toppings)
            ? [...new Set(rawItem.toppings.map((item) => cleanText(item, 50)).filter(Boolean))]
            : [];

        if (!Number.isInteger(productId) || productId <= 0) {
            return { error: "ID sản phẩm trong giỏ hàng không hợp lệ" };
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            return { error: "Số lượng sản phẩm phải từ 1 đến 99" };
        }

        if (!(size in SIZE_PRICES)) {
            return { error: "Kích thước sản phẩm không hợp lệ" };
        }

        if (!LEVELS.has(sugarLevel) || !LEVELS.has(iceLevel)) {
            return { error: "Mức đường hoặc mức đá không hợp lệ" };
        }

        if (toppings.some((name) => !(name in TOPPING_PRICES))) {
            return { error: "Topping không hợp lệ" };
        }

        items.push({
            productId,
            quantity,
            size,
            sugarLevel,
            iceLevel,
            toppings,
            note: itemNote || null,
        });
    }

    return {
        value: {
            customerName,
            customerPhone,
            customerEmail: customerEmail || null,
            orderType,
            tableCode: orderType === "at_table" ? tableCode : null,
            note: note || null,
            couponCode: couponCode || null,
            paymentMethod,
            items,
        },
    };
};

// POST /api/orders
const createOrder = async (req, res) => {
    const validation = validateRequest(req.body || {});

    if (validation.error) {
        return res.status(400).json({
            success: false,
            message: validation.error,
        });
    }

    const order = validation.value;
    const userId = req.user?.role === "customer"
        ? Number(req.user.id)
        : null;
    let connection;

    try {
        // Các truy vấn chỉ đọc làm TRƯỚC khi mở transaction để giữ kết nối/khóa trong thời gian ngắn nhất.
        const productIds = [
            ...new Set(order.items.map((item) => item.productId)),
        ];
        const placeholders = productIds.map(() => "?").join(", ");

        const [productRows] = await pool.execute(
            `SELECT
                p.id,
                p.name,
                p.price,
                p.image
             FROM products AS p
             INNER JOIN categories AS c
                ON c.id = p.category_id
             WHERE p.id IN (${placeholders})
               AND p.status = 1
               AND c.status = 1`,
            productIds
        );

        const productMap = new Map(
            productRows.map((product) => [
                Number(product.id),
                product,
                ])
        );

        if (productMap.size !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: "Có sản phẩm không tồn tại hoặc đã ngừng bán",
            });
        }

        const calculatedItems = order.items.map((item) => {
            const product = productMap.get(item.productId);
            const toppingPrice = item.toppings.reduce(
                (total, name) => total + TOPPING_PRICES[name],
                0
            );
            const unitPrice = Math.max(
                0,
                Number(product.price) +
                    SIZE_PRICES[item.size] +
                    toppingPrice
            );

            return {
                ...item,
                productName: product.name,
                productImage: product.image,
                unitPrice,
                lineTotal: unitPrice * item.quantity,
            };
        });

        const subtotal = calculatedItems.reduce(
            (total, item) => total + item.lineTotal,
            0
        );
        let discountAmount = 0;
        let voucher = null;
        const serviceFee = order.orderType === "at_table"
            ? Math.round((subtotal * 0.05) / 1000) * 1000
            : 0;
        const paymentStatus = order.paymentMethod === "bank_transfer"
            ? "pending_verification"
            : "pending";
        const orderCode = createOrderCode();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (order.couponCode) {
            const [voucherRows] = await connection.execute(
                `SELECT id, code, discount_type, value, min_order, max_discount,
                        usage_limit, per_user_limit, used_count
                   FROM vouchers
                  WHERE code = ? AND status = 1
                    AND starts_at <= NOW() AND ends_at >= NOW()
                  LIMIT 1 FOR UPDATE`,
                [order.couponCode]
            );
            voucher = voucherRows[0];

            if (!voucher || (voucher.usage_limit !== null && Number(voucher.used_count) >= Number(voucher.usage_limit))) {
                const error = new Error("Voucher không tồn tại, đã hết hạn hoặc hết lượt sử dụng");
                error.httpStatus = 400;
                throw error;
            }
            if (subtotal < Number(voucher.min_order)) {
                const error = new Error(`Đơn hàng phải đạt tối thiểu ${Number(voucher.min_order).toLocaleString("vi-VN")}đ để dùng voucher`);
                error.httpStatus = 400;
                throw error;
            }

            const [usageRows] = await connection.execute(
                userId
                    ? `SELECT COUNT(*) AS total FROM voucher_usages WHERE voucher_id = ? AND user_id = ?`
                    : `SELECT COUNT(*) AS total FROM voucher_usages WHERE voucher_id = ? AND customer_phone = ?`,
                [voucher.id, userId || order.customerPhone]
            );
            if (Number(usageRows[0].total) >= Number(voucher.per_user_limit)) {
                const error = new Error("Bạn đã sử dụng hết số lượt của voucher này");
                error.httpStatus = 409;
                throw error;
            }

            discountAmount = voucher.discount_type === "percent"
                ? Math.round(subtotal * Number(voucher.value) / 100)
                : Math.round(Number(voucher.value));
            if (voucher.max_discount !== null) {
                discountAmount = Math.min(discountAmount, Number(voucher.max_discount));
            }
            discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
        }

        const totalAmount = Math.max(
            0,
            subtotal - discountAmount + serviceFee
        );

        // Khóa và cập nhật bàn trong cùng transaction với đơn hàng.
        // Nhờ vậy không có trạng thái đơn đã tạo nhưng sơ đồ vẫn báo bàn trống.
        if (order.orderType === "at_table") {
            const [tableRows] = await connection.execute(
                `SELECT id, status
                   FROM coffee_tables
                  WHERE table_code = ?
                  LIMIT 1
                  FOR UPDATE`,
                [order.tableCode]
            );

            if (!tableRows.length) {
                const error = new Error("Mã bàn không tồn tại");
                error.httpStatus = 400;
                throw error;
            }

            if (tableRows[0].status === "maintenance") {
                const error = new Error("Bàn đang bảo trì, vui lòng chọn bàn khác");
                error.httpStatus = 409;
                throw error;
            }

            await connection.execute(
                "UPDATE coffee_tables SET status = 'occupied' WHERE id = ?",
                [tableRows[0].id]
            );
        }

        const [orderResult] = await connection.execute(
            `INSERT INTO orders (
                order_code,
                user_id,
                customer_name,
                customer_phone,
                customer_email,
                order_type,
                table_code,
                note,
                coupon_code,
                subtotal,
                discount_amount,
                service_fee,
                total_amount,
                payment_method,
                payment_status,
                status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderCode,
                userId,
                order.customerName,
                order.customerPhone,
                order.customerEmail,
                order.orderType,
                order.tableCode,
                order.note,
                order.couponCode,
                subtotal,
                discountAmount,
                serviceFee,
                totalAmount,
                order.paymentMethod,
                paymentStatus,
                "pending",
            ]
        );

        // Thêm TẤT CẢ món bằng 1 câu INSERT thay vì 1 câu cho mỗi món
        const itemRows = calculatedItems.map((item) => [
            orderResult.insertId,
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

        await connection.query(
            `INSERT INTO order_items (
                order_id,
                product_id,
                product_name,
                product_image,
                unit_price,
                quantity,
                line_total,
                size,
                sugar_level,
                ice_level,
                toppings,
                note
             ) VALUES ?`,
            [itemRows]
        );

        if (voucher) {
            await connection.execute(
                `INSERT INTO voucher_usages
                    (voucher_id, order_id, user_id, customer_phone, discount_amount)
                 VALUES (?, ?, ?, ?, ?)`,
                [voucher.id, orderResult.insertId, userId, order.customerPhone, discountAmount]
            );
            await connection.execute(
                "UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?",
                [voucher.id]
            );
        }

        await connection.commit();

        try {
            require("../../../realtime").emit("order:created", {
                id: orderResult.insertId,
                order_code: orderCode,
                status: "pending",
            });
        } catch { /* realtime không được phép làm hỏng giao dịch */ }

        return res.status(201).json({

            success: true,
            message: "Tạo đơn hàng thành công",
            data: {
                id: orderResult.insertId,
                order_code: orderCode,
                customer_name: order.customerName,
                customer_phone: order.customerPhone,
                customer_email: order.customerEmail,
                order_type: order.orderType,
                table_code: order.tableCode,
                note: order.note,
                coupon_code: order.couponCode,
                subtotal,
                discount_amount: discountAmount,
                service_fee: serviceFee,
                total_amount: totalAmount,
                payment_method: order.paymentMethod,
                payment_status: paymentStatus,
                payment_status_text:
                    paymentStatus === "pending_verification"
                        ? "Chờ xác nhận chuyển khoản"
                        : "Chưa thanh toán",
                status: "pending",
                created_at: new Date().toISOString(),
                items: calculatedItems.map((item) => ({
                    product_id: item.productId,
                    product_name: item.productName,
                    image: item.productImage,
                    image_url: createImageUrl(req, item.productImage),
                    unit_price: item.unitPrice,
                    quantity: item.quantity,
                    line_total: item.lineTotal,
                    size: item.size,
                    sugar_level: item.sugarLevel,
                    ice_level: item.iceLevel,
                    toppings: item.toppings,
                    note: item.note,
                })),
            },
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError){
                console.error("Lỗi rollback đơn hàng:", rollbackError.code);
            }
        }

        console.error("Lỗi tạo đơn hàng:", error);

        return res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus
                ? error.message
                : dbErrorMessage(error, "Lỗi máy chủ khi tạo đơn hàng"),
        });
    } finally {
        connection?.release();
    }
};

module.exports = {
    createOrder,
};
