SET NAMES utf8mb4;
USE moc_coffee;

-- Migration 006: tài khoản MỚI mặc định giao diện Sáng (trước đây là 'system').
-- Chỉ đổi giá trị mặc định của cột; KHÔNG đổi dữ liệu của tài khoản cũ.
-- Chạy được trên MariaDB 10.4 (XAMPP) lẫn MySQL 8, chạy lại nhiều lần vẫn an toàn.
--   mysql -u root -p moc_coffee < database/migrations/006_theme_default_light.sql
ALTER TABLE users ALTER COLUMN theme SET DEFAULT 'light';
