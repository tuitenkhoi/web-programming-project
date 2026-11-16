let io = null;

function initialize(server) {
    const { Server } = require('socket.io');
    const jwt = require('jsonwebtoken');
    const db = require('./config/db');
    const { SECRET_KEY } = require('./middleware/auth');
    const allowedOrigins = String(process.env.CORS_ORIGIN || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    io = new Server(server, {
        cors: {
            origin: allowedOrigins.length ? allowedOrigins : true,
            credentials: false,
        },
    });

    // Kênh realtime dành cho admin và nhân viên đã xác thực. Không tin role trong token;
    // luôn đối chiếu lại role và trạng thái tài khoản trong database.
    io.use(async (socket, next) => {
        try {
            const token = String(socket.handshake.auth?.token || '');
            const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });
            const userId = Number(decoded.id ?? decoded.sub);
            if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isFinite(decoded.exp)) {
                return next(new Error('UNAUTHORIZED'));
            }
            let rows;
            try {
                [rows] = await db.execute(
                    "SELECT id, role, staff_position FROM users WHERE id = ? AND role IN ('admin', 'staff') AND status = 1 LIMIT 1",
                    [userId]
                );
            } catch (error) {
                if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
                // Chưa chạy migration 007 (chưa có staff_position): vẫn cho kết nối, chỉ không có phòng theo vị trí
                [rows] = await db.execute(
                    "SELECT id, role FROM users WHERE id = ? AND role IN ('admin', 'staff') AND status = 1 LIMIT 1",
                    [userId]
                );
            }
            if (!rows.length) return next(new Error('FORBIDDEN'));
            socket.data.userId = userId;
            socket.data.room = rows[0].role === 'admin' ? 'pos:admin' : (rows[0].staff_position ? `pos:${rows[0].staff_position}` : null);
            return next();
        } catch (_error) {
            return next(new Error('UNAUTHORIZED'));
        }
    });

    io.on('connection', (socket) => {
        // Tên phòng giữ là 'admins' cho tương thích; nay gồm cả nhân viên
        socket.join('admins');
        // Phòng theo vị trí (pos:waiter, pos:cashier, pos:kitchen, pos:admin) để gửi thông báo đúng người
        if (socket.data.room) socket.join(socket.data.room);
    });
    return io;
}

function emit(event, payload = {}) {
    if (io) io.to('admins').emit(event, payload);
}

// Gửi tới các vị trí được chọn, ví dụ emitToPositions(['waiter', 'admin'], 'order:ready', {...})
function emitToPositions(positions, event, payload = {}) {
    if (!io) return;
    positions.forEach((position) => io.to(`pos:${position}`).emit(event, payload));
}

module.exports = { initialize, emit, emitToPositions };
