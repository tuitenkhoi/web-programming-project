SET NAMES utf8mb4;
USE moc_coffee;

-- Migration 007: tài khoản nhân viên (staff), người tạo đơn và nhật ký thao tác.
-- Có thể chạy lại nhiều lần. Không dùng "ADD COLUMN IF NOT EXISTS" để chạy được cả MariaDB 10.4 (XAMPP) lẫn MySQL/TiDB.

-- 1) users.role thêm giá trị 'staff' (tài khoản cũ giữ nguyên)
ALTER TABLE users
    MODIFY COLUMN role ENUM('customer', 'admin', 'staff') NOT NULL DEFAULT 'customer';

-- 2) users.staff_position: vị trí của nhân viên (chỉ dùng khi role = 'staff')
SET @has_position = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'staff_position'
);
SET @sql = IF(@has_position = 0,
    'ALTER TABLE users
        ADD COLUMN staff_position ENUM(''waiter'', ''cashier'', ''kitchen'') NULL,
        ADD COLUMN created_by INT UNSIGNED NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) orders: ai tạo đơn + đơn đến từ đâu (khách tự đặt hay nhân viên tạo)
SET @has_created_by = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'created_by'
);
SET @sql = IF(@has_created_by = 0,
    'ALTER TABLE orders
        ADD COLUMN created_by INT UNSIGNED NULL,
        ADD COLUMN source ENUM(''online'', ''staff'') NOT NULL DEFAULT ''online''',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Khách vãng lai tại quầy có thể không cho số điện thoại
ALTER TABLE orders MODIFY COLUMN customer_phone VARCHAR(20) NULL;

-- 4) Nhật ký thao tác của nhân viên/admin
CREATE TABLE IF NOT EXISTS staff_activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    user_name VARCHAR(100) NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(30) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    detail VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activity_created (created_at),
    INDEX idx_activity_user (user_id, created_at),
    INDEX idx_activity_entity (entity, entity_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
