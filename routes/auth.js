const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Import kết nối CSDL từ config/db.js

// 1. Lấy danh sách sơ đồ bàn từ CSDL MySQL
router.get('/', async (req, res) => {
    try {
        const [tables] = await db.query('SELECT * FROM tables');
        res.json(tables);
    } catch (err) {
        console.error('Lỗi CSDL:', err);
        res.status(500).json({ message: 'Lỗi truy vấn cơ sở dữ liệu!', error: err.message });
    }
});

// 2. Cập nhật trạng thái bàn (available / occupied / reserved) trong CSDL
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const [result] = await db.query('UPDATE tables SET status = ? WHERE id = ?', [status, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bàn cần cập nhật!' });
        }

        res.json({ message: 'Cập nhật trạng thái bàn trong Database thành công!' });
    } catch (err) {
        console.error('Lỗi CSDL:', err);
        res.status(500).json({ message: 'Lỗi khi cập nhật cơ sở dữ liệu!', error: err.message });
    }
});

module.exports = router;