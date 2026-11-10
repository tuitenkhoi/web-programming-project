const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fsPromises = require('fs/promises');
const db = require('../config/db');
const {
    SECRET_KEY,
    verifyToken,
    requireCustomer,
} = require('../middleware/auth');
const { revokeToken, revokeAllForUser } = require('../middleware/revoke');
const rateLimit = require('../middleware/rateLimit');
const { createUploader } = require('../backend/src/middleware/upload.middleware');
const { sendMail } = require('../services/mailer');

const router = express.Router();

// Avatar: 1 ảnh, tối đa 2 MB, chỉ JPG/PNG/WEBP (có kiểm tra magic-byte)
const avatarUploader = createUploader({
    destFolder: 'avatars',
    maxFiles: 1,
    maxSizeMB: 2,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
});
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
        // jti: mã định danh riêng của token để thu hồi khi đăng xuất; iat_ms: mốc phát hành chính xác tới mili giây
        { id: user.id, email: user.email, role: user.role, jti: crypto.randomUUID(), iat_ms: Date.now() },
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
                avatar: user.avatar || '',
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
    // Số điện thoại là TÙY CHỌN: để trống thì lưu NULL (không lưu chuỗi rỗng, vì cột phone có UNIQUE)
    const phone = clean(req.body?.phone, 20);
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirm_password ?? '');

    if (fullName.length < 2) {
        return res.status(400).json({ success: false, message: 'Họ tên phải có ít nhất 2 ký tự.' });
    }
    if (!validEmail(email)) {
        return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    }
    if (phone && !validPhone(phone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.' });
    }
    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 đến 72 ký tự.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp' });
    }
    const phoneValue = phone || null;

    try {
        // Chỉ kiểm tra trùng số điện thoại khi khách có nhập (NULL không bao giờ trùng)
        const [duplicates] = phoneValue
            ? await db.execute('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phoneValue])
            : await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (duplicates.length) {
            return res.status(409).json({ success: false, message: 'Email hoặc số điện thoại đã được đăng ký.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        // Mã kích hoạt email: 32 ký tự hex ngẫu nhiên, hạn 24 giờ (tính bằng giờ của MySQL để khỏi lệch múi giờ)
        const verificationToken = crypto.randomBytes(16).toString('hex');
        const [result] = await db.execute(
            `INSERT INTO users (full_name, email, password_hash, phone, role, status, verification_token, verification_expires_at)
             VALUES (?, ?, ?, ?, 'customer', 1, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
            [fullName, email, passwordHash, phoneValue, verificationToken]
        );
        // Gửi mail kích hoạt; gửi lỗi cũng không làm hỏng việc đăng ký (khách vẫn đăng nhập được)
        const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
        await sendMail({
            to: email,
            subject: 'Kích hoạt tài khoản Mộc Coffee',
            text: `Chào ${fullName},\n\nBấm vào liên kết sau để xác minh email (có hiệu lực 24 giờ):\n${appUrl}/api/auth/activate?token=${verificationToken}\n\nNếu bạn không đăng ký, hãy bỏ qua email này.`,
        });
        // Không tự nhận các đơn cũ theo số điện thoại/email khi chưa có OTP.
        // Khách vẫn có thể tra từng đơn cũ bằng mã đơn + số điện thoại.
        return authResponse(res.status(201), {
            id: result.insertId,
            full_name: fullName,
            email,
            phone: phoneValue,
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
            `SELECT id, full_name, email, phone, avatar, password_hash, role, status
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
            `SELECT id, full_name, email, phone, created_at, email_verified_at, theme, font_size, avatar
             FROM users WHERE id = ? LIMIT 1`,
            [req.user.id]
        );
        return res.json({ success: true, data: rows[0] || null });
    } catch (error) {
        console.error('Lỗi lấy hồ sơ khách hàng:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải hồ sơ lúc này.' });
    }
});

// PATCH /api/auth/customer/me — sửa họ tên, SĐT, avatar (multipart/form-data, field ảnh tên 'avatar')
// Chỉ cập nhật những trường khách có gửi lên; email không cho sửa.
router.patch(
    '/customer/me',
    verifyToken,
    requireCustomer,
    avatarUploader.single('avatar'),
    avatarUploader.verifyContent,
    async (req, res) => {
        const uploaded = req.file ? `/uploads/avatars/${req.file.filename}` : null;
        // Báo lỗi thì phải xóa luôn ảnh vừa lưu để không để lại file rác
        const fail = async (status, message) => {
            if (req.file) await fsPromises.unlink(req.file.path).catch(() => {});
            return res.status(status).json({ success: false, message });
        };

        const sets = [];
        const values = [];

        if (req.body?.full_name !== undefined) {
            const fullName = clean(req.body.full_name, 100);
            if (fullName.length < 2) return fail(400, 'Họ tên phải có ít nhất 2 ký tự.');
            sets.push('full_name = ?');
            values.push(fullName);
        }

        let phoneValue;
        if (req.body?.phone !== undefined) {
            const phone = clean(req.body.phone, 20);
            if (phone && !validPhone(phone)) {
                return fail(400, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.');
            }
            phoneValue = phone || null; // để trống = xóa số điện thoại (NULL)
            sets.push('phone = ?');
            values.push(phoneValue);
        }

        if (uploaded) {
            sets.push('avatar = ?');
            values.push(uploaded);
        }

        if (!sets.length) return fail(400, 'Không có thông tin nào để cập nhật.');

        try {
            if (phoneValue) {
                const [taken] = await db.execute(
                    'SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1',
                    [phoneValue, req.user.id]
                );
                if (taken.length) return fail(409, 'Số điện thoại đã được tài khoản khác sử dụng.');
            }

            // Nhớ avatar cũ để xóa sau khi cập nhật thành công
            let oldAvatar = null;
            if (uploaded) {
                const [current] = await db.execute('SELECT avatar FROM users WHERE id = ? LIMIT 1', [req.user.id]);
                oldAvatar = current[0]?.avatar || null;
            }

            // Tên cột nằm cứng trong code ở trên; dữ liệu của khách chỉ đi qua dấu ?
            await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, req.user.id]);

            if (oldAvatar && oldAvatar.startsWith('/uploads/avatars/')) {
                // path.basename chặn kiểu "../" trong giá trị cũ; xóa lỗi cũng bỏ qua (best-effort)
                await fsPromises
                    .unlink(path.join(avatarUploader.directory, path.basename(oldAvatar)))
                    .catch(() => {});
            }

            const [rows] = await db.execute(
                `SELECT id, full_name, email, phone, created_at, email_verified_at, theme, font_size, avatar
                 FROM users WHERE id = ? LIMIT 1`,
                [req.user.id]
            );
            return res.json({ success: true, message: 'Cập nhật hồ sơ thành công.', data: rows[0] || null });
        } catch (error) {
            if (req.file) await fsPromises.unlink(req.file.path).catch(() => {});
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'Số điện thoại đã được tài khoản khác sử dụng.' });
            }
            console.error('Lỗi cập nhật hồ sơ khách hàng:', error);
            return res.status(500).json({ success: false, message: 'Không thể cập nhật hồ sơ lúc này.' });
        }
    }
);

