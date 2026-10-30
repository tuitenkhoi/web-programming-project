require('dotenv').config(); // phải nạp .env trước khi require middleware/routes
const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Chỉ phục vụ các thư mục giao diện, KHÔNG phục vụ cả thư mục dự án (tránh lộ .env, server.js, config/).
// Sửa danh sách này cho khớp cấu trúc thư mục của bạn.
const STATIC_DIRS = ['admin', 'assets', 'pages'];

const PUBLIC_EXTENSIONS = new Set([
    '.html',
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
]);

function allowPublicFile(req, res, next) {
    let decodedPath;

    try {
        decodedPath = decodeURIComponent(req.path);
    } catch {
        return res.status(400).end();
    }

    const segments = decodedPath.split('/');
    const extension = path.extname(decodedPath).toLowerCase();

    const blocked =
        decodedPath.includes('\\') ||
        decodedPath.includes('\0') ||
        segments.some((segment) => segment.startsWith('.')) ||
        !PUBLIC_EXTENSIONS.has(extension);

    if (blocked) {
        return res.status(404).end();
    }

    next();
}

STATIC_DIRS.forEach((dir) => {
    app.use(
        '/' + dir,
        allowPublicFile,
        express.static(path.join(__dirname, dir), {
            index: false,
            dotfiles: 'deny',
            redirect: false,
        })
    );
});

app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', verifyToken, require('./routes/dashboard')); // toàn bộ cần token
app.use('/api/tables', require('./routes/tables'));     // GET công khai, PATCH cần token (bên trong route)
app.use('/api/bookings', require('./routes/bookings')); // POST công khai, GET/PATCH cần token (bên trong route)

// 404
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'Không tìm thấy đường dẫn API!' });
    }
    res.status(404).send('Không tìm thấy trang!');
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ!' });
    }
    console.error('Lỗi không mong muốn:', err);
    res.status(500).json({ message: 'Lỗi máy chủ!' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
}

module.exports = app;
