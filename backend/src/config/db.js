const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "moc_coffee",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4"
});

async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();

        console.log("MySQL kết nối thành công");

        connection.release();
    } catch (error) {
        console.error(
            "MySQL kết nối thất bại:",
            error.message
        );
    }
}

module.exports = {
    pool,
    testDatabaseConnection
};