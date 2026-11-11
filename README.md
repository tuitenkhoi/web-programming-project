# ☕ Mộc Coffee – Hệ thống đặt món & quản lý quán cà phê

Đồ án môn **Lập trình Web & Ứng dụng (503073)**. Khách xem menu theo nhãn/danh mục, gọi món, xem ảnh–video–tài liệu của món, thanh toán, đặt bàn, đánh giá, dùng voucher; quản trị viên đăng nhập trang admin để xử lý đơn, hóa đơn, bàn, đặt bàn, sản phẩm, danh mục, nhãn, voucher và theo dõi dashboard. Toàn bộ giao tiếp frontend ↔ backend đi qua **58 endpoint REST** (JSON), xác thực bằng **JWT + bcrypt**, token gửi qua header `Authorization` **hoặc** cookie `HttpOnly`.

## Thành viên & phân công (nhóm 2 người)

| Thành viên | Mã số SV | Phụ trách code | Phụ trách báo cáo (Chương) |
|---|---|---|---|
| **Khôi** (@tuitenkhoi) | 52400206 | Backend & Database — Auth JWT, tài khoản & phân quyền, Bàn / Đặt bàn / Dashboard, Nhãn & đính kèm | Chương 1–3: tổng quan, cơ sở lý thuyết REST, phân tích yêu cầu |
| **Đức** | 52400109 | Backend & Frontend — Sản phẩm, Đơn hàng, Hóa đơn, Voucher, Đánh giá, Kiểm thử & CI | Chương 4–6: thiết kế API, cài đặt, kiểm thử, kết luận + format báo cáo và README |

Mọi thắc mắc về lý thuyết, schema và phân quyền → hỏi Khôi; về sản phẩm, đơn hàng, kiểm thử và hoàn thiện báo cáo → hỏi Đức.

## Công nghệ

Node.js 18+ (Render chạy Node 22) · Express 5.2 · MySQL/MariaDB qua `mysql2` (pool dùng chung) · `jsonwebtoken` 9 + `bcryptjs` 3 · `multer` 2.5 (ảnh, video, PDF) · `nodemailer` 10.5 (mail kích hoạt & OTP) · `socket.io` 4.8 (realtime admin) · `helmet` 8 + `compression` + `cors` · Frontend HTML/CSS/JS thuần + Bootstrap 5.3, **không dùng framework SPA**.

## Cơ sở dữ liệu — 13 bảng

`database/schema.sql` tự tạo DB `moc_coffee` (có `CREATE DATABASE IF NOT EXISTS`, không cần tạo tay) với 13 bảng:

| Bảng | Vai trò |
|---|---|
| `users` | Khách và admin; có `avatar`, `theme`, `font_size`, `menu_view`, `email_verified_at`, `verification_token`, `reset_otp`, `reset_ticket` |
| `categories` | Danh mục món |
| `tags`, `product_tags` | Nhãn và quan hệ **nhiều–nhiều** giữa nhãn với món |
| `products` | Món; có `is_pinned`, `pinned_at` để ghim lên đầu |
| `product_attachments` | Đính kèm của món: `kind` = `image` / `video` / `file` |
| `orders`, `order_items` | Đơn hàng và chi tiết; `orders.user_id` liên kết tài khoản khi khách đã đăng nhập |
| `vouchers`, `voucher_usages` | Mã giảm giá và lượt sử dụng theo khách |
| `product_reviews` | Đánh giá món (chỉ sau đơn đã hoàn thành) |
| `coffee_tables`, `bookings` | Sơ đồ bàn và đặt bàn |

> Migration `001_bookings_to_standard.sql` còn tạo bảng phụ `bookings_old_backup` (bản sao để hoàn tác), nên DB sau khi migrate đủ có **14** bảng.

## Cài đặt và chạy

**1. Lấy mã nguồn và cài thư viện**
```bash
git clone https://github.com/tuitenkhoi/web-programming-project.git
cd web-programming-project
npm install
```

