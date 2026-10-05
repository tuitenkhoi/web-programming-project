const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(
    __dirname,
    "../../uploads/products"
);

fs.mkdirSync(uploadDirectory, {
    recursive: true,
});

const extensionByMimeType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

const allowedMimeTypes = new Set(
    Object.keys(extensionByMimeType)
);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (req, file, callback) => {
        const extension =
            extensionByMimeType[file.mimetype];

        const randomName = crypto
            .randomBytes(12)
            .toString("hex");

        const filename =
            `${Date.now()}-${randomName}${extension}`;

        callback(null, filename);
    },
});

const fileFilter = (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
            new Error(
                "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"
            )
        );
    }

    callback(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 10,
        parts: 11,
    },
});

module.exports = {
    upload,
};