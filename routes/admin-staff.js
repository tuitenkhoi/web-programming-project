// Admin quản lý tài khoản nhân viên. Gắn trong server.js: app.use('/api/admin/staff', verifyToken, requireAdmin, ...)
//   GET   /api/admin/staff                      danh sách (?q= &status=1|0)
//   POST  /api/admin/staff                      tạo tài khoản (mật khẩu tạm do admin đặt)
//   PATCH /api/admin/staff/:id                  sửa họ tên, SĐT, vị trí
//   PATCH /api/admin/staff/:id/status           khóa / mở khóa ({ status: 0 | 1 })
//   POST  /api/admin/staff/:id/reset-password   đặt lại mật khẩu tạm
//   GET   /api/admin/staff/logs                 nhật ký thao tác (?user_id= &limit= &offset=)
// Chỉ thao tác được trên tài khoản role = 'staff', không đụng tới admin hoặc khách.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { invalidateUserCache } = require('../middleware/auth');
const { revokeAllForUser } = require('../middleware/revoke');
const { POSITIONS } = require('../middleware/permissions');
const { logActivity } = require('../services/audit');

const router = express.Router();

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value) => /^0\d{9}$/.test(value);
const validId = (value) => /^[1-9]\d*$/.test(String(value));

const PUBLIC_COLUMNS = 'id, full_name, email, phone, staff_position, status, created_at, updated_at';

const bad = (res, status, message) => res.status(status).json({ success: false, message });
const serverError = (res, label, error) => {
    console.error(label, error.code || error.message);
    return bad(res, 500, 'Không thể xử lý yêu cầu lúc này.');
};

// ----- Nhật ký (đặt trước /:id để không bị nhầm là id) -----
router.get('/logs', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const userId = validId(req.query.user_id) ? Number(req.query.user_id) : null;
    try {
        const [rows] = await db.query(
            `SELECT id, user_id, user_name, action, entity, entity_id, detail, created_at
               FROM staff_activity_logs
              ${userId ? 'WHERE user_id = ?' : ''}
              ORDER BY id DESC
              LIMIT ? OFFSET ?`,
            userId ? [userId, limit, offset] : [limit, offset]
        );
        return res.json({ success: true, data: rows });
    } catch (error) {
        return serverError(res, 'Lỗi tải nhật ký:', error);
    }
});

router.get('/', async (req, res) => {
    const conditions = ["role = 'staff'"];
    const params = [];
    const q = clean(req.query.q, 50);
    if (q) {
        const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        conditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
        params.push(like, like, like);
    }
    if (req.query.status === '0' || req.query.status === '1') {
        conditions.push('status = ?');
        params.push(Number(req.query.status));
    }
    try {
        const [rows] = await db.query(
            `SELECT ${PUBLIC_COLUMNS} FROM users WHERE ${conditions.join(' AND ')} ORDER BY status DESC, full_name ASC`,
            params
        );
        return res.json({ success: true, data: rows });
    } catch (error) {
        return serverError(res, 'Lỗi tải danh sách nhân viên:', error);
    }
});

