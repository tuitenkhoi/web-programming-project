/* Quản lý voucher dành cho quản trị viên.
   Gắn trong server.js:
   app.use('/api/admin/vouchers', verifyToken, requireAdmin, require('./routes/admin-vouchers')); */
const express = require('express');
const db = require('../config/db');

const router = express.Router();

const SELECT = `SELECT id, code, name, description, discount_type, value, min_order, max_discount,
        DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i') AS starts_at,
        DATE_FORMAT(ends_at, '%Y-%m-%dT%H:%i') AS ends_at,
        usage_limit, per_user_limit, used_count, status,
        (starts_at <= NOW() AND ends_at >= NOW()) AS in_period,
        (ends_at < NOW()) AS expired
   FROM vouchers`;

function toDateTime(value) {
    const text = String(value || '').trim().replace('T', ' ');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text)) return null;
    return text.length === 16 ? `${text}:00` : text;
}

function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    return Number(value);
}

function validate(body) {
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const type = body.discount_type;
    const value = Number(body.value);
    const minOrder = Number(body.min_order || 0);
    const maxDiscount = optionalNumber(body.max_discount);
    const usageLimit = optionalNumber(body.usage_limit);
    const perUser = Number(body.per_user_limit || 1);
    const startsAt = toDateTime(body.starts_at);
    const endsAt = toDateTime(body.ends_at);
    const status = body.status === 0 || body.status === '0' || body.status === false ? 0 : 1;

    if (!/^[A-Z0-9-]{3,30}$/.test(code)) return { error: 'Mã voucher gồm 3-30 ký tự chữ hoa, số hoặc dấu gạch ngang.' };
    if (name.length < 2 || name.length > 120) return { error: 'Tên voucher phải từ 2 đến 120 ký tự.' };
    if (description.length > 255) return { error: 'Mô tả tối đa 255 ký tự.' };
    if (!['percent', 'fixed'].includes(type)) return { error: 'Loại giảm giá không hợp lệ.' };
    if (!Number.isFinite(value) || value <= 0) return { error: 'Giá trị giảm phải lớn hơn 0.' };
    if (type === 'percent' && value > 100) return { error: 'Giảm theo % không được vượt quá 100.' };
    if (!Number.isFinite(minOrder) || minOrder < 0) return { error: 'Đơn tối thiểu không hợp lệ.' };
    if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return { error: 'Giảm tối đa không hợp lệ.' };
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) return { error: 'Tổng lượt dùng phải là số nguyên từ 1 trở lên.' };
    if (!Number.isInteger(perUser) || perUser < 1) return { error: 'Lượt dùng mỗi khách phải là số nguyên từ 1 trở lên.' };
    if (!startsAt || !endsAt) return { error: 'Vui lòng nhập thời gian bắt đầu và kết thúc.' };
    if (endsAt <= startsAt) return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };

    return {
        value: [code, name, description || null, type, value, minOrder, maxDiscount, startsAt, endsAt, usageLimit, perUser, status],
    };
}

const COLUMNS = 'code, name, description, discount_type, value, min_order, max_discount, starts_at, ends_at, usage_limit, per_user_limit, status';

function sendError(res, error, fallback) {
    if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
    }
    console.error(fallback, error);
    return res.status(500).json({ success: false, message: fallback });
}

router.get('/', async (_req, res) => {
    try {
        const [rows] = await db.execute(`${SELECT} ORDER BY id DESC`);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        sendError(res, error, 'Không thể tải danh sách voucher.');
    }
});

router.post('/', async (req, res) => {
    const check = validate(req.body || {});
    if (check.error) return res.status(400).json({ success: false, message: check.error });
    try {
        const [result] = await db.execute(
            `INSERT INTO vouchers (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            check.value
        );
        const [rows] = await db.execute(`${SELECT} WHERE id = ?`, [result.insertId]);
        res.status(201).json({ success: true, message: 'Đã tạo voucher.', data: rows[0] });
    } catch (error) {
        sendError(res, error, 'Không thể tạo voucher.');
    }
});

router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const check = validate(req.body || {});
    if (check.error) return res.status(400).json({ success: false, message: check.error });
    try {
        const [result] = await db.execute(
            `UPDATE vouchers SET code = ?, name = ?, description = ?, discount_type = ?, value = ?, min_order = ?,
                    max_discount = ?, starts_at = ?, ends_at = ?, usage_limit = ?, per_user_limit = ?, status = ?
              WHERE id = ?`,
            [...check.value, id]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        const [rows] = await db.execute(`${SELECT} WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Đã cập nhật voucher.', data: rows[0] });
    } catch (error) {
        sendError(res, error, 'Không thể cập nhật voucher.');
    }
});

router.patch('/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const status = Number(req.body?.status) === 1 ? 1 : 0;
    try {
        const [result] = await db.execute('UPDATE vouchers SET status = ? WHERE id = ?', [status, id]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        const [rows] = await db.execute(`${SELECT} WHERE id = ?`, [id]);
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        sendError(res, error, 'Không thể đổi trạng thái voucher.');
    }
});

router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    try {
        const [used] = await db.execute('SELECT COUNT(*) AS total FROM voucher_usages WHERE voucher_id = ?', [id]);
        if (Number(used[0].total) > 0) {
            return res.status(409).json({ success: false, message: 'Voucher đã được dùng trong đơn hàng nên không thể xóa. Hãy tắt voucher thay vì xóa.' });
        }
        const [result] = await db.execute('DELETE FROM vouchers WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        res.json({ success: true, message: 'Đã xóa voucher.' });
    } catch (error) {
        sendError(res, error, 'Không thể xóa voucher.');
    }
});

module.exports = router;
