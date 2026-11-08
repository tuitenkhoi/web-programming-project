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

  async function loadMember() {
    const profile = api.getCustomerProfile();
    guest.classList.toggle("d-none", Boolean(profile));
    member.classList.toggle("d-none", !profile);
    if (!profile) return;

    document.querySelector("#member-name").textContent = profile.full_name;
    document.querySelector("#member-contact").textContent = `${profile.email} · ${profile.phone || "Chưa có SĐT"}`;

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
    try {
      await api.customerRegister(data);
      message("Đăng ký thành công.", "success");
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

  document.querySelector("#customer-logout").addEventListener("click", function () {
    api.clearCustomerSession();
    loadMember();
  });

  loadMember();
});
