const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
    SECRET_KEY,
    verifyToken,
    requireCustomer,
} = require('../middleware/auth');

const router = express.Router();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Giới hạn đăng nhập sai: tối đa 10 lần / 15 phút cho mỗi IP (lưu trong bộ nhớ)
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

const isBlocked = (ip) => {
    const rec = fails.get(ip);
    if (!rec) return false;
    if (Date.now() - rec.first > WINDOW_MS) { fails.delete(ip); return false; }
    return rec.count >= MAX_FAILS;
};
const recordFail = (ip) => {
    const rec = fails.get(ip);
    if (!rec || Date.now() - rec.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
    else rec.count++;
};

// Hash giả để thời gian phản hồi không lộ việc tài khoản có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('khong-ton-tai', 10);

const clean = (value, maxLength) => String(value || '').trim().slice(0, maxLength);
const normalizeEmail = (value) => clean(value, 150).toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value) => /^0\d{9}$/.test(value);

function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: EXPIRES_IN, algorithm: 'HS256' }
    );
}

function authResponse(res, user, message = 'Đăng nhập thành công') {
    return res.json({
        success: true,
        message,
        data: {
            token: createToken(user),
            expiresIn: EXPIRES_IN,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone || '',
                role: user.role,
            },
        },
    });
}

// POST /api/auth/login  { email, password }  (cột users.email của DB thật; không có cột username)
router.post('/login', async (req, res) => {
    const ip = req.ip;
    if (isBlocked(ip)) {
        return res.status(429).json({ message: 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút!' });
    }

    const body = req.body || {};
    const email = String(body.email || body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, email, full_name, password_hash, role, status FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        const user = rows[0];

        // Hash tạo bởi PHP có tiền tố $2y$, bcryptjs đọc được khi đổi thành $2a$
        const hash = user ? String(user.password_hash).replace(/^\$2y\$/, '$2a$') : DUMMY_HASH;
        const passwordOk = await bcrypt.compare(password, hash);

        if (!user || !passwordOk || user.role !== 'admin' || Number(user.status) !== 1) {
            recordFail(ip);
            return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
        }

        fails.delete(ip);
        return authResponse(res, user);
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ message: 'Lỗi máy chủ!' });
    }
});

// POST /api/auth/customer/register
router.post('/customer/register', async (req, res) => {
    const fullName = clean(req.body?.full_name, 100);
    const email = normalizeEmail(req.body?.email);
    const phone = clean(req.body?.phone, 20);
    const password = String(req.body?.password || '');

    if (fullName.length < 2) {
        return res.status(400).json({ success: false, message: 'Họ tên phải có ít nhất 2 ký tự.' });
    }
    if (!validEmail(email)) {
        return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    }
    if (!validPhone(phone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.' });
    }
    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 đến 72 ký tự.' });
    }

    try {
        const [duplicates] = await db.execute(
            'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
            [email, phone]
        );
        if (duplicates.length) {
            return res.status(409).json({ success: false, message: 'Email hoặc số điện thoại đã được đăng ký.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            `INSERT INTO users (full_name, email, password_hash, phone, role, status)
             VALUES (?, ?, ?, ?, 'customer', 1)`,
            [fullName, email, passwordHash, phone]
        );
        // Không tự nhận các đơn cũ theo số điện thoại/email khi chưa có OTP.
        // Khách vẫn có thể tra từng đơn cũ bằng mã đơn + số điện thoại.
        return authResponse(res.status(201), {
            id: result.insertId,
            full_name: fullName,
            email,
            phone,
            role: 'customer',
        }, 'Đăng ký tài khoản thành công');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email hoặc số điện thoại đã được đăng ký.' });
        }
        console.error('Lỗi đăng ký khách hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể đăng ký tài khoản lúc này.' });
    }
});

// POST /api/auth/customer/login
router.post('/customer/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT id, full_name, email, phone, password_hash, role, status
             FROM users WHERE email = ? LIMIT 1`,
            [email]
        );
        const user = rows[0];
        const hash = user ? String(user.password_hash).replace(/^\$2y\$/, '$2a$') : DUMMY_HASH;
        const passwordOk = await bcrypt.compare(password, hash);
        if (!user || !passwordOk || user.role !== 'customer' || Number(user.status) !== 1) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
        }
        return authResponse(res, user);
    } catch (error) {
        console.error('Lỗi đăng nhập khách hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể đăng nhập lúc này.' });
    }
});

router.get('/customer/me', verifyToken, requireCustomer, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, phone, created_at FROM users WHERE id = ? LIMIT 1',
            [req.user.id]
        );
        return res.json({ success: true, data: rows[0] || null });
    } catch (error) {
        console.error('Lỗi lấy hồ sơ khách hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải hồ sơ lúc này.' });
    }
});

module.exports = router;
