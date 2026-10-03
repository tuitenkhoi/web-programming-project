const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

// GET /api/categories
router.get("/", async (req, res) => {
    try {
        const [categories] = await pool.execute(`
            SELECT id, name, slug, description
            FROM categories
            WHERE status = 1
            ORDER BY id ASC
        `);

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error("Lỗi lấy danh mục:", error.code);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách danh mục"
        });
    }
});

module.exports = router;