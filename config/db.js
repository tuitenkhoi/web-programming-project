const mysql = require('mysql2/promise');

// Tạo kết nối Pool đến CSDL MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',      // Mặc định XAMPP là 'root'
    password: process.env.DB_PASSWORD || '',   // Mặc định XAMPP để trống
    database: process.env.DB_NAME || 'moc_coffee',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;