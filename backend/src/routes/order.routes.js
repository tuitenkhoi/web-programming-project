const express = require("express");
const {
    createOrder,
} = require("../controllers/order.controller");

const router = express.Router();

// Khách hàng không cần đăng nhập vẫn có thể gọi món.
router.post("/", createOrder);

module.exports = router;
