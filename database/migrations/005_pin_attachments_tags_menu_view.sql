SET NAMES utf8mb4;
USE moc_coffee;

-- Migration 005 (S17, S19, S20, S23): chạy được trên MariaDB 10.4 (XAMPP) lẫn MySQL 8.
-- KHÔNG dùng "ADD COLUMN IF NOT EXISTS" / "CREATE INDEX IF NOT EXISTS": mỗi thay đổi tự kiểm tra
-- information_schema trước khi chạy, nên CHẠY LẠI NHIỀU LẦN vẫn an toàn.
--   mysql -u root -p moc_coffee < database/migrations/005_pin_attachments_tags_menu_view.sql

-- ===== S17: kiểu hiển thị thực đơn của khách (đồng bộ giữa các thiết bị) =====
SET @has_menu_view = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'menu_view'
);
SET @menu_view_sql = IF(
    @has_menu_view = 0,
    'ALTER TABLE users ADD COLUMN menu_view VARCHAR(10) NOT NULL DEFAULT ''grid''',
    'SELECT 1'
);
PREPARE menu_view_stmt FROM @menu_view_sql;
EXECUTE menu_view_stmt;
DEALLOCATE PREPARE menu_view_stmt;

-- ===== S20: ghim sản phẩm =====
SET @has_is_pinned = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_pinned'
);
SET @pin_sql = IF(
    @has_is_pinned = 0,
    'ALTER TABLE products
        ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN pinned_at DATETIME NULL',
    'SELECT 1'
);
PREPARE pin_stmt FROM @pin_sql;
EXECUTE pin_stmt;
DEALLOCATE PREPARE pin_stmt;

SET @has_pin_index = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_pinned'
);
SET @pin_index_sql = IF(
    @has_pin_index = 0,
    'ALTER TABLE products ADD INDEX idx_products_pinned (is_pinned, pinned_at)',
    'SELECT 1'
);
PREPARE pin_index_stmt FROM @pin_index_sql;
EXECUTE pin_index_stmt;
DEALLOCATE PREPARE pin_index_stmt;

-- ===== S19: đính kèm sản phẩm (ảnh phụ, video, tài liệu) =====
-- Tạo ở commit S21 vì câu truy vấn danh sách món (badge 🎞️ / 📎) đã LEFT JOIN bảng này.
CREATE TABLE IF NOT EXISTS product_attachments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    kind ENUM('image', 'video', 'file') NOT NULL DEFAULT 'image',
    url VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size INT UNSIGNED NOT NULL DEFAULT 0,
    sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attachments_product (product_id, kind, sort_order),
    CONSTRAINT fk_attachments_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ===== S23: nhãn (tag) nhiều-nhiều cho sản phẩm =====
CREATE TABLE IF NOT EXISTS tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(60) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tags_name (name),
    UNIQUE KEY uq_tags_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_tags (
    product_id INT UNSIGNED NOT NULL,
    tag_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (product_id, tag_id),
    INDEX idx_product_tags_tag (tag_id),
    CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_product_tags_tag FOREIGN KEY (tag_id)
        REFERENCES tags(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
