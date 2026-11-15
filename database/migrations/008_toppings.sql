SET NAMES utf8mb4;
USE moc_coffee;

-- Migration 008: bảng topping do admin quản lý (trang "Quản lý món" > nút "Quản lý topping").
-- Trước đây topping và giá viết cứng trong HTML + code server nên không sửa được.
-- Chạy được trên MariaDB 10.4 (XAMPP) lẫn MySQL 8, CHẠY LẠI NHIỀU LẦN vẫn an toàn:
--   mysql -u root -p moc_coffee < database/migrations/008_toppings.sql

CREATE TABLE IF NOT EXISTS toppings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price INT UNSIGNED NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_toppings_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Dữ liệu mẫu: 4 topping cũ (giữ nguyên tên và giá để giỏ hàng cũ vẫn dùng được) + 8 lựa chọn mới.
-- INSERT IGNORE: topping đã có (trùng tên) thì bỏ qua, không ghi đè giá admin đã sửa.
INSERT IGNORE INTO toppings (name, price, sort_order) VALUES
    ('Trân châu', 10000, 1),
    ('Thạch cà phê', 10000, 2),
    ('Kem sữa', 12000, 3),
    ('Thêm shot cà phê', 15000, 4),
    ('Trân châu trắng', 10000, 5),
    ('Pudding trứng', 12000, 6),
    ('Thạch dừa', 8000, 7),
    ('Sương sáo', 8000, 8),
    ('Kem cheese', 15000, 9),
    ('Sốt caramel', 8000, 10),
    ('Đào miếng', 12000, 11),
    ('Thạch trái cây', 10000, 12);
