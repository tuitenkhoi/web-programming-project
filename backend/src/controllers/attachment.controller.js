// Tệp đính kèm của sản phẩm: ảnh phụ, video, tài liệu PDF.
const fs = require("fs/promises");
const path = require("path");
const pool = require("../../../config/db");

const attachmentDirectory = path.join(__dirname, "../../uploads/attachments");
const URL_PREFIX = "/uploads/attachments/";
const MAX_ATTACHMENTS_PER_PRODUCT = 20;

const KIND_BY_MIME = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/webm": "video",
    "application/pdf": "file",
};

const parsePositiveId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Tên file gốc do trình duyệt gửi dưới dạng latin1 -> đổi lại UTF-8 để giữ dấu tiếng Việt
const decodeOriginalName = (name) => {
    let decoded = String(name || "tep-dinh-kem");
    try {
        decoded = Buffer.from(decoded, "latin1").toString("utf8");
    } catch {
        /* giữ nguyên */
    }
    decoded = decoded.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim();
    return (decoded || "tep-dinh-kem").slice(0, 255);
};

const formatAttachment = (req, row) => ({
    id: row.id,
    product_id: row.product_id,
    kind: row.kind,
    url: `${req.protocol}://${req.get("host")}${row.url}`,
    original_name: row.original_name,
    mime: row.mime,
    size: Number(row.size),
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
});

// Đường dẫn file trên đĩa của một url đã lưu; null nếu url lạ (chống path traversal)
const resolveStoredFile = (storedUrl) => {
    if (typeof storedUrl !== "string" || !storedUrl.startsWith(URL_PREFIX)) return null;

    const fileName = path.basename(storedUrl);
    const fullPath = path.resolve(attachmentDirectory, fileName);

    if (path.dirname(fullPath) !== path.resolve(attachmentDirectory)) return null;
    return fullPath;
};

const removeStoredFile = async (storedUrl) => {
    const fullPath = resolveStoredFile(storedUrl);
    if (!fullPath) return;

    try {
        await fs.unlink(fullPath);
    } catch (error) {
        if (error.code !== "ENOENT") console.error("Lỗi xóa tệp đính kèm:", error.code);
    }
};

const discardUploaded = (files) =>
    Promise.all((files || []).map((file) => fs.unlink(file.path).catch(() => {})));

const listAttachments = async (req, productId) => {
    const [rows] = await pool.execute(
        `SELECT id, product_id, kind, url, original_name, mime, size, sort_order, created_at
         FROM product_attachments
         WHERE product_id = ?
         ORDER BY FIELD(kind, 'image', 'video', 'file'), sort_order ASC, id ASC`,
        [productId]
    );
    return rows.map((row) => formatAttachment(req, row));
};

// GET /api/products/:id/attachments (công khai, chỉ của sản phẩm đang bán)
const getProductAttachments = async (req, res) => {
    try {
        const productId = parsePositiveId(req.params.id);
        if (!productId) {
            return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
        }

        const [products] = await pool.execute(
            `SELECT id, status FROM products WHERE id = ? LIMIT 1`,
            [productId]
        );
        if (products.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
        }

        return res.status(200).json({
            success: true,
            data: await listAttachments(req, productId),
        });
    } catch (error) {
        console.error("Lỗi lấy tệp đính kèm:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy tệp đính kèm" });
    }
};

// POST /api/products/:id/attachments  (multipart, field "files", tối đa 5 file/lần)
const addProductAttachments = async (req, res) => {
    const files = req.files || [];

    try {
        const productId = parsePositiveId(req.params.id);
        if (!productId) {
            await discardUploaded(files);
            return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
        }

        if (files.length === 0) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất một file" });
        }

        // mime trình duyệt khai phải khớp nội dung thật (đã đọc magic bytes ở verifyContent)
        if (files.some((file) => file.detectedMime !== file.mimetype)) {
            await discardUploaded(files);
            return res.status(400).json({
                success: false,
                message: "Có file có nội dung không khớp với định dạng khai báo",
            });
        }

        const [products] = await pool.execute(`SELECT id FROM products WHERE id = ? LIMIT 1`, [productId]);
        if (products.length === 0) {
            await discardUploaded(files);
            return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
        }

        const [counts] = await pool.execute(
            `SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), 0) AS max_order
             FROM product_attachments WHERE product_id = ?`,
            [productId]
        );
        const current = Number(counts[0].total);

        if (current + files.length > MAX_ATTACHMENTS_PER_PRODUCT) {
            await discardUploaded(files);
            return res.status(400).json({
                success: false,
                message: `Mỗi sản phẩm tối đa ${MAX_ATTACHMENTS_PER_PRODUCT} tệp đính kèm (hiện có ${current})`,
            });
        }

        let nextOrder = Number(counts[0].max_order);
        const saved = [];

        for (const file of files) {
            nextOrder = Math.min(nextOrder + 1, 255);
            const storedUrl = URL_PREFIX + file.filename;

            const [result] = await pool.execute(
                `INSERT INTO product_attachments
                    (product_id, kind, url, original_name, mime, size, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId,
                    KIND_BY_MIME[file.detectedMime],
                    storedUrl,
                    decodeOriginalName(file.originalname),
                    file.detectedMime,
                    file.size,
                    nextOrder,
                ]
            );

            saved.push({
                id: result.insertId,
                product_id: productId,
                kind: KIND_BY_MIME[file.detectedMime],
                url: storedUrl,
                original_name: decodeOriginalName(file.originalname),
                mime: file.detectedMime,
                size: file.size,
                sort_order: nextOrder,
                created_at: new Date().toISOString(),
            });
        }

        return res.status(201).json({
            success: true,
            message: `Đã tải lên ${saved.length} tệp`,
            data: saved.map((row) => formatAttachment(req, row)),
        });
    } catch (error) {
        await discardUploaded(files);
        console.error("Lỗi thêm tệp đính kèm:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi tải tệp đính kèm" });
    }
};

// DELETE /api/attachments/:id
const deleteAttachment = async (req, res) => {
    try {
        const attachmentId = parsePositiveId(req.params.id);
        if (!attachmentId) {
            return res.status(400).json({ success: false, message: "ID tệp đính kèm không hợp lệ" });
        }

        const [rows] = await pool.execute(
            `SELECT id, url FROM product_attachments WHERE id = ? LIMIT 1`,
            [attachmentId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tệp đính kèm" });
        }

        await pool.execute(`DELETE FROM product_attachments WHERE id = ?`, [attachmentId]);
        await removeStoredFile(rows[0].url);

        return res.status(200).json({ success: true, message: "Đã xóa tệp đính kèm" });
    } catch (error) {
        console.error("Lỗi xóa tệp đính kèm:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa tệp đính kèm" });
    }
};

module.exports = {
    attachmentDirectory,
    listAttachments,
    removeStoredFile,
    getProductAttachments,
    addProductAttachments,
    deleteAttachment,
};
