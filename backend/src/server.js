require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    testDatabaseConnection
} = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");

const app = express();

const PORT = process.env.PORT || 3000;

// Đọc dữ liệu từ request
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Kiểm tra server
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Mộc Coffee API đang hoạt động",
        timestamp: new Date().toISOString()
    });
});

// Đăng ký API danh mục và sản phẩm
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);

// Đặt phần xử lý 404 SAU tất cả route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API không tồn tại"
    });
});

// Khởi động server
app.listen(PORT, async () => {
    console.log(
        `Backend đang chạy tại http://localhost:${PORT}`
    );

    await testDatabaseConnection();
});