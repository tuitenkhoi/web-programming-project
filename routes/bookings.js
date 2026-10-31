const express = require('express');
const router = express.Router();
const { randomBytes } = require('node:crypto');
const db = require('../config/db'); // kết nối CSDL
const {
    verifyToken,
    requireAdmin,
} = require('../middleware/auth');

const VALID_STATUS = ['pending', 'confirmed', 'cancelled'];
const BOOKING_FILTER_STATUS = [
    'pending',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
];

const pad = (n) => String(n).padStart(2, '0');
const toMySqlDateTime = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ===== Khách đặt bàn (công khai) =====
router.post('/', async (req, res) => {
    let connection;
    let transactionStarted = false;

    const reject = (status, message) => {
        const error = new Error(message);
        error.httpStatus = status;
        throw error;
    };

    const readText = (value, label, maxLength, required = false) => {
        if (value === undefined || value === null) value = '';

        if (typeof value !== 'string') {
            reject(400, label + ' phải là chuỗi ký tự.');
        }

        const text = value.trim();

        if ((required && !text) || text.length > maxLength) {
            reject(400, label + ' bị thiếu hoặc vượt độ dài cho phép.');
        }

        return text;
    };

    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const MINUTE_MS = 60 * 1000;
    const DAY_MS = 24 * 60 * MINUTE_MS;
    const SLOT_MS = 120 * MINUTE_MS;

    const vnDate = (milliseconds) =>
        new Date(milliseconds + VN_OFFSET_MS)
            .toISOString()
            .slice(0, 10);

    const vnSqlTime = (milliseconds) =>
        new Date(milliseconds + VN_OFFSET_MS)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

    try {
        const body = req.body;

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            reject(400, 'Dữ liệu đặt bàn phải là một đối tượng JSON.');
        }

        const customerName = readText(
            body.customer_name, 'Họ tên', 100, true
        );

        const customerPhone = readText(
            body.customer_phone, 'Số điện thoại', 20, true
        );

        const customerEmail = readText(
            body.customer_email, 'Email', 150
        );

        const bookingDate = readText(
            body.booking_date, 'Ngày đặt', 10, true
        );

        const rawTime = readText(
            body.booking_time, 'Giờ đặt', 8, true
        );

        const tableCode = readText(
            body.table_code, 'Mã bàn', 20, true
        ).toUpperCase();

        const note = readText(body.note, 'Ghi chú', 300);

        if (customerName.length < 2) {
            reject(400, 'Họ tên phải có ít nhất 2 ký tự.');
        }

        if (!/^0\d{9}$/.test(customerPhone)) {
            reject(
                400,
                'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
            );
        }

        if (
            customerEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
        ) {
            reject(400, 'Email không hợp lệ.');
        }

        if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(tableCode)) {
            reject(400, 'Mã bàn không hợp lệ.');
        }

        const guestValue = body.guest_count;

        if (
            !['string', 'number'].includes(typeof guestValue) ||
            !/^[1-9]\d*$/.test(String(guestValue))
        ) {
            reject(400, 'Số khách phải là số nguyên dương.');
        }

        const guestCount = Number(guestValue);

        if (!Number.isSafeInteger(guestCount) || guestCount > 20) {
            reject(400, 'Số khách phải từ 1 đến 20.');
        }

        if (
            !/^20\d{2}-\d{2}-\d{2}$/.test(bookingDate) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(rawTime)
        ) {
            reject(400, 'Ngày hoặc giờ đặt bàn không đúng định dạng.');
        }

        const bookingTime = rawTime.slice(0, 5);
        const localStart = bookingDate + 'T' + bookingTime + ':00';
        const startMs = Date.parse(localStart + '+07:00');

        if (
            !Number.isFinite(startMs) ||
            vnSqlTime(startMs) !== localStart.replace('T', ' ')
        ) {
            reject(400, 'Ngày đặt bàn không tồn tại.');
        }

        const now = Date.now();

        if (startMs < now + 30 * MINUTE_MS) {
            reject(400, 'Vui lòng đặt bàn trước ít nhất 30 phút.');
        }

        if (bookingDate > vnDate(now + 30 * DAY_MS)) {
            reject(400, 'Chỉ được đặt bàn trước tối đa 30 ngày.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [tables] = await connection.execute(
            `SELECT id, table_code, table_name, capacity, area, status
             FROM coffee_tables
             WHERE table_code = ?
             FOR UPDATE`,
            [tableCode]
        );

        if (!tables.length) {
            reject(404, 'Bàn được chọn không tồn tại.');
        }

        const table = tables[0];

        if (!['available', 'occupied'].includes(table.status)) {
            reject(409, 'Bàn đang bảo trì hoặc không nhận đặt trước.');
        }

        if (guestCount > Number(table.capacity)) {
            reject(400, 'Số khách vượt quá sức chứa của bàn.');
        }

        if (startMs < Date.now() + 30 * MINUTE_MS) {
            reject(
                400,
                'Giờ đã chọn không còn đáp ứng thời gian đặt trước 30 phút.'
            );
        }

        const [conflicts] = await connection.execute(
            `SELECT id
             FROM bookings
             WHERE table_id = ?
               AND status IN ('pending', 'confirmed', 'seated')
               AND TIMESTAMP(booking_date, booking_time) < ?
               AND TIMESTAMP(booking_date, booking_time) > ?
             LIMIT 1
             FOR UPDATE`,
            [
                table.id,
                vnSqlTime(startMs + SLOT_MS),
                vnSqlTime(startMs - SLOT_MS),
            ]
        );

        if (conflicts.length) {
            reject(
                409,
                'Bàn đã có lịch đặt trùng trong khoảng 120 phút này.'
            );
        }

        const bookingCode =
            'BK' +
            bookingDate.replaceAll('-', '') +
            randomBytes(10).toString('hex').toUpperCase();

        const [result] = await connection.execute(
            `INSERT INTO bookings (
                booking_code,
                table_id,
                customer_name,
                customer_phone,
                customer_email,
                booking_date,
                booking_time,
                guest_count,
                note,
                status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                bookingCode,
                table.id,
                customerName,
                customerPhone,
                customerEmail || null,
                bookingDate,
                bookingTime + ':00',
                guestCount,
                note || null,
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message: 'Đã lưu yêu cầu đặt bàn. Vui lòng chờ xác nhận.',
            data: {
                id: result.insertId,
                booking_code: bookingCode,
                table_id: table.id,
                table_code: table.table_code,
                table_name: table.table_name,
                capacity: Number(table.capacity),
                area: table.area,
                booking_date: bookingDate,
                booking_time: bookingTime + ':00',
                booking_end: vnSqlTime(startMs + SLOT_MS),
                guest_count: guestCount,
                status: 'pending',
                duration_minutes: 120,
            },
        });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Lỗi rollback booking:',
                    rollbackError.code
                );
            }
        }

        if (error.httpStatus) {
            return res.status(error.httpStatus).json({
                success: false,
                message: error.message,
            });
        }

        console.error(
            'Lỗi tạo booking:',
            error.code || error.name
        );

        if (
            ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']
                .includes(error.code)
        ) {
            return res.status(503).json({
                success: false,
                message: 'Hệ thống đang bận. Vui lòng kiểm tra và thử lại sau.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Không thể hoàn tất yêu cầu. Hãy kiểm tra booking trước khi gửi lại.',
        });
    } finally {
        if (connection) connection.release();
    }
});

// ===== Danh sách đơn đặt bàn (admin) =====
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    const status = req.query.status;

    if (
        status !== undefined &&
        (
            typeof status !== 'string' ||
            !BOOKING_FILTER_STATUS.includes(status)
        )
    ) {
        return res.status(400).json({
            message: 'Trạng thái lọc không hợp lệ!',
        });
    }

    try {
        let sql = `
            SELECT
                b.id,
                b.booking_code,
                b.table_id,
                b.customer_name,
                b.customer_phone,
                b.customer_phone AS phone,
                b.customer_email,
                DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                TIME_FORMAT(b.booking_time, '%H:%i:%s') AS booking_time,
                b.guest_count,
                b.guest_count AS number_of_guests,
                b.note,
                b.status,
                b.created_at,
                b.updated_at,
                t.table_code,
                t.table_name,
                t.capacity,
                t.area
            FROM bookings AS b
            INNER JOIN coffee_tables AS t
                ON t.id = b.table_id
        `;

        const params = [];

        if (status !== undefined) {
            sql += ' WHERE b.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY b.created_at DESC, b.id DESC';

        const [bookings] = await db.execute(sql, params);

        res.json(bookings);
    } catch (error) {
        console.error('Lỗi lấy danh sách booking:', error.code);

        res.status(500).json({
            message: 'Không thể lấy danh sách đặt bàn!',
        });
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
