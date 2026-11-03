const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/dashboard/stats - Tổng quan chỉ số (server.js đã gắn verifyToken)
router.get('/stats', async (req, res) => {
    try {
        const count = async (sql) => {
            const [[row]] = await db.query(sql);
            return row.total;
        };

        // Doanh thu tính theo đơn đã thanh toán. Lọc theo khoảng thời gian (không bọc created_at trong DATE())
        // để MySQL dùng được index idx_orders_created_at.
        const revenue = async (fromSql, toSql) => {
            const [[row]] = await db.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total
                 FROM orders
                 WHERE payment_status = 'paid'
                   AND created_at >= ${fromSql}
                   AND created_at < ${toSql}`
            );
            return Number(row.total);
        };

        const [totalTables, occupiedTables, reservedTables, pendingBookings, completedOrders, todayRevenue, yesterdayRevenue] = await Promise.all([
            count('SELECT COUNT(*) AS total FROM coffee_tables'),
            count("SELECT COUNT(*) AS total FROM coffee_tables WHERE status = 'occupied'"),
            // Bàn đã đặt = số bàn có booking đã xác nhận trong hôm nay
            count("SELECT COUNT(DISTINCT table_id) AS total FROM bookings WHERE status = 'confirmed' AND booking_date = CURDATE()"),
            count("SELECT COUNT(*) AS total FROM bookings WHERE status = 'pending'"),
            count("SELECT COUNT(*) AS total FROM orders WHERE status = 'completed'"),
            revenue('CURDATE()', 'CURDATE() + INTERVAL 1 DAY'),
            revenue('CURDATE() - INTERVAL 1 DAY', 'CURDATE()')
        ]);

        res.json({ totalTables, occupiedTables, reservedTables, pendingBookings, completedOrders, todayRevenue, yesterdayRevenue });
    } catch (err) {
        console.error('Lỗi dashboard:', err);
        res.status(500).json({ message: 'Lỗi lấy số liệu tổng quan!' });
    }
});

module.exports = router;