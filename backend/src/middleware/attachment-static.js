// Phục vụ file đính kèm sản phẩm (/uploads/attachments). Tách riêng để test được mà không cần khởi động cả server.
const express = require("express");
const path = require("path");

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm", ".pdf"]);

// Chỉ nhận đúng 1 đoạn đường dẫn (tên file), không .., không file ẩn, không \ hoặc NUL, đúng đuôi cho phép.
function createPathGuard(allowedExtensions) {
    return function guardPath(req, res, next) {
    let decodedPath;

    try {
        decodedPath = decodeURIComponent(req.path);
    } catch {
        return res.status(400).end();
    }

    const segments = decodedPath.split("/").filter(Boolean);
    const extension = path.extname(decodedPath).toLowerCase();

    const blocked =
        segments.length !== 1 ||
        decodedPath.includes("\\") ||
        decodedPath.includes("\0") ||
        decodedPath.includes("..") ||
        segments[0].startsWith(".") ||
        !allowedExtensions.has(extension);

    if (blocked) {
        return res.status(404).end();
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    if (extension === ".pdf") {
        res.setHeader("Content-Disposition", "inline");
    }
    next();
    };
}

const guardAttachmentPath = createPathGuard(ALLOWED_EXTENSIONS);

// allowedExtensions: mặc định là ALLOWED_EXTENSIONS; truyền tập hẹp hơn (vd. chỉ ảnh) để tái dùng cùng cơ chế chống path traversal.
function attachmentStatic(rootDir, allowedExtensions = ALLOWED_EXTENSIONS) {
    return [
        allowedExtensions === ALLOWED_EXTENSIONS ? guardAttachmentPath : createPathGuard(allowedExtensions),
        express.static(rootDir, {
            index: false,
            dotfiles: "deny",
            redirect: false,
            immutable: true, // tên file duy nhất (timestamp + random) nên nội dung không bao giờ đổi
            maxAge: "30d",
        }),
    ];
}

module.exports = { attachmentStatic, guardAttachmentPath, ALLOWED_EXTENSIONS };