**2. Tạo cơ sở dữ liệu** — bật module **MySQL** trong XAMPP (không cần bật Apache, vì Node tự phục vụ trang tĩnh). Luôn nhập bằng `utf8mb4` để không lỗi tiếng Việt:
```bash
mysql --default-character-set=utf8mb4 -u root < database/schema.sql
```

**3. Chạy migrations theo đúng thứ tự** (DB vừa tạo xong vẫn cần chạy để có cột mới):
```bash
for f in database/migrations/001_*.sql database/migrations/002_*.sql database/migrations/003_*.sql database/migrations/004_*.sql database/migrations/005_*.sql; do mysql --default-character-set=utf8mb4 -u root moc_coffee < "$f"; done
```
> ⚠️ **Hai thông báo sau là bình thường, bỏ qua được** (migration lịch sử, không phải lỗi dự án):
> * `001_...sql`: `ERROR 1146 ... Table 'moc_coffee.tables' doesn't exist` — tham chiếu bảng của bản cũ, nay đã gộp vào `coffee_tables`.
> * `002_...sql`: `ERROR 1061 ... Duplicate key name 'idx_orders_table_open'` — index đã có sẵn trong `schema.sql`.
> Chạy lại migration lần 2 cũng có thể báo trùng khóa; cấu trúc cuối cùng vẫn đúng (kiểm chứng bằng `npm run check-db`).

**4. Tạo file cấu hình**
```bash
copy .env.example .env       # Windows   (Linux/macOS: cp .env.example .env)
```
Điền `JWT_SECRET` (chuỗi ngẫu nhiên **ít nhất 32 ký tự** — thiếu hoặc ngắn hơn thì server từ chối khởi động) và `APP_URL`. Sinh khóa nhanh:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**5. Tạo tài khoản admin**
```bash
npm run create-admin -- admin@moccoffee.local admin12345678 "Quản lý"
```

**6. Chạy**
```bash
npm start          # hoặc: npm run dev  (tự khởi động lại khi sửa code)
```
Mở http://localhost:5000 (khách) và http://localhost:5000/admin/login.html (quản lý). Cổng lấy từ `PORT`, **không hardcode** trong mã nguồn; mọi liên kết trong trang dùng đường dẫn tương đối.

## Biến môi trường (`.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `PORT` | không | Cổng chạy server (mặc định 5000) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | không | Kết nối MySQL; mặc định theo XAMPP (`127.0.0.1:3306`, `root`, mật khẩu trống, `moc_coffee`). Code vẫn đọc `DB_PASS` để tương thích file `.env` cũ |
| `JWT_SECRET` | **có** | Khóa ký token, ≥ 32 ký tự |
| `JWT_EXPIRES_IN` | không | Thời hạn đăng nhập (mặc định `8h`) |
| `APP_URL` | nên có | Địa chỉ gốc đầy đủ (`http://localhost:5000` khi dev) để **link kích hoạt trong email bấm được**. Bỏ trống thì link trong mail chỉ là đường dẫn tương đối |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `MAIL_FROM` | không | Gửi mail kích hoạt & OTP. **Bỏ trống `SMTP_HOST` thì server không gửi thật mà in nội dung mail (kèm link và mã OTP) ra console** với nhãn `[MAIL TRAP]` — vẫn test được trọn luồng |
| `CORS_ORIGIN` | không | Domain được gọi API, cách nhau bằng dấu phẩy. Bỏ trống = cho tất cả |
| `TRUST_PROXY` | không | Đặt `1` khi chạy sau Nginx/hosting để lấy đúng IP khách (cần cho giới hạn chống spam) |
| `DB_POOL_SIZE` | không | Số kết nối MySQL tối đa trong pool (mặc định 10) |
| `AUTH_CACHE_MS` | không | Thời gian nhớ kết quả kiểm tra tài khoản admin, `0` = tắt (mặc định 10000) |
| `AI_PROVIDER` `AI_API_KEY` `AI_MODEL` | chưa dùng | Chỗ trống cho tính năng AI ở giai đoạn sau |

## Tính năng

