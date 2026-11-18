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

// Tách "Tên <email>" hoặc "email" thành { name, email } (Brevo cần tách riêng hai phần)
function parseSender(value) {
    const raw = String(value || '').trim().replace(/^"+|"+$/g, '');
    const match = raw.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
    if (match) return { name: match[1].replace(/^"+|"+$/g, '').trim() || undefined, email: match[2] };
    const bare = raw.match(/[^\s<>"]+@[^\s<>"]+/);
    if (bare) {
        const name = raw.replace(bare[0], '').replace(/[<>"]/g, '').trim();
        return { name: name || undefined, email: bare[0] };
    }
    return null;
}

// Gửi qua API HTTPS của Brevo: Render gói miễn phí chặn cổng SMTP (587/465/25) nên SMTP bị ETIMEDOUT, còn HTTPS thì không bị chặn.
async function sendViaBrevo({ to, subject, text, html }) {
    const sender = parseSender(process.env.MAIL_FROM || process.env.SMTP_USER);
    if (!sender) {
        console.error('Không gửi được email: MAIL_FROM không hợp lệ (cần dạng "Tên <email>" hoặc "email").');
        return false;
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender,
            to: [{ email: to }],
            subject,
            textContent: text,
            ...(html ? { htmlContent: html } : {}),
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`Không gửi được email (Brevo ${response.status}):`, detail.slice(0, 300));
        return false;
    }
    return true;
}

// Trả true nếu đã gửi/ghi log, false nếu gửi lỗi (không ném lỗi để không làm hỏng luồng đăng ký)
async function sendMail({ to, subject, text, html }) {
    if (process.env.BREVO_API_KEY) {
        try {
            return await sendViaBrevo({ to, subject, text, html });
        } catch (error) {
            console.error('Không gửi được email (Brevo):', error.code || error.name || error.message);
            return false;
        }
    }
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[MAIL] Chưa đặt SMTP_HOST nên email KHÔNG được gửi thật. Hãy thêm BREVO_API_KEY (hoặc SMTP_*) trong Render > Environment.');
        }
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

module.exports = { sendMail, parseSender };
