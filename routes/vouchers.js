const express = require('express');
const db = require('../config/db');

const router = express.Router();

function calculate(voucher, subtotal) {
    const value = Number(voucher.value);
    let discount = voucher.discount_type === 'percent'
        ? Math.round(subtotal * value / 100)
        : Math.round(value);
    if (voucher.max_discount !== null) {
        discount = Math.min(discount, Number(voucher.max_discount));
    }
    return Math.max(0, Math.min(discount, subtotal));
}

router.get('/', async (_req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT code, name, description, discount_type, value, min_order,
                    max_discount, starts_at, ends_at
               FROM vouchers
              WHERE status = 1
                AND starts_at <= NOW()
                AND ends_at >= NOW()
                AND (usage_limit IS NULL OR used_count < usage_limit)
              ORDER BY value DESC, id DESC`
        );
        return res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Lỗi lấy voucher:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải voucher.' });
    }
});

router.post('/validate', async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 30);
    const subtotal = Number(req.body?.subtotal);
    if (!/^[A-Z0-9-]{3,30}$/.test(code) || !Number.isFinite(subtotal) || subtotal < 0) {
        return res.status(400).json({ success: false, message: 'Mã voucher hoặc giá trị đơn hàng không hợp lệ.' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT code, name, description, discount_type, value, min_order,
                    max_discount, usage_limit, used_count
               FROM vouchers
              WHERE code = ? AND status = 1
                AND starts_at <= NOW() AND ends_at >= NOW()
              LIMIT 1`,
            [code]
        );
        const voucher = rows[0];
        if (!voucher || (voucher.usage_limit !== null && Number(voucher.used_count) >= Number(voucher.usage_limit))) {
            return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc đã hết hạn.' });
        }
        if (subtotal < Number(voucher.min_order)) {
            return res.status(400).json({ success: false, message: `Đơn hàng tối thiểu ${Number(voucher.min_order).toLocaleString('vi-VN')}đ.` });
        }
        return res.json({
            success: true,
            data: { ...voucher, discount_amount: calculate(voucher, subtotal) },
        });
    } catch (error) {
        console.error('Lỗi kiểm tra voucher:', error);
        return res.status(500).json({ success: false, message: 'Không thể kiểm tra voucher.' });
    }
});

module.exports = router;
