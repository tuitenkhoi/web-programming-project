require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

(async () => {
    const [emailArg, password, fullName = 'Quản lý'] = process.argv.slice(2);
    const email = (emailArg || '').trim().toLowerCase();

    if (!email.includes('@') || !password || password.length < 8) {
        console.error('Dùng: node scripts/create-admin.js <email> <mat_khau_toi_thieu_8_ky_tu> ["Họ tên"]');
        process.exit(1);
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO users (email, full_name, password_hash, role, status)
             VALUES (?, ?, ?, 'admin', 1)
             ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), role = 'admin', status = 1`,
            [email, fullName, hash]
        );
        console.log(`Đã tạo/cập nhật tài khoản admin "${email}".`);
        process.exit(0);
    } catch (err) {
        console.error('Lỗi:', err.message);
        process.exit(1);
    }
})();