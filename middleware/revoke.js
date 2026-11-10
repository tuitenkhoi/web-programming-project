// Danh sách thu hồi token lưu trong bộ nhớ (đủ dùng cho 1 server Node duy nhất).
// JWT bản thân không "hủy" được, nên ta ghi nhớ những token đã đăng xuất và từ chối chúng.
// Lưu ý: khởi động lại server thì danh sách này mất, nhưng token cũ vẫn tự hết hạn theo JWT_EXPIRES_IN.

const revokedJti = new Map();      // jti -> thời điểm token hết hạn (ms)
const revokedBefore = new Map();   // userId -> mọi token phát hành trước mốc này (ms) đều bị thu hồi

// Thu hồi MỘT token (dùng khi đăng xuất). expSeconds là claim "exp" của token.
function revokeToken(jti, expSeconds) {
    if (!jti) return;
    revokedJti.set(jti, Number(expSeconds) * 1000);
}

// Thu hồi MỌI phiên của một người dùng (dùng khi đổi / đặt lại mật khẩu)
function revokeAllForUser(userId) {
    revokedBefore.set(Number(userId), Date.now());
}

// decoded: payload JWT đã giải mã. Token cũ không có jti (ký trước khi có tính năng này) vẫn hợp lệ.
function isRevoked(decoded) {
    if (decoded.jti && revokedJti.has(decoded.jti)) return true;
    const cutoff = revokedBefore.get(Number(decoded.id ?? decoded.sub));
    if (cutoff) {
        const issuedAt = Number(decoded.iat_ms) || Number(decoded.iat) * 1000;
        if (issuedAt <= cutoff) return true;
    }
    return false;
}

// Tự dọn các jti đã hết hạn (không cần giữ nữa vì token đó vốn đã không dùng được)
setInterval(() => {
    const now = Date.now();
    for (const [jti, expiresAt] of revokedJti) {
        if (expiresAt <= now) revokedJti.delete(jti);
    }
}, 10 * 60 * 1000).unref();

module.exports = { revokeToken, revokeAllForUser, isRevoked };
