const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'moc_coffee_key';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Dạng Bearer <TOKEN>

    if (!token) return res.status(401).json({ message: 'Thiếu Token xác thực!' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

module.exports = { verifyToken };