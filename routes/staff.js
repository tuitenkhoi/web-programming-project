// API dành cho trang nhân viên (/staff). Gắn trong server.js: app.use('/api/staff', verifyToken, requireStaff, ...)
//   GET  /api/staff/me               thông tin + danh sách quyền của người đang đăng nhập
//   POST /api/staff/change-password  nhân viên tự đổi mật khẩu (không bắt buộc)
//   GET  /api/staff/order-options    size / topping / mức đường, đá cho màn hình tạo đơn
//   GET  /api/staff/kitchen          đơn đang xử lý kèm món (màn hình bếp)
//   POST /api/staff/orders           tạo đơn tại quầy
//   PUT  /api/staff/orders/:id       sửa món / ghi chú của đơn chưa thanh toán
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { revokeAllForUser } = require('../middleware/revoke');
const {
    permissionsOf,
    allowedOrderStatuses,
    requirePermission,
    POSITION_TEXT,
} = require('../middleware/permissions');
const { dbErrorMessage } = require('../middleware/dbError');
const { logActivity } = require('../services/audit');
const { cleanText, createOrderCode } = require('../backend/src/controllers/order.controller');
const {
    parseItems,
    priceItems,
    serviceFeeFor,
    itemRowsFor,
    INSERT_ITEMS_SQL,
    SIZE_PRICES,
    TOPPING_PRICES,
    LEVELS,
} = require('../backend/src/services/order-items');

const router = express.Router();

const DUMMY_HASH = bcrypt.hashSync('khong-ton-tai', 10);
const OPEN_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];
const EDITABLE_STATUSES = ['pending', 'confirmed', 'preparing'];

const fail = (status, message) => {
    const error = new Error(message);
    error.httpStatus = status;
    return error;
};

const emitRealtime = (event, payload) => {
    try { require('../realtime').emit(event, payload); } catch { /* realtime không được làm hỏng giao dịch */ }
};

const parseToppings = (value) => {
    try {
        const list = JSON.parse(value || '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

// ----- Thông tin người đang đăng nhập -----
router.get('/me', (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user.id,
            full_name: req.user.full_name,
            email: req.user.email,
            role: req.user.role,
            staff_position: req.user.staff_position,
            position_text: req.user.role === 'admin' ? 'Quản trị viên' : (POSITION_TEXT[req.user.staff_position] || ''),
            permissions: permissionsOf(req.user),
            order_statuses: allowedOrderStatuses(req.user),
        },
    });
});

