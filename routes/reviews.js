const express = require('express');
const db = require('../config/db');
const { verifyToken, requireCustomer } = require('../middleware/auth');

const router = express.Router();

router.get('/product/:productId', async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
        return res.status(400).json({ success: false, message: 'ID sản phẩm không hợp lệ.' });
    }
    try {
        const [rows] = await db.execute(
            `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
               FROM product_reviews r
               JOIN users u ON u.id = r.user_id
              WHERE r.product_id = ? AND r.status = 1
              ORDER BY r.id DESC LIMIT 100`,
            [productId]
        );
        const [summaryRows] = await db.execute(
            `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS average
               FROM product_reviews WHERE product_id = ? AND status = 1`,
            [productId]
        );
        return res.json({
            success: true,
            summary: { total: Number(summaryRows[0].total), average: Number(summaryRows[0].average) },
            data: rows,
        });
    } catch (error) {
        console.error('Lỗi lấy đánh giá:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải đánh giá.' });
    }
});

router.post('/', verifyToken, requireCustomer, async (req, res) => {
    const productId = Number(req.body?.product_id);
    const orderId = Number(req.body?.order_id);
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim().slice(0, 1000);
    if (!Number.isSafeInteger(productId) || productId <= 0 ||
        !Number.isSafeInteger(orderId) || orderId <= 0 ||
        !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Dữ liệu đánh giá không hợp lệ.' });
    }

    try {
        const [purchases] = await db.execute(
            `SELECT 1
               FROM orders o
               JOIN order_items oi ON oi.order_id = o.id
              WHERE o.id = ? AND o.user_id = ? AND oi.product_id = ?
                AND o.status = 'completed'
              LIMIT 1`,
            [orderId, req.user.id, productId]
        );
        if (!purchases.length) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có thể đánh giá món đã mua và hoàn thành.' });
        }
        const [result] = await db.execute(
            `INSERT INTO product_reviews (user_id, product_id, order_id, rating, comment)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), status = 1`,
            [req.user.id, productId, orderId, rating, comment || null]
        );
        return res.status(result.insertId ? 201 : 200).json({ success: true, message: 'Đã lưu đánh giá.' });
    } catch (error) {
        console.error('Lỗi lưu đánh giá:', error);
        return res.status(500).json({ success: false, message: 'Không thể lưu đánh giá.' });
    }
});

module.exports = router;
