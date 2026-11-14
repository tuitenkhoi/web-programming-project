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
            const [rows] = await db.execute(
                "SELECT id FROM users WHERE id = ? AND role IN ('admin', 'staff') AND status = 1 LIMIT 1",
                [userId]
            );
            if (!rows.length) return next(new Error('FORBIDDEN'));
            socket.data.userId = userId;
            return next();
        } catch (_error) {
            return next(new Error('UNAUTHORIZED'));
        }
    });

    io.on('connection', (socket) => {
        // Tên phòng giữ là 'admins' cho tương thích; nay gồm cả nhân viên
        socket.join('admins');
    });
    return io;
}

function emit(event, payload = {}) {
    if (io) io.to('admins').emit(event, payload);
}

module.exports = { initialize, emit };
