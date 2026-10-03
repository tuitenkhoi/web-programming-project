const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

// Đăng ký tài khoản
const register = async (req, res) => {
    try {
        let { full_name, email, password, phone } = req.body;

        full_name =
            typeof full_name === "string" ? full_name.trim() : "";

        email =
            typeof email === "string"
                ? email.trim().toLowerCase()
                : "";

        phone =
            typeof phone === "string" ? phone.trim() : null;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
            });
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Email không hợp lệ",
            });
        }

        if (
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải có ít nhất 8 ký tự",
            });
        }

        if (Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu quá dài",
            });
        }

        const [existingUsers] = await pool.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email đã được sử dụng",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users
                (full_name, email, password_hash, phone, role, status)
             VALUES (?, ?, ?, ?, 'customer', 1)`,
            [full_name, email, passwordHash, phone]
        );

        return res.status(201).json({
            success: true,
            message: "Đăng ký tài khoản thành công",
            data: {
                id: result.insertId,
                full_name,
                email,
                phone,
                role: "customer",
            },
        });
    } catch (error) {
        console.error("Lỗi đăng ký:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Email đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi đăng ký tài khoản",
        });
    }
};

// Đăng nhập
const login = async (req, res) => {
    try {
        let { email, password } = req.body;

        email =
            typeof email === "string"
                ? email.trim().toLowerCase()
                : "";

        if (!email || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập email và mật khẩu",
            });
        }

        const [users] = await pool.execute(
            `SELECT
                id,
                full_name,
                email,
                password_hash,
                phone,
                role,
                status
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không chính xác",
            });
        }

        const user = users[0];

        if (Number(user.status) !== 1) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản đã bị khóa",
            });
        }

        const passwordIsCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordIsCorrect) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không chính xác",
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET chưa được cấu hình");
        }

        const token = jwt.sign(
            {
                sub: user.id,
                role: user.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Đăng nhập thành công",
            data: {
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                },
            },
        });
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi đăng nhập",
        });
    }
};

// Lấy thông tin tài khoản đang đăng nhập
const getMe = async (req, res) => {
    try {
        const userId = req.user.sub;

        const [users] = await pool.execute(
            `SELECT
                id,
                full_name,
                email,
                phone,
                role,
                status,
                created_at,
                updated_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng",
            });
        }

        const user = users[0];

        if (Number(user.status) !== 1) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản đã bị khóa",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy thông tin tài khoản thành công",
            data: user,
        });
    } catch (error) {
        console.error(
            "Lỗi lấy thông tin tài khoản:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Lỗi máy chủ khi lấy thông tin tài khoản",
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
};