# Mộc Coffee – Hệ thống quản lý quán cà phê

Mộc Coffee là đồ án môn Lập trình Web, mô phỏng hệ thống quản lý và phục vụ tại quán cà phê. Hệ thống hỗ trợ khách hàng xem thực đơn, thêm món vào giỏ hàng, đặt bàn, gọi món và thanh toán. Phía quản trị hỗ trợ quản lý sản phẩm, đơn hàng, booking, bàn, doanh thu và hóa đơn.

## 1. Chức năng chính

### 1.1. Khách hàng

- Xem trang chủ và danh sách sản phẩm.
- Lọc, tìm kiếm sản phẩm theo danh mục.
- Xem chi tiết sản phẩm.
- Chọn kích thước, mức đường, mức đá và topping.
- Thêm sản phẩm vào giỏ hàng.
- Cập nhật số lượng hoặc xóa sản phẩm khỏi giỏ.
- Đặt món dùng tại bàn hoặc mang đi.
- Thanh toán bằng tiền mặt hoặc chuyển khoản.
- Xem thông báo và mã đơn hàng sau khi đặt thành công.
- Đặt bàn theo ngày, giờ và số lượng khách.

### 1.2. Quản trị viên

- Đăng nhập và đăng xuất tài khoản quản trị.
- Xem thống kê doanh thu, đơn hàng và booking.
- Quản lý danh mục và sản phẩm.
- Thêm, sửa, xóa và tìm kiếm sản phẩm.
- Tải lên hình ảnh sản phẩm.
- Tiếp nhận và cập nhật trạng thái đơn hàng.
- Xác nhận trạng thái thanh toán.
- Quản lý yêu cầu đặt bàn.
- Xem và cập nhật trạng thái bàn.
- Xem chi tiết và in hóa đơn.

## 2. Công nghệ sử dụng

### Frontend

- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Bootstrap Icons

### Backend

- PHP
- Node.js
- Express.js
- RESTful API

### Database

- MySQL hoặc MariaDB
- PDO
- mysql2

### Công cụ

- XAMPP
- Visual Studio Code
- Git
- GitHub
- phpMyAdmin
- Postman hoặc PowerShell để kiểm thử API

## 3. Cấu trúc thư mục

```text
web-programming-project/
├── actions/                    # Xử lý form PHP
│   ├── booking-create.php
│   ├── cart-add.php
│   ├── cart-clear.php
│   ├── cart-remove.php
│   ├── cart-update.php
│   └── order-create.php
├── admin/                      # Giao diện quản trị PHP và HTML
│   ├── partials/
│   ├── _bootstrap.php
│   ├── login.php
│   ├── logout.php
│   ├── dashboard.php
│   ├── products.php
│   ├── orders.php
│   ├── bookings.php
│   ├── tables.php
│   └── invoices.php
├── assets/
│   ├── css/
│   ├── images/
│   └── js/
├── backend/                    # REST API Node.js/Express
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── config/
│   └── database.php           # Kết nối PDO cho PHP
├── database/
│   ├── schema.sql             # Schema chính và dữ liệu mẫu
│   ├── php_booking.sql        # Bảng bàn và booking
│   └── week3_orders.sql       # Migration đơn hàng cũ
├── includes/
│   ├── functions.php
│   └── init.php
├── pages/                     # Giao diện khách hàng
│   ├── menu.php
│   ├── product-detail.php
│   ├── cart.php
│   ├── payment.php
│   ├── success.php
│   └── booking.php
├── index.php
└── README.md
```

## 4. Yêu cầu môi trường

Trước khi chạy dự án, máy tính cần cài đặt:

- Git
- XAMPP
- PHP 8.1 trở lên
- MySQL hoặc MariaDB
- Node.js 18 trở lên
- npm

Kiểm tra phiên bản:

```powershell
git --version
php -v
node -v
npm -v
```

Nếu PowerShell không nhận lệnh `php`, có thể dùng trực tiếp:

```powershell
& "C:\xampp\php\php.exe" -v
```

## 5. Tải mã nguồn

Với XAMPP mặc định, mở PowerShell và chạy:

```powershell
cd C:\xampp\htdocs
git clone https://github.com/tuitenkhoi/web-programming-project.git
cd web-programming-project
```

Nếu đã clone dự án trước đó:

```powershell
cd C:\xampp\htdocs\web-programming-project
git switch main
git pull --ff-only origin main
```

Nếu đã cấu hình Apache sử dụng thư mục khác, có thể đặt dự án tại thư mục tương ứng.

## 6. Khởi tạo cơ sở dữ liệu

