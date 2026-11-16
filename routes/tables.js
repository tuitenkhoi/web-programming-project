const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePermission, canTableTransition } = require('../middleware/permissions');
const { logActivity } = require('../services/audit');
const { dbErrorMessage } = require('../middleware/dbError');

router.get('/', async (req, res) => {
    try {
        const [tables] = await db.query(
            `SELECT
                id,
                table_code,
                table_name,
                table_name AS name,
                capacity,
                area,
                status
             FROM coffee_tables
             ORDER BY id`
        );

        res.json(tables);
    } catch (error) {
        console.error('Lỗi lấy danh sách bàn:', error.code, error.sqlMessage || error.message);

        res.status(500).json({
            message: dbErrorMessage(error, 'Lỗi truy vấn cơ sở dữ liệu!'),
        });
    }
});

// Admin thêm bàn mới. Mã bàn là duy nhất; bàn mới luôn ở trạng thái "trống".
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    const body = req.body || {};
    const code = String(body.table_code || '').trim().toUpperCase();
    const name = String(body.table_name || '').trim();
    const area = String(body.area || '').trim();
    const capacity = Number(body.capacity);

    if (!/^[A-Z0-9_-]{1,20}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'Mã bàn chỉ gồm chữ, số, "-" hoặc "_" (tối đa 20 ký tự).' });
    }
    if (!name || name.length > 100) {
        return res.status(400).json({ success: false, message: 'Tên bàn bắt buộc, tối đa 100 ký tự.' });
    }
    if (area.length > 100) {
        return res.status(400).json({ success: false, message: 'Khu vực tối đa 100 ký tự.' });
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
        return res.status(400).json({ success: false, message: 'Sức chứa phải từ 1 đến 20 người.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO coffee_tables (table_code, table_name, capacity, area, status)
             VALUES (?, ?, ?, ?, 'available')`,
            [code, name, capacity, area || null]
        );
        await logActivity(req.user, 'table.create', 'table', result.insertId, `${code} - ${name}`);
        res.status(201).json({
            success: true,
            message: 'Đã thêm bàn ' + name + '.',
            data: { id: result.insertId, table_code: code, table_name: name, name, capacity, area: area || null, status: 'available' },
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Mã bàn ' + code + ' đã tồn tại.' });
        }
        console.error('Lỗi thêm bàn:', error.code, error.sqlMessage || error.message);
        res.status(500).json({ success: false, message: dbErrorMessage(error, 'Không thể thêm bàn.') });
    }
});

router.patch('/:id/status', verifyToken, requirePermission('tables.update'), async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status;
    const allowed = ['available', 'occupied', 'maintenance'];

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Mã bàn không hợp lệ.',
        });
    }

    if (typeof status !== 'string' || !allowed.includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Chỉ chấp nhận available, occupied hoặc maintenance.',
        });
    }

    const transitions = {
        available: ['occupied', 'maintenance'],
        occupied: ['available'],
        maintenance: ['available'],
    };

    const fail = (httpStatus, message) => {
        const error = new Error(message);
        error.httpStatus = httpStatus;
        throw error;
    };

    const sqlVnTime = (milliseconds) =>
        new Date(milliseconds + 7 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

    let connection;
    let inTransaction = false;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        inTransaction = true;

        const [tables] = await connection.execute(
            `SELECT id, table_code, status
             FROM coffee_tables
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (!tables.length) {
            fail(404, 'Không tìm thấy bàn.');
        }

        const table = tables[0];
        const unchanged = table.status === status;

        if (!unchanged) {
            if (!canTableTransition(req.user, table.status, status)) {
                fail(403, 'Vị trí của bạn không được đổi bàn từ trạng thái này sang trạng thái kia.');
            }

            if (!transitions[table.status]?.includes(status)) {
                fail(
                    409,
                    'Không được chuyển trực tiếp từ ' +
                    table.status + ' sang ' + status + '.'
                );
            }

            const [seated] = await connection.execute(
                `SELECT id
                 FROM bookings
                 WHERE table_id = ?
                   AND status = 'seated'
                 LIMIT 1
                 FOR UPDATE`,
                [id]
            );

            if (seated.length) {
                fail(
                    409,
                    'Bàn có booking đang phục vụ. Hãy xử lý qua API booking.'
                );
            }

            const [openOrders] = await connection.execute(
                `SELECT id
                 FROM orders
                 WHERE table_code = ?
                   AND status <> 'cancelled'
                   AND (
                       status <> 'completed'
                       OR payment_status NOT IN ('paid', 'refunded')
                   )
                 LIMIT 1
                 FOR UPDATE`,
                [table.table_code]
            );

            if (openOrders.length) {
                fail(
                    409,
                    'Bàn còn đơn hàng chưa hoàn tất hoặc chưa xử lý thanh toán.'
                );
            }

            const now = Date.now();
            const durationMs = 120 * 60 * 1000;

            if (status === 'occupied' || status === 'maintenance') {
                let sql = `
                    SELECT id
                    FROM bookings
                    WHERE table_id = ?
                      AND status IN ('pending', 'confirmed')
                      AND booking_date >= ?
                      AND TIMESTAMP(booking_date, booking_time) > ?
                `;

                const params = [
                    id,
                    sqlVnTime(now - durationMs).slice(0, 10), // lọc ngày trước để dùng index
                    sqlVnTime(now - durationMs),
                ];

                if (status === 'occupied') {
                    sql += `
                        AND TIMESTAMP(booking_date, booking_time) < ?
                    `;

                    params.push(sqlVnTime(now + durationMs));
                }

                sql += ' LIMIT 1 FOR UPDATE';

                const [reservations] = await connection.execute(
                    sql,
                    params
                );

                if (reservations.length) {
                    fail(
                        409,
                        status === 'occupied'
                            ? 'Bàn có lịch đặt chồng với 120 phút tới. Không nhận khách vãng lai bằng thao tác này.'
                            : 'Bàn còn lịch đặt chưa hết hạn. Cần xử lý các booking trước khi bảo trì.'
                    );
                }
            }

            await connection.execute(
                'UPDATE coffee_tables SET status = ? WHERE id = ?',
                [status, id]
            );
        }

        await connection.commit();
        inTransaction = false;

        if (!unchanged) {
            logActivity(req.user, 'table.status', 'table', id, table.table_code + ': ' + table.status + ' -> ' + status);
        }

        require('../realtime').emit('table:updated', {
            id,
            table_code: table.table_code,
            status,
        });

        res.json({
            success: true,
            message: unchanged
                ? 'Bàn đã ở trạng thái này, không cập nhật lại.'
                : 'Cập nhật trạng thái bàn thành công.',
            status,
            data: {
                id,
                table_code: table.table_code,
                status,
                unchanged,
            },
        });
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Lỗi rollback trạng thái bàn:',
                    rollbackError.code
                );
            }
        }

        console.error(
            'Lỗi cập nhật bàn:',
            error.code || error.httpStatus || error.name
        );

        res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus
                ? error.message
                : 'Không thể cập nhật bàn. Hãy tải lại dữ liệu trước khi thử lại.',
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
