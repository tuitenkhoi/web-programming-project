// Dùng chung kết nối DB của server chính
const pool = require("../../../config/db");
const fs = require("fs/promises");
const path = require("path");
const { listAttachments, removeStoredFile } = require("./attachment.controller");

const productUploadDirectory = path.join(
    __dirname,
    "../../uploads/products"
);

const createSlug = (value) => {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

const parsePositiveId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const parseStatus = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }

    const status = Number(value);

    if (status !== 0 && status !== 1) {
        return null;
    }

    return status;
};

const createUploadedImagePath = (file) => {
    if (!file) {
        return null;
    }

    return `/uploads/products/${file.filename}`;
};

const removeUploadedFile = async (file) => {
    if (!file?.path) {
        return;
    }

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Lỗi xóa file vừa upload:",
                error
            );
        }
    }
};

const removeStoredImage = async (imagePath) => {
    if (
        typeof imagePath !== "string" ||
        !imagePath.startsWith("/uploads/products/")
    ) {
        return;
    }

    const filename = path.basename(imagePath);

    try {
        await fs.unlink(
            path.join(
                productUploadDirectory,
                filename
            )
        );
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Lỗi xóa ảnh sản phẩm:",
                error
            );
        }
    }
};

const rejectUploadedRequest = async (
    req,
    res,
    statusCode,
    message
) => {
    await removeUploadedFile(req.file);

    return res.status(statusCode).json({
        success: false,
        message,
    });
};

const formatProduct = (req, product) => {
    let imageUrl = null;

    if (
        typeof product.image === "string" &&
        product.image.startsWith("/uploads/")
    ) {
        imageUrl =
            `${req.protocol}://${req.get("host")}` +
            product.image;
    }

    // Số liệu gộp từ LEFT JOIN (chuỗi do MySQL trả về) -> số
    const aggregates = {};

    if (product.rating_avg !== undefined) {
        aggregates.rating_avg = Math.round(Number(product.rating_avg || 0) * 10) / 10;
        aggregates.rating_count = Number(product.rating_count || 0);
        aggregates.video_count = Number(product.video_count || 0);
        aggregates.file_count = Number(product.file_count || 0);
        aggregates.attachment_count = Number(product.attachment_count || 0);
    }

    return {
        ...product,
        ...aggregates,
        ...(product.has_voucher !== undefined
            ? { has_voucher: Number(product.has_voucher) === 1 ? 1 : 0 }
            : {}),
        ...(product.is_pinned !== undefined
            ? { is_pinned: Number(product.is_pinned) === 1 ? 1 : 0 }
            : {}),
        image_url: imageUrl,
    };
};

// Escape % và _ để người dùng gõ "50%" hay "a_b" thì tìm đúng ký tự đó, không bị hiểu là ký tự đại diện của LIKE
const escapeLike = (text) => text.replace(/[\\%_]/g, "\\$&");

// Sắp xếp mặc định (khi client không gửi ?sort=): sản phẩm ghim lên đầu, ghim mới nhất trước.
// Không ghim thì sắp theo thời điểm cập nhật rồi tới id.
const DEFAULT_ORDER =
    "p.is_pinned DESC, COALESCE(p.pinned_at, p.updated_at) DESC, p.id DESC";

const SORT_ORDERS = {
    newest: "p.id DESC",
    price_asc: "p.price ASC, p.id DESC",
    price_desc: "p.price DESC, p.id DESC",
    name_asc: "p.name ASC, p.id DESC",
    name_desc: "p.name DESC, p.id DESC",
};

const MAX_FILTER_TAGS = 10;
const MAX_TAGS_PER_PRODUCT = 20;

// "1,2,3" -> [1,2,3] (bỏ trùng). Trả null nếu có phần tử không hợp lệ hoặc quá nhiều.
const parseTagIds = (value, max) => {
    const parts = String(value).split(",").map((part) => part.trim()).filter(Boolean);
    const ids = [];

    for (const part of parts) {
        const id = parsePositiveId(part);
        if (!id) return null;
        if (!ids.includes(id)) ids.push(id);
    }

    return ids.length > 0 && ids.length <= max ? ids : null;
};

