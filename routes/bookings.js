const express = require('express');
const router = express.Router();
const db = require('../config/db'); // kết nối CSDL
const {
    verifyToken,
    requireAdmin,
} = require('../middleware/auth');

const VALID_STATUS = ['pending', 'confirmed', 'cancelled'];

const pad = (n) => String(n).padStart(2, '0');
const toMySqlDateTime = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ===== Khách đặt bàn (công khai) =====
router.post('/', async (req, res) => {
    const body = req.body || {};
    const customer_name = String(body.customer_name || '').trim();
    const phone = String(body.phone || '').trim();
    const guests = Number(body.number_of_guests);
    const when = new Date(body.booking_time);
    const hasTable = body.table_id !== undefined && body.table_id !== null && body.table_id !== '';
    const table_id = hasTable ? Number(body.table_id) : null;

    // 1. Validate dữ liệu đầu vào
    if (!customer_name || !phone || !body.booking_time || !body.number_of_guests) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc!' });
    }
    if (customer_name.length < 2 || customer_name.length > 100) {
        return res.status(400).json({ message: 'Tên khách hàng phải từ 2 đến 100 ký tự!' });
    }
    if (!/^[0-9]{9,11}$/.test(phone)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ!' });
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
        return res.status(400).json({ message: 'Số khách phải là số nguyên từ 1 đến 20!' });
    }
    if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: 'Thời gian đặt bàn không hợp lệ!' });
    }
    if (when.getTime() < Date.now() - 60 * 1000) {
        return res.status(400).json({ message: 'Thời gian đặt bàn không được ở quá khứ!' });
    }
    if (hasTable && (!Number.isInteger(table_id) || table_id <= 0)) {
        return res.status(400).json({ message: 'Mã bàn không hợp lệ!' });
    }

    try {
        const bookingTime = toMySqlDateTime(when);

        if (table_id !== null) {
            const [tables] = await db.query('SELECT * FROM tables WHERE id = ?', [table_id]);
            if (tables.length === 0) {
                return res.status(400).json({ message: 'Bàn được chọn không tồn tại!' });
            }
            if (tables[0].capacity != null && guests > tables[0].capacity) {
                return res.status(400).json({ message: 'Số khách vượt quá sức chứa của bàn!' });
            }
            const [clash] = await db.query(
                "SELECT id FROM bookings WHERE table_id = ? AND booking_time = ? AND status <> 'cancelled' LIMIT 1",
                [table_id, bookingTime]
            );
            if (clash.length > 0) {
                return res.status(409).json({ message: 'Bàn đã có người đặt vào thời điểm này!' });
            }
        }

        // 2. Thêm đơn đặt bàn mới (trạng thái: pending)
        const sql = `
            INSERT INTO bookings (customer_name, phone, booking_time, number_of_guests, table_id, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `;
        const [result] = await db.query(sql, [customer_name, phone, bookingTime, guests, table_id]);

        res.status(201).json({
            message: 'Gửi yêu cầu đặt bàn thành công! Chúng tôi sẽ liên hệ lại để xác nhận',
            bookingId: result.insertId
        });
    } catch (err) {
        console.error('Lỗi khi lưu booking:', err);
        res.status(500).json({ message: 'Lỗi máy chủ! Không thể đặt bàn.' });
    }
});

// ===== Danh sách đơn đặt bàn (admin) =====
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !VALID_STATUS.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái lọc không hợp lệ!' });
    }

    try {
        let sql = `
            SELECT b.*, t.name AS table_name
            FROM bookings b
            LEFT JOIN tables t ON b.table_id = t.id
        `;
        const params = [];
        if (status) {
            sql += ' WHERE b.status = ?';
            params.push(status);
        }
        sql += ' ORDER BY b.created_at DESC, b.id DESC';

        const [bookings] = await db.query(sql, params);
        res.json(bookings);
    } catch (err) {
        console.error('Lỗi lấy danh sách booking:', err);
        res.status(500).json({ message: 'Lỗi lấy danh sách booking!' });
    }
});

// ===== Duyệt / hủy đơn đặt bàn (admin) =====
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {}; // pending | confirmed | cancelled

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Mã đơn đặt bàn không hợp lệ!' });
    }
    if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ!' });
    }

    try {
        const [rows] = await db.query('SELECT id, table_id FROM bookings WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt bàn!' });
        }
        const tableId = rows[0].table_id;

        await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);

        // Đồng bộ sơ đồ bàn
        let tableStatus = null;
        if (tableId) {
            if (status === 'confirmed') {
                // Chỉ giữ chỗ khi bàn đang trống (không ghi đè bàn đang có khách)
                const [r] = await db.query(
                    "UPDATE tables SET status = 'reserved' WHERE id = ? AND status = 'available'",
                    [tableId]
                );
                if (r.affectedRows > 0) tableStatus = 'reserved';
            } else {
                // Hủy/đưa về chờ: trả bàn về trống nếu không còn đơn confirmed nào khác giữ bàn này
                const [[other]] = await db.query(
                    "SELECT COUNT(*) AS cnt FROM bookings WHERE table_id = ? AND status = 'confirmed' AND id <> ?",
                    [tableId, id]
                );
                if (other.cnt === 0) {
                    const [r] = await db.query(
                        "UPDATE tables SET status = 'available' WHERE id = ? AND status = 'reserved'",
                        [tableId]
                    );
                    if (r.affectedRows > 0) tableStatus = 'available';
                }
            }
        }

        res.json({ message: 'Cập nhật trạng thái đơn đặt bàn thành công', status, tableStatus });
    } catch (err) {
        console.error('Lỗi cập nhật trạng thái booking:', err);
        res.status(500).json({ message: 'Lỗi cập nhật trạng thái' });
    }
});

module.exports = router;
