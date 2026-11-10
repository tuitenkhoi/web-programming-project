/* Trang tài khoản: MỘT form đăng nhập cho cả khách hàng và quản trị viên.
   - Nhập email + mật khẩu: thử tài khoản khách hàng trước, không được thì thử quản trị.
   - Khách hàng ở lại trang này; quản trị viên được chuyển thẳng vào trang quản trị.
   - Nạp SAU account.js:  <script src="../assets/js/account-ui.js"></script> */
(function () {
  'use strict';

  var HOME_PAGE = '../index.html';
  var ADMIN_DASHBOARD = '../admin/dashboard.html';
  var ADMIN_AUTH_SCRIPT = '../assets/js/admin-auth.js';

  var loginPanel = document.getElementById('login-panel');
  var registerPanel = document.getElementById('register-panel');
  var alertBox = document.getElementById('account-alert');
  var loginForm = document.getElementById('customer-login-form');

  function hideAlert() {
    if (!alertBox) return;
    alertBox.className = 'alert d-none';
    alertBox.textContent = '';
  }

  function showAlert(text, type) {
    if (!alertBox) return;
    alertBox.textContent = text;
    alertBox.className = 'alert alert-' + (type || 'danger');
  }

  /* ---------- Chuyển qua lại đăng nhập / đăng ký ---------- */
  function show(which) {
    if (!loginPanel || !registerPanel) return;
    var register = which === 'register';
    loginPanel.classList.toggle('d-none', register);
    registerPanel.classList.toggle('d-none', !register);
    hideAlert();
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('#show-register, #show-login');
    if (!link) return;
    event.preventDefault();
    var toRegister = link.id === 'show-register';
    show(toRegister ? 'register' : 'login');
    try {
      history.replaceState(null, '', toRegister ? '#register' : '#login');
    } catch (e) { /* bỏ qua */ }
  });

  show(location.hash === '#register' ? 'register' : 'login');

  /* ---------- Bỏ hẳn lối vào "đăng nhập quản trị" riêng ---------- */
  document.querySelectorAll('#login-panel p, #login-panel div, #login-panel small').forEach(function (el) {
    if (el.children.length < 4 && /quản trị viên/i.test(el.textContent) && /đăng nhập/i.test(el.textContent)) {
      el.remove();
    }
  });
  document.querySelectorAll('a[href$="admin/login.html"]').forEach(function (a) {
    var holder = a.closest('p, div, small') || a;
    if (!holder.querySelector('form')) holder.remove();
  });

  // Tiêu đề chỉ là "Đăng nhập" (dùng chung cho khách và quản trị)
  document.querySelectorAll('#login-panel h1, #login-panel h2, #login-panel h3').forEach(function (h) {
    if (/đăng nhập khách hàng/i.test(h.textContent)) h.textContent = 'Đăng nhập';
  });

  /* ---------- Thông báo từ trang quản trị chuyển sang ---------- */
  var params = new URLSearchParams(location.search);
  if (params.get('expired')) showAlert('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'warning');
  else if (params.get('required')) showAlert('Vui lòng đăng nhập để tiếp tục.', 'warning');

  /* ---------- Lời chào theo giờ + tên khách ---------- */
  var nameEl = document.getElementById('member-name');
  if (nameEl) {
    var greeting = function () {
      var h = new Date().getHours();
      return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    };
    var greet = function () {
      var name = nameEl.textContent.trim();
      if (!name || /^Chào buổi/i.test(name)) return;
      nameEl.textContent = greeting() + ', ' + name + '!';
    };
    new MutationObserver(greet).observe(nameEl, { childList: true, characterData: true, subtree: true });
    greet();
  }

  /* ---------- Đăng ký xong => về trang chủ ---------- */
  var registerForm = document.getElementById('customer-register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', function () {
      var tokenBefore = localStorage.getItem('mocCoffeeCustomerToken');
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var token = localStorage.getItem('mocCoffeeCustomerToken');
        if (token && token !== tokenBefore) {
          clearInterval(timer);
          setTimeout(function () { location.href = HOME_PAGE; }, 700); // cho khách kịp thấy "Đăng ký thành công"
        } else if (tries > 40) {
          clearInterval(timer);
        }
      }, 250);
    });
  }

  /* ---------- Đăng nhập chung ---------- */
  async function post(url, body) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    var data = await res.json().catch(function () { return {}; });
    var ok = res.ok && data.success !== false && data.data && data.data.token;
    return { ok: Boolean(ok), status: res.status, data: data.data, message: data.message };
  }

  function loadAdminAuth() {
    if (window.AdminAuth) return Promise.resolve(window.AdminAuth);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ADMIN_AUTH_SCRIPT;
      s.onload = function () { window.AdminAuth ? resolve(window.AdminAuth) : reject(new Error('Thiếu AdminAuth')); };
      s.onerror = function () { reject(new Error('Không nạp được admin-auth.js')); };
      document.head.appendChild(s);
    });
  }

  if (loginForm) {
    // Capture + stopImmediatePropagation: chặn handler cũ trong account.js (chỉ biết khách hàng).
    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var button = loginForm.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      hideAlert();

      try {
        // 1) Khách hàng
        var customer = await post('/api/auth/customer/login', { email: email, password: password });
        if (customer.ok) {
          window.MocCoffeeApi.setCustomerSession(customer.data);
          location.href = HOME_PAGE;
          return;
        }
        if (customer.status === 429) throw new Error(customer.message || 'Thử quá nhiều lần, vui lòng đợi một lúc.');

        // 2) Quản trị viên
        var admin = await post('/api/auth/login', { email: email, password: password });
        if (admin.ok) {
          var auth = await loadAdminAuth();
          auth.setToken(admin.data.token);
          showAlert('Đăng nhập quản trị thành công. Đang chuyển hướng...', 'success');
          location.href = ADMIN_DASHBOARD;
          return;
        }

        throw new Error(customer.message || 'Email hoặc mật khẩu không chính xác.');
      } catch (error) {
        showAlert(error.message === 'Failed to fetch' ? 'Không kết nối được máy chủ.' : error.message);
        if (button) button.disabled = false;
      }
    }, true);
  }
})();
