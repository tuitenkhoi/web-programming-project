# ☕ Mộc Coffee – Hệ thống đặt món & quản lý quán cà phê (có offline/PWA)

Đồ án môn **Lập trình Web & Ứng dụng (503073)**. Hệ thống phục vụ trọn một quán cà phê:

* **Khách** xem menu, tùy chỉnh món (size, đường, đá, topping), đặt món mang đi hoặc **quét mã QR trên bàn để tự gọi món**, thanh toán (có mã QR chuyển khoản), đặt bàn, đánh giá, dùng voucher, và **dùng được cả khi mất mạng** (PWA).
* **Nhân viên** (phục vụ / thu ngân / bếp) dùng trang `/staff` trên điện thoại: sơ đồ bàn, tạo & sửa đơn, màn hình bếp, hết món theo ngày, quản lý topping.
* **Quản trị viên** xử lý đơn, hóa đơn, bàn, đặt bàn, sản phẩm, danh mục, nhãn, topping, voucher, nhân viên và xem dashboard.

Frontend ↔ backend giao tiếp qua khoảng **80 endpoint REST** (JSON), xác thực **JWT + bcrypt** có thu hồi token, **216 ca kiểm thử tự động** (không cần MySQL).

## Thành viên & phân công (nhóm 2 người)

| Thành viên | Mã số SV | Phụ trách code | Phụ trách báo cáo (Chương) |
|---|---|---|---|
| **Khôi** (@tuitenkhoi) | 52400206 | Backend & Database — Auth JWT, tài khoản & phân quyền, trang nhân viên, Bàn / Đặt bàn / Dashboard, Nhãn & đính kèm | Chương 1–3: tổng quan, cơ sở lý thuyết REST, phân tích yêu cầu |
| **Đức** | 52400109 | Backend & Frontend — Sản phẩm, Đơn hàng, Hóa đơn, Voucher, Topping, Đánh giá, PWA/offline, Kiểm thử & CI | Chương 4–6: thiết kế API, cài đặt, kiểm thử, kết luận + format báo cáo và README |

Mọi thắc mắc về lý thuyết, schema và phân quyền → hỏi Khôi; về sản phẩm, đơn hàng, kiểm thử và hoàn thiện báo cáo → hỏi Đức.

## Công nghệ

Node.js 18+ (Render chạy Node 22) · Express 5 · MySQL/MariaDB/TiDB Cloud qua `mysql2` (pool dùng chung, tự bật SSL khi nối TiDB) · `jsonwebtoken` + `bcryptjs` · `multer` (ảnh, video, PDF) · `nodemailer` và **Brevo API** (mail OTP/kích hoạt) · `socket.io` (realtime) · `helmet` + `compression` + `cors` · **PWA bằng JS thuần, không build step** (`sw.js` + `manifest.webmanifest`) · Frontend HTML/CSS/JS thuần + Bootstrap 5.3, không dùng framework SPA.

## Cơ sở dữ liệu — 18 bảng

`database/schema.sql` tự tạo DB `moc_coffee` (có `CREATE DATABASE IF NOT EXISTS`, không cần tạo tay):

| Bảng | Vai trò |
|---|---|
| `users` | Khách, nhân viên và admin; có `role` (`customer`/`staff`/`admin`), `staff_position`, `theme` (mặc định `light`), `font_size`, `menu_view`, `avatar`, thông tin xác minh email và OTP |
| `categories` | Danh mục món |
| `tags`, `product_tags` | Nhãn và quan hệ **nhiều–nhiều** giữa nhãn với món |
| `products` | Món; có `is_pinned`, `pinned_at` để ghim lên đầu |
| `product_attachments` | Đính kèm của món: ảnh / video / file |
| `product_sold_out` | Món bị đánh dấu **hết theo ngày** (sang ngày mới tự bán lại) |
| `toppings` | Topping do admin/bếp quản lý (tên, giá, bật/tắt) |
| `topping_categories`, `topping_products` | **Phạm vi topping**: áp dụng theo danh mục, kèm ngoại lệ từng món (thêm món riêng / loại trừ món) |
| `orders`, `order_items` | Đơn hàng và chi tiết; `orders.source` cho biết đơn do khách hay nhân viên tạo |
| `vouchers`, `voucher_usages` | Mã giảm giá và lượt sử dụng theo khách |
| `product_reviews` | Đánh giá món (chỉ sau đơn đã hoàn thành) |
| `coffee_tables`, `bookings` | Sơ đồ bàn và đặt bàn |
| `staff_activity_logs` | Nhật ký thao tác của nhân viên |

> Migration `001_bookings_to_standard.sql` còn tạo bảng phụ `bookings_old_backup` (bản sao để hoàn tác), nên DB sau khi migrate đủ có thêm bảng này.

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

**3. Chạy migrations theo đúng thứ tự** (DB vừa tạo xong vẫn cần chạy để có cột/bảng mới):
```bash
for f in database/migrations/0*.sql; do mysql --default-character-set=utf8mb4 -u root moc_coffee < "$f"; done
```
Windows (PowerShell), chạy từng file:
```powershell
cmd /c "mysql --default-character-set=utf8mb4 -u root moc_coffee < database\migrations\010_topping_scopes.sql"
```