// POST /api/auth/customer/change-password { current_password, new_password, confirm_password }
router.post('/customer/change-password', verifyToken, requireCustomer, async (req, res) => {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password ?? '');

    if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại.' });
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 8 đến 72 ký tự.' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp' });
    }
    if (newPassword === currentPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    try {
        const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        const hash = rows[0] ? String(rows[0].password_hash).replace(/^\$2y\$/, '$2a$') : DUMMY_HASH;
        if (!rows[0] || !(await bcrypt.compare(currentPassword, hash))) {
            return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
        revokeAllForUser(req.user.id); // đăng xuất mọi thiết bị, kể cả phiên đang dùng

        // Không trả token mới: khách phải đăng nhập lại bằng mật khẩu mới
        return res.json({ success: true, message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' });
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này.' });
    }
});

// PATCH /api/auth/customer/preferences { theme, font_size } — chỉ nhận giá trị nằm trong danh sách cho phép
const THEMES = ['light', 'dark', 'system'];
const FONT_SIZES = [14, 16, 18, 20];

router.patch('/customer/preferences', verifyToken, requireCustomer, async (req, res) => {
    const hasTheme = req.body?.theme !== undefined;
    const hasFont = req.body?.font_size !== undefined;
    const theme = String(req.body?.theme ?? '');
    const fontSize = Number(req.body?.font_size);

    if (!hasTheme && !hasFont) {
        return res.status(400).json({ success: false, message: 'Không có tùy chọn nào để cập nhật.' });
    }
    if (hasTheme && !THEMES.includes(theme)) {
        return res.status(400).json({ success: false, message: 'Giao diện chỉ nhận: light, dark hoặc system.' });
    }
    if (hasFont && !FONT_SIZES.includes(fontSize)) {
        return res.status(400).json({ success: false, message: 'Cỡ chữ chỉ nhận: 14, 16, 18 hoặc 20.' });
    }

    try {
        const sets = [];
        const values = [];
        if (hasTheme) { sets.push('theme = ?'); values.push(theme); }
        if (hasFont) { sets.push('font_size = ?'); values.push(fontSize); }
        await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, req.user.id]);

        const [rows] = await db.execute('SELECT theme, font_size FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        return res.json({ success: true, message: 'Đã lưu tùy chọn.', data: rows[0] || null });
    } catch (error) {
        console.error('Lỗi lưu tùy chọn:', error);
        return res.status(500).json({ success: false, message: 'Không thể lưu tùy chọn lúc này.' });
    }
});

// ===================== QUÊN MẬT KHẨU BẰNG OTP =====================
// Luồng: forgot-password (gửi OTP) -> verify-otp (đổi OTP lấy reset_ticket) -> reset-password (đặt mật khẩu mới)
const OTP_MAX_ATTEMPTS = 5;

// Tối đa 5 yêu cầu / 15 phút CHO MỖI EMAIL (gom theo email chứ không theo IP)
const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    methods: ['POST'],
    keyFn: (req) => normalizeEmail(req.body?.email),
    message: 'Bạn yêu cầu mã quá nhiều lần, vui lòng thử lại sau 15 phút.',
});

