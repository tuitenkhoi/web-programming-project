/* Lời chào khách hàng đã đăng nhập, hiện ngay ở thanh menu mọi trang
   và ở khung chào của trang chủ (index.html).
   Nạp ở cuối trang:  <script src="assets/js/customer-greeting.js"></script> */
(function () {
  'use strict';

  /* 0) Chỉ giữ MỘT lối vào tài khoản trên thanh menu (bỏ nút chữ "Tài khoản", giữ biểu tượng) */
  var navs = document.querySelectorAll('.navbar');
  navs.forEach(function (nav) {
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href$="account.html"]'));
    if (links.length < 2) return;
    var keep = links.filter(function (a) { return a.querySelector('.bi-person-circle, .bi-person'); })[0] || links[links.length - 1];
    links.forEach(function (a) {
      if (a === keep) return;
      var item = a.closest('li') || a;
      item.style.display = 'none';
      item.setAttribute('aria-hidden', 'true');
    });
  });

  var profile = null;
  try {
    profile = JSON.parse(localStorage.getItem('mocCoffeeCustomerProfile') || 'null');
  } catch (e) { /* bỏ qua */ }

  if (!profile || !profile.full_name) return;
  if (!localStorage.getItem('mocCoffeeCustomerToken')) return;

  var fullName = String(profile.full_name).trim();
  var parts = fullName.split(/\s+/);
  var shortName = parts[parts.length - 1]; // tên gọi: từ cuối của họ tên

  var h = new Date().getHours();
  var greeting = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  var style = document.createElement('style');
  style.textContent =
    '.moc-greeting{display:inline-block;max-width:160px;margin-left:8px;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;font-size:.9rem;font-weight:600}' +
    '@media (max-width:991.98px){.moc-greeting{max-width:none}}';
  document.head.appendChild(style);

  /* 1) Thanh menu: biểu tượng tài khoản => "Chào, Khôi" */
  document.querySelectorAll('.navbar a[href$="account.html"]').forEach(function (link) {
    if (link.querySelector('.moc-greeting')) return;
    var span = document.createElement('span');
    span.className = 'moc-greeting';
    span.textContent = 'Chào, ' + shortName;
    // Ảnh đại diện nhỏ; chưa có thì dùng ảnh mặc định (trang con ở /pages/ cần lùi một cấp)
    var defaultAvatar = (location.pathname.indexOf('/pages/') !== -1 ? '../' : '') + 'assets/images/default-avatar.png';
    var avatar = document.createElement('img');
    avatar.alt = '';
    avatar.width = 24;
    avatar.height = 24;
    avatar.className = 'rounded-circle object-fit-cover flex-shrink-0';
    avatar.src = (profile.avatar && window.MocCoffeeApi && MocCoffeeApi.avatarUrl)
      ? MocCoffeeApi.avatarUrl(profile.avatar)
      : defaultAvatar;
    avatar.onerror = function () { avatar.onerror = null; avatar.src = defaultAvatar; };
    // Đã đăng nhập: ẩn biểu tượng người, chỉ còn ảnh + lời chào trên MỘT hàng
    var icon = link.querySelector('.bi-person-circle, .bi-person');
    if (icon) icon.classList.add('d-none');
    link.appendChild(avatar);
    link.appendChild(span);
    link.classList.add('d-inline-flex', 'align-items-center', 'text-nowrap');
    link.title = fullName;
    link.setAttribute('aria-label', 'Tài khoản của ' + fullName);
    link.style.width = 'auto';
    link.style.borderRadius = '999px';
    link.style.paddingRight = '12px';
  });

  /* 2) Trang chủ: huy hiệu "Chào mừng đến với Mộc Coffee" => lời chào theo giờ */
  var pattern = /chào mừng đến với mộc coffee/i;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var node;
  while ((node = walker.nextNode())) {
    var parent = node.parentElement;
    if (!parent || /SCRIPT|STYLE|TITLE/.test(parent.tagName)) continue;
    if (pattern.test(node.nodeValue)) {
      node.nodeValue = greeting + ', ' + shortName + '! Chào mừng đến với Mộc Coffee';
      break;
    }
  }
})();

/* Banner nhắc xác minh email: hiện ở mọi trang cho tới khi khách bấm link kích hoạt trong email. */
(function () {
  'use strict';

  var token = localStorage.getItem('mocCoffeeCustomerToken');
  if (!token) return;

  fetch('/api/auth/customer/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (body) {
      if (!body || !body.data || body.data.email_verified_at) return;

      var style = document.createElement('style');
      style.textContent =
        '.moc-verify-banner{position:fixed;left:0;right:0;top:56px;z-index:1029;margin:0;border-radius:0;text-align:center}';
      document.head.appendChild(style);

      var banner = document.createElement('div');
      banner.className = 'alert alert-warning moc-verify-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Email của bạn chưa được xác minh — vui lòng kiểm tra hộp thư';
      document.body.appendChild(banner);
    })
    .catch(function () { /* mất mạng thì thôi, không làm phiền khách */ });
})();