**Phía khách** — xem menu (lưới / danh sách, chuyển đổi được và lưu theo tài khoản), tìm kiếm live 300 ms trên cả tên lẫn mô tả, lọc theo danh mục và theo nhiều nhãn (kết hợp AND), xem chi tiết món với thư viện ảnh / video / tài liệu và đánh giá, giỏ hàng, voucher, đặt bàn, thanh toán + mã QR ngân hàng (sinh ngay trên trình duyệt, không gọi site ngoài), tra đơn bằng mã đơn + SĐT. Tài khoản: đăng ký (email + tên + mật khẩu ×2, SĐT tùy chọn), auto-login, kích hoạt email, đổi mật khẩu, quên mật khẩu bằng OTP 6 số, sửa hồ sơ + avatar, tùy chọn giao diện (sáng/tối/hệ thống, cỡ chữ), lịch sử đơn theo tài khoản. Trang thanh toán và hồ sơ yêu cầu đăng nhập; sau khi đăng nhập sẽ quay lại đúng trang đang dở.

**Phía admin** — dashboard số liệu động + biểu đồ doanh thu, đơn hàng (lọc, tìm, phân trang, đổi trạng thái, xác nhận thanh toán, in hóa đơn), bàn (sơ đồ và trạng thái), đặt bàn (duyệt / xếp khách / hoàn tất), sản phẩm (thêm/sửa **tự lưu**, ghim lên đầu, gán nhãn, đính kèm), danh mục, voucher, đánh giá. Thông báo đơn/booking/trạng thái bàn đẩy bằng Socket.IO; polling dự phòng 20 s (màn đặt bàn) và 60 s (badge thông báo header).

## Danh sách API — 58 endpoint

Ký hiệu: 🌐 công khai · 🔑 cần token **khách** · 🔒 cần token **admin** (`Authorization: Bearer <token>` hoặc cookie `mocToken`).

