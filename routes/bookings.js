const express = require('express');
const router = express.Router();
const db = require('../config/db'); //ket noi csdl

router.post('/', async(req, res) => {
    const { customer_name, phone, booking_time, number_of_guests, table_id } = req.body;

    //1. Validate du lieu dau vao
    if( !customer_name || !phone || !booking_time || !number_of_guests) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc!!!'});
    }

    // Kiem tra sdt(chi chua chu so)
    const phoneRegex = /^[0-9]{9,11}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ !'})
    }

    try {
        //2. Them don dat ban moi vao CSDL(Trang thai: pending)
        const sql = `
            INSERT INTO booking (customer_name, phone, booking_time, number_of_guests, table_id, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `;
        const [result] = await db.query(sql, [
            customer_name,
            phone,
            booking_time,
            number_of_guests,
            table_id || null
        ]);

        res.status(201).json({
            message: 'Gửi yêu cầu đặt bàn thành công! Chúng tôi sẽ liên hệ lại để xác nhận' ,
            bookingId: result.insertId
        });
    } catch (err) {
        console.error('Lỗi khi lưu booking:', err);
        res.status(500).json({ message: 'Lỗi máy chủ! Không thể đặt bàn. ', error: err.message });
    }
});

module.exports = router;