// POST /api/auth/forgot-password { email }
// LUÔN trả success dù email có tồn tại hay không, để người lạ không dò được email nào đã đăng ký
router.post('/forgot-password', forgotLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const reply = () => res.json({
        success: true,
        message: 'Nếu email đã đăng ký, mã xác nhận gồm 6 số đã được gửi. Mã có hiệu lực 10 phút.',
    });
    if (!validEmail(email)) return reply();

    try {
        const [rows] = await db.execute(
            'SELECT id FROM users WHERE email = ? AND status = 1 LIMIT 1',
            [email]
        );
        if (rows[0]) {
            const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); // 6 số, kể cả bắt đầu bằng 0
            await db.execute(
                `UPDATE users SET reset_otp = ?, reset_otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                        reset_attempts = 0, reset_ticket = NULL, reset_ticket_expires_at = NULL
                 WHERE id = ?`,
                [otp, rows[0].id]
            );
            await sendMail({
                to: email,
                subject: 'Mã đặt lại mật khẩu Mộc Coffee',
                text: `Mã xác nhận của bạn là: ${otp}\nMã có hiệu lực trong 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`,
            });
        }
        return reply();
    } catch (error) {
        console.error('Lỗi quên mật khẩu:', error);
        return res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu lúc này.' });
    }
});

