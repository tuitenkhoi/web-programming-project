// Gửi email (kích hoạt tài khoản, mã OTP quên mật khẩu).
// Chưa cấu hình SMTP_HOST thì KHÔNG ném lỗi: chỉ in nội dung mail ra console ("[MAIL TRAP]")
// để lúc dev vẫn lấy được link kích hoạt / mã OTP mà test.
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465, // cổng 465 dùng SSL, các cổng khác dùng STARTTLS
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
            : undefined,

        // Mail server chậm/không trả lời thì bỏ cuộc sau 10 giây (mặc định của nodemailer là 30 giây đến 2 phút)
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
    return transporter;
}

// Trả true nếu đã gửi/ghi log, false nếu gửi lỗi (không ném lỗi để không làm hỏng luồng đăng ký)
async function sendMail({ to, subject, text, html }) {
    if (!process.env.SMTP_HOST) {
        console.log(`[MAIL TRAP] Gửi tới: ${to} | Tiêu đề: ${subject}\n${text}`);
        return true;
    }
    try {
        await getTransporter().sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html,
        });
        return true;
    } catch (error) {
        console.error('Không gửi được email:', error.code || error.message);
        return false;
    }
}

module.exports = { sendMail };