router.post('/', async (req, res) => {
    const fullName = clean(req.body?.full_name, 100);
    const email = clean(req.body?.email, 150).toLowerCase();
    const phone = clean(req.body?.phone, 20);
    const position = String(req.body?.staff_position || '');
    const password = String(req.body?.password || '');

    if (fullName.length < 2) return bad(res, 400, 'Họ tên phải có ít nhất 2 ký tự.');
    if (!validEmail(email)) return bad(res, 400, 'Email đăng nhập không hợp lệ (ví dụ: tennhanvien@moccoffee.local).');
    if (phone && !validPhone(phone)) return bad(res, 400, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.');
    if (!POSITIONS.includes(position)) return bad(res, 400, 'Vị trí chỉ nhận: waiter, cashier hoặc kitchen.');
    if (password.length < 8 || password.length > 72) return bad(res, 400, 'Mật khẩu tạm phải từ 8 đến 72 ký tự.');

    try {
        const ROLE_TEXT = { customer: 'khách hàng', staff: 'nhân viên', admin: 'quản trị' };
        const [sameEmail] = await db.execute('SELECT id, full_name, role FROM users WHERE email = ? LIMIT 1', [email]);
        if (sameEmail.length) {
            return bad(res, 409, `Email ${email} đã tồn tại (tài khoản ${ROLE_TEXT[sameEmail[0].role] || ''} "${sameEmail[0].full_name}"). Hãy đổi tên đăng nhập khác, hoặc dùng nút sửa nếu đó là nhân viên bạn đã tạo.`);
        }
        if (phone) {
            const [samePhone] = await db.execute('SELECT id, full_name, role FROM users WHERE phone = ? LIMIT 1', [phone]);
            if (samePhone.length) {
                return bad(res, 409, `Số điện thoại ${phone} đang được dùng bởi tài khoản ${ROLE_TEXT[samePhone[0].role] || ''} "${samePhone[0].full_name}". Hãy dùng số khác hoặc để trống.`);
            }
        }

        const hash = await bcrypt.hash(password, 10);
        // email_verified_at = NOW(): tài khoản do admin tạo coi như đã xác minh
        const [result] = await db.execute(
            `INSERT INTO users (full_name, email, password_hash, phone, role, staff_position, status, created_by, email_verified_at)
             VALUES (?, ?, ?, ?, 'staff', ?, 1, ?, NOW())`,
            [fullName, email, hash, phone || null, position, req.user.id]
        );
        logActivity(req.user, 'staff.create', 'user', result.insertId, `${email} (${position})`);
        return res.status(201).json({
            success: true,
            message: 'Đã tạo tài khoản nhân viên.',
            data: { id: result.insertId, full_name: fullName, email, phone: phone || null, staff_position: position, status: 1 },
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return bad(res, 409, 'Email hoặc số điện thoại đã được dùng cho tài khoản khác.');
        return serverError(res, 'Lỗi tạo nhân viên:', error);
    }
});

// Lấy tài khoản nhân viên theo id (404 nếu là admin/khách hoặc không tồn tại)
async function findStaff(req, res) {
    if (!validId(req.params.id)) { bad(res, 400, 'Mã nhân viên không hợp lệ.'); return null; }
    const [rows] = await db.execute(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND role = 'staff' LIMIT 1`, [Number(req.params.id)]);
    if (!rows.length) { bad(res, 404, 'Không tìm thấy nhân viên.'); return null; }
    return rows[0];
}

router.patch('/:id', async (req, res) => {
    try {
        const staff = await findStaff(req, res);
        if (!staff) return;

        const sets = [];
        const values = [];
        if (req.body?.full_name !== undefined) {
            const fullName = clean(req.body.full_name, 100);
            if (fullName.length < 2) return bad(res, 400, 'Họ tên phải có ít nhất 2 ký tự.');
            sets.push('full_name = ?'); values.push(fullName);
        }
        if (req.body?.phone !== undefined) {
            const phone = clean(req.body.phone, 20);
            if (phone && !validPhone(phone)) return bad(res, 400, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.');
            if (phone) {
                const [taken] = await db.execute('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [phone, staff.id]);
                if (taken.length) return bad(res, 409, 'Số điện thoại đã được tài khoản khác sử dụng.');
            }
            sets.push('phone = ?'); values.push(phone || null);
        }
        if (req.body?.staff_position !== undefined) {
            if (!POSITIONS.includes(req.body.staff_position)) return bad(res, 400, 'Vị trí chỉ nhận: waiter, cashier hoặc kitchen.');
            sets.push('staff_position = ?'); values.push(req.body.staff_position);
        }
        if (!sets.length) return bad(res, 400, 'Không có thông tin nào để cập nhật.');

        await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, staff.id]);
        invalidateUserCache(staff.id); // đổi vị trí có hiệu lực ngay
        logActivity(req.user, 'staff.update', 'user', staff.id, staff.email);

        const [rows] = await db.execute(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [staff.id]);
        return res.json({ success: true, message: 'Đã cập nhật nhân viên.', data: rows[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return bad(res, 409, 'Số điện thoại đã được tài khoản khác sử dụng.');
        return serverError(res, 'Lỗi sửa nhân viên:', error);
    }
});

router.patch('/:id/status', async (req, res) => {
    const status = Number(req.body?.status);
    if (status !== 0 && status !== 1) return bad(res, 400, 'Trạng thái chỉ nhận 0 (khóa) hoặc 1 (hoạt động).');
    try {
        const staff = await findStaff(req, res);
        if (!staff) return;

        await db.execute('UPDATE users SET status = ? WHERE id = ?', [status, staff.id]);
        if (status === 0) revokeAllForUser(staff.id); // khóa là đăng xuất ngay mọi thiết bị
        invalidateUserCache(staff.id);
        logActivity(req.user, status === 0 ? 'staff.lock' : 'staff.unlock', 'user', staff.id, staff.email);
        return res.json({
            success: true,
            message: status === 0 ? 'Đã khóa tài khoản nhân viên.' : 'Đã mở khóa tài khoản nhân viên.',
            data: { id: staff.id, status },
        });
    } catch (error) {
        return serverError(res, 'Lỗi khóa/mở nhân viên:', error);
    }
});

router.post('/:id/reset-password', async (req, res) => {
    const password = String(req.body?.password || '');
    if (password.length < 8 || password.length > 72) return bad(res, 400, 'Mật khẩu tạm phải từ 8 đến 72 ký tự.');
    try {
        const staff = await findStaff(req, res);
        if (!staff) return;

        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), staff.id]);
        revokeAllForUser(staff.id);
        logActivity(req.user, 'staff.reset_password', 'user', staff.id, staff.email);
        return res.json({ success: true, message: 'Đã đặt lại mật khẩu. Nhân viên cần đăng nhập lại.' });
    } catch (error) {
        return serverError(res, 'Lỗi đặt lại mật khẩu nhân viên:', error);
    }
});

module.exports = router;
