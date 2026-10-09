const express = require('express');
const router = express.Router();

// Giả lập dữ liệu bàn để test nhanh trước khi nối Database
let tables = [
    { id: 1, name: 'Bàn 01', capacity: 4, status: 'available' },
    { id: 2, name: 'Bàn 02', capacity: 2, status: 'occupied' },
    { id: 3, name: 'Bàn 03', capacity: 6, status: 'reserved' }
];

// Lấy danh sách sơ đồ bàn
router.get('/', (req, res) => {
    res.json(tables);
});

// Cập nhật trạng thái bàn (available / occupied / reserved)
router.patch('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const table = tables.find(t => t.id == id);
    if (table) {
        table.status = status;
        return res.json({ message: 'Cập nhật trạng thái thành công!', table });
    }
    res.status(404).json({ message: 'Không tìm thấy bàn!' });
});

module.exports = router;