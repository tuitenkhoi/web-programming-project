"use strict";

/* Luồng quên mật khẩu, dùng chung cho 2 trang:
   - forgot-password.html: bước 1 (nhập email) và bước 2 (nhập OTP 6 số)
   - reset-password.html : bước 3 (đặt mật khẩu mới)
   Giữa các bước, trình duyệt chỉ nhớ email/reset_ticket trong sessionStorage (mất khi đóng tab). */
document.addEventListener("DOMContentLoaded", function () {
  const EMAIL_KEY = "mocResetEmail";
  const TICKET_KEY = "mocResetTicket";
  const alertBox = document.querySelector("#reset-alert");

  function message(text, type = "danger") {
    alertBox.textContent = text;
    alertBox.className = `alert alert-${type}`;
  }

  async function post(path, body) {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Không thể kết nối đến máy chủ.");
    }
    return result;
  }

  /* ---------- forgot-password.html ---------- */
  const forgotForm = document.querySelector("#forgot-form");
  if (forgotForm) {
    const stepEmail = document.querySelector("#step-email");
    const stepOtp = document.querySelector("#step-otp");
    const boxes = Array.from(document.querySelectorAll(".otp-box"));

    function showOtpStep(email) {
      document.querySelector("#otp-email").textContent = email;
      stepEmail.classList.add("d-none");
      stepOtp.classList.remove("d-none");
      boxes.forEach((box) => { box.value = ""; });
      boxes[0].focus();
    }

    forgotForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const email = document.querySelector("#forgot-email").value.trim().toLowerCase();
      if (!email) return message("Vui lòng nhập email.");
      try {
        const result = await post("forgot-password", { email });
        sessionStorage.setItem(EMAIL_KEY, email);
        message(result.message, "success");
        showOtpStep(email);
      } catch (error) { message(error.message); }
    });

    // 6 ô OTP: gõ 1 số thì nhảy sang ô kế, Backspace lùi lại, dán cả chuỗi 6 số thì tự chia vào các ô
    boxes.forEach((box, index) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        if (box.value && boxes[index + 1]) boxes[index + 1].focus();
      });
      box.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !box.value && boxes[index - 1]) boxes[index - 1].focus();
      });
      box.addEventListener("paste", (event) => {
        const digits = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        event.preventDefault();
        digits.split("").forEach((digit, i) => { if (boxes[i]) boxes[i].value = digit; });
        boxes[Math.min(digits.length, 5)].focus();
      });
    });

    document.querySelector("#otp-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const otp = boxes.map((box) => box.value).join("");
      if (!/^\d{6}$/.test(otp)) return message("Vui lòng nhập đủ 6 số.");
      try {
        const result = await post("verify-otp", { email: sessionStorage.getItem(EMAIL_KEY), otp });
        sessionStorage.setItem(TICKET_KEY, result.data.reset_ticket);
        location.href = "reset-password.html";
      } catch (error) { message(error.message); }
    });

    document.querySelector("#otp-back").addEventListener("click", function () {
      stepOtp.classList.add("d-none");
      stepEmail.classList.remove("d-none");
      alertBox.className = "alert d-none";
    });
  }

  /* ---------- reset-password.html ---------- */
  const resetForm = document.querySelector("#reset-form");
  if (resetForm) {
    if (!sessionStorage.getItem(TICKET_KEY)) {
      resetForm.closest(".card").classList.add("d-none");
      alertBox.innerHTML = 'Phiên đặt lại mật khẩu không còn hiệu lực. <a href="forgot-password.html">Yêu cầu mã mới</a>';
      alertBox.className = "alert alert-warning";
      return;
    }

    resetForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const password = document.querySelector("#new-password").value;
      const confirmPassword = document.querySelector("#confirm-password").value;
      if (password !== confirmPassword) return message("Mật khẩu nhập lại không khớp");
      try {
        const result = await post("reset-password", {
          reset_ticket: sessionStorage.getItem(TICKET_KEY),
          password,
          confirm_password: confirmPassword,
        });
        sessionStorage.removeItem(TICKET_KEY);
        sessionStorage.removeItem(EMAIL_KEY);
        message(result.message + " Đang chuyển về trang đăng nhập...", "success");
        resetForm.querySelector("button[type=submit]").disabled = true;
        setTimeout(() => { location.href = "account.html"; }, 1800);
      } catch (error) { message(error.message); }
    });
  }
});
