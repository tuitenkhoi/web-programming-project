"use strict";

document.addEventListener("DOMContentLoaded", async function () {
  const api = window.MocCoffeeApi;
  const productId = Number(new URLSearchParams(location.search).get("id"));
  const purchasedOrderId = Number(new URLSearchParams(location.search).get("order_id"));
  const main = document.querySelector("main");
  if (!api || !main || !Number.isSafeInteger(productId) || productId <= 0) return;

  const section = document.createElement("section");
  section.className = "py-5 bg-light";
  section.innerHTML = `<div class="container">
    <div class="row g-4">
      <div class="col-lg-7"><div class="card border-0 shadow-sm"><div class="card-body p-4">
        <h2 class="h4">Đánh giá từ khách hàng <small id="review-summary" class="text-secondary"></small></h2>
        <div id="review-list"><p class="text-secondary">Đang tải đánh giá...</p></div>
      </div></div></div>
      <div class="col-lg-5"><div class="card border-0 shadow-sm"><div class="card-body p-4">
        <h2 class="h5">Viết đánh giá đã mua</h2>
        <div id="review-login-note" class="small text-secondary mb-3"></div>
        <form id="review-form">
          <input class="form-control mb-3" name="order_id" type="number" min="1" placeholder="ID đơn hàng đã hoàn thành" required />
          <select class="form-select mb-3" name="rating" required>
            <option value="5">5 sao — Rất hài lòng</option><option value="4">4 sao</option>
            <option value="3">3 sao</option><option value="2">2 sao</option><option value="1">1 sao</option>
          </select>
          <textarea class="form-control mb-3" name="comment" maxlength="1000" rows="3" placeholder="Chia sẻ cảm nhận"></textarea>
          <button class="btn btn-coffee w-100" type="submit">Gửi đánh giá</button>
        </form>
        <div id="review-message" class="small mt-3"></div>
      </div></div></div>
    </div>
  </div>`;
  main.appendChild(section);

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const list = section.querySelector("#review-list");
  const summary = section.querySelector("#review-summary");
  const form = section.querySelector("#review-form");
  const note = section.querySelector("#review-login-note");
  const message = section.querySelector("#review-message");
  if (Number.isSafeInteger(purchasedOrderId) && purchasedOrderId > 0) {
    form.elements.order_id.value = purchasedOrderId;
  }

  async function loadReviews() {
    try {
      const result = await api.getProductReviews(productId);
      summary.textContent = `(${Number(result.summary.average).toFixed(1)}/5 · ${result.summary.total} lượt)`;
      const topScore = document.querySelector("#product-rating-score");
      const topCount = document.querySelector("#product-review-count");
      const topStars = document.querySelector("#product-rating");
      const roundedRating = Math.round(Number(result.summary.average));
      if (topScore) topScore.textContent = Number(result.summary.average).toFixed(1);
      if (topCount) topCount.textContent = String(result.summary.total);
      if (topStars) {
        topStars.setAttribute("aria-label", `Đánh giá ${Number(result.summary.average).toFixed(1)} trên 5 sao`);
        topStars.innerHTML = `${'<i class="bi bi-star-fill"></i>'.repeat(roundedRating)}${'<i class="bi bi-star"></i>'.repeat(5 - roundedRating)}`;
      }
      list.innerHTML = result.data.length ? result.data.map((review) => `<article class="border-top py-3">
        <div class="d-flex justify-content-between"><strong>${esc(review.full_name)}</strong><span class="text-warning">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</span></div>
        <p class="mb-1">${esc(review.comment || "Không có nội dung.")}</p>
        <small class="text-secondary">${esc(new Date(review.created_at).toLocaleDateString("vi-VN"))}</small>
      </article>`).join("") : '<p class="text-secondary">Chưa có đánh giá cho sản phẩm này.</p>';
    } catch (error) { list.innerHTML = `<p class="text-danger">${esc(error.message)}</p>`; }
  }

  const profile = api.getCustomerProfile();
  if (!profile) {
    note.innerHTML = 'Bạn cần <a href="account.html">đăng nhập khách hàng</a> để đánh giá.';
    form.querySelectorAll("input,select,textarea,button").forEach((element) => { element.disabled = true; });
  } else {
    note.textContent = `Đang đánh giá với tài khoản ${profile.full_name}.`;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await api.createReview({ product_id: productId, order_id: Number(data.order_id), rating: Number(data.rating), comment: data.comment });
      message.className = "small mt-3 text-success";
      message.textContent = "Đã lưu đánh giá.";
      await loadReviews();
    } catch (error) {
      message.className = "small mt-3 text-danger";
      message.textContent = error.message;
    }
  });

  loadReviews();
});
