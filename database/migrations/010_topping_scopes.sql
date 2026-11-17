-- 010: Topping áp dụng theo danh mục món + ngoại lệ từng món.
-- Quy tắc: topping KHÔNG có dòng nào trong hai bảng này (hoặc chỉ có dòng "loại trừ") thì áp dụng cho mọi món.
--         Topping có danh mục / món được chọn thì chỉ hiện ở các danh mục / món đó.
--         topping_products.allowed = 1: thêm món riêng; allowed = 0: loại trừ món khỏi danh mục đã chọn.
-- Chạy: mysql -u root moc_coffee < database/migrations/010_topping_scopes.sql  (TiDB: dán vào SQL Editor)
USE moc_coffee;

CREATE TABLE IF NOT EXISTS topping_categories (
    topping_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (topping_id, category_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS topping_products (
    topping_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    allowed TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (topping_id, product_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Gợi ý (bỏ comment nếu muốn): "Thêm shot cà phê" chỉ cho danh mục Cà phê
-- INSERT IGNORE INTO topping_categories (topping_id, category_id)
--   SELECT t.id, c.id FROM toppings t, categories c WHERE t.name = 'Thêm shot cà phê' AND c.name = 'Cà phê';