| Migration | Nội dung |
|---|---|
| `001`–`002` | Chuẩn hóa bảng đặt bàn, thêm index |
| `003`–`004` | Tài khoản khách, voucher, đánh giá, bổ sung cột người dùng |
| `005`–`006` | Ghim món, đính kèm, nhãn, kiểu hiển thị menu; giao diện mặc định `light` |
| `007_staff_accounts` | Role `staff`, `users.staff_position`, `orders.source`, `staff_activity_logs` |
| `008_toppings` | Bảng topping + 12 topping mẫu |
| `009_product_sold_out` | Hết món theo ngày |
| `010_topping_scopes` | Phạm vi topping theo danh mục / từng món |

> ⚠️ **Hai thông báo sau là bình thường, bỏ qua được** (migration lịch sử, không phải lỗi dự án):
> * `001_...sql`: `ERROR 1146 ... Table 'moc_coffee.tables' doesn't exist` — tham chiếu bảng của bản cũ, nay đã gộp vào `coffee_tables`.
> * `002_...sql`: `ERROR 1061 ... Duplicate key name 'idx_orders_table_open'` — index đã có sẵn trong `schema.sql`.
>
> Cấu trúc cuối cùng vẫn đúng, kiểm chứng bằng `npm run check-db`. Các migration `008`–`010` chạy lại nhiều lần vẫn an toàn. **Chưa chạy migration mới thì web vẫn hoạt động** (topping không có phạm vi nghĩa là áp dụng cho mọi món), nhưng các tính năng mới tương ứng sẽ chưa dùng được: lưu phạm vi topping (010), đánh dấu hết món (009), topping (008), tài khoản nhân viên (007).

Dùng **TiDB Cloud**: dán nội dung từng file migration vào SQL Editor, nhớ đổi dòng `USE moc_coffee;` cho đúng tên database.

**4. (Tùy chọn) `database/optional/theme_system_to_light.sql`** — chỉ đổi các tài khoản **cũ** đang để giao diện "Theo thiết bị" về "Sáng". Không tự chạy; bỏ qua cũng không sao vì tài khoản mới đã mặc định `light`.

**5. Tạo file cấu hình**
```bash
copy .env.example .env       # Windows   (Linux/macOS: cp .env.example .env)
```
Điền `JWT_SECRET` (chuỗi ngẫu nhiên **ít nhất 32 ký tự** — thiếu hoặc ngắn hơn thì server từ chối khởi động) và `APP_URL`. Sinh khóa nhanh:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**6. Tạo tài khoản admin**
```bash
npm run create-admin -- admin@moccoffee.local admin12345678 "Quản lý"
```

**7. Chạy**
```bash
npm start          # hoặc: npm run dev  (tự khởi động lại khi sửa code)
```
Mở http://localhost:5000 (khách), http://localhost:5000/admin/login.html (quản lý) và http://localhost:5000/staff/index.html (nhân viên). Cổng lấy từ `PORT`, không hardcode; mọi liên kết trong trang dùng đường dẫn tương đối.

## Biến môi trường (`.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `PORT` | không | Cổng chạy server (mặc định 5000) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | không | Kết nối MySQL; mặc định theo XAMPP (`127.0.0.1:3306`, `root`, mật khẩu trống, `moc_coffee`) |
| `DB_SSL` | không | Đặt `true` để bật SSL (TiDB Cloud được bật tự động) |
| `JWT_SECRET` | **có** | Khóa ký token, ≥ 32 ký tự |
| `JWT_EXPIRES_IN` | không | Thời hạn đăng nhập (mặc định `8h`) |
| `APP_URL` | nên có | Địa chỉ gốc đầy đủ (`http://localhost:5000` khi dev) để **link trong email bấm được** |
| `BREVO_API_KEY` | không | **Cách gửi mail nên dùng khi triển khai**: gửi qua API HTTPS của Brevo. Có biến này thì bỏ qua SMTP |
| `MAIL_FROM` | khi gửi mail | Người gửi, dạng `Mộc Coffee <email@domain>` (không để dấu nháy bao quanh). Với Brevo, email này phải là **Sender đã xác minh** |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | không | Gửi mail bằng SMTP (chạy máy cá nhân). Xem lưu ý Render bên dưới |
| `CORS_ORIGIN` | không | Domain được gọi API, cách nhau bằng dấu phẩy. Bỏ trống = cho tất cả |
| `TRUST_PROXY` | không | Đặt `1` khi chạy sau Nginx/hosting để lấy đúng IP khách (cho giới hạn chống spam) |
| `DB_POOL_SIZE` | không | Số kết nối MySQL tối đa trong pool (mặc định 10) |
| `AUTH_CACHE_MS` | không | Thời gian nhớ kết quả kiểm tra tài khoản, `0` = tắt (mặc định 10000) |
| `AI_PROVIDER` `AI_API_KEY` `AI_MODEL` | chưa dùng | Chỗ trống cho tính năng AI ở giai đoạn sau |

