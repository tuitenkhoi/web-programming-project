document.addEventListener('DOMContentLoaded', function () {
    const bookingForm = document.querySelector('#bookingForm'); // Thay #bookingForm bằng ID Form của bạn

    if (bookingForm) {
        bookingForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Lấy dữ liệu từ Form
            const bookingData = {
                customer_name: document.querySelector('#customerName').value.trim(),
                phone: document.querySelector('#phone').value.trim(),
                booking_time: document.querySelector('#bookingTime').value,
                number_of_guests: document.querySelector('#numberOfGuests').value,
                table_id: document.querySelector('#tableSelect')?.value || null
            };

            try {
                // Gọi API gửi yêu cầu Đặt Bàn
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    bookingForm.reset(); // Xóa dữ liệu form sau khi gửi thành công
                } else {
                    alert(data.message || 'Đặt bàn thất bại!');
                }
            } catch (error) {
                console.error('Lỗi kết nối API:', error);
                alert('Không thể kết nối đến máy chủ!');
            }
        });
    }
});