| Nhóm | Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| Hệ thống (2) | `GET /api/health` | 🌐 | Kiểm tra server và DB |
| | `GET /api/admin/me` | 🔒 | Thông tin admin đang đăng nhập |
| Xác thực (12) | `POST /api/auth/login` | 🌐 | Đăng nhập admin, trả token |
| | `POST /api/auth/logout` | 🔑 | Thu hồi token hiện hành (theo `jti`) |
| | `GET /api/auth/activate?token=` | 🌐 | Kích hoạt email |
| | `POST /api/auth/customer/register` | 🌐 | Đăng ký khách, auto-login + gửi mail kích hoạt |
| | `POST /api/auth/customer/login` | 🌐 | Đăng nhập khách |
| | `GET /api/auth/customer/me` | 🔑 | Hồ sơ + trạng thái xác minh email |
| | `PATCH /api/auth/customer/me` | 🔑 | Sửa tên/SĐT/avatar (`multipart`, ảnh ≤ 2 MB, JPG/PNG/WEBP) |
| | `POST /api/auth/customer/change-password` | 🔑 | Mật khẩu hiện tại + mật khẩu mới ×2, thu hồi mọi phiên cũ |
| | `PATCH /api/auth/customer/preferences` | 🔑 | `theme` (light/dark/system), `font_size` (14/16/18/20), `menu_view` |
| | `POST /api/auth/forgot-password` | 🌐 | Gửi OTP 6 số (10 phút); luôn trả success để không dò được email |
| | `POST /api/auth/verify-otp` | 🌐 | Xác nhận OTP, đổi `reset_ticket`; khóa sau 5 lần sai |
| | `POST /api/auth/reset-password` | 🌐 | Đặt mật khẩu mới bằng `reset_ticket`, buộc đăng nhập lại |
| Tài khoản khách (2) | `GET /api/customer/orders` | 🔑 | Lịch sử đơn theo tài khoản |
| | `POST /api/customer/orders/lookup` | 🌐 | Tra đơn bằng mã đơn và SĐT |
| Danh mục (6) | `GET /api/categories` · `GET /api/categories/:id` | 🌐 | Danh mục đang bán và chi tiết |
| | `GET /api/categories/admin` · `POST` · `PUT /:id` · `DELETE /:id` | 🔒 | Quản lý danh mục |
| Nhãn (4) | `GET /api/tags` | 🌐 | Danh sách nhãn kèm số món |
| | `POST /api/tags` · `PATCH /api/tags/:id` · `DELETE /api/tags/:id` | 🔒 | Thêm / đổi tên (tự phản chiếu lên mọi món) / xóa (không xóa món) |
| Sản phẩm (11) | `GET /api/products` · `GET /api/products/:id` | 🌐 | Menu: `?search=` `?category_id=` `?tags=1,2` (AND) `?sort=`; món ghim luôn dẫn đầu |
| | `GET /api/products/admin` · `POST` · `PUT /:id` · `PATCH /:id` · `DELETE /:id` | 🔒 | Quản lý món; `PATCH` cập nhật một phần (phục vụ tự lưu) |
| | `PUT /api/products/:id/pin` | 🔒 | Ghim / bỏ ghim (ghi `pinned_at`) |
| | `PUT /api/products/:id/tags` | 🔒 | Gán lại toàn bộ nhãn cho món (transaction) |
| | `GET /api/products/:id/attachments` · `POST /api/products/:id/attachments` | 🌐 / 🔒 | Đính kèm: tối đa 5 file/lần, 10 MB/file, JPG/PNG/WEBP + MP4/WebM + PDF |
| Đính kèm (1) | `DELETE /api/attachments/:id` | 🔒 | Xóa một đính kèm |
| Đơn hàng (5) | `POST /api/orders` | 🌐 | Khách gọi món (có token khách thì đơn được gắn vào tài khoản) |
| | `GET /api/orders` | 🔒 | Danh sách có lọc + phân trang (xem tham số dưới) |
| | `GET /api/orders/:id` · `PATCH /:id/status` · `PATCH /:id/payment` | 🔒 | Chi tiết, đổi trạng thái, xác nhận thanh toán |
| Voucher (7) | `GET /api/vouchers` · `POST /api/vouchers/validate` | 🌐 | Danh sách và kiểm tra voucher từ DB |
| | `GET /api/admin/vouchers` · `POST` · `PUT /:id` · `PATCH /:id/status` · `DELETE /:id` | 🔒 | Quản lý voucher |
| Đánh giá (2) | `GET /api/reviews/product/:productId` | 🌐 | Đánh giá đã duyệt của món |
| | `POST /api/reviews` | 🔑 | Khách đánh giá món đã mua |
| Bàn (2) | `GET /api/tables` | 🌐 | Danh sách bàn và trạng thái |
| | `PATCH /api/tables/:id/status` | 🔒 | Đổi trạng thái bàn |
| Đặt bàn (3) | `POST /api/bookings` | 🌐 | Khách đặt bàn |
| | `GET /api/bookings` · `PATCH /api/bookings/:id/status` | 🔒 | Danh sách, duyệt / hủy / xếp khách / hoàn tất |
| Tổng quan (1) | `GET /api/dashboard/stats` | 🔒 | Số liệu dashboard |

**Tham số của `GET /api/orders`:** `page`, `limit` (mặc định 20, tối đa 200), `sort` (`newest` `oldest` `amount_desc` `amount_asc`), `q` (tìm theo mã đơn / tên / SĐT / bàn / mã hóa đơn `HD0012`), `status` (một hoặc nhiều, cách nhau dấu phẩy), `awaiting_payment=1`, `payment_status`, `payment_method`, `order_type`, `invoice_status`, `date`, `date_from`, `date_to`. Kết quả gồm `total`, `total_pages` và `summary` (số liệu tính trên tất cả đơn).

**Quy tắc sắp xếp mặc định của menu:** `is_pinned DESC, COALESCE(pinned_at, updated_at) DESC, id DESC` — món ghim lên đầu, nhiều món ghim thì xếp theo thời gian ghim gần nhất.

## Kiểm tra nhanh