// Lấy nhãn của nhiều sản phẩm bằng MỘT truy vấn; trả Map product_id -> [{id,name,slug}]
const loadTagsByProduct = async (productIds) => {
    const map = new Map();
    if (!productIds.length) return map;

    const [rows] = await pool.execute(
        `SELECT pt.product_id, t.id, t.name, t.slug
         FROM product_tags AS pt
         INNER JOIN tags AS t
            ON t.id = pt.tag_id
         WHERE pt.product_id IN (${productIds.map(() => "?").join(", ")})
         ORDER BY t.name ASC`,
        productIds
    );

    for (const row of Array.isArray(rows) ? rows : []) {
        if (row.product_id === undefined) continue;
        if (!map.has(row.product_id)) map.set(row.product_id, []);
        map.get(row.product_id).push({ id: row.id, name: row.name, slug: row.slug });
    }

    return map;
};

// Dùng chung cho GET /api/products (khách) và GET /api/products/admin
// onlyActive = true: chỉ sản phẩm và danh mục đang hoạt động
const listProducts = async (req, res, onlyActive, errorLabel) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim().slice(0, 100)
                : "";

        let categoryId = null;

        let sortOrder = DEFAULT_ORDER;

        if (req.query.sort !== undefined) {
            const sortKey = String(req.query.sort);

            if (!Object.prototype.hasOwnProperty.call(SORT_ORDERS, sortKey)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kiểu sắp xếp chỉ nhận: newest, price_asc, price_desc, name_asc hoặc name_desc",
                });
            }

            sortOrder = SORT_ORDERS[sortKey];
        }

        if (req.query.category_id !== undefined) {
            categoryId = parsePositiveId(
                req.query.category_id
            );

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "ID danh mục không hợp lệ",
                });
            }
        }

        // ?tags=1,2,3 -> món phải có ĐỦ cả 3 nhãn (AND)
        let tagIds = null;

        if (req.query.tags !== undefined && String(req.query.tags).trim() !== "") {
            tagIds = parseTagIds(req.query.tags, MAX_FILTER_TAGS);

            if (!tagIds) {
                return res.status(400).json({
                    success: false,
                    message: `Danh sách nhãn không hợp lệ (ví dụ tags=1,2,3, tối đa ${MAX_FILTER_TAGS} nhãn)`,
                });
            }
        }

        const conditions = onlyActive
            ? ["p.status = 1", "c.status = 1"]
            : [];

        const values = [];
        const orderValues = [];
        let orderBy = sortOrder;

        if (search) {
            conditions.push(
                `(p.name LIKE ?
                  OR p.description LIKE ?)`
            );

            const keyword = `%${escapeLike(search)}%`;

            values.push(keyword, keyword);

            // Khớp tên được xếp trước khớp mô tả; cùng nhóm thì món mới trước.
            // Tham số này nằm SAU các tham số của WHERE nên đẩy vào cuối mảng values.
            orderBy = `CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, ${sortOrder}`;
            orderValues.push(keyword);
        }


        if (categoryId) {
            conditions.push("p.category_id = ?");
            values.push(categoryId);
        }

        if (tagIds) {
            conditions.push(
                `p.id IN (
                    SELECT pt.product_id
                    FROM product_tags AS pt
                    WHERE pt.tag_id IN (${tagIds.map(() => "?").join(", ")})
                    GROUP BY pt.product_id
                    HAVING COUNT(DISTINCT pt.tag_id) = ?
                 )`
            );
            values.push(...tagIds, tagIds.length);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        // Voucher áp dụng theo ĐƠN HÀNG (không theo từng món): chỉ cần biết hiện có voucher
        // đang hiệu lực hay không. Tính MỘT lần cho cả danh sách, không truy vấn theo từng sản phẩm.
        const [voucherRows] = await pool.execute(
            `SELECT COUNT(*) AS n
             FROM vouchers
             WHERE status = 1
               AND starts_at <= NOW()
               AND ends_at >= NOW()
               AND (usage_limit IS NULL OR used_count < usage_limit)`
        );
        const hasVoucher = Number(voucherRows[0]?.n || 0) > 0 ? 1 : 0;

        const [products] = await pool.execute(
            `SELECT
                p.id,
                p.category_id,
                c.name AS category_name,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.image,
                p.status,
                p.is_pinned,
                p.pinned_at,
                p.created_at,
                p.updated_at,
                COALESCE(sales.sold_count, 0) AS sold_count,
                COALESCE(rv.avg_rating, 0) AS rating_avg,
                COALESCE(rv.review_count, 0) AS rating_count,
                COALESCE(att.video_count, 0) AS video_count,
                COALESCE(att.file_count, 0) AS file_count,
                COALESCE(att.attachment_count, 0) AS attachment_count
             FROM products AS p
             INNER JOIN categories AS c
                ON c.id = p.category_id
             LEFT JOIN (
                SELECT
                    product_id,
                    AVG(rating) AS avg_rating,
                    COUNT(*) AS review_count
                FROM product_reviews
                WHERE status = 1
                GROUP BY product_id
             ) AS rv
                ON rv.product_id = p.id
             LEFT JOIN (
                SELECT
                    product_id,
                    SUM(kind = 'video') AS video_count,
                    SUM(kind = 'file') AS file_count,
                    COUNT(*) AS attachment_count
                FROM product_attachments
                GROUP BY product_id
             ) AS att
                ON att.product_id = p.id
             LEFT JOIN (
                SELECT
                    oi.product_id,
                    SUM(oi.quantity) AS sold_count
                FROM order_items AS oi
                INNER JOIN orders AS o
                    ON o.id = oi.order_id
                WHERE o.status <> 'cancelled'
                GROUP BY oi.product_id
             ) AS sales
                ON sales.product_id = p.id
             ${whereClause}
             ORDER BY ${orderBy}`,
            [...values, ...orderValues]
        );

        const tagsByProduct = await loadTagsByProduct(
            products.map((product) => product.id).filter((id) => id !== undefined)
        );

        return res.status(200).json({
            success: true,
            count: products.length,
            data: products.map((product) => ({
                ...formatProduct(req, { ...product, has_voucher: hasVoucher }),
                tags: tagsByProduct.get(product.id) || [],
            })),
        });
    } catch (error) {
        console.error(errorLabel, error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy sản phẩm",
        });
    }
};

