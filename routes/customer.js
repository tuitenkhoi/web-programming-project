const express = require('express');
const db = require('../config/db');
const { verifyToken, requireCustomer } = require('../middleware/auth');

const router = express.Router();

function groupItems(orders, items) {
    const byOrder = new Map();
    items.forEach((item) => {
        const orderId = Number(item.order_id);
        if (!byOrder.has(orderId)) byOrder.set(orderId, []);
        byOrder.get(orderId).push({
            ...item,
            unit_price: Number(item.unit_price),
            line_total: Number(item.line_total),
            quantity: Number(item.quantity),
            toppings: (() => {
                try { return JSON.parse(item.toppings || '[]'); } catch { return []; }
            })(),
        });
    });
    return orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        discount_amount: Number(order.discount_amount),
        service_fee: Number(order.service_fee),
        total_amount: Number(order.total_amount),
        items: byOrder.get(Number(order.id)) || [],
    }));
}

async function loadItems(orderIds) {
    if (!orderIds.length) return [];
    const placeholders = orderIds.map(() => '?').join(',');
    const [items] = await db.execute(
        `SELECT order_id, product_id, product_name, product_image, unit_price,
                quantity, line_total, size, sugar_level, ice_level, toppings, note
           FROM order_items
          WHERE order_id IN (${placeholders})
          ORDER BY id`,
        orderIds
    );
    return items;
}

router.get('/orders', verifyToken, requireCustomer, async (req, res) => {
    try {
        const [orders] = await db.execute(
            `SELECT id, order_code, order_type, table_code, coupon_code, subtotal,
                    discount_amount, service_fee, total_amount, payment_method,
                    payment_status, status, created_at
               FROM orders
              WHERE user_id = ?
              ORDER BY id DESC
              LIMIT 100`,
            [req.user.id]
        );
        const items = await loadItems(orders.map((order) => order.id));
        return res.json({ success: true, count: orders.length, data: groupItems(orders, items) });
    } catch (error) {
        console.error('Lỗi lấy lịch sử khách hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải lịch sử đơn hàng.' });
    }
});

// Khách vãng lai chỉ tra một đơn khi biết đồng thời mã đơn và số điện thoại.
router.post('/orders/lookup', async (req, res) => {
    const orderCode = String(req.body?.order_code || '').trim().toUpperCase().slice(0, 30);
    const phone = String(req.body?.phone || '').trim().slice(0, 20);
    if (!/^[A-Z0-9-]{5,30}$/.test(orderCode) || !/^0\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Mã đơn hoặc số điện thoại không hợp lệ.' });
    }

    try {
        const [orders] = await db.execute(
            `SELECT id, order_code, order_type, table_code, coupon_code, subtotal,
                    discount_amount, service_fee, total_amount, payment_method,
                    payment_status, status, created_at
               FROM orders
              WHERE order_code = ? AND customer_phone = ?
              LIMIT 1`,
            [orderCode, phone]
        );
        if (!orders.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng phù hợp.' });
        }
        const items = await loadItems([orders[0].id]);
        return res.json({ success: true, data: groupItems(orders, items)[0] });
    } catch (error) {
        console.error('Lỗi tra cứu đơn hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể tra cứu đơn hàng.' });
    }
});

module.exports = router;
