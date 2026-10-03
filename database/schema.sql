CREATE DATABASE IF NOT EXISTS moc_coffee
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE moc_coffee;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(170) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    image VARCHAR(255),
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_categories
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


INSERT IGNORE INTO categories
    (name, slug, description)
VALUES
    ('Cà phê', 'ca-phe', 'Các loại cà phê truyền thống'),
    ('Trà trái cây', 'tra-trai-cay', 'Các loại trà trái cây'),
    ('Đá xay', 'da-xay', 'Các loại thức uống đá xay'),
    ('Bánh ngọt', 'banh-ngot', 'Các loại bánh ngọt');


INSERT IGNORE INTO products
    (category_id, name, slug, description, price, image)
VALUES
    (
        (SELECT id FROM categories WHERE slug = 'ca-phe'),
        'Cà phê sữa đá',
        'ca-phe-sua-da',
        'Cà phê sữa đá truyền thống',
        29000,
        'ca-phe-sua-da.jpg'
    ),
    (
        (SELECT id FROM categories WHERE slug = 'ca-phe'),
        'Bạc xỉu',
        'bac-xiu',
        'Bạc xỉu thơm béo',
        32000,
        'bac-xiu.jpg'
    ),
    (
        (SELECT id FROM categories WHERE slug = 'tra-trai-cay'),
        'Trà đào cam sả',
        'tra-dao-cam-sa',
        'Trà đào cam sả thanh mát',
        45000,
        'tra-dao-cam-sa.jpg'
    ),
    (
        (SELECT id FROM categories WHERE slug = 'da-xay'),
        'Matcha đá xay',
        'matcha-da-xay',
        'Matcha đá xay thơm béo',
        49000,
        'matcha-da-xay.jpg'
    ),
    (
        (SELECT id FROM categories WHERE slug = 'banh-ngot'),
        'Bánh Tiramisu',
        'banh-tiramisu',
        'Bánh Tiramisu mềm mịn',
        45000,
        'banh-tiramisu.jpg'
    );