// GET /api/products
const getProducts = (req, res) =>
    listProducts(req, res, true, "Lỗi lấy sản phẩm:");

// GET /api/products/admin
const getAllProducts = (req, res) =>
    listProducts(req, res, false, "Lỗi lấy sản phẩm Admin:");

// GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ID sản phẩm không hợp lệ",
            });
        }

        const [products] = await pool.execute(
            `SELECT
                p.id,
                p.category_id,
                c.name AS category_name,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.image,
                p.status,
                p.is_pinned,
                p.pinned_at,
                p.created_at,
                p.updated_at
             FROM products AS p
             INNER JOIN categories AS c
                ON c.id = p.category_id
             WHERE p.id = ?
               AND p.status = 1
               AND c.status = 1
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        const detail = formatProduct(req, products[0]);
        detail.attachments = await listAttachments(req, productId);
        detail.tags = (await loadTagsByProduct([products[0].id])).get(products[0].id) || [];

        return res.status(200).json({
            success: true,
            data: detail,
        });
    } catch (error) {
        console.error(
            "Lỗi lấy chi tiết sản phẩm:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy sản phẩm",
        });
    }
};

// POST /api/products
const createProduct = async (req, res) => {
    try {
        const categoryId = parsePositiveId(
            req.body.category_id
        );

        const name =
            typeof req.body.name === "string"
                ? req.body.name.trim()
                : "";

        const description =
            typeof req.body.description === "string"
                ? req.body.description.trim() || null
                : null;

        const priceText =
            req.body.price === undefined
                ? ""
                : String(req.body.price).trim();

        const price = Number(priceText);

        const status = parseStatus(
            req.body.status,
            1
        );

        if (!categoryId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Danh mục không hợp lệ"
            );
        }

        if (!name) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm là bắt buộc"
            );
        }

        if (name.length > 150) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm không quá 150 ký tự"
            );
        }

        if (
            priceText === "" ||
            !Number.isFinite(price) ||
            price < 0 ||
            price > 9999999999.99
        ) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Giá sản phẩm không hợp lệ"
            );
        }

        if (status === null) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Trạng thái không hợp lệ"
            );
        }

        const [categories] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy danh mục"
            );
        }

        const slug = createSlug(name);

        if (!slug) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Không thể tạo slug từ tên sản phẩm"
            );
        }

        const [duplicatedProducts] =
            await pool.execute(
                `SELECT id
                 FROM products
                 WHERE slug = ?
                 LIMIT 1`,
                [slug]
            );

        if (duplicatedProducts.length > 0) {
            return rejectUploadedRequest(
                req,
                res,
                409,
                "Tên sản phẩm đã được sử dụng"
            );
        }

        const image =
            createUploadedImagePath(req.file);

        const [result] = await pool.execute(
            `INSERT INTO products
                (
                    category_id,
                    name,
                    slug,
                    description,
                    price,
                    image,
                    status
                )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công",
            data: {
                id: result.insertId,
                category_id: categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            },
        });
    } catch (error) {
        await removeUploadedFile(req.file);

        console.error("Lỗi thêm sản phẩm:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Tên sản phẩm đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi thêm sản phẩm",
        });
    }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "ID sản phẩm không hợp lệ"
            );
        }

        const [products] = await pool.execute(
            `SELECT *
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy sản phẩm"
            );
        }

        const currentProduct = products[0];

        const categoryId =
            req.body.category_id === undefined
                ? Number(currentProduct.category_id)
                : parsePositiveId(
                      req.body.category_id
                  );

        const name =
            req.body.name === undefined
                ? currentProduct.name
                : String(req.body.name).trim();

        const description =
            req.body.description === undefined
                ? currentProduct.description
                : String(
                      req.body.description
                  ).trim() || null;

        const priceText =
            req.body.price === undefined
                ? String(currentProduct.price)
                : String(req.body.price).trim();

        const price = Number(priceText);

        const status = parseStatus(
            req.body.status,
            Number(currentProduct.status)
        );

        if (!categoryId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Danh mục không hợp lệ"
            );
        }

        if (!name || name.length > 150) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm không hợp lệ"
            );
        }

        if (
            priceText === "" ||
            !Number.isFinite(price) ||
            price < 0 ||
            price > 9999999999.99
        ) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Giá sản phẩm không hợp lệ"
            );
        }

        if (status === null) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Trạng thái không hợp lệ"
            );
        }

        const [categories] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy danh mục"
            );
        }

        const slug = createSlug(name);

        const [duplicatedProducts] =
            await pool.execute(
                `SELECT id
                 FROM products
                 WHERE slug = ?
                   AND id <> ?
                 LIMIT 1`,
                [slug, productId]
            );

        if (duplicatedProducts.length > 0) {
            return rejectUploadedRequest(
                req,
                res,
                409,
                "Tên sản phẩm đã được sử dụng"
            );
        }

        const image = req.file
            ? createUploadedImagePath(req.file)
            : currentProduct.image;

        await pool.execute(
            `UPDATE products
             SET
                category_id = ?,
                name = ?,
                slug = ?,
                description = ?,
                price = ?,
                image = ?,
                status = ?
             WHERE id = ?`,
            [
                categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
                productId,
            ]
        );

        if (req.file) {
            await removeStoredImage(
                currentProduct.image
            );
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật sản phẩm thành công",
            data: {
                id: productId,
                category_id: categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            },
        });
    } catch (error) {
        await removeUploadedFile(req.file);

        console.error(
            "Lỗi cập nhật sản phẩm:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Tên sản phẩm đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Lỗi máy chủ khi cập nhật sản phẩm",
        });
    }
};

// DELETE /api/products/:id
// PATCH /api/products/:id  (JSON) - sửa MỘT PHẦN, kiểm tra y như PUT: trường không gửi thì giữ nguyên.
// Dùng cho tự lưu ở form admin; không nhận ảnh (đổi ảnh vẫn dùng PUT kèm file).
const PATCHABLE_FIELDS = ["name", "category_id", "price", "description", "status"];

const patchProduct = (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (body.image !== undefined) {
        return res.status(400).json({
            success: false,
            message: "PATCH không hỗ trợ đổi ảnh, hãy dùng PUT kèm file ảnh",
        });
    }

    if (!PATCHABLE_FIELDS.some((field) => body[field] !== undefined)) {
        return res.status(400).json({
            success: false,
            message: "Cần gửi ít nhất một trường cần sửa: name, category_id, price, description hoặc status",
        });
    }

    return updateProduct(req, res);
};

const deleteProduct = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ID sản phẩm không hợp lệ",
            });
        }

        const [products] = await pool.execute(
            `SELECT id, image
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        // Lấy danh sách file đính kèm trước khi xóa (bản ghi bị xóa theo ON DELETE CASCADE)
        const [attachmentRows] = await pool.execute(
            `SELECT url FROM product_attachments WHERE product_id = ?`,
            [productId]
        );

        await pool.execute(
            `DELETE FROM products WHERE id = ?`,
            [productId]
        );

        await removeStoredImage(products[0].image);
        await Promise.all(
            (attachmentRows || []).map((row) => removeStoredFile(row.url))
        );

        return res.status(200).json({
            success: true,
            message: "Xóa sản phẩm thành công",
        });
    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa sản phẩm",
        });
    }
};

