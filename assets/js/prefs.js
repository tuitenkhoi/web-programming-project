/* Áp tùy chọn giao diện (sáng/tối, cỡ chữ) NGAY khi trang bắt đầu tải.
   Nạp đồng bộ trong <head> (không async/defer) để trang không nháy sai màu rồi mới đổi.
   Dữ liệu nằm ở localStorage "mocPrefs" nên khách chưa đăng nhập vẫn dùng được;
   khách đã đăng nhập thì account.js đồng bộ thêm lên server (cột users.theme, users.font_size). */
(function () {
  'use strict';

  var KEY = 'mocPrefs';
  var root = document.documentElement;
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function apply(prefs) {
    var theme = prefs.theme || 'light';
    // 'system' thì theo cài đặt của hệ điều hành (prefers-color-scheme)
    var dark = theme === 'dark' || (theme === 'system' && darkQuery && darkQuery.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-bs-theme', dark ? 'dark' : 'light'); // để Bootstrap (card, form, bảng) cũng đổi màu
    // Chỉ đặt cỡ chữ khi khách đã chọn, nếu không giữ cỡ mặc định của trình duyệt
    if (prefs.font_size) root.style.fontSize = Number(prefs.font_size) + 'px';
  }

  function save(partial) {
    var prefs = Object.assign(read(), partial);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* bỏ qua */ }
    apply(prefs);
    return prefs;
  }

  apply(read());
  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', function () { apply(read()); });
  }

  window.MocPrefs = { read: read, save: save };
})();