```bash
npm run verify          # kiểm tra mã nguồn + toàn bộ test
npm run test:coverage   # chạy test và in báo cáo coverage
```
Bộ kiểm thử tự động gồm **83 ca trong 6 file** (`tests/`), dùng Node test runner — **không cần MySQL**, kết nối CSDL được thay bằng bản giả. Cơ cấu: `smoke` (luồng lõi, trang tĩnh, header bảo mật), `security` (JWT sai / hết hạn / thiếu, token giả mạo role, JSON hỏng, 404 API), `customer-features` (đăng ký, đơn, voucher, đánh giá), `auth-guard` (chặn truy cập khi chưa đăng nhập), `password-reset` (OTP, đổi mật khẩu, thu hồi phiên), `products` (nhãn, đính kèm, ghim, tự lưu, badge, tìm kiếm). `npm run check` còn phát hiện lỗi cú pháp JavaScript, marker xung đột Git và `id` HTML trùng (quét toàn bộ file JS và HTML trong dự án).

Mỗi push/pull request vào `main` tự chạy các bước trên bằng GitHub Actions (`.github/workflows/ci.yml`). Kiểm tra CSDL thật có đúng cấu trúc bằng `npm run check-db`. Danh sách kiểm thử thủ công: `docs/KIEM_THU_THU_CONG.md`; kịch bản trình bày: `docs/CHECKLIST_DEMO.md`.

## Xử lý lỗi thường gặp

**Trang admin báo "Lỗi máy chủ" / "Lỗi truy vấn cơ sở dữ liệu" / "Không thể lấy danh sách đặt bàn"**
Thường do CSDL đang dùng là bản cũ, thiếu bảng hoặc cột so với `database/schema.sql`. Server cũng in cảnh báo này ngay khi khởi động:
```bash
npm run check-db                 # liệt kê bảng/cột còn thiếu
mysql --default-character-set=utf8mb4 -u root < database/schema.sql   # tạo bảng còn thiếu (không xóa dữ liệu)
npm run check-db -- --fix        # tự thêm các cột còn thiếu vào bảng cũ
npm run check-db                 # phải báo "OK"
```
**Server không khởi động, báo lỗi `JWT_SECRET`** — thiếu hoặc dưới 32 ký tự (xem mục Biến môi trường).
**Không nhận được email kích hoạt / OTP** — nếu bỏ trống `SMTP_HOST`, mã và link được in ra console với nhãn `[MAIL TRAP]`; khi triển khai thật phải cấu hình SMTP (app-password Gmail hoặc Mailtrap, cổng 587) và đặt `APP_URL` thì link trong mail mới bấm được.
**Sai mật khẩu MySQL / chưa bật MySQL** — server hiện thông báo riêng; kiểm tra `DB_PASSWORD`, `DB_PORT` trong `.env` và module MySQL trong XAMPP.

## Cấu trúc thư mục

```
server.js                 Khởi động Express, gắn middleware, mount route và thư mục tĩnh
config/db.js              Pool MySQL dùng chung
config/schemaCheck.js     Kiểm tra bảng/cột lúc khởi động (+ npm run check-db)
middleware/               auth.js (JWT, cookie, phân quyền), revoke.js (thu hồi token),
                          rateLimit.js (chống spam), dbError.js
services/mailer.js        Gửi mail kích hoạt & OTP (nodemailer, có chế độ [MAIL TRAP])
routes/                   auth, customer, bookings, tables, dashboard, reviews,
                          vouchers, admin-vouchers, tags
backend/src/              controllers + routes + upload middleware cho
                          sản phẩm, danh mục, đơn hàng, đính kèm
backend/uploads/          File do admin tải lên: products/, attachments/, avatars/ (không đưa lên git)
database/                 schema.sql + migrations/001…005
scripts/                  create-admin.js, check-db.js, check-project.js
tests/                    83 ca kiểm thử chức năng và bảo mật (Node test runner)
docs/                     Hướng dẫn triển khai, bảng kiểm thử thủ công, checklist demo
.github/workflows/        CI tự kiểm tra code, test và coverage
report/                   Báo cáo giữa kỳ 503073 – Restful Web Services (Word + template + đề bài)
index.html, pages/        Giao diện khách (9 trang)
admin/                    Giao diện quản lý (8 trang)
assets/                   CSS, JS, hình ảnh
```

## Realtime và triển khai

