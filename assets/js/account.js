"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const api = window.MocCoffeeApi;
  const guest = document.querySelector("#guest-section");
  const member = document.querySelector("#member-section");
  const alertBox = document.querySelector("#account-alert");

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const money = (value) => Number(value || 0).toLocaleString("vi-VN") + "đ";
  const statusText = {
    pending: "Chờ xác nhận", confirmed: "Đã xác nhận", preparing: "Đang chế biến",
    ready: "Sẵn sàng", completed: "Hoàn thành", cancelled: "Đã hủy",
  };

  // Gắn sự kiện an toàn: trang thiếu phần tử nào thì bỏ qua phần đó, không làm hỏng cả script
  function on(selector, type, handler) {
    const element = document.querySelector(selector);
    if (element) element.addEventListener(type, handler);
  }

  const HOME_PAGE = "../index.html";
  const ADMIN_DASHBOARD = "../admin/dashboard.html";
  const ADMIN_AUTH_SCRIPT = "../assets/js/admin-auth.js";

  const loginPanel = document.querySelector("#login-panel");
  const registerPanel = document.querySelector("#register-panel");

  function message(text, type = "danger") {
    alertBox.textContent = text;
    alertBox.className = `alert alert-${type}`;
  }

  function hideAlert() {
    alertBox.className = "alert d-none";
    alertBox.textContent = "";
  }

  // ----- Chuyển qua lại đăng nhập / đăng ký -----
  function showPanel(which) {
    if (!loginPanel || !registerPanel) return;
    const register = which === "register";
    loginPanel.classList.toggle("d-none", register);
    registerPanel.classList.toggle("d-none", !register);
    hideAlert();
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest?.("#show-register, #show-login");
    if (!link) return;
    event.preventDefault();
    const toRegister = link.id === "show-register";
    showPanel(toRegister ? "register" : "login");
    try {
      history.replaceState(null, "", toRegister ? "#register" : "#login");
    } catch (e) { /* bỏ qua */ }
  });

  showPanel(location.hash === "#register" ? "register" : "login");

  // Không còn lối vào "đăng nhập quản trị" riêng: form đăng nhập dùng chung cho cả hai
  document.querySelectorAll("#login-panel p, #login-panel div, #login-panel small").forEach(function (el) {
    if (!el.querySelector("form") && el.children.length < 4 && /quản trị viên/i.test(el.textContent) && /đăng nhập/i.test(el.textContent)) {
      el.remove();
    }
  });
  document.querySelectorAll('a[href$="admin/login.html"]').forEach(function (a) {
    const holder = a.closest("p, div, small") || a;
    if (!holder.querySelector("form")) holder.remove();
  });
  document.querySelectorAll("#login-panel h1, #login-panel h2, #login-panel h3").forEach(function (h) {
    if (/đăng nhập khách hàng/i.test(h.textContent)) h.textContent = "Đăng nhập";
  });

  // Thông báo từ trang quản trị chuyển sang
  const pageParams = new URLSearchParams(location.search);
  if (pageParams.get("expired")) message("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.", "warning");
  else if (pageParams.get("required")) message("Vui lòng đăng nhập để tiếp tục.", "warning");
  else if (pageParams.get("login")) message("Bạn cần đăng nhập để tiếp tục", "warning");

  // Lời chào theo giờ
  function greetingText() {
    const h = new Date().getHours();
    return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  }

  function orderCard(order) {
    const reviewLinks = order.status === "completed"
      ? (order.items || []).filter((item) => Number(item.product_id) > 0).map((item) =>
          `<a class="btn btn-sm btn-outline-secondary" href="product-detail.html?id=${Number(item.product_id)}&order_id=${Number(order.id)}">Đánh giá ${esc(item.product_name)}</a>`
        ).join("")
      : "";
    return `<article class="border rounded p-3 mb-3">
      <div class="d-flex flex-wrap justify-content-between gap-2">
        <strong>${esc(order.order_code)}</strong>
        <span class="badge text-bg-secondary">${esc(statusText[order.status] || order.status)}</span>
      </div>
      <small class="text-secondary">${esc(new Date(order.created_at).toLocaleString("vi-VN"))}</small>
      <ul class="mt-3 mb-2">${(order.items || []).map((item) =>
        `<li>${esc(item.product_name)} × ${Number(item.quantity)} — ${money(item.line_total)}</li>`
      ).join("")}</ul>
      <div class="d-flex justify-content-between"><span>${esc(order.table_code || "Mang đi")}</span><strong>${money(order.total_amount)}</strong></div>
      ${reviewLinks ? `<div class="d-flex flex-wrap gap-2 mt-3">${reviewLinks}</div>` : ""}
    </article>`;
  }

  // ----- Tùy chọn giao diện: áp ngay khi đổi, lưu localStorage (prefs.js) và lên server sau 300ms -----
  const prefsForm = document.querySelector("#prefs-form");
  const prefsStatus = document.querySelector("#prefs-status");
  let prefsTimer;

  function showPrefs(prefs) {
    if (!prefsForm) return;
    const theme = prefs.theme || "light";
    const radio = prefsForm.querySelector(`input[name="theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
    prefsForm.querySelector("#pref-font").value = String(prefs.font_size || 16);
  }

  on("#prefs-form", "change", function () {
    const prefs = {
      theme: prefsForm.querySelector('input[name="theme"]:checked')?.value || "light",
      font_size: Number(prefsForm.querySelector("#pref-font").value),
    };
    if (window.MocPrefs) window.MocPrefs.save(prefs); // đổi giao diện tức thì
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(async () => {
      if (!api.getCustomerProfile()) return; // chưa đăng nhập: chỉ lưu trong trình duyệt
      try {
        await api.savePreferences(prefs);
        prefsStatus.textContent = "Đã lưu tùy chọn.";
      } catch (error) { prefsStatus.textContent = error.message; }
    }, 300);
  });

  // Khách chưa đăng nhập cũng thấy đúng lựa chọn hiện tại của trình duyệt
  if (window.MocPrefs) showPrefs(window.MocPrefs.read());

  // Đổ thông tin hồ sơ vào phần đầu trang và form chỉnh sửa
  function fillProfile(profile) {
    document.querySelector("#member-name").textContent = `${greetingText()}, ${profile.full_name}!`;
    document.querySelector("#member-contact").textContent = `${profile.email} · ${profile.phone || "Chưa có SĐT"}`;
    const avatar = api.avatarUrl ? api.avatarUrl(profile.avatar) : "";
    const setSrc = (selector, value) => { const el = document.querySelector(selector); if (el && value) el.src = value; };
    const setValue = (selector, value) => { const el = document.querySelector(selector); if (el) el.value = value; };
    setSrc("#member-avatar", avatar);
    setSrc("#avatar-preview", avatar);
    setValue("#profile-email", profile.email || "");
    setValue("#profile-name", profile.full_name || "");
    setValue("#profile-phone", profile.phone || "");
  }

  async function loadMember() {
    const profile = api.getCustomerProfile();
    guest?.classList.toggle("d-none", Boolean(profile));
    member?.classList.toggle("d-none", !profile);
    if (!profile) return;

    fillProfile(profile);
    // Lấy hồ sơ mới nhất từ server (avatar, tên, SĐT có thể đã đổi ở thiết bị khác)
    if (window.MocPrefs) showPrefs(window.MocPrefs.read());
    api.getMe().then((fresh) => {
      if (!fresh) return;
      fillProfile(fresh);
      // Tùy chọn trên server là bản chuẩn: đồng bộ về trình duyệt này
      if (window.MocPrefs) showPrefs(window.MocPrefs.save({ theme: fresh.theme, font_size: Number(fresh.font_size) }));
    }).catch(() => {});

    try {
      const [orders, vouchers] = await Promise.all([api.getCustomerOrders(), api.getVouchers()]);
      document.querySelector("#order-history").innerHTML = orders.length
        ? orders.map(orderCard).join("")
        : '<p class="text-secondary">Bạn chưa có đơn hàng nào.</p>';
      document.querySelector("#voucher-list").innerHTML = vouchers.length
        ? vouchers.map((voucher) => `<div class="col-md-6"><div class="border rounded p-3 h-100">
            <strong>${esc(voucher.code)} — ${esc(voucher.name)}</strong>
            <p class="text-secondary mb-0">${esc(voucher.description || "")}</p>
          </div></div>`).join("")
        : '<p class="text-secondary">Hiện chưa có voucher khả dụng.</p>';
    } catch (error) {
      if (/đăng nhập|token|hết hạn/i.test(error.message)) {
        api.clearCustomerSession();
        return loadMember();
      }
      message(error.message);
    }
  }

  // ----- Đăng nhập chung: thử tài khoản khách hàng trước, không được thì thử quản trị -----
  async function postLogin(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.success !== false && data.data && data.data.token;
    return { ok: Boolean(ok), status: res.status, data: data.data, message: data.message };
  }

  function loadAdminAuth() {
    if (window.AdminAuth) return Promise.resolve(window.AdminAuth);
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = ADMIN_AUTH_SCRIPT;
      script.onload = () => (window.AdminAuth ? resolve(window.AdminAuth) : reject(new Error("Thiếu AdminAuth")));
      script.onerror = () => reject(new Error("Không nạp được admin-auth.js"));
      document.head.appendChild(script);
    });
  }

  on("#customer-login-form", "submit", async function (event) {
    event.preventDefault();
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;
    const button = event.currentTarget.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    hideAlert();

    try {
      const customer = await postLogin("/api/auth/customer/login", { email, password });
      if (customer.ok) {
        api.setCustomerSession(customer.data);
        // Bị guard chuyển tới từ trang khác (giỏ hàng, thanh toán...) thì quay lại đúng trang đó
        location.href = window.MocAuthGuard.afterLoginUrl(HOME_PAGE);
        return;
      }
      if (customer.status === 429) throw new Error(customer.message || "Thử quá nhiều lần, vui lòng đợi một lúc.");

      const admin = await postLogin("/api/auth/login", { email, password });
      if (admin.ok) {
        const auth = await loadAdminAuth();
        auth.setToken(admin.data.token);
        message("Đăng nhập quản trị thành công. Đang chuyển hướng...", "success");
        location.href = ADMIN_DASHBOARD;
        return;
      }

      throw new Error(customer.message || "Email hoặc mật khẩu không chính xác.");
    } catch (error) {
      message(error.message === "Failed to fetch" ? "Không kết nối được máy chủ." : error.message);
      if (button) button.disabled = false;
    }
  });

  on("#customer-register-form", "submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    // Kiểm tra nhập lại mật khẩu ngay ở trình duyệt (server vẫn kiểm tra lại)
    if (data.password !== data.confirm_password) {
      message("Mật khẩu nhập lại không khớp");
      return;
    }
    try {
      await api.customerRegister(data);
      message("Đăng ký thành công.", "success");
      // Cho khách kịp thấy thông báo rồi về trang chủ
      setTimeout(() => { location.href = window.MocAuthGuard.afterLoginUrl(HOME_PAGE); }, 700);
    } catch (error) { message(error.message); }
  });

  // ----- Hồ sơ: chọn ảnh (xem trước + kiểm tra phía trình duyệt) và lưu -----
  const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const avatarInput = document.querySelector("#avatar-input");
  const avatarError = document.querySelector("#avatar-error");

  avatarInput?.addEventListener("change", function () {
    const file = avatarInput.files[0];
    if (avatarError) avatarError.textContent = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      if (avatarError) avatarError.textContent = "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.";
      avatarInput.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      if (avatarError) avatarError.textContent = "Ảnh không được vượt quá 2 MB.";
      avatarInput.value = "";
      return;
    }
    const preview = document.querySelector("#avatar-preview");
    if (preview) preview.src = URL.createObjectURL(file);
  });

  on("#profile-form", "submit", async function (event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append("full_name", document.querySelector("#profile-name").value.trim());
    formData.append("phone", document.querySelector("#profile-phone").value.trim());
    if (avatarInput?.files[0]) formData.append("avatar", avatarInput.files[0]);
    try {
      const updated = await api.updateProfile(formData);
      if (avatarInput) avatarInput.value = "";
      fillProfile(updated);
      message("Cập nhật hồ sơ thành công.", "success");
    } catch (error) { message(error.message); }
  });

  // ----- Đổi mật khẩu: nút hiện/ẩn, thành công thì xóa phiên và về trang đăng nhập -----
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      button.querySelector("i").className = show ? "bi bi-eye-slash" : "bi bi-eye";
    });
  });

  on("#password-form", "submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget; // currentTarget thành null sau await, nên giữ lại trước khi gọi API
    const payload = {
      current_password: document.querySelector("#pw-current").value,
      new_password: document.querySelector("#pw-new").value,
      confirm_password: document.querySelector("#pw-confirm").value,
    };
    if (payload.new_password !== payload.confirm_password) return message("Mật khẩu nhập lại không khớp");
    try {
      const text = await api.changePassword(payload);
      api.clearCustomerSession(); // token cũ đã bị server thu hồi, chỉ cần xóa bản lưu cục bộ
      form.reset();
      message(text, "success");
      await loadMember();
    } catch (error) { message(error.message); }
  });

  on("#order-lookup-form", "submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = document.querySelector("#lookup-result");
    try { result.innerHTML = orderCard(await api.lookupOrder(data)); }
    catch (error) { result.innerHTML = `<p class="text-danger">${esc(error.message)}</p>`; }
  });

  on("#customer-logout", "click", async function () {
    await api.customerLogout();
    loadMember();
  });

  // Quay về từ link kích hoạt trong email (server redirect kèm ?verified=1)
  if (new URLSearchParams(location.search).get("verified")) {
    message("Xác minh email thành công. Cảm ơn bạn!", "success");
  }

  loadMember();
});
