"use strict";

/* =========================================================
   PWA - MỘC COFFEE
   - Đăng ký service worker (sw.js ở gốc, scope "/") khi DOMContentLoaded.
   - Có bản mới: hiện thông báo "Đã có bản mới" + nút Tải lại (không tự tải lại để khỏi mất dữ liệu đang nhập).
   - Mất mạng (hoặc phải lấy bản cache): hiện badge "Đang ngoại tuyến".
   Chỉ dùng class Bootstrap có sẵn, không thêm CSS.
========================================================= */

(function () {
  const OFFLINE_BADGE_ID = "moc-offline-badge";
  const UPDATE_BANNER_ID = "moc-update-banner";

  // ----- Badge ngoại tuyến -----
  function ensureOfflineBadge() {
    let badge = document.getElementById(OFFLINE_BADGE_ID);
    if (badge) return badge;

    badge = document.createElement("div");
    badge.id = OFFLINE_BADGE_ID;
    badge.className = "badge text-bg-warning position-fixed bottom-0 start-0 m-3 shadow z-3 d-none";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");

    const icon = document.createElement("i");
    icon.className = "bi bi-wifi-off me-1";
    icon.setAttribute("aria-hidden", "true");
    badge.append(icon, document.createTextNode("Đang ngoại tuyến"));

    document.body.appendChild(badge);
    return badge;
  }

  function setOffline(isOffline) {
    ensureOfflineBadge().classList.toggle("d-none", !isOffline);
  }

  // ----- Thông báo có bản mới -----
  function showUpdateBanner(worker) {
    if (document.getElementById(UPDATE_BANNER_ID)) return;

    const banner = document.createElement("div");
    banner.id = UPDATE_BANNER_ID;
    banner.className = "alert alert-info d-flex align-items-center gap-2 position-fixed bottom-0 end-0 m-3 shadow z-3";
    banner.setAttribute("role", "alert");

    const text = document.createElement("span");
    text.textContent = "Đã có bản mới — tải lại";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-dark";
    button.textContent = "Tải lại";
    button.addEventListener("click", function () {
      button.disabled = true;
      worker.postMessage({ type: "SKIP_WAITING" });
    });

    banner.append(text, button);
    document.body.appendChild(banner);
  }

  // ----- Đăng ký service worker -----
  function registerServiceWorker() {
    // Service worker chỉ chạy trên HTTPS hoặc địa chỉ loopback của máy; nơi khác thì bỏ qua êm, trang vẫn hoạt động bình thường
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener("message", function (event) {
      if (event.data && event.data.type === "moc-offline-fallback") setOffline(true);
    });

    // sw.js phải ở gốc site để scope là "/" cho mọi trang (kể cả /pages/...)
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(function (registration) {
        // Trang mở lên mà đã có bản mới đang chờ
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdateBanner(registration.waiting);
        }

        registration.addEventListener("updatefound", function () {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", function () {
            // Lần cài đầu tiên chưa có controller: không cần hỏi
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(installing);
            }
          });
        });
      })
      .catch(function (error) {
        console.warn("Không đăng ký được service worker:", error && error.message);
      });
  }

  function init() {
    window.addEventListener("offline", function () { setOffline(true); });
    window.addEventListener("online", function () { setOffline(false); });
    if (!navigator.onLine) setOffline(true);

    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
