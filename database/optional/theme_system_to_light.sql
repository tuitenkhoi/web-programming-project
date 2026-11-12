SET NAMES utf8mb4;
USE moc_coffee;

-- ============================================================================
-- TÙY CHỌN (OPTIONAL) — KHÔNG nằm trong database/migrations nên không tự chạy.
-- Bạn tự quyết định có chạy hay không.
--
-- Đưa các tài khoản CŨ đang để 'system' (Theo thiết bị) về 'light' (Sáng).
-- Lưu ý: không phân biệt được người "tự chọn Theo thiết bị" với người "chưa từng chọn
-- (mặc định cũ)". Chạy câu này sẽ đổi cả hai nhóm về Sáng; họ vẫn có thể chọn lại
-- Tối / Theo thiết bị trong trang Tài khoản.
-- Nếu KHÔNG chạy: tài khoản cũ giữ 'system' và sẽ theo giao diện của hệ điều hành.
-- ============================================================================
UPDATE users SET theme = 'light' WHERE theme = 'system';
