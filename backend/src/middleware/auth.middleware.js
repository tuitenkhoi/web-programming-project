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

const authorizeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Bạn chưa đăng nhập",
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message:
                "Bạn không có quyền thực hiện chức năng này",
        });
    }

    next();
};

module.exports = {
    authenticateToken,
    authorizeAdmin,
};