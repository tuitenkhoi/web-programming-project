const jwt = require('jsonwebtoken');

// Bắt buộc phải có JWT_SECRET trong .env, không dùng khóa mặc định đoán được.
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    throw new Error('Thiếu JWT_SECRET trong file .env');
}

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || '';
    const [scheme, token] = authHeader.split(' '); // Dạng: Bearer <TOKEN>

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Thiếu Token xác thực!', code: 'NO_TOKEN' });
    }

    try {
        req.user = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token đã hết hạn, vui lòng đăng nhập lại!', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ message: 'Token không hợp lệ!', code: 'TOKEN_INVALID' });
    }
};

module.exports = { verifyToken, SECRET_KEY };
