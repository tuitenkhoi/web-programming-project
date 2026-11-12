SET NAMES utf8mb4;
USE moc_coffee;

-- Bổ sung hồ sơ, tùy chọn giao diện, xác minh email và quên mật khẩu (OTP) cho bảng users.
-- Chạy được trên cả MariaDB 10.4 (XAMPP) lẫn MySQL 8: KHÔNG dùng "ADD COLUMN IF NOT EXISTS".
-- Có thể chạy lại nhiều lần: chỉ ALTER khi cột "avatar" (cột đầu tiên của đợt này) chưa tồn tại.
SET @has_avatar = (
    SELECT COUNT(*)
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'avatar'
);

SET @users_alter_sql = IF(
    @has_avatar = 0,
    'ALTER TABLE users
        ADD COLUMN avatar VARCHAR(255) NULL,
        ADD COLUMN theme VARCHAR(10) NOT NULL DEFAULT ''light'',
        ADD COLUMN font_size TINYINT NOT NULL DEFAULT 16,
        ADD COLUMN email_verified_at DATETIME NULL,
        ADD COLUMN verification_token CHAR(32) NULL,
        ADD COLUMN verification_expires_at DATETIME NULL,
        ADD COLUMN reset_otp CHAR(6) NULL,
        ADD COLUMN reset_otp_expires_at DATETIME NULL,
        ADD COLUMN reset_attempts TINYINT NOT NULL DEFAULT 0,
        ADD COLUMN reset_ticket CHAR(32) NULL,
        ADD COLUMN reset_ticket_expires_at DATETIME NULL',
    'SELECT 1'
);
PREPARE users_alter_stmt FROM @users_alter_sql;
EXECUTE users_alter_stmt;
DEALLOCATE PREPARE users_alter_stmt;

-- Tài khoản tạo trước đợt này (kể cả admin) được coi là đã xác minh để không bị banner làm phiền
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL AND verification_token IS NULL;
