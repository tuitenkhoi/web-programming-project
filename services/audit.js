// Ghi nhật ký thao tác (ai làm gì, lúc nào). Lỗi ghi nhật ký KHÔNG được làm hỏng thao tác chính.
const db = require('../config/db');

// logActivity(req.user, 'order.cancel', 'order', 12, 'Đơn MC2026...')
async function logActivity(user, action, entity, entityId, detail) {
    if (!user || !user.id) return;
    try {
        await db.execute(
            `INSERT INTO staff_activity_logs (user_id, user_name, action, entity, entity_id, detail)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                Number(user.id),
                String(user.full_name || '').slice(0, 100) || null,
                String(action).slice(0, 50),
                String(entity).slice(0, 30),
                entityId === undefined || entityId === null ? null : Number(entityId),
                detail ? String(detail).slice(0, 500) : null,
            ]
        );
    } catch (error) {
        console.error('Không ghi được nhật ký thao tác:', error.code || error.message);
    }
}

module.exports = { logActivity };
