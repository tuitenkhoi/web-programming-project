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


CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(30) NOT NULL UNIQUE,
    user_id INT UNSIGNED NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(150) NULL,
    order_type ENUM('at_table', 'takeaway')
        NOT NULL DEFAULT 'at_table',
    table_code VARCHAR(20) NULL,
    note VARCHAR(300) NULL,
    coupon_code VARCHAR(30) NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method ENUM('cash', 'bank_transfer')
        NOT NULL DEFAULT 'cash',
    payment_status ENUM(
        'pending',
        'pending_verification',
        'paid',
        'failed',
        'refunded'
    ) NOT NULL DEFAULT 'pending',
    status ENUM(
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_orders_phone (customer_phone),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created_at (created_at),

    CONSTRAINT fk_orders_users
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    product_name VARCHAR(150) NOT NULL,
    product_image VARCHAR(255) NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    size VARCHAR(10) NOT NULL DEFAULT 'M',
    sugar_level VARCHAR(10) NOT NULL DEFAULT '70%',
    ice_level VARCHAR(10) NOT NULL DEFAULT '70%',
    toppings TEXT NULL,
    note VARCHAR(200) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id),

    CONSTRAINT fk_order_items_orders
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_products
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