// ----- Đổi mật khẩu (nhân viên tự đổi, không bắt buộc) -----
router.post('/change-password', async (req, res) => {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password ?? '');

    if (!currentPassword) return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại.' });
    if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 8 đến 72 ký tự.' });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp' });
    if (newPassword === currentPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    try {
        const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        const hash = rows[0] ? String(rows[0].password_hash).replace(/^\$2y\$/, '$2a$') : DUMMY_HASH;
        if (!rows[0] || !(await bcrypt.compare(currentPassword, hash))) {
            // 400 (không phải 401) để giao diện không tưởng là hết phiên đăng nhập
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
        revokeAllForUser(req.user.id);
        logActivity(req.user, 'account.password', 'user', req.user.id, 'Tự đổi mật khẩu');
        return res.json({ success: true, message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' });
    } catch (error) {
        console.error('Lỗi đổi mật khẩu nhân viên:', error);
        return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này.' });
    }
});

// ----- Tùy chọn cho màn hình tạo đơn (lấy từ cùng nguồn với server tính tiền) -----
router.get('/order-options', requirePermission('orders.create'), (req, res) => {
    res.json({
        success: true,
        data: {
            sizes: Object.entries(SIZE_PRICES).map(([code, price]) => ({ code, price })),
            toppings: Object.entries(TOPPING_PRICES).map(([name, price]) => ({ name, price })),
            levels: [...LEVELS],
        },
    });
});

// ----- Màn hình bếp -----
router.get('/kitchen', requirePermission('kitchen.view'), async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT id, order_code, customer_name, order_type, table_code, note, status,
                    payment_status, created_at, updated_at
               FROM orders
              WHERE status IN (?)
              ORDER BY created_at ASC, id ASC
              LIMIT 100`,
            [OPEN_STATUSES]
        );

        const itemsByOrder = new Map();
        if (orders.length) {
            const [items] = await db.query(
                `SELECT order_id, product_name, quantity, size, sugar_level, ice_level, toppings, note
                   FROM order_items
                  WHERE order_id IN (?)
                  ORDER BY id`,
                [orders.map((order) => order.id)]
            );
            for (const item of items) {
                if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
                itemsByOrder.get(item.order_id).push({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    size: item.size,
                    sugar_level: item.sugar_level,
                    ice_level: item.ice_level,
                    toppings: parseToppings(item.toppings),
                    note: item.note,
                });
            }
        }

        return res.json({
            success: true,
            data: orders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) || [] })),
        });
    } catch (error) {
        console.error('Lỗi tải màn hình bếp:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Không tải được danh sách đơn của bếp') });
    }
});

// ----- Tạo đơn tại quầy -----
router.post('/orders', requirePermission('orders.create'), async (req, res) => {
    const body = req.body || {};
    const orderType = cleanText(body.order_type, 20);
    const tableCode = cleanText(body.table_code, 20).toUpperCase();
    const paymentMethod = cleanText(body.payment_method || 'cash', 30);
    const customerPhone = cleanText(body.customer_phone, 20);
    const note = cleanText(body.note, 300);

    if (!['at_table', 'takeaway'].includes(orderType)) {
        return res.status(400).json({ success: false, message: 'Hình thức nhận món không hợp lệ' });
    }
    if (orderType === 'at_table' && !/^[A-Z0-9-]{1,20}$/.test(tableCode)) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn bàn' });
    }
    if (!['cash', 'bank_transfer'].includes(paymentMethod)) {
        return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ' });
    }
    if (customerPhone && !/^0\d{9}$/.test(customerPhone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0' });
    }
    const customerName = cleanText(body.customer_name, 100)
        || (orderType === 'at_table' ? `Khách bàn ${tableCode}` : 'Khách mang đi');

    const parsed = parseItems(body.items);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    let connection;
    try {
        const { items, subtotal } = await priceItems(parsed.items);
        const serviceFee = serviceFeeFor(orderType, subtotal);
        const totalAmount = subtotal + serviceFee;
        const paymentStatus = paymentMethod === 'bank_transfer' ? 'pending_verification' : 'pending';
        const orderCode = createOrderCode();

        connection = await db.getConnection();
        await connection.beginTransaction();

        if (orderType === 'at_table') {
            const [tables] = await connection.execute(
                'SELECT id, status FROM coffee_tables WHERE table_code = ? LIMIT 1 FOR UPDATE',
                [tableCode]
            );
            if (!tables.length) throw fail(400, 'Mã bàn không tồn tại');
            if (tables[0].status === 'maintenance') throw fail(409, 'Bàn đang bảo trì, vui lòng chọn bàn khác');
            await connection.execute("UPDATE coffee_tables SET status = 'occupied' WHERE id = ?", [tables[0].id]);
        }

        // Đơn nhân viên tạo đã được nhân viên xác nhận nên vào thẳng trạng thái "confirmed" để bếp thấy ngay
        const [result] = await connection.execute(
            `INSERT INTO orders (
                order_code, user_id, customer_name, customer_phone, customer_email, order_type, table_code,
                note, coupon_code, subtotal, discount_amount, service_fee, total_amount,
                payment_method, payment_status, status, created_by, source
             ) VALUES (?, NULL, ?, ?, NULL, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, 'confirmed', ?, 'staff')`,
            [
                orderCode, customerName, customerPhone || null, orderType,
                orderType === 'at_table' ? tableCode : null,
                note || null, subtotal, serviceFee, totalAmount, paymentMethod, paymentStatus, req.user.id,
            ]
        );
        await connection.query(INSERT_ITEMS_SQL, [itemRowsFor(result.insertId, items)]);
        await connection.commit();

        logActivity(req.user, 'order.create', 'order', result.insertId, `${orderCode} - ${totalAmount}đ`);
        emitRealtime('order:created', { id: result.insertId, order_code: orderCode, status: 'confirmed' });
        if (orderType === 'at_table') emitRealtime('table:updated', { table_code: tableCode, status: 'occupied' });

        return res.status(201).json({
            success: true,
            message: 'Đã tạo đơn hàng',
            data: {
                id: result.insertId,
                order_code: orderCode,
                customer_name: customerName,
                order_type: orderType,
                table_code: orderType === 'at_table' ? tableCode : null,
                subtotal,
                service_fee: serviceFee,
                total_amount: totalAmount,
                payment_method: paymentMethod,
                payment_status: paymentStatus,
                status: 'confirmed',
            },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Lỗi nhân viên tạo đơn:', error.code || error.message);
        return res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus ? error.message : dbErrorMessage(error, 'Lỗi máy chủ khi tạo đơn hàng'),
        });
    } finally {
        connection?.release();
    }
});

// ----- Sửa đơn: thay toàn bộ món và/hoặc ghi chú -----
router.put('/orders/:id', requirePermission('orders.edit'), async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ' });
    }
    const id = Number(req.params.id);
    const body = req.body || {};
    const hasNote = body.note !== undefined;
    const note = cleanText(body.note, 300);

    const parsed = parseItems(body.items);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    let connection;
    try {
        const { items, subtotal } = await priceItems(parsed.items);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT id, order_code, order_type, status, payment_status, coupon_code, discount_amount, total_amount FROM orders WHERE id = ? FOR UPDATE',
            [id]
        );
        if (!rows.length) throw fail(404, 'Không tìm thấy đơn hàng');
        const order = rows[0];

        if (!EDITABLE_STATUSES.includes(order.status)) {
            throw fail(409, 'Chỉ sửa được đơn chưa sẵn sàng phục vụ (đơn mới, đã xác nhận, đang chế biến)');
        }
        if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
            throw fail(409, 'Đơn đã thanh toán nên không thể sửa món');
        }
        if (order.coupon_code) {
            throw fail(409, 'Đơn đã áp voucher, không thể sửa món. Hãy nhờ quản lý xử lý.');
        }

        const serviceFee = serviceFeeFor(order.order_type, subtotal);
        const totalAmount = subtotal + serviceFee;

        await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
        await connection.query(INSERT_ITEMS_SQL, [itemRowsFor(id, items)]);
        await connection.execute(
            hasNote
                ? 'UPDATE orders SET subtotal = ?, service_fee = ?, total_amount = ?, note = ? WHERE id = ?'
                : 'UPDATE orders SET subtotal = ?, service_fee = ?, total_amount = ? WHERE id = ?',
            hasNote
                ? [subtotal, serviceFee, totalAmount, note || null, id]
                : [subtotal, serviceFee, totalAmount, id]
        );
        await connection.commit();

        logActivity(
            req.user, 'order.edit', 'order', id,
            `${order.order_code}: ${Number(order.total_amount)}đ -> ${totalAmount}đ`
        );
        emitRealtime('order:updated', { id, status: order.status, payment_status: order.payment_status });

        return res.json({
            success: true,
            message: 'Đã cập nhật đơn hàng',
            data: { id, subtotal, service_fee: serviceFee, total_amount: totalAmount, status: order.status },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Lỗi nhân viên sửa đơn:', error.code || error.message);
        return res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus ? error.message : dbErrorMessage(error, 'Lỗi máy chủ khi sửa đơn hàng'),
        });
    } finally {
        connection?.release();
    }
});

module.exports = router;
