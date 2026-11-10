const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const crypto = require("crypto");

const uploadsRoot = path.join(__dirname, "../../uploads");

const extensionByMimeType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

// Nhận dạng loại file thật bằng vài byte đầu ("magic bytes"). Trả về mime hoặc null.
// mimetype do trình duyệt tự khai nên có thể bị giả; chữ ký ở đầu file thì khó giả hơn nhiều.
const detectMimeType = (buffer) => {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";

    if (isJpeg) return "image/jpeg";
    if (isPng) return "image/png";
    if (isWebp) return "image/webp";
    return null;
};

const labelByMimeType = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WEBP" };

// Nhà máy tạo bộ upload: mỗi nơi dùng (sản phẩm, avatar...) chỉ khác thư mục, số file, dung lượng và loại cho phép.
//   destFolder  : thư mục con trong backend/uploads (vd "avatars")
//   maxFiles    : số file tối đa mỗi lần
//   maxSizeMB   : dung lượng tối đa mỗi file
//   allowedMime : mảng mime được phép (hiện hỗ trợ jpeg/png/webp)
function createUploader({ destFolder, maxFiles = 1, maxSizeMB = 5, allowedMime = Object.keys(extensionByMimeType) }) {
    const directory = path.join(uploadsRoot, destFolder);
    fs.mkdirSync(directory, { recursive: true });

    const allowed = new Set(allowedMime);
    const typeList = allowedMime.map((mime) => labelByMimeType[mime]).join(", ");
    const typeMessage = `Chỉ chấp nhận ảnh ${typeList}`;

    const storage = multer.diskStorage({
        destination: (req, file, callback) => callback(null, directory),
        filename: (req, file, callback) => {
            const randomName = crypto.randomBytes(12).toString("hex");
            callback(null, `${Date.now()}-${randomName}${extensionByMimeType[file.mimetype]}`);
        },
    });

    const fileFilter = (req, file, callback) => {
        if (!allowed.has(file.mimetype)) {
            return callback(new Error(typeMessage));
        }
        callback(null, true);
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024,
            files: maxFiles,
            fields: 10,
            parts: maxFiles + 10,
        },
    });

    // Bọc upload.single(...) để lỗi upload trả JSON 400 bằng tiếng Việt đúng với giới hạn của từng nơi
    const single = (fieldName) => (req, res, next) => {
        upload.single(fieldName)(req, res, (error) => {
            if (!error) return next();

            const message =
                error.name === "MulterError" && error.code === "LIMIT_FILE_SIZE"
                    ? `Ảnh không được vượt quá ${maxSizeMB} MB`
                    : error.name === "MulterError"
                        ? "Lỗi upload: " + error.message
                        : error.message;
            return res.status(400).json({ success: false, message });
        });
    };

    // Kiểm tra NỘI DUNG file sau khi multer đã lưu; sai thì xóa file và báo 400.
    const verifyContent = async (req, res, next) => {
        const files = req.files || (req.file ? [req.file] : []);
        if (!files.length) return next(); // không upload thì bỏ qua

        for (const file of files) {
            let detected = null;

            try {
                const handle = await fsPromises.open(file.path, "r");
                try {
                    const buffer = Buffer.alloc(12);
                    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
                    detected = detectMimeType(buffer.subarray(0, bytesRead));
                } finally {
                    await handle.close();
                }
            } catch (error) {
                console.error("Lỗi kiểm tra nội dung ảnh:", error.code);
            }

            if (!detected || !allowed.has(detected)) {
                await Promise.all(files.map((f) => fsPromises.unlink(f.path).catch(() => {})));
                return res.status(400).json({
                    success: false,
                    message: `File tải lên không phải ảnh ${typeList} hợp lệ`,
                });
            }
        }

        next();
    };

    return { upload, single, verifyContent, directory };
}

// Bộ upload ảnh sản phẩm: giữ nguyên hành vi cũ (1 ảnh, 5 MB, field "image")
const products = createUploader({ destFolder: "products", maxFiles: 1, maxSizeMB: 5 });

module.exports = {
    createUploader,
    upload: products.upload,
    verifyImageContent: products.verifyContent,
};