### Cách 1: Sử dụng phpMyAdmin

1. Mở XAMPP Control Panel.
2. Khởi động Apache và MySQL.
3. Truy cập `http://localhost/phpmyadmin`.
4. Chọn tab **Import**.
5. Import file `database/schema.sql`.
6. Chọn database `moc_coffee`.
7. Import tiếp file `database/php_booking.sql`.

Không cần import `week3_orders.sql` nếu đã import `schema.sql`, vì `schema.sql` đã chứa bảng `orders` và `order_items`.

### Cách 2: Sử dụng PowerShell

Nếu dự án nằm trong `C:\xampp\htdocs\web-programming-project`, chạy:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" `
    --default-character-set=utf8mb4 `
    -u root `
    -e "SOURCE C:/xampp/htdocs/web-programming-project/database/schema.sql;"
```

Sau đó:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" `
    --default-character-set=utf8mb4 `
    -u root `
    -D moc_coffee `
    -e "SOURCE C:/xampp/htdocs/web-programming-project/database/php_booking.sql;"
```

Kiểm tra:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" `
    --default-character-set=utf8mb4 `
    -u root `
    -D moc_coffee `
    -e "SHOW TABLES;"
```

Các bảng chính:

```text
users
categories
products
orders
order_items
coffee_tables
bookings
```

## 7. Cấu hình PHP

Thông tin kết nối PHP nằm tại:

```text
config/database.php
```

Cấu hình mặc định:

```php
$host = '127.0.0.1';
$port = '3306';
$database = 'moc_coffee';
$username = 'root';
$password = '';
```

Nếu MySQL của máy có mật khẩu, thay giá trị `$password` cho phù hợp.

Không đưa mật khẩu thật lên GitHub.

## 8. Chạy giao diện PHP bằng XAMPP

Trong XAMPP Control Panel, khởi động:

- Apache
- MySQL

Trang khách hàng:

```text
http://localhost/web-programming-project/index.php
```

Trang đăng nhập quản trị:

```text
http://localhost/web-programming-project/admin/login.php
```

Nếu dự án không nằm trong `C:\xampp\htdocs`, cần cấu hình `DocumentRoot`, Virtual Host hoặc đặt lại dự án vào thư mục `htdocs`.

## 9. Cấu hình và chạy Node.js API

Di chuyển vào backend:

```powershell
cd C:\xampp\htdocs\web-programming-project\backend
```

Cài đặt thư viện:

```powershell
npm install
```

Tạo file môi trường từ file mẫu:

```powershell
Copy-Item .env.example .env
```

Nội dung cấu hình mẫu:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=moc_coffee
DB_USER=root
DB_PASSWORD=

JWT_SECRET=moc_coffee_secret_key
```

Trong môi trường thực tế, phải thay `JWT_SECRET` bằng chuỗi bí mật mạnh và không đưa file `.env` lên GitHub.

Chạy chế độ phát triển:

```powershell
npm run dev
```

Hoặc chạy thông thường:

```powershell
npm start
```

Kết quả mong đợi:

```text
Backend đang chạy tại http://localhost:3000
MySQL kết nối thành công
```

Kiểm tra API:

```text
http://localhost:3000/api/health
```

## 10. Một số API chính

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| GET | `/api/health` | Kiểm tra trạng thái backend |
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/categories` | Lấy danh sách danh mục |
| GET | `/api/products` | Lấy danh sách sản phẩm |
| POST | `/api/orders` | Tạo đơn hàng |
| POST | `/api/bookings` | Tạo yêu cầu đặt bàn |

Các API quản trị yêu cầu JWT có vai trò `admin`.

## 11. Tài khoản admin mẫu

```text
Email: admin@moccoffee.local
Mật khẩu: MocAdmin@123
```

Tài khoản mẫu được tạo bởi `database/schema.sql`.

Đây chỉ là tài khoản dành cho môi trường học tập và kiểm thử. Khi triển khai thực tế cần thay đổi mật khẩu.

Điều kiện đăng nhập admin:

```text
role = admin
status = 1
```

## 12. Quy trình đặt món

```text
Khách chọn món
→ Thêm vào giỏ hàng
→ Cập nhật số lượng
→ Nhập thông tin thanh toán
→ Tạo đơn hàng
→ Admin tiếp nhận
→ Admin cập nhật trạng thái
→ Xác nhận đã thanh toán
→ Hoàn thành đơn
→ Xuất và in hóa đơn
```

Trạng thái đơn hàng:

```text
pending
→ confirmed
→ preparing
→ ready
→ completed
```

Đơn hàng cũng có thể chuyển sang:

