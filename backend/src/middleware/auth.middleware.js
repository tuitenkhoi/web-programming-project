const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const authorizationHeader = req.headers.authorization;

    if (
        !authorizationHeader ||
        !authorizationHeader.startsWith("Bearer ")
    ) {
        return res.status(401).json({
            success: false,
            message: "Bạn chưa đăng nhập",
        });
    }

    const token = authorizationHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token không hợp lệ",
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Phiên đăng nhập đã hết hạn",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Token không hợp lệ",
        });
    }
};

module.exports = {
    authenticateToken,
};