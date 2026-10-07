require("dotenv").config();

const multer = require("multer");
const path = require("path");
const express = require("express");
const cors = require("cors");

const {
    testDatabaseConnection,
} = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "../uploads")
    )
);
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Mộc Coffee API đang hoạt động",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API không tồn tại",
    });
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Ảnh sản phẩm không được vượt quá 5 MB",
            });
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Tên trường upload phải là image",
            });
        }

        return res.status(400).json({
            success: false,
            message: `Lỗi upload: ${error.message}`,
        });
    }

    if (error.message === "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP") {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }

    console.error("Lỗi chưa được xử lý:", error);

    return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ",
    });
});

app.listen(PORT, async () => {
    console.log(`Backend đang chạy tại http://localhost:${PORT}`);
    await testDatabaseConnection();
});
