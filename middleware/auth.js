const jwt = require('jsonwebtoken');
const db = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET;

if (
    typeof SECRET_KEY !== 'string' ||
    SECRET_KEY.trim().length < 32
) {
    throw new Error(
            'JWT_SECRET phải được cấu hình bằng khóa ngẫu nhiên ít nhất 32 ký tự.'
    );
}

// Cache ngắn hạn kết quả tra tài khoản: một trang admin gọi nhiều API cùng lúc,
// không cần SELECT users cho từng request. Khóa tài khoản sẽ có hiệu lực sau tối đa AUTH_CACHE_MS.
// Đặt AUTH_CACHE_MS=0 trong .env để tắt cache.
const AUTH_CACHE_MS = Number(process.env.AUTH_CACHE_MS ?? 10000);
const userCache = new Map(); // userId -> { user, expires }

function getCachedUser(userId) {
    const hit = userCache.get(userId);
    if (!hit) return null;
    if (hit.expires <= Date.now()) {
        userCache.delete(userId);
        return null;
    }
    return hit.user;
}

function setCachedUser(userId, user) {
    if (AUTH_CACHE_MS <= 0) return;
    if (userCache.size > 500) userCache.clear(); // chặn phình bộ nhớ
    userCache.set(userId, { user, expires: Date.now() + AUTH_CACHE_MS });
}

async function verifyToken(req, res, next) {
    const authorization = req.headers.authorization || '';
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);


    if (!match) {
        return res.status(401).json({
            success: false,
            message: 'Bạn chưa đăng nhập.',
            code: 'NO_TOKEN',
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(match[1], SECRET_KEY, {
            algorithms: ['HS256'],
        });
    } catch (error) {
        const expired = error.name === 'TokenExpiredError';

        return res.status(401).json({
            success: false,
            message: expired
                ? 'Phiên đăng nhập đã hết hạn.'
                : 'Token không hợp lệ.',
            code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        });
    }

    if (
        !decoded ||
        typeof decoded !== 'object' ||
        !Number.isFinite(decoded.exp)
    ) {
        return res.status(401).json({
            success: false,
            message: 'Token thiếu thông tin xác thực hợp lệ.',
            code: 'TOKEN_INVALID',
        });
    }

    const userId = Number(decoded.id ?? decoded.sub);

    const conflictingIds =
        decoded.id !== undefined &&
        decoded.sub !== undefined &&
        Number(decoded.id) !== Number(decoded.sub);

    if (
        !Number.isSafeInteger(userId) ||
        userId <= 0 ||
        conflictingIds
    ) {
        return res.status(401).json({
            success: false,
            message: 'Token có thông tin tài khoản không hợp lệ.',
                        code: 'TOKEN_INVALID',
        });
    }

    let user = getCachedUser(userId);

    if (!user) {
        try {
            const [rows] = await db.execute(
                `SELECT id, full_name, email, role, status
                 FROM users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            user = rows[0];
            if (user && Number(user.status) === 1) setCachedUser(userId, user);
        } catch (error) {
            console.error('Lỗi kiểm tra tài khoản:', error.code);

            return res.status(500).json({
                success: false,
                message: 'Không thể kiểm tra tài khoản lúc này.',
            });
        }
    }

    if (!user || Number(user.status) !== 1) {
        return res.status(401).json({
            success: false,
            message: 'Tài khoản không tồn tại hoặc đã bị khóa.',
            code: 'ACCOUNT_UNAVAILABLE',
        });
    }

    req.user = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
    };

    next();
}

// Cho phép endpoint dùng được cho cả khách vãng lai và khách đã đăng nhập.
// Nếu request có token thì vẫn xác thực đầy đủ, không âm thầm bỏ qua token sai.
function optionalToken(req, res, next) {
    if (!req.headers.authorization) {
        req.user = null;
        return next();
    }

    return verifyToken(req, res, next);
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Bạn chưa đăng nhập.',
            code: 'NO_USER',
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền quản trị.',
            code: 'FORBIDDEN',
        });
    }

    next();
}

function requireCustomer(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Bạn chưa đăng nhập.',
            code: 'NO_USER',
        });
    }

    if (req.user.role !== 'customer') {
        return res.status(403).json({
            success: false,
            message: 'Chức năng này chỉ dành cho khách hàng.',
            code: 'FORBIDDEN',
        });
    }

    next();
}

module.exports = {
    verifyToken,
    optionalToken,
    requireAdmin,
    requireCustomer,
    SECRET_KEY,
};
