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

  function message(text, type = "danger") {
    alertBox.textContent = text;
    alertBox.className = `alert alert-${type}`;
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
    const theme = prefs.theme || "system";
    const radio = prefsForm.querySelector(`input[name="theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
    prefsForm.querySelector("#pref-font").value = String(prefs.font_size || 16);
  }

  prefsForm.addEventListener("change", function () {
    const prefs = {
      theme: prefsForm.querySelector('input[name="theme"]:checked')?.value || "system",
      font_size: Number(prefsForm.querySelector("#pref-font").value),
    };
    window.MocPrefs.save(prefs); // đổi giao diện tức thì
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(async () => {
      if (!api.getCustomerProfile()) return; // chưa đăng nhập: chỉ lưu trong trình duyệt
      try {
        await api.savePreferences(prefs);
        prefsStatus.textContent = "Đã lưu tùy chọn.";
      } catch (error) { prefsStatus.textContent = error.message; }
    }, 300);
  });

  // Đổ thông tin hồ sơ vào phần đầu trang và form chỉnh sửa
  function fillProfile(profile) {
    document.querySelector("#member-name").textContent = profile.full_name;
    document.querySelector("#member-contact").textContent = `${profile.email} · ${profile.phone || "Chưa có SĐT"}`;
    const avatar = api.avatarUrl(profile.avatar);
    document.querySelector("#member-avatar").src = avatar;
    document.querySelector("#avatar-preview").src = avatar;
    document.querySelector("#profile-email").value = profile.email || "";
    document.querySelector("#profile-name").value = profile.full_name || "";
    document.querySelector("#profile-phone").value = profile.phone || "";
  }

  async function loadMember() {
    const profile = api.getCustomerProfile();
    guest.classList.toggle("d-none", Boolean(profile));
    member.classList.toggle("d-none", !profile);
    if (!profile) return;

    fillProfile(profile);
    // Lấy hồ sơ mới nhất từ server (avatar, tên, SĐT có thể đã đổi ở thiết bị khác)
    showPrefs(window.MocPrefs.read());
    api.getMe().then((fresh) => {
      if (!fresh) return;
      fillProfile(fresh);
      // Tùy chọn trên server là bản chuẩn: đồng bộ về trình duyệt này
      showPrefs(window.MocPrefs.save({ theme: fresh.theme, font_size: Number(fresh.font_size) }));
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

  document.querySelector("#customer-login-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    try {
      await api.customerLogin(document.querySelector("#login-email").value.trim(), document.querySelector("#login-password").value);
      message("Đăng nhập thành công.", "success");
      await loadMember();
    } catch (error) { message(error.message); }
  });

  document.querySelector("#customer-register-form").addEventListener("submit", async function (event) {
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
      await loadMember();
    } catch (error) { message(error.message); }
  });

  // ----- Hồ sơ: chọn ảnh (xem trước + kiểm tra phía trình duyệt) và lưu -----
  const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const avatarInput = document.querySelector("#avatar-input");
  const avatarError = document.querySelector("#avatar-error");

  avatarInput.addEventListener("change", function () {
    const file = avatarInput.files[0];
    avatarError.textContent = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      avatarError.textContent = "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.";
      avatarInput.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      avatarError.textContent = "Ảnh không được vượt quá 2 MB.";
      avatarInput.value = "";
      return;
    }
    document.querySelector("#avatar-preview").src = URL.createObjectURL(file);
  });

  document.querySelector("#profile-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append("full_name", document.querySelector("#profile-name").value.trim());
    formData.append("phone", document.querySelector("#profile-phone").value.trim());
    if (avatarInput.files[0]) formData.append("avatar", avatarInput.files[0]);
    try {
      const updated = await api.updateProfile(formData);
      avatarInput.value = "";
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

  document.querySelector("#password-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = {
      current_password: document.querySelector("#pw-current").value,
      new_password: document.querySelector("#pw-new").value,
      confirm_password: document.querySelector("#pw-confirm").value,
    };
    if (payload.new_password !== payload.confirm_password) return message("Mật khẩu nhập lại không khớp");
    try {
      const text = await api.changePassword(payload);
      api.clearCustomerSession(); // token cũ đã bị server thu hồi, chỉ cần xóa bản lưu cục bộ
      event.currentTarget.reset();
      message(text, "success");
      await loadMember();
    } catch (error) { message(error.message); }
  });

  document.querySelector("#order-lookup-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = document.querySelector("#lookup-result");
    try { result.innerHTML = orderCard(await api.lookupOrder(data)); }
    catch (error) { result.innerHTML = `<p class="text-danger">${esc(error.message)}</p>`; }
  });

  document.querySelector("#customer-logout").addEventListener("click", async function () {
    await api.customerLogout();
    loadMember();
  });

  // Quay về từ link kích hoạt trong email (server redirect kèm ?verified=1)
  if (new URLSearchParams(location.search).get("verified")) {
    message("Xác minh email thành công. Cảm ơn bạn!", "success");
  }

  loadMember();
});
