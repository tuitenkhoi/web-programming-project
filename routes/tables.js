const express = require('express');
const router = express.Router();
const db = require('../config/db');
const {
    verifyToken,
    requireAdmin,
} = require('../middleware/auth');

const VALID_STATUS = ['available', 'occupied', 'reserved'];

// 1. Lấy danh sách sơ đồ bàn (công khai để form khách chọn bàn)
router.get('/', async (req, res) => {
    try {
        const [tables] = await db.query(`
            SELECT
                id,
                table_code,
                table_name,
                table_name AS name,
                capacity,
                area,
                status
            FROM coffee_tables
            ORDER BY id
        `);

        res.json(tables);
    } catch (err) {
        console.error('Lỗi lấy danh sách bàn:', err.code);

        res.status(500).json({
            message: 'Lỗi truy vấn cơ sở dữ liệu!'
        });
    }
});

// 2. Cập nhật trạng thái bàn (admin)
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Mã bàn không hợp lệ!' });
    }
    if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái bàn không hợp lệ!' });
    }

    try {
        const [result] = await db.query('UPDATE tables SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bàn cần cập nhật!' });
        }
        res.json({ message: 'Cập nhật trạng thái bàn thành công!', status });
    } catch (err) {
        console.error('Lỗi CSDL:', err);
        res.status(500).json({ message: 'Lỗi khi cập nhật cơ sở dữ liệu!' });
    }
});

module.exports = router;
