const express = require("express");

const {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    patchProduct,
    deleteProduct,
    pinProduct,
    setProductTags,
} = require("../controllers/product.controller");

const {
    getProductAttachments,
    addProductAttachments,
} = require("../controllers/attachment.controller");

// Dùng middleware chung của server chính (có kiểm tra tài khoản trong DB)
const {
    verifyToken: authenticateToken,
    requireAdmin: authorizeAdmin,
} = require("../../../middleware/auth");

const {
    upload,
    verifyImageContent,
    attachments,
} = require("../middleware/upload.middleware");

const router = express.Router();

// Người dùng xem và tìm kiếm sản phẩm hoạt động
router.get("/", getProducts);

// Admin xem tất cả sản phẩm
// Phải đặt trước /:id
router.get(
    "/admin",
    authenticateToken,
    authorizeAdmin,
    getAllProducts
);

// Xem chi tiết sản phẩm
router.get("/:id", getProductById);

// Admin thêm sản phẩm
router.post(
    "/",
    authenticateToken,
    authorizeAdmin,
    upload.single("image"),
    verifyImageContent,
    createProduct
);

// Admin cập nhật sản phẩm
router.put(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    upload.single("image"),
    verifyImageContent,
    updateProduct
);

// Admin sửa một phần (JSON, không có file) - dùng cho tự lưu
router.patch(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    patchProduct
);

// Admin ghim / bỏ ghim sản phẩm (không có file đính kèm nên không cần multer)
router.put(
    "/:id/pin",
    authenticateToken,
    authorizeAdmin,
    pinProduct
);

// Admin thay toàn bộ nhãn của món (JSON { tag_ids: [...] })
router.put(
    "/:id/tags",
    authenticateToken,
    authorizeAdmin,
    setProductTags
);

// Tệp đính kèm: xem công khai, thêm (tối đa 5 file/lần) chỉ admin
router.get("/:id/attachments", getProductAttachments);
router.post(
    "/:id/attachments",
    authenticateToken,
    authorizeAdmin,
    attachments.array("files"),
    attachments.verifyContent,
    addProductAttachments
);

// Admin xóa sản phẩm
router.delete(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    deleteProduct
);

module.exports = router;