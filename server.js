const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ các file tĩnh giao diện HTML
app.use(express.static('.'));

// Đăng ký Route API cho Khôi
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});