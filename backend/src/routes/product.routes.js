const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

// GET /api/products
router.get("/", async (req, res) => {
    try {
        const [products] = await pool.execute(`
            SELECT
                p.id,
                p.category_id,
                c.name AS category_name,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.image
            FROM products AS p
            INNER JOIN categories AS c
                ON p.category_id = c.id
            WHERE p.status = 1
                AND c.status = 1
            ORDER BY p.id ASC
        `);

        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error("Lỗi lấy sản phẩm:", error.code);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách sản phẩm"
        });
    }
});

module.exports = router;