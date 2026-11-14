const express = require("express");
const {
    createOrder,
} = require("../controllers/order.controller");
const {
    getOrders,
    getOrderById,
    updateOrderStatus,
    confirmOrderPayment,
} = require("../controllers/order.admin.controller");
// Middleware chung của server chính: verifyToken = phải đăng nhập, requireAdmin = phải là admin
const {
    verifyToken,
    optionalToken,
} = require("../../../middleware/auth");
const {
    requirePermission,
    requireOrderStatusPermission,
} = require("../../../middleware/permissions");

const router = express.Router();

// Khách hàng không cần đăng nhập vẫn có thể gọi món.
router.post("/", optionalToken, createOrder);

// Các API dưới đây dành cho admin và nhân viên (admin luôn đủ quyền; nhân viên theo vị trí, xem middleware/permissions.js).
router.get("/", verifyToken, requirePermission("orders.view"), getOrders);
router.get("/:id", verifyToken, requirePermission("orders.view"), getOrderById);
router.patch(
    "/:id/status",
    verifyToken,
    requirePermission("orders.view"),
    requireOrderStatusPermission,
    updateOrderStatus
);
router.patch("/:id/payment", verifyToken, requirePermission("orders.payment"), confirmOrderPayment);

module.exports = router;
