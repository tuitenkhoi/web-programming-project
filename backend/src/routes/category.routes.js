const express = require("express");

const {
    getCategories,
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/category.controller");

const {
    authenticateToken,
    authorizeAdmin,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getCategories);

router.get(
    "/admin",
    authenticateToken,
    authorizeAdmin,
    getAllCategories
);

router.get("/:id", getCategoryById);

router.post(
    "/",
    authenticateToken,
    authorizeAdmin,
    createCategory
);

router.put(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    updateCategory
);

router.delete(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    deleteCategory
);

module.exports = router;