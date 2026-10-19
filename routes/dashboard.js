const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/dashboard/stats - Lấy tổng quan chỉ số
router.get('/stats', async (req, res) => {
    try {
        const [[tablesCount]] = await db.query('SELECT COUNT(*) as total FROM tables');
        const [[bookingsCount]] = await db.query("SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'");
        const [[ordersCount]] = await db.query("SELECT COUNT(*) as total FROM orders WHERE status = 'completed'");

        res.json({
            totalTables: tablesCount.total,
            pendingBookings: bookingsCount.total,
            completedOrders: ordersCount.total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;