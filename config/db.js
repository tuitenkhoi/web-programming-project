const mysql = require('mysql2/promise');

// Bật SSL khi kết nối TiDB Cloud (hoặc khi đặt DB_SSL=true).
// Chạy XAMPP local (localhost) thì không bật.
const useSSL =
    process.env.DB_SSL === 'true' ||
    (process.env.DB_HOST || '').includes('tidbcloud.com');

// Kết nối Pool đến MySQL/TiDB - DÙNG CHUNG cho toàn bộ dự án
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'moc_coffee',
    charset: 'utf8mb4',
    ssl: useSSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 100,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    maxIdle: 10,
    idleTimeout: 60000
});

module.exports = pool;