Socket.IO đẩy 5 sự kiện cho phòng admin: `order:created`, `order:updated`, `booking:created`, `booking:updated`, `table:updated`; polling dự phòng 20 s / 60 s vẫn được giữ. Cấu hình triển khai Render nằm trong `render.yaml`, hướng dẫn chi tiết tại `docs/DEPLOY_RENDER.md`.

## Lưu ý bảo mật khi triển khai

* Không commit `.env`; đặt `JWT_SECRET` dài và ngẫu nhiên (server từ chối chạy nếu dưới 32 ký tự).
* Xóa hoặc đổi mật khẩu mọi tài khoản mẫu/demo trong bảng `users` trước khi công khai.
* Chạy sau HTTPS và đặt `TRUST_PROXY=1` nếu có reverse proxy; khi production, cookie `mocToken` tự bật `Secure`.
* Trang tĩnh chỉ phục vụ `admin/`, `assets/`, `pages/` và `index.html`; `.env`, `server.js`, `config/`… không truy cập được (đã có ca kiểm thử bảo vệ).
* Upload kiểm tra **magic-byte** thật của file, không tin MIME do trình duyệt gửi; có giới hạn dung lượng và số file.
* Token đăng xuất bị thu hồi theo `jti`; đổi hoặc đặt lại mật khẩu thu hồi **mọi** phiên của tài khoản đó.

## Lộ trình hoàn thiện

**Đã xong:** toàn bộ nhóm *tài khoản* (đăng ký, đăng nhập/đăng xuất, kích hoạt email, OTP quên mật khẩu, hồ sơ + avatar, đổi mật khẩu, tùy chọn giao diện) và nhóm *quản lý nội dung* (lưới/danh sách, tìm kiếm live, nhãn nhiều–nhiều và lọc đa nhãn, ghim, badge trạng thái, đính kèm ảnh/video/file, tự lưu, hộp thoại xác nhận xóa).

**Còn lại, theo thứ tự ưu tiên:**
1. Mount thư mục `/uploads/avatars` trong `server.js` — file avatar đã được ghi và API đã trả đường dẫn `/uploads/avatars/...`, nhưng thư mục này chưa được phục vụ nên ảnh avatar chưa hiện lên được.
2. **Offline / PWA** — chưa có `manifest.webmanifest`, service worker, IndexedDB; tài nguyên Bootstrap/icon/font vẫn nạp từ CDN (64 tham chiếu) nên mất mạng là giao diện vỡ.
3. **Nhóm nâng cao** — khóa ghi chú bằng mật khẩu, chia sẻ và cộng tác realtime, AI Summary / AI Q&A (đã chừa chỗ `AI_*` trong `.env.example`).
4. **`docker-compose.yml`** làm phương án chạy tại chỗ cho giảng viên khi không truy cập được bản online.

## Hồ sơ nộp

* **Báo cáo giữa kỳ** (đã nộp 07/11/2026): `report/report.docx` dựng trên `report/Template_VN.dotx`, kèm `report/503073-Midterm.pdf` (đề bài + tiêu chí) và `report/BaoCao_GiuaKy_503073_RestfulWebServices.docx` (bản gốc để dựng lại). Sáu chương khớp bảng phân công ở đầu README. Khi mở bản chưa cập nhật field, trong Word nhấn **Ctrl + A rồi F9** để sinh lại mục lục và danh sách hình/bảng.
* **Đồ án cuối kỳ**: source code kèm README này (setup, `.env`, tạo admin, chạy test, danh sách API), `Rubric.xlsx` tự chấm theo 32 hạng mục, `demo.mp4` (tối thiểu 1080p, các thành viên cùng xuất hiện, demo lần lượt từng hạng mục — hạng mục không quay được tính là chưa làm), `Readme.txt` ghi URL công khai + tài khoản test, `Screenshot.png` chụp GitHub Insights, và folder nén tên dạng `id1_fullname1_id2_fullname2.zip`.
* Bản nộp phải là **`git clone`** (giữ thư mục `.git` và lịch sử commit), không dùng "Download ZIP". Trước khi nén: xóa `node_modules`, `.env`, `report/`, `backup_moc_coffee.sql` và các file upload thử nghiệm trong `backend/uploads/`.