```text
cancelled
```

Trạng thái thanh toán:

```text
pending
pending_verification
paid
failed
refunded
```

## 13. Kiểm thử hệ thống

Hệ thống đã được kiểm thử các chức năng:

| Mã | Nội dung | Kết quả |
|---|---|---|
| TC-01 | Thêm sản phẩm vào giỏ hàng | PASS |
| TC-02 | Cập nhật số lượng | PASS |
| TC-03 | Xóa sản phẩm khỏi giỏ | PASS |
| TC-04 | Kiểm tra dữ liệu thanh toán | PASS |
| TC-05 | Tạo đơn hàng | PASS |
| TC-06 | Kiểm tra `orders` và `order_items` | PASS |
| TC-07 | Admin tiếp nhận và cập nhật đơn | PASS |
| TC-08 | Xuất và in hóa đơn | PASS |
| TC-09 | Chặn truy cập admin trái phép | PASS |
| TC-10 | Không tạo đơn khi giỏ trống | PASS |
| TC-11 | Chống tạo đơn trùng khi tải lại trang | PASS |
| TC-12 | Thanh toán chuyển khoản | PASS |
| TC-13 | Kiểm tra giao diện responsive | PASS |

Kết quả kiểm tra mã nguồn:

```text
PHP:        27/27 file hợp lệ
JavaScript: 24/24 file hợp lệ
Console:    Không có lỗi
```

## 14. Kiểm tra cú pháp PHP

Chạy tại thư mục gốc:

```powershell
$phpFiles = Get-ChildItem . `
    -Recurse `
    -File `
    -Filter *.php |
    Where-Object {
        $_.FullName -notmatch "\\node_modules\\|\\vendor\\"
    }

foreach ($file in $phpFiles) {
    & "C:\xampp\php\php.exe" -l $file.FullName
}
```

## 15. Kiểm tra cú pháp JavaScript

```powershell
$jsFiles = Get-ChildItem `
    .\assets\js, .\backend\src `
    -Recurse `
    -File `
    -Filter *.js

foreach ($file in $jsFiles) {
    node --check $file.FullName
}
```

## 16. Tối ưu đã thực hiện

- Xóa các conflict marker Git còn sót trong HTML, JavaScript và SQL.
- Kiểm tra cú pháp toàn bộ file PHP và JavaScript.
- Tối ưu truy vấn thống kê theo ngày.
- Tận dụng index `idx_orders_created_at`.
- Sử dụng prepared statement và PDO cho truy vấn PHP.
- Sử dụng transaction khi tạo đơn hàng và chi tiết đơn.
- Kiểm tra dữ liệu đầu vào phía server.
- Bảo vệ trang admin bằng session.
- Sử dụng CSRF token cho các thao tác quản trị.
- Mã hóa mật khẩu bằng bcrypt.
- Giới hạn và kiểm tra loại file ảnh tải lên.

## 17. Xử lý lỗi thường gặp

### Không mở được trang PHP

Kiểm tra Apache đã chạy và dự án nằm trong:

```text
C:\xampp\htdocs\web-programming-project
```

### Không kết nối được database

Kiểm tra:

- MySQL đã chạy.
- Database có tên `moc_coffee`.
- Thông tin trong `config/database.php`.
- Thông tin trong `backend/.env`.

### API không hoạt động

Mở Terminal tại `backend`:

```powershell
npm install
npm run dev
```

Sau đó kiểm tra:

```text
http://localhost:3000/api/health
```

### Trang báo 404

Kiểm tra URL và tên file. Trang PHP phải sử dụng đuôi `.php`, không phải `.html`.

### Tiếng Việt bị lỗi trong PowerShell

Chạy:

```powershell
chcp 65001
```

Và dùng:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

Khi đọc file UTF-8:

```powershell
Get-Content -Raw -Encoding utf8 .\README.md
```

## 18. Thành viên thực hiện

- Khôi: Backend, database, authentication, booking API.
- Đức: Sản phẩm, đơn hàng, hóa đơn, giao diện PHP, kiểm thử và tài liệu.

## 19. Repository

```text
https://github.com/tuitenkhoi/web-programming-project.git
```

## 20. Ghi chú bảo mật

Dự án được xây dựng cho mục đích học tập. Trước khi triển khai thực tế cần:

- Thay đổi tài khoản và mật khẩu admin mẫu.
- Thay đổi `JWT_SECRET`.
- Không đưa `.env` hoặc mật khẩu database lên GitHub.
- Tắt hiển thị lỗi chi tiết trên môi trường production.
- Cấu hình HTTPS.
- Sao lưu database định kỳ.