**Thứ tự gửi mail:** có `BREVO_API_KEY` → gửi qua Brevo; không có nhưng có `SMTP_HOST` → gửi qua SMTP; không có cả hai → **không gửi thật**, server in nội dung mail (kèm mã OTP, link kích hoạt) ra console với nhãn `[MAIL TRAP]` để vẫn test được trọn luồng.

### Cấu hình gửi mail trên Render

Render gói **miễn phí chặn cổng SMTP** (25/465/587), nên gửi qua Gmail sẽ báo `ETIMEDOUT`. Cách làm:

1. Đăng ký [brevo.com](https://www.brevo.com) (miễn phí, 300 mail/ngày) và xác minh số điện thoại khi được yêu cầu.
2. **Settings → Senders, domains, IPs → Senders → Add a sender**: nhập tên và email Gmail, bấm link xác nhận trong hộp thư.
3. **Settings → SMTP & API → API keys → Generate a new API key**, sao chép khóa (`xkeysib-...`).
4. Trên Render → **Environment** thêm: `BREVO_API_KEY`, `MAIL_FROM` (đúng tên + email của Sender), `APP_URL` (`https://<tên-app>.onrender.com`). Lưu và chờ deploy lại.
5. Thử "Quên mật khẩu"; nếu không có mail, xem Render → Logs dòng `Không gửi được email`: `401` sai khóa API, `400` email gửi chưa xác minh.

Dùng địa chỉ Gmail làm người gửi nên thư dễ rơi vào mục **Spam**; muốn khắc phục triệt để cần tên miền riêng có DKIM/DMARC.

## Tính năng

### Phía khách

* **Thực đơn:** dạng lưới hoặc danh sách (lưu theo tài khoản qua `menu_view`), tìm kiếm live 300 ms trên tên lẫn mô tả (không phân biệt dấu, tô sáng từ khóa), lọc theo danh mục và nhiều nhãn (AND), chi tiết món với ảnh / video / tài liệu và đánh giá. Món nhân viên đánh dấu hết hôm nay hiện "Hết hôm nay" và không đặt được.
* **Thẻ tùy chỉnh món:** bấm "thêm vào giỏ" (ở trang chủ và thực đơn) sẽ mở thẻ chọn **size S/M/L, mức đường, mức đá, topping, số lượng, ghi chú** với giá cập nhật tức thì. Trên điện thoại thẻ trượt từ đáy lên. Món bánh ngọt không có size/đường/đá. Topping chỉ hiện nếu áp dụng cho món đó (xem *Phạm vi topping*).
* **Đặt tại bàn bằng QR:** mỗi bàn có mã QR dẫn tới `pages/menu.html?table=<mã bàn>`. Quét xong, trang chuyển sang **chế độ tại bàn** cho điện thoại: header gọn (tên bàn, đăng nhập tùy chọn, giỏ), tìm kiếm và danh mục dính trên đầu, danh sách món gọn nhìn được nhiều món, nút "+" lớn, **giỏ ghim ở đáy** mở ra bảng chỉnh số lượng rồi sang bước thanh toán. Bàn được ghi nhớ 6 giờ. **Không bắt buộc đăng nhập**; đăng nhập thì đơn được lưu vào lịch sử tài khoản.
* **Giỏ hàng & thanh toán:** sửa size/topping ngay trong giỏ, voucher, phí phục vụ khi dùng tại bàn, thanh toán + mã QR ngân hàng (sinh ngay trên trình duyệt, không gọi site ngoài), tra đơn bằng mã đơn + SĐT.
* **Tài khoản:** đăng ký, kích hoạt email (vẫn dùng được mọi tính năng trước khi kích hoạt), đổi mật khẩu, quên mật khẩu bằng OTP 6 số, sửa hồ sơ + avatar, lịch sử đơn.
* **Giao diện Sáng / Tối:** mặc định **Sáng**. Khách chọn Tối (hoặc "Theo thiết bị") ở *Tài khoản → Tùy chọn của tôi*; lựa chọn áp ngay không nháy trang và lưu cả khi chưa đăng nhập (`localStorage`), đồng bộ lên server khi đã đăng nhập. Phần màu tối nằm ở `assets/css/dark.css` (nạp sau cùng ở các trang khách), kèm cỡ chữ 14–20 px.

### Phía admin

Dashboard số liệu động + biểu đồ doanh thu; đơn hàng (lọc, tìm, phân trang, đổi trạng thái, xác nhận thanh toán, in hóa đơn, **xuất Excel / CSV / PDF**); bàn (sơ đồ, **thêm bàn mới**, trạng thái, **in mã QR cho từng bàn**, bấm bàn có khách để xem đơn của bàn); đặt bàn; sản phẩm (tự lưu, ghim, nhãn, đính kèm); danh mục; **topping và phạm vi áp dụng**; voucher; đánh giá; **nhân viên và nhật ký thao tác**. Thông báo đơn/đặt bàn/trạng thái bàn đẩy bằng Socket.IO; polling dự phòng 20 s và 60 s.

### Phạm vi topping

Mỗi topping có thể gắn với **danh mục** (ví dụ "Thêm 1 shot cà phê" chỉ cho nhóm Cà phê) và có **ngoại lệ từng món**: thêm một món riêng ngoài danh mục, hoặc loại trừ một món khỏi danh mục. Quy tắc (`toppingAppliesTo`, lặp lại ở `assets/js/cart-options.js` — hai nơi phải giữ giống nhau):

```
áp dụng = không bị loại trừ
          VÀ ( chưa đặt phạm vi nào  HOẶC  món nằm trong "thêm món riêng"  HOẶC  danh mục của món được chọn )
```
Topping chưa đặt phạm vi nào thì áp dụng cho **mọi món**. Máy chủ kiểm tra lại khi nhận đơn (khách và nhân viên) và từ chối topping không hợp với món. Cấu hình ở `admin/products.html` → **Quản lý topping** (nút biểu tượng sơ đồ trên từng topping), có thanh tìm kiếm và lọc theo "Dùng cho: danh mục".

## Trang nhân viên (`/staff`)

Admin tạo tài khoản nhân viên tại `admin/staff.html` (email dạng `tennhanvien@moccoffee.local`, mật khẩu tạm do admin đặt). Nhân viên đăng nhập ở trang đăng nhập chung và được chuyển tới `/staff/index.html`. Giao diện thiết kế cho điện thoại (giỏ hàng trượt từ đáy, nút lớn).

| Chức năng | Phục vụ | Thu ngân | Bếp | Admin |
|---|---|---|---|---|
| Xem sơ đồ bàn; bấm bàn có khách để xem đơn của bàn | ✔ | ✔ | ✔ | ✔ |
| Nhận khách (bàn trống → có khách) rồi gọi món tại bàn đó | ✔ | | | ✔ |
| Đặt bàn sang / ra khỏi bảo trì | ✔ | ✔ | | ✔ |
| Xác nhận đơn và xuất hóa đơn trên sơ đồ bàn | | ✔ | | ✔ |
| Chuyển / gộp / tách bàn | ✔ | ✔ | | ✔ |
| Đánh dấu món hết trong ngày | ✔ | ✔ | ✔ | ✔ |
| Nhận thông báo "món sẵn sàng" khi bếp bấm Xong món | ✔ | | | ✔ |
| Xem đặt bàn | ✔ | ✔ | | ✔ |
| Duyệt / xếp khách / hủy đặt bàn | ✔ | | | ✔ |
| Xem đơn hàng | ✔ | ✔ | ✔ | ✔ |
| Tạo đơn mang đi (phục vụ chỉ tạo được đơn mang đi hoặc đơn tại bàn đã nhận khách) | ✔ | ✔ | | ✔ |
| Sửa đơn | ✔ | ✔ | | ✔ |
| Xác nhận thanh toán | | ✔ | | ✔ |
| Hủy đơn | | ✔ | | ✔ |
| Xem doanh thu | | ✔ | | ✔ |
| Màn hình bếp (đổi sang đang làm / xong) | | | ✔ | ✔ |
| **Quản lý topping: thêm, sửa, bật/tắt, chọn món áp dụng** | | | ✔ | ✔ |
| **Xóa topping** | | | | ✔ |
| Xuất hóa đơn Excel / CSV / PDF | | | | ✔ |

Bảng quyền nằm trong `middleware/permissions.js` (sửa ở đó nếu muốn đổi). Mọi thao tác quan trọng được ghi vào `staff_activity_logs` (admin xem ở "Nhật ký thao tác"). Khóa tài khoản có hiệu lực ngay và đăng xuất mọi thiết bị.

| Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|
| `GET/POST /api/admin/staff` · `PATCH /:id` · `PATCH /:id/status` · `POST /:id/reset-password` · `GET /logs` | 🔒 admin | Quản lý nhân viên và nhật ký |
| `GET /api/staff/me` · `POST /api/staff/change-password` | nhân viên | Thông tin, quyền, tự đổi mật khẩu |
| `GET /api/staff/order-options` | nhân viên | Menu, topping (kèm phạm vi), bàn cho màn hình tạo đơn |
| `POST /api/staff/orders` · `PUT /api/staff/orders/:id` | theo vị trí | Tạo / sửa đơn (giá do server tính, kiểm tra topping theo món) |
| `GET /api/staff/kitchen` | theo vị trí | Đơn cho màn hình bếp |
| `POST /api/staff/tables/move` | theo vị trí | Chuyển / gộp / tách bàn |
| `PUT /api/staff/products/:id/sold-out` | theo vị trí | Đánh dấu hết / bán lại món trong hôm nay |

## Offline / PWA

`sw.js` (nằm ở gốc dự án để scope là `/`) + `manifest.webmanifest` + `assets/js/pwa.js`, **không dùng thư viện build nào**:

| Loại tài nguyên | Chiến lược |
|---|---|
| Trang HTML (`/`, `pages/*`, `admin/*`) | network-first, fallback bản cache; mất mạng vẫn mở được trang đã xem |
| `GET /api/products`, `/api/tags`, `/api/categories`, `/api/reviews`, `/api/tables` | network-first + cache, nên menu và nhãn còn hiển thị khi offline |
| `assets/*` (CSS/JS/local image) | cache-first, precache khi cài đặt service worker |
| CDN (Bootstrap, bootstrap-icons, Google Fonts) | cache-first + precache |
| `/uploads/**` (ảnh, video, PDF, avatar) | cache-first |
| POST/PUT/PATCH/DELETE | không cache, đi thẳng mạng |

`server.js` chỉ phục vụ đúng **2 file** `sw.js` và `manifest.webmanifest` theo danh sách cố định, kèm `Cache-Control: no-cache` để bản service worker mới được nhận ngay; `.env`, `server.js`, `config/`… vẫn bị chặn (có ca kiểm thử).

**Giới hạn hiện tại:** chưa có hàng đợi **IndexedDB** để gom đơn tạo lúc offline rồi đồng bộ — offline đang ở mức "xem và duyệt nội dung đã cache".

**Sau khi cập nhật giao diện**, trình duyệt có thể còn giữ bản cũ: nhấn **Ctrl + Shift + R**, hoặc DevTools → Application → Service Workers → *Unregister* + *Clear storage*.

**Cách test offline:** mở trang → DevTools → Network → bật *Offline* → tải lại → nội dung đã xem vẫn hiển thị, badge "Đang ngoại tuyến" xuất hiện.

## Danh sách API

Ký hiệu: 🌐 công khai · 🔑 cần token **khách** · 🔒 cần token **admin** · 👷 nhân viên (theo vị trí). Gửi `Authorization: Bearer <token>`.

| Nhóm | Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| Hệ thống | `GET /api/health` | 🌐 | Kiểm tra server và DB |
| | `GET /api/admin/me` | 🔒 | Thông tin admin đang đăng nhập |
| Xác thực | `POST /api/auth/login` | 🌐 | Đăng nhập admin / nhân viên, trả token |
| | `POST /api/auth/logout` | 🔑 | Thu hồi token hiện hành (theo `jti`) |
| | `GET /api/auth/activate?token=` | 🌐 | Kích hoạt email |
| | `POST /api/auth/customer/register` · `login` | 🌐 | Đăng ký (auto-login, gửi mail kích hoạt) / đăng nhập khách |
| | `GET/PATCH /api/auth/customer/me` | 🔑 | Hồ sơ; sửa tên/SĐT/avatar (`multipart`, ảnh ≤ 2 MB) |
| | `POST /api/auth/customer/change-password` | 🔑 | Đổi mật khẩu, thu hồi mọi phiên cũ |
| | `PATCH /api/auth/customer/preferences` | 🔑 | `theme` (light/dark/system), `font_size` (14/16/18/20), `menu_view` |
| | `POST /api/auth/forgot-password` | 🌐 | Gửi OTP 6 số (10 phút); luôn trả success để không dò được email |
| | `POST /api/auth/verify-otp` | 🌐 | Xác nhận OTP, đổi lấy `reset_ticket`; 5 lần sai thì khóa |
| | `POST /api/auth/reset-password` | 🌐 | Đặt mật khẩu mới bằng `reset_ticket` |
| Tài khoản khách | `GET /api/customer/orders` | 🔑 | Lịch sử đơn theo tài khoản |
| | `POST /api/customer/orders/lookup` | 🌐 | Tra đơn bằng mã đơn và SĐT |
| Danh mục | `GET /api/categories` · `/:id` | 🌐 | Danh mục đang bán |
| | `GET /api/categories/admin` · `POST` · `PUT /:id` · `DELETE /:id` | 🔒 | Quản lý danh mục |
| Nhãn | `GET /api/tags` | 🌐 | Nhãn kèm số món |
| | `POST` · `PATCH /:id` · `DELETE /:id` `/api/tags` | 🔒 | Thêm / đổi tên / xóa |
| Sản phẩm | `GET /api/products` · `/:id` | 🌐 | Menu: `?search=` `?category_id=` `?tags=1,2` `?sort=`; món ghim dẫn đầu; có cờ `sold_out` |
| | `GET /api/products/admin` · `POST` · `PUT /:id` · `PATCH /:id` · `DELETE /:id` | 🔒 | Quản lý món (`PATCH` phục vụ tự lưu) |
| | `PUT /api/products/:id/pin` · `PUT /api/products/:id/tags` | 🔒 | Ghim / gán nhãn |
| | `GET/POST /api/products/:id/attachments` · `DELETE /api/attachments/:id` | 🌐 / 🔒 | Đính kèm: ≤ 5 file/lần, 10 MB/file, JPG/PNG/WEBP + MP4/WebM + PDF |
| **Topping** | `GET /api/toppings` | 🌐 | Topping đang bật, kèm `scope` `{categories, include, exclude}` nếu có phạm vi |
| | `GET /api/toppings/admin` · `POST` · `PATCH /:id` · `PUT /:id/scope` | 🔒 / 👷 bếp | Xem toàn bộ, thêm, sửa, bật/tắt, **đặt phạm vi** (quyền `toppings.manage`) |
| | `DELETE /api/toppings/:id` | 🔒 | Xóa topping (chỉ admin) |
| Đơn hàng | `POST /api/orders` | 🌐 | Khách gọi món (có token khách thì gắn vào tài khoản); máy chủ tính lại giá, kiểm tra topping hợp món |
| | `GET /api/orders` · `/:id` · `PATCH /:id/status` · `PATCH /:id/payment` | 🔒 / 👷 | Danh sách có lọc + phân trang, chi tiết, đổi trạng thái, xác nhận thanh toán |
| | `GET /api/orders/export?format=xlsx\|csv\|json` | 🔒 | Xuất hóa đơn |
| Voucher | `GET /api/vouchers` · `POST /api/vouchers/validate` | 🌐 | Danh sách và kiểm tra voucher |
| | `GET/POST/PUT/PATCH/DELETE /api/admin/vouchers` | 🔒 | Quản lý voucher |
| Đánh giá | `GET /api/reviews/product/:productId` · `POST /api/reviews` | 🌐 / 🔑 | Xem / đánh giá món đã mua |
| Bàn | `GET /api/tables` | 🌐 | Danh sách bàn và trạng thái |
| | `POST /api/tables` · `PATCH /api/tables/:id/status` | 🔒 / 👷 | Thêm bàn mới (admin); đổi trạng thái bàn |
| Đặt bàn | `POST /api/bookings` · `GET /api/bookings` · `PATCH /:id/status` | 🌐 / 🔒 / 👷 | Khách đặt bàn; duyệt / hủy / xếp khách / hoàn tất |
| Tổng quan | `GET /api/dashboard/stats` | 🔒 / 👷 thu ngân | Số liệu dashboard và doanh thu |
| Nhân viên | `/api/admin/staff/*`, `/api/staff/*` | xem mục *Trang nhân viên* | |

**Tham số của `GET /api/orders`:** `page`, `limit` (mặc định 20, tối đa 200), `sort` (`newest` `oldest` `amount_desc` `amount_asc`), `q` (mã đơn / tên / SĐT / bàn / mã hóa đơn), `status`, `awaiting_payment=1`, `payment_status`, `payment_method`, `order_type`, `invoice_status`, `date`, `date_from`, `date_to`.

## Kiểm tra nhanh

```bash
npm run verify          # kiểm tra mã nguồn + toàn bộ test
npm run test:coverage   # chạy test và in báo cáo coverage
```
Bộ kiểm thử gồm **216 ca trong 16 file** (`tests/`), dùng Node test runner — **không cần MySQL**, kết nối CSDL được thay bằng bản giả:

| File | Số ca | Nội dung |
|---|---|---|
| `staff.test.js` | 38 | đăng nhập nhân viên, phân quyền theo vị trí, tạo/sửa đơn, bàn, hết món |
| `products.test.js` | 28 | nhãn, đính kèm, ghim, tự lưu, badge, tìm kiếm, phân quyền sản phẩm |
| `customer-features.test.js` | 24 | đăng ký/đăng nhập khách, đơn, voucher, đánh giá |
| `toppings-export.test.js` | 19 | API topping, xuất hóa đơn Excel/CSV |
| `smoke.test.js` | 18 | luồng lõi, trang tĩnh, header bảo mật |
| `cart-options.test.js` | 16 | tính giá theo size/topping, hòa giải giỏ hàng |
| `pwa.test.js` / `pwa-runtime.test.js` / `pwa-server.test.js` | 15 / 11 / 3 | manifest, precache, hành vi offline |
| `auth-guard.test.js` | 14 | chặn truy cập trang khi chưa đăng nhập |
| `export-files.test.js` | 9 | sinh file Excel/CSV |
| `topping-scopes.test.js` | 6 | quy tắc phạm vi topping (server = trình duyệt), quyền bếp, file giao diện |
| `security.test.js` | 5 | JWT sai/hết hạn, token giả role, JSON hỏng |
| `password-reset.test.js` · `schema-check.test.js` | 4 · 4 | OTP; kiểm tra cấu trúc DB |
| `mailer.test.js` | 2 | gửi mail qua Brevo, đọc `MAIL_FROM` |

`npm run check` quét 200 file JS/HTML, phát hiện lỗi cú pháp, marker xung đột Git và `id` HTML trùng. Mỗi push/pull request vào `main` tự chạy `npm ci` → `check` → `test` → coverage bằng GitHub Actions (`.github/workflows/ci.yml`). Kiểm tra CSDL thật bằng `npm run check-db`. Tài liệu: `docs/KIEM_THU_THU_CONG.md` (kiểm thử thủ công), `docs/CHECKLIST_DEMO.md` (kịch bản trình bày), `docs/DEPLOY_RENDER.md` (triển khai).

## Xử lý lỗi thường gặp

**Trang báo "Lỗi máy chủ" / "Lỗi truy vấn cơ sở dữ liệu"** — thường do CSDL thiếu bảng hoặc cột so với `database/schema.sql` (server cũng in cảnh báo này khi khởi động):
```bash
npm run check-db                 # liệt kê bảng/cột còn thiếu
mysql --default-character-set=utf8mb4 -u root < database/schema.sql   # tạo bảng còn thiếu (không xóa dữ liệu)
npm run check-db -- --fix        # tự thêm các cột còn thiếu vào bảng cũ
```
**Server không khởi động, báo lỗi `JWT_SECRET`** — thiếu hoặc dưới 32 ký tự.
**Không nhận được email kích hoạt / OTP** — xem mục *Cấu hình gửi mail trên Render*. Trên Render, log `Không gửi được email: ETIMEDOUT` nghĩa là cổng SMTP bị chặn → dùng Brevo. Nếu log có `[MAIL TRAP]` nghĩa là chưa đặt `BREVO_API_KEY` hoặc `SMTP_HOST`.
**Lưu phạm vi topping báo lỗi** — chưa chạy migration `010_topping_scopes.sql`.
**Không thêm được tài khoản nhân viên / lỗi vai trò** — chưa chạy `007_staff_accounts.sql`.
**Giao diện không đổi sang Tối** — nhấn Ctrl + Shift + R để bỏ cache; kiểm tra trang có nạp `assets/js/prefs.js` (đặt trong `<head>`) và `assets/css/dark.css`.
**Sai mật khẩu MySQL / chưa bật MySQL** — kiểm tra `DB_PASSWORD`, `DB_PORT` trong `.env` và module MySQL trong XAMPP.

## Cấu trúc thư mục

```
server.js                 Khởi động Express, gắn middleware, mount route, trang tĩnh, sw.js + manifest
realtime.js               Socket.IO (phòng admin)
config/db.js              Pool MySQL dùng chung (tự bật SSL cho TiDB)
config/schemaCheck.js     Kiểm tra bảng/cột lúc khởi động (+ npm run check-db)
middleware/               auth.js (JWT, phân quyền), permissions.js (quyền theo vị trí nhân viên),
                          revoke.js (thu hồi token), rateLimit.js, dbError.js
services/                 mailer.js (Brevo / SMTP / [MAIL TRAP]), audit.js (nhật ký), csv.js, xlsx.js
routes/                   auth, customer, bookings, tables, dashboard, reviews, vouchers,
                          admin-vouchers, tags, toppings, staff, admin-staff
backend/src/              controllers + routes + upload middleware cho sản phẩm, danh mục, đơn hàng,
                          đính kèm; services: toppings.js (phạm vi), order-items.js, sold-out.js
backend/uploads/          File admin tải lên (không đưa lên git)
database/                 schema.sql, migrations/001…010, optional/
sw.js, manifest.webmanifest   PWA (đặt ở gốc để scope "/")
scripts/                  create-admin.js, check-db.js, check-project.js, inject-pwa.js
tests/                    216 ca kiểm thử
docs/                     Hướng dẫn triển khai, kiểm thử thủ công, checklist demo
.github/workflows/        CI
report/                   Báo cáo giữa kỳ 503073
index.html, pages/        Giao diện khách (trang chủ + 9 trang: menu, chi tiết món, giỏ, thanh toán,
                          đặt bàn, tài khoản, quên/đặt lại mật khẩu, thành công)
staff/                    Giao diện nhân viên (8 trang: sơ đồ bàn, đơn, tạo đơn, bếp, đặt bàn,
                          menu hết món, doanh thu, topping)
admin/                    Giao diện quản lý (9 trang)
assets/css/               style, responsive, theme, pages, mobile-fixes, item-sheet, table-menu,
                          dark (giao diện tối), staff, admin
assets/js/                main/client-api (dùng chung), prefs.js (sáng/tối), item-sheet.js (thẻ tùy chỉnh món),
                          table-menu.js (chế độ tại bàn), cart*.js, staff-*.js, admin-*.js, pwa.js…
```

## Realtime và triển khai

Socket.IO đẩy sự kiện cho phòng admin (`order:created`, `order:updated`, `booking:created`, `booking:updated`, `table:updated`) và thông báo "món sẵn sàng" cho phục vụ; polling dự phòng vẫn được giữ. Cấu hình Render nằm trong `render.yaml` (thêm `BREVO_API_KEY`, `MAIL_FROM`, `APP_URL` trong mục Environment), hướng dẫn chi tiết tại `docs/DEPLOY_RENDER.md`. Cơ sở dữ liệu có thể dùng MySQL của nhà cung cấp bên ngoài hoặc **TiDB Cloud**.

> File `render.yaml` chỉ có tác dụng khi tạo mới bằng Blueprint; với service đang chạy, giá trị đặt trong **Environment** của Render mới là giá trị được dùng.

## Lưu ý bảo mật khi triển khai

* Không commit `.env`; đặt `JWT_SECRET` dài và ngẫu nhiên (server từ chối chạy nếu dưới 32 ký tự). Không dán khóa `BREVO_API_KEY` / `SMTP_PASS` vào mã nguồn.
* Xóa hoặc đổi mật khẩu mọi tài khoản mẫu/demo trong bảng `users`, và **gỡ giá trị demo hardcode trong `assets/js/admin-api.js`** trước khi công khai.
* Chạy sau HTTPS và đặt `TRUST_PROXY=1` nếu có reverse proxy.
* Trang tĩnh chỉ phục vụ `admin/`, `staff/`, `assets/`, `pages/`, `index.html` và đúng 2 file `sw.js` + `manifest.webmanifest`; `.env`, `server.js`, `config/`… không truy cập được (có ca kiểm thử).
* Upload kiểm tra **magic-byte** thật của file, không tin MIME do trình duyệt gửi; có giới hạn dung lượng và số file.
* Server **tự tính lại giá** đơn hàng và kiểm tra topping hợp món, không tin giá do trình duyệt gửi.
* Token đăng xuất bị thu hồi theo `jti`; đổi hoặc đặt lại mật khẩu thu hồi **mọi** phiên của tài khoản đó. Danh sách thu hồi lưu trong bộ nhớ tiến trình, nên chỉ đúng khi chạy **một** instance.
* Mọi thao tác nhân viên được ghi nhật ký; nhân viên bị khóa mất hiệu lực ngay.

## Lộ trình hoàn thiện

**Đã xong:** tài khoản khách (đăng ký, OTP quên mật khẩu, hồ sơ, giao diện Sáng/Tối); quản lý nội dung (lưới/danh sách, tìm kiếm, nhãn, ghim, đính kèm, tự lưu); **PWA offline**; **trang nhân viên theo vị trí** (phục vụ / thu ngân / bếp); chuyển–gộp–tách bàn; hết món theo ngày; **topping có phạm vi theo danh mục và món, bếp quản lý được**; **thẻ tùy chỉnh món**; **đặt món tại bàn bằng QR** trên điện thoại; xuất hóa đơn Excel/CSV/PDF; gửi mail qua Brevo.

**Còn lại, theo thứ tự ưu tiên:**
1. **Đồng bộ offline** — hàng đợi IndexedDB cho đơn tạo lúc mất mạng + tự gửi lại khi có mạng.
2. **Giao diện tối cho trang nhân viên và admin** (hiện mới có cho trang khách).
3. **Nhóm nâng cao** — ghi chú nội bộ (`staff_notes`) có mật khẩu riêng, chia sẻ read/edit + thu hồi, cộng tác realtime, AI Summary / Q&A (`.env.example` đã chừa chỗ `AI_*`).
4. **`docker-compose.yml`** để giảng viên chạy tại chỗ khi không truy cập được bản online.
5. **Dọn nốt:** `window.confirm` còn ở vài màn hình admin (nên dùng `MocConfirm`); `render.yaml` mới mount đĩa bền vững cho `backend/uploads/products`, cần thêm `avatars/` và `attachments/` để file upload không mất khi redeploy; thanh toán ngay trong bảng giỏ ở chế độ tại bàn (hiện chuyển sang `cart.html`).

## Hồ sơ nộp

* **Báo cáo giữa kỳ** (đã nộp 07/11/2026): `report/report.docx` dựng trên `report/Template_VN.dotx`, kèm `report/503073-Midterm.pdf` (đề bài + tiêu chí). Các số liệu trong báo cáo giữa kỳ (26 endpoint, 13 ca kiểm thử) là **tại thời điểm giữa kỳ**; bản hiện tại khoảng 80 endpoint và 216 ca kiểm thử — cần cập nhật khi viết báo cáo cuối kỳ. Khi mở bản chưa cập nhật field, trong Word nhấn **Ctrl + A rồi F9** để sinh lại mục lục.
* **Đồ án cuối kỳ**: source code kèm README này, `Rubric.xlsx` tự chấm theo 32 hạng mục, `demo.mp4` (tối thiểu 1080p, các thành viên cùng xuất hiện, demo lần lượt từng hạng mục; nhớ quay cả phần **test offline**), `Readme.txt` ghi URL công khai + tài khoản test, `Screenshot.png` chụp GitHub Insights, và folder nén tên dạng `id1_fullname1_id2_fullname2.zip`.
* Bản nộp phải là **`git clone`** (giữ thư mục `.git` và lịch sử commit), không dùng "Download ZIP". Trước khi nén: xóa `node_modules`, `.env`, `report/`, `backup_moc_coffee.sql`, các file upload thử nghiệm trong `backend/uploads/` và **2 file đặt sai chỗ `database/migrations/sw.js` + `database/migrations/manifest.webmanifest`** (bản đúng nằm ở gốc dự án).
