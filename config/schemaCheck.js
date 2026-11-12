// So cấu trúc database đang chạy với cấu trúc mà code cần (khớp database/schema.sql).
// Dùng bởi `npm run check-db` và khi khởi động server.
const E = (...values) => values.map((v) => `'${v}'`).join(', ');

// Với mỗi bảng: cột -> câu định nghĩa dùng khi cần ADD COLUMN.
// "id" không có định nghĩa vì không thể tự thêm khóa chính vào bảng đã có dữ liệu.
const EXPECTED = {
    users: {
        id: null,
        full_name: "VARCHAR(100) NOT NULL DEFAULT ''",
        email: "VARCHAR(150) NOT NULL DEFAULT ''",
        password_hash: "VARCHAR(255) NOT NULL DEFAULT ''",
        phone: 'VARCHAR(20) NULL',
        role: `ENUM(${E('customer', 'admin')}) NOT NULL DEFAULT 'customer'`,
        status: 'TINYINT(1) NOT NULL DEFAULT 1',
        avatar: 'VARCHAR(255) NULL',
        theme: "VARCHAR(10) NOT NULL DEFAULT 'light'",
        font_size: 'TINYINT NOT NULL DEFAULT 16',
        menu_view: "VARCHAR(10) NOT NULL DEFAULT 'grid'",
        // Các cột còn lại của migration 004_user_completeness.sql (xác minh email, quên mật khẩu).
        // Thiếu chúng thì đăng ký/quên mật khẩu báo lỗi 500, nên phải nằm trong danh sách để check-db báo và --fix thêm đủ.
        email_verified_at: 'DATETIME NULL',
        verification_token: 'CHAR(32) NULL',
        verification_expires_at: 'DATETIME NULL',
        reset_otp: 'CHAR(6) NULL',
        reset_otp_expires_at: 'DATETIME NULL',
        reset_attempts: 'TINYINT NOT NULL DEFAULT 0',
        reset_ticket: 'CHAR(32) NULL',
        reset_ticket_expires_at: 'DATETIME NULL',
    },
    categories: {
        id: null,
        name: "VARCHAR(100) NOT NULL DEFAULT ''",
        slug: 'VARCHAR(120) NULL',
        description: 'TEXT NULL',
        status: 'TINYINT(1) NOT NULL DEFAULT 1',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    products: {
        id: null,
        category_id: 'INT UNSIGNED NULL',
        name: "VARCHAR(150) NOT NULL DEFAULT ''",
        slug: 'VARCHAR(170) NULL',
        description: 'TEXT NULL',
        price: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        image: 'VARCHAR(255) NULL',
        status: 'TINYINT(1) NOT NULL DEFAULT 1',
        is_pinned: 'TINYINT(1) NOT NULL DEFAULT 0',
        pinned_at: 'DATETIME NULL',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    orders: {
        id: null,
        order_code: 'VARCHAR(30) NULL',
        user_id: 'INT UNSIGNED NULL',
        customer_name: "VARCHAR(100) NOT NULL DEFAULT ''",
        customer_phone: "VARCHAR(20) NOT NULL DEFAULT ''",
        customer_email: 'VARCHAR(150) NULL',
        order_type: `ENUM(${E('at_table', 'takeaway')}) NOT NULL DEFAULT 'at_table'`,
        table_code: 'VARCHAR(20) NULL',
        note: 'VARCHAR(300) NULL',
        coupon_code: 'VARCHAR(30) NULL',
        subtotal: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        discount_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        service_fee: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        total_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        payment_method: `ENUM(${E('cash', 'bank_transfer')}) NOT NULL DEFAULT 'cash'`,
        payment_status: `ENUM(${E('pending', 'pending_verification', 'paid', 'failed', 'refunded')}) NOT NULL DEFAULT 'pending'`,
        status: `ENUM(${E('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')}) NOT NULL DEFAULT 'pending'`,
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    order_items: {
        id: null,
        order_id: 'BIGINT UNSIGNED NULL',
        product_id: 'INT UNSIGNED NULL',
        product_name: "VARCHAR(150) NOT NULL DEFAULT ''",
        product_image: 'VARCHAR(255) NULL',
        unit_price: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        quantity: 'INT UNSIGNED NOT NULL DEFAULT 1',
        line_total: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        size: "VARCHAR(10) NOT NULL DEFAULT 'M'",
        sugar_level: "VARCHAR(10) NOT NULL DEFAULT '70%'",
        ice_level: "VARCHAR(10) NOT NULL DEFAULT '70%'",
        toppings: 'TEXT NULL',
        note: 'VARCHAR(200) NULL',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    coffee_tables: {
        id: null,
        table_code: 'VARCHAR(20) NULL',
        table_name: "VARCHAR(100) NOT NULL DEFAULT ''",
        capacity: 'INT UNSIGNED NOT NULL DEFAULT 2',
        area: 'VARCHAR(100) NULL',
        status: `ENUM(${E('available', 'occupied', 'maintenance')}) NOT NULL DEFAULT 'available'`,
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    bookings: {
        id: null,
        booking_code: 'VARCHAR(30) NULL',
        table_id: 'INT UNSIGNED NULL',
        customer_name: "VARCHAR(100) NOT NULL DEFAULT ''",
        customer_phone: "VARCHAR(20) NOT NULL DEFAULT ''",
        customer_email: 'VARCHAR(150) NULL',
        booking_date: 'DATE NULL',
        booking_time: 'TIME NULL',
        guest_count: 'INT UNSIGNED NOT NULL DEFAULT 1',
        note: 'VARCHAR(300) NULL',
        status: `ENUM(${E('pending', 'confirmed', 'seated', 'completed', 'cancelled')}) NOT NULL DEFAULT 'pending'`,
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    vouchers: {
        id: null,
        code: "VARCHAR(30) NOT NULL DEFAULT ''",
        name: "VARCHAR(120) NOT NULL DEFAULT ''",
        description: 'VARCHAR(255) NULL',
        discount_type: `ENUM(${E('percent', 'fixed')}) NOT NULL DEFAULT 'percent'`,
        value: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        min_order: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        max_discount: 'DECIMAL(12,2) NULL',
        starts_at: 'DATETIME NULL',
        ends_at: 'DATETIME NULL',
        usage_limit: 'INT UNSIGNED NULL',
        per_user_limit: 'INT UNSIGNED NOT NULL DEFAULT 1',
        used_count: 'INT UNSIGNED NOT NULL DEFAULT 0',
        status: 'TINYINT(1) NOT NULL DEFAULT 1',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    voucher_usages: {
        id: null,
        voucher_id: 'INT UNSIGNED NULL',
        order_id: 'BIGINT UNSIGNED NULL',
        user_id: 'INT UNSIGNED NULL',
        customer_phone: "VARCHAR(20) NOT NULL DEFAULT ''",
        discount_amount: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    product_attachments: {
        id: null,
        product_id: 'INT UNSIGNED NULL',
        kind: `ENUM(${E('image', 'video', 'file')}) NOT NULL DEFAULT 'image'`,
        url: "VARCHAR(255) NOT NULL DEFAULT ''",
        original_name: "VARCHAR(255) NOT NULL DEFAULT ''",
        mime: "VARCHAR(100) NOT NULL DEFAULT ''",
        size: 'INT UNSIGNED NOT NULL DEFAULT 0',
        sort_order: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    tags: {
        id: null,
        name: 'VARCHAR(50) NOT NULL',
        slug: 'VARCHAR(60) NOT NULL',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
    product_tags: {
        product_id: 'INT UNSIGNED NOT NULL',
        tag_id: 'INT UNSIGNED NOT NULL',
    },
    product_reviews: {
        id: null,
        user_id: 'INT UNSIGNED NULL',
        product_id: 'INT UNSIGNED NULL',
        order_id: 'BIGINT UNSIGNED NULL',
        rating: 'TINYINT UNSIGNED NOT NULL DEFAULT 5',
        comment: 'VARCHAR(1000) NULL',
        status: 'TINYINT(1) NOT NULL DEFAULT 1',
        created_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
};

const q = (name) => '`' + String(name).replace(/`/g, '``') + '`';

// Trả về danh sách vấn đề, mỗi vấn đề có sẵn câu SQL sửa (nếu sửa tự động được).
async function inspectSchema(db) {
    const [[{ dbName }]] = await db.query('SELECT DATABASE() AS dbName');
    const [rows] = await db.query(
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS type,
                IS_NULLABLE AS nullable, COLUMN_DEFAULT AS def, EXTRA AS extra
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?`,
        [dbName]
    );

    const actual = {};
    for (const r of rows) {
        (actual[r.t.toLowerCase()] ||= {})[r.c.toLowerCase()] = r;
    }

    const issues = [];

    for (const [table, columns] of Object.entries(EXPECTED)) {
        const have = actual[table];

        if (!have) {
            issues.push({
                kind: 'missing_table',
                table,
                text: `Thiếu bảng "${table}"`,
                fix: null, // sửa bằng cách nhập database/schema.sql (an toàn, chỉ tạo bảng còn thiếu)
            });
            continue;
        }

        for (const [column, definition] of Object.entries(columns)) {
            const col = have[column];

            if (!col) {
                issues.push({
                    kind: 'missing_column',
                    table,
                    column,
                    text: `Bảng "${table}" thiếu cột "${column}"`,
                    fix: definition ? `ALTER TABLE ${q(table)} ADD COLUMN ${q(column)} ${definition}` : null,
                });
                continue;
            }

            // Cột ENUM thiếu giá trị mà code dùng (ví dụ thiếu 'preparing')
            if (definition && /^ENUM/i.test(definition) && /^enum/i.test(col.type)) {
                const need = [...definition.matchAll(/'([^']+)'/g)].map((m) => m[1]);
                const lower = col.type.toLowerCase();
                const missing = need.filter((v) => !lower.includes(`'${v.toLowerCase()}'`));

                if (missing.length) {
                    issues.push({
                        kind: 'enum_values',
                        table,
                        column,
                        text: `Cột "${table}.${column}" thiếu giá trị: ${missing.join(', ')}`,
                        fix: `ALTER TABLE ${q(table)} MODIFY COLUMN ${q(column)} ${definition}`,
                    });
                }
            }
        }

        // Cột thừa của bản cũ mà BẮT BUỘC nhập (NOT NULL, không có giá trị mặc định) sẽ làm INSERT bị lỗi
        for (const [column, col] of Object.entries(have)) {
            const known = Object.prototype.hasOwnProperty.call(columns, column);
            const isAuto = /auto_increment/i.test(col.extra || '');
            const generated = /generated/i.test(col.extra || '');

            if (!known && col.nullable === 'NO' && col.def === null && !isAuto && !generated) {
                issues.push({
                    kind: 'blocking_extra',
                    table,
                    column,
                    text: `Bảng "${table}" có cột cũ "${column}" bắt buộc nhập nhưng code không dùng (sẽ làm thêm dữ liệu bị lỗi)`,
                    fix: `ALTER TABLE ${q(table)} MODIFY COLUMN ${q(column)} ${col.type} NULL DEFAULT NULL`,
                });
            }
        }
    }

    return { database: dbName, issues };
}

module.exports = { EXPECTED, inspectSchema };
