-- Schema thống nhất cho Mộc Coffee (Node.js + MySQL + JWT).
-- Gộp từ 2 nhánh bị conflict trong schema.sql cũ:
--   * Giữ nguyên các bảng của nhóm: users, categories, products, orders, order_items (tuần 3)
--   * Thêm `coffee_tables` và `bookings` cho đặt bàn / sơ đồ bàn (tuần 5) - cấu trúc chuẩn duy nhất
--   * Bỏ order_details và invoices (nhánh HEAD): đã được order_items thay thế, code hiện tại không dùng
-- Chạy: mysql -u <user> -p < database/schema.sql

SET NAMES utf8mb4;

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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uq_users_phone (phone)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(170) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    image VARCHAR(255),
    status TINYINT(1) NOT NULL DEFAULT 1,
    is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    pinned_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_status_category (status, category_id),
    INDEX idx_products_pinned (is_pinned, pinned_at),
    CONSTRAINT fk_products_categories FOREIGN KEY (category_id)
        REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


INSERT IGNORE INTO categories (name, slug, description) VALUES
    ('Cà phê', 'ca-phe', 'Các loại cà phê truyền thống'),
    ('Trà trái cây', 'tra-trai-cay', 'Các loại trà trái cây'),
    ('Đá xay', 'da-xay', 'Các loại thức uống đá xay'),
    ('Bánh ngọt', 'banh-ngot', 'Các loại bánh ngọt');

INSERT IGNORE INTO products (category_id, name, slug, description, price, image) VALUES
    ((SELECT id FROM categories WHERE slug = 'ca-phe'), 'Cà phê sữa đá', 'ca-phe-sua-da', 'Cà phê sữa đá truyền thống', 29000, 'ca-phe-sua-da.jpg'),
    ((SELECT id FROM categories WHERE slug = 'ca-phe'), 'Bạc xỉu', 'bac-xiu', 'Bạc xỉu thơm béo', 32000, 'bac-xiu.jpg'),
    ((SELECT id FROM categories WHERE slug = 'tra-trai-cay'), 'Trà đào cam sả', 'tra-dao-cam-sa', 'Trà đào cam sả thanh mát', 45000, 'tra-dao-cam-sa.jpg'),
    ((SELECT id FROM categories WHERE slug = 'da-xay'), 'Matcha đá xay', 'matcha-da-xay', 'Matcha đá xay thơm béo', 49000, 'matcha-da-xay.jpg'),
    ((SELECT id FROM categories WHERE slug = 'banh-ngot'), 'Bánh Tiramisu', 'banh-tiramisu', 'Bánh Tiramisu mềm mịn', 45000, 'banh-tiramisu.jpg');

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(30) NOT NULL UNIQUE,
    user_id INT UNSIGNED NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(150) NULL,
    order_type ENUM('at_table', 'takeaway') NOT NULL DEFAULT 'at_table',
    table_code VARCHAR(20) NULL,
    note VARCHAR(300) NULL,
    coupon_code VARCHAR(30) NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method ENUM('cash', 'bank_transfer') NOT NULL DEFAULT 'cash',
    payment_status ENUM('pending', 'pending_verification', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    status ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_orders_phone (customer_phone),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created_at (created_at),
    INDEX idx_orders_table_open (table_code, status, payment_status),
    INDEX idx_orders_payment_status (payment_status),
    CONSTRAINT fk_orders_users FOREIGN KEY (user_id)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;


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
    CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id)
        REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_order_items_products FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

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
    CONSTRAINT fk_voucher_usages_voucher FOREIGN KEY (voucher_id)
        REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_voucher_usages_order FOREIGN KEY (order_id)
        REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_voucher_usages_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
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
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_reviews_order FOREIGN KEY (order_id)
        REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Tệp đính kèm của sản phẩm (ảnh phụ, video, tài liệu) - migration 005
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

-- Nhãn sản phẩm (nhiều-nhiều) - migration 005
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

INSERT IGNORE INTO vouchers (
    code, name, description, discount_type, value, min_order,
    max_discount, starts_at, ends_at, usage_limit, per_user_limit, status
) VALUES (
    'MOCCOFFEE10', 'Giảm 10%', 'Giảm 10% cho đơn từ 50.000đ',
    'percent', 10, 50000, 50000, '2026-01-01 00:00:00',
    '2030-12-31 23:59:59', 10000, 3, 1
);

-- ===== Tuần 5: bàn và đặt bàn (cấu trúc CHUẨN, dùng chung cho Node và PHP) =====
-- Bảng bàn là coffee_tables, bảng đặt bàn là bookings (booking_code, customer_phone, booking_date, booking_time...).
-- Không còn bảng `tables` kiểu cũ. Máy đang có bookings kiểu cũ (cột `phone`) -> xem database/migrations/.
CREATE TABLE IF NOT EXISTS coffee_tables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_code VARCHAR(20) NOT NULL UNIQUE,
    table_name VARCHAR(100) NOT NULL,
    capacity INT UNSIGNED NOT NULL DEFAULT 2,
    area VARCHAR(100) NULL,
    status ENUM(
        'available',
        'occupied',
        'maintenance'
    ) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    table_id INT UNSIGNED NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(150) NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    guest_count INT UNSIGNED NOT NULL,
    note VARCHAR(300) NULL,
    status ENUM(
        'pending',
        'confirmed',
        'seated',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_bookings_date_time (
        booking_date,
        booking_time
    ),

    INDEX idx_bookings_status (status),

    INDEX idx_bookings_table_date_time (
        table_id,
        booking_date,
        booking_time
    ),

    INDEX idx_bookings_status_created (status, created_at),

    CONSTRAINT fk_bookings_table
        FOREIGN KEY (table_id)
        REFERENCES coffee_tables(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

INSERT INTO coffee_tables (
    table_code,
    table_name,
    capacity,
    area,
    status
) VALUES
    (
        'T01',
        'Bàn T01',
        2,
        'Tầng trệt',
        'available'
    ),
    (
        'T02',
        'Bàn T02',
        2,
        'Tầng trệt',
        'available'
    ),
    (
        'T03',
        'Bàn T03',
        4,
        'Tầng trệt',
        'available'
    ),
    (
        'T04',
        'Bàn T04',
        4,
        'Tầng trệt',
        'available'
    ),
    (
        'T05',
        'Bàn T05',
        4,
        'Khu vực cửa sổ',
        'available'
    ),
    (
        'T06',
        'Bàn T06',
        6,
        'Khu vực cửa sổ',
        'available'
    ),
    (
        'T07',
        'Bàn T07',
        6,
        'Tầng 1',
        'available'
    ),
    (
        'T08',
        'Bàn T08',
        8,
        'Tầng 1',
        'available'
    )
ON DUPLICATE KEY UPDATE
    table_name = VALUES(table_name),
    capacity = VALUES(capacity),
    area = VALUES(area);
