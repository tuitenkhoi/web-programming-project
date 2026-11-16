SET NAMES utf8mb4;
USE moc_coffee;

-- Migration 009: "Hết món theo ngày". Nhân viên đánh dấu một món đã hết cho riêng ngày hôm nay (giờ Việt Nam);
-- sang ngày mới món tự bán lại, không cần ai bật lại. Chạy lại nhiều lần vẫn an toàn.
CREATE TABLE IF NOT EXISTS product_sold_out (
    product_id INT UNSIGNED NOT NULL PRIMARY KEY,
    sold_date DATE NOT NULL,
    marked_by INT UNSIGNED NULL,
    marked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sold_out_date (sold_date),
    CONSTRAINT fk_sold_out_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
