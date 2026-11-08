# Triển khai Mộc Coffee lên Render

File `render.yaml` đã chuẩn bị web service Node.js, health check và ổ đĩa lưu ảnh sản phẩm. Việc triển khai thật cần tài khoản Render và một MySQL công khai (Aiven, Railway, DigitalOcean hoặc nhà cung cấp tương đương).

1. Push toàn bộ code lên nhánh `main` và bảo đảm GitHub Actions xanh.
2. Tạo MySQL, import `database/schema.sql`, sau đó chạy migration nếu nâng cấp database cũ.
3. Trên Render chọn **New → Blueprint**, kết nối repository và chọn `render.yaml`.
4. Điền `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `CORS_ORIGIN`; Render tự sinh `JWT_SECRET`.
5. Deploy, mở `/api/health`, sau đó tạo lại tài khoản admin bằng shell của Render.
6. Test lại đăng ký khách, gọi món, booking, upload ảnh, WebSocket và admin.

Không đưa `.env` hoặc mật khẩu database lên GitHub. Gói có persistent disk là gói trả phí; nếu dùng gói miễn phí, hãy chuyển ảnh upload sang Cloudinary/S3 trước khi demo lâu dài.