// PUT /api/products/:id/tags  { tag_ids: [1,2,3] }  -> thay toàn bộ nhãn của món trong MỘT transaction
const setProductTags = async (req, res) => {
    const productId = parsePositiveId(req.params.id);

    if (!productId) {
        return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
    }

    const raw = req.body?.tag_ids;
    const tagIds = [];

    if (!Array.isArray(raw)) {
        return res.status(400).json({ success: false, message: "tag_ids phải là một mảng ID nhãn" });
    }

    for (const item of raw) {
        const id = parsePositiveId(item);
        if (!id) {
            return res.status(400).json({ success: false, message: "tag_ids chứa ID nhãn không hợp lệ" });
        }
        if (!tagIds.includes(id)) tagIds.push(id);
    }

    if (tagIds.length > MAX_TAGS_PER_PRODUCT) {
        return res.status(400).json({
            success: false,
            message: `Mỗi món tối đa ${MAX_TAGS_PER_PRODUCT} nhãn`,
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [products] = await connection.execute(
            `SELECT id FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
            [productId]
        );

        if (products.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
        }

        let tags = [];

        if (tagIds.length > 0) {
            const [found] = await connection.execute(
                `SELECT id, name, slug FROM tags WHERE id IN (${tagIds.map(() => "?").join(", ")}) ORDER BY name ASC`,
                tagIds
            );

            if (found.length !== tagIds.length) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: "Có nhãn không tồn tại" });
            }

            tags = found;
        }

        await connection.execute(`DELETE FROM product_tags WHERE product_id = ?`, [productId]);

        if (tagIds.length > 0) {
            await connection.execute(
                `INSERT INTO product_tags (product_id, tag_id) VALUES ${tagIds.map(() => "(?, ?)").join(", ")}`,
                tagIds.flatMap((tagId) => [productId, tagId])
            );
        }

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Đã cập nhật nhãn cho sản phẩm",
            data: { id: productId, tags: tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })) },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Lỗi cập nhật nhãn sản phẩm:", error);

        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật nhãn" });
    } finally {
        if (connection) connection.release();
    }
};

// PUT /api/products/:id/pin  { pinned: true | false }
const parseBoolean = (value) => {
    if (value === true || value === 1 || value === "1" || value === "true") return true;
    if (value === false || value === 0 || value === "0" || value === "false") return false;
    return null;
};

const pinProduct = async (req, res) => {
    try {
        const productId = parsePositiveId(req.params.id);

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ID sản phẩm không hợp lệ",
            });
        }

        const pinned = parseBoolean(req.body?.pinned);

        if (pinned === null) {
            return res.status(400).json({
                success: false,
                message: "Trường pinned phải là true hoặc false",
            });
        }

        const [products] = await pool.execute(
            `SELECT id, is_pinned
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        // updated_at = updated_at: ghim/bỏ ghim không được làm đổi "ngày cập nhật" của món
        await pool.execute(
            pinned
                ? `UPDATE products
                   SET is_pinned = 1, pinned_at = NOW(), updated_at = updated_at
                   WHERE id = ?`
                : `UPDATE products
                   SET is_pinned = 0, pinned_at = NULL, updated_at = updated_at
                   WHERE id = ?`,
            [productId]
        );

        const [rows] = await pool.execute(
            `SELECT id, is_pinned, pinned_at
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        return res.status(200).json({
            success: true,
            message: pinned ? "Đã ghim sản phẩm" : "Đã bỏ ghim sản phẩm",
            data: {
                id: productId,
                is_pinned: pinned ? 1 : 0,
                pinned_at: rows[0] ? rows[0].pinned_at : null,
            },
        });
    } catch (error) {
        console.error("Lỗi ghim sản phẩm:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi ghim sản phẩm",
        });
    }
};

module.exports = {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    patchProduct,
    deleteProduct,
    pinProduct,
    setProductTags,
};
