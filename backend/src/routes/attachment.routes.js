const express = require("express");

const { deleteAttachment } = require("../controllers/attachment.controller");
const {
    verifyToken: authenticateToken,
    requireAdmin: authorizeAdmin,
} = require("../../../middleware/auth");

const router = express.Router();

// Admin xóa một tệp đính kèm (thêm/xem nằm ở /api/products/:id/attachments)
router.delete("/:id", authenticateToken, authorizeAdmin, deleteAttachment);

module.exports = router;
