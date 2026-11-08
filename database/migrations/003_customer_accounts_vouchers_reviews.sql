SET NAMES utf8mb4;
USE moc_coffee;

-- Có thể chạy lại migration mà không lỗi nếu index đã tồn tại.
SET @has_users_phone_index = (
    SELECT COUNT(*)
      FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'uq_users_phone'
);
SET @users_phone_index_sql = IF(
    @has_users_phone_index = 0,
    'ALTER TABLE users ADD UNIQUE INDEX uq_users_phone (phone)',
    'SELECT 1'
);
PREPARE users_phone_index_stmt FROM @users_phone_index_sql;
EXECUTE users_phone_index_stmt;
DEALLOCATE PREPARE users_phone_index_stmt;

CREATE TABLE IF NOT EXISTS vouchers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    discount_type ENUM('percent', 'fixed') NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    min_order DECIMAL(12, 2) NOT NULL DEFAULT 0,
    max_discount DECIMAL(12, 2) NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    usage_limit INT UNSIGNED NULL,
    per_user_limit INT UNSIGNED NOT NULL DEFAULT 1,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vouchers_active (status, starts_at, ends_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_usages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NULL,
    customer_phone VARCHAR(20) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_voucher_order (voucher_id, order_id),
    INDEX idx_voucher_user (voucher_id, user_id),
    INDEX idx_voucher_phone (voucher_id, customer_phone),
    CONSTRAINT fk_voucher_usages_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    CONSTRAINT fk_voucher_usages_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_voucher_usages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment VARCHAR(1000) NULL,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_review_purchase (user_id, product_id, order_id),
    INDEX idx_reviews_product (product_id, status, created_at),
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO vouchers (
    code, name, description, discount_type, value, min_order,
    max_discount, starts_at, ends_at, usage_limit, per_user_limit, status
) VALUES (
    'MOCCOFFEE10', 'Giảm 10%', 'Giảm 10% cho đơn từ 50.000đ',
    'percent', 10, 50000, 50000, '2026-01-01 00:00:00',
    '2030-12-31 23:59:59', 10000, 3, 1
);