// POST /api/auth/verify-otp { email, otp } -> trả reset_ticket để dùng ở bước đặt mật khẩu
router.post('/verify-otp', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = clean(req.body?.otp, 6);
    const invalid = () => res.status(400).json({ success: false, message: 'Mã xác nhận không đúng hoặc đã hết hạn.' });
    if (!validEmail(email) || !/^\d{6}$/.test(otp)) return invalid();

    try {
        const [rows] = await db.execute(
            `SELECT id, reset_otp, reset_attempts, reset_otp_expires_at > NOW() AS otp_valid
             FROM users WHERE email = ? AND status = 1 LIMIT 1`,
            [email]
        );
        const user = rows[0];
        if (!user || !user.reset_otp || !Number(user.otp_valid)) return invalid();

        if (Number(user.reset_attempts) >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ success: false, message: 'Bạn nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.' });
        }

        // So sánh hằng thời gian để không lộ thông tin qua thời gian phản hồi
        const a = Buffer.from(String(user.reset_otp));
        const b = Buffer.from(otp);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            await db.execute('UPDATE users SET reset_attempts = reset_attempts + 1 WHERE id = ?', [user.id]);
            return invalid();
        }

        const ticket = crypto.randomBytes(16).toString('hex');
        await db.execute(
            `UPDATE users SET reset_ticket = ?, reset_ticket_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                    reset_otp = NULL, reset_otp_expires_at = NULL, reset_attempts = 0
             WHERE id = ?`,
            [ticket, user.id]
        );
        return res.json({ success: true, message: 'Xác nhận thành công.', data: { reset_ticket: ticket } });
    } catch (error) {
        console.error('Lỗi xác nhận OTP:', error);
        return res.status(500).json({ success: false, message: 'Không thể xác nhận mã lúc này.' });
    }
});

// POST /api/auth/reset-password { reset_ticket, password, confirm_password }
router.post('/reset-password', async (req, res) => {
    const ticket = String(req.body?.reset_ticket || '');
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirm_password ?? '');

    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 đến 72 ký tự.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp' });
    }
    if (!/^[0-9a-f]{32}$/.test(ticket)) {
        return res.status(400).json({ success: false, message: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT id FROM users WHERE reset_ticket = ? AND reset_ticket_expires_at > NOW() LIMIT 1',
            [ticket]
        );
        if (!rows[0]) {
            return res.status(400).json({ success: false, message: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.execute(
            `UPDATE users SET password_hash = ?, reset_otp = NULL, reset_otp_expires_at = NULL, reset_attempts = 0,
                    reset_ticket = NULL, reset_ticket_expires_at = NULL
             WHERE id = ?`,
            [passwordHash, rows[0].id]
        );
        revokeAllForUser(rows[0].id); // mọi phiên cũ đều mất hiệu lực

        // Cố ý KHÔNG trả token: buộc khách đăng nhập lại bằng mật khẩu mới
        return res.json({ success: true, message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại.' });
    } catch (error) {
        console.error('Lỗi đặt lại mật khẩu:', error);
        return res.status(500).json({ success: false, message: 'Không thể đặt lại mật khẩu lúc này.' });
    }
});

// GET /api/auth/activate?token=...  (công khai: khách bấm link trong email)
router.get('/activate', async (req, res) => {
    const token = String(req.query.token || '');
    if (!/^[0-9a-f]{32}$/.test(token)) {
        return res.status(400).json({ success: false, message: 'Liên kết kích hoạt không hợp lệ.' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT id, verification_expires_at > NOW() AS still_valid FROM users WHERE verification_token = ? LIMIT 1',
            [token]
        );
        const user = rows[0];
        if (!user) {
            return res.status(400).json({ success: false, message: 'Liên kết kích hoạt không hợp lệ hoặc đã được sử dụng.' });
        }
        if (!Number(user.still_valid)) {
            return res.status(400).json({ success: false, message: 'Liên kết kích hoạt đã hết hạn (quá 24 giờ). Vui lòng đăng ký lại hoặc liên hệ quán để được hỗ trợ.' });
        }

        await db.execute(
            `UPDATE users SET email_verified_at = NOW(), verification_token = NULL, verification_expires_at = NULL
             WHERE id = ?`,
            [user.id]
        );
        return res.redirect('/pages/account.html?verified=1');
    } catch (error) {
        console.error('Lỗi kích hoạt tài khoản:', error);
        return res.status(500).json({ success: false, message: 'Không thể kích hoạt tài khoản lúc này.' });
    }
});

// POST /api/auth/logout — dùng chung cho khách và admin: thu hồi token đang dùng
router.post('/logout', verifyToken, (req, res) => {
    revokeToken(req.tokenPayload.jti, req.tokenPayload.exp);
    return res.json({ success: true, message: 'Đã đăng xuất' });
});

module.exports = router;
