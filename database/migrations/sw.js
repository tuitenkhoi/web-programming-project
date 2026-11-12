"use strict";

/* =========================================================
   SERVICE WORKER - MỘC COFFEE
   JS thuần, không build step. File này nằm ở GỐC dự án để scope là "/".
   Phần "logic thuần" (classifyRequest, normalizeUrl...) được export cho Node test;
   phần gắn sự kiện chỉ chạy khi file được nạp trong service worker thật.

   Chiến lược:
   - Trang HTML (khách)        : network-first, mất mạng thì trả bản cache + báo "Đang ngoại tuyến".
   - /api/products|tags|categories|reviews|tables (GET): network-first, cache theo URL đã chuẩn hóa.
   - /uploads/**               : cache-first.
   - /assets/** css, js        : network-first (sửa code là thấy ngay); ảnh, font: cache-first.
   - CDN (Bootstrap, icon, Google Fonts): cache-first, precache khi cài đặt.
   - POST/PUT/PATCH/DELETE, /admin/**, /api/auth, /api/orders, /socket.io...: KHÔNG đụng vào.
========================================================= */

// Đổi số này khi thay đổi danh sách precache để cache cũ bị xóa.
const CACHE_VERSION = "v1";

const CACHE_NAMES = {
  pages: `moc-pages-${CACHE_VERSION}`,
  api: `moc-api-${CACHE_VERSION}`,
  static: `moc-static-${CACHE_VERSION}`,
  uploads: `moc-uploads-${CACHE_VERSION}`,
};

// Số mục tối đa mỗi cache để không phình dung lượng
const MAX_ENTRIES = { pages: 60, api: 120, static: 200, uploads: 120 };

// ----- Danh sách precache (đường dẫn tương đối gốc site, KHÔNG có host/port) -----
const PRECACHE_PAGES = [
  "/",
  "/index.html",
  "/pages/account.html",
  "/pages/booking.html",
  "/pages/cart.html",
  "/pages/forgot-password.html",
  "/pages/menu.html",
  "/pages/payment.html",
  "/pages/product-detail.html",
  "/pages/reset-password.html",
  "/pages/success.html",
];

const PRECACHE_STATIC = [
  "/assets/css/style.css",
  "/assets/css/responsive.css",
  "/assets/css/theme.css",
  "/assets/css/pages.css",
  "/assets/css/mobile-fixes.css",
  "/assets/js/prefs.js",
  "/assets/js/client-api.js",
  "/assets/js/main.js",
  "/assets/js/effects.js",
  "/assets/js/customer-greeting.js",
  "/assets/js/home.js",
  "/assets/js/menu.js",
  "/assets/js/product-badges.js",
  "/assets/js/product-detail.js",
  "/assets/js/product-reviews.js",
  "/assets/js/lightbox.js",
  "/assets/js/cart.js",
  "/assets/js/confirm-modal.js",
  "/assets/js/booking.js",
  "/assets/js/payment.js",
  "/assets/js/payment-qr.js",
  "/assets/js/vendor/qrcode.js",
  "/assets/js/success.js",
  "/assets/js/account.js",
  "/assets/js/password-reset.js",
  "/assets/js/pwa.js",
  "/assets/images/products/default-product.jpg",
  "/assets/images/icons/icon-192.png",
  "/assets/images/icons/icon-512.png",
];

// Tài nguyên CDN mà các trang đang nạp (giữ khớp với <link>/<script> trong HTML).
const PRECACHE_CDN = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap",
];

const CDN_HOSTS = new Set(["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"]);

// Chỉ các API công khai, dùng để hiển thị nội dung. KHÔNG có /api/bookings (GET cần token admin, chứa dữ liệu cá nhân),
// /api/orders, /api/auth, /api/customer, /api/dashboard, /api/admin...
const API_CACHEABLE = /^\/api\/(products|tags|categories|reviews|tables)(\/|$)/;
const API_EXCLUDED = /^\/api\/products\/admin(\/|$)/;

const IMAGE_FONT_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;
const CODE_EXT = /\.(css|js)$/i;

const OFFLINE_MESSAGE = "Bạn đang ngoại tuyến và dữ liệu này chưa được lưu.";

// ----- Logic thuần (test được bằng Node) -----

// Chuẩn hóa URL làm khóa cache: bỏ #hash, sắp xếp tham số truy vấn, bỏ "/" cuối (trừ gốc).
function normalizeUrl(input, base) {
  const url = new URL(input, base); // input tuyệt đối thì bỏ qua base; đường dẫn gốc ("/x") thì truyền origin vào base
  const params = Array.from(url.searchParams.entries()).sort((a, b) =>
    a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1
  );
  const query = new URLSearchParams(params).toString();
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  return `${url.origin}${pathname}${query ? `?${query}` : ""}`;
}

// Quyết định cách xử lý một request. Trả null = để trình duyệt tự xử lý (không đụng vào).
//   strategy : "network-first" | "cache-first"
//   cache    : khóa trong CACHE_NAMES
//   store    : có ghi phản hồi vào cache hay không
function classifyRequest(info, origin) {
  if (!info || String(info.method).toUpperCase() !== "GET") return null;
  if (info.hasRange) return null; // video/pdf tải từng đoạn: không cache

  let url;
  try {
    url = new URL(info.url);
  } catch {
    return null;
  }

  if (url.origin !== origin) {
    return CDN_HOSTS.has(url.hostname)
      ? { strategy: "cache-first", cache: "static", store: true }
      : null;
  }

  const path = url.pathname;

  if (path === "/sw.js" || path === "/manifest.webmanifest") return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  if (path.startsWith("/socket.io")) return null;

  if (path.startsWith("/api/")) {
    if (!API_CACHEABLE.test(path) || API_EXCLUDED.test(path)) return null;
    let fromAdminPage = false;
    try {
      fromAdminPage = info.referrer ? new URL(info.referrer).pathname.startsWith("/admin/") : false;
    } catch {
      fromAdminPage = false;
    }
    // Trang quản trị dùng chung API này nhưng dữ liệu của nó không được lưu cho khách
    return { strategy: "network-first", cache: "api", store: !fromAdminPage, timeoutMs: 6000 };
  }

  if (path.startsWith("/uploads/")) {
    return { strategy: "cache-first", cache: "uploads", store: true };
  }

  if (path.startsWith("/assets/")) {
    if (IMAGE_FONT_EXT.test(path)) return { strategy: "cache-first", cache: "static", store: true };
    if (CODE_EXT.test(path)) return { strategy: "network-first", cache: "static", store: true, timeoutMs: 6000 };
    return null;
  }

  if (info.mode === "navigate") {
    return { strategy: "network-first", cache: "pages", store: true, ignoreSearch: true, page: true, timeoutMs: 6000 };
  }

  return null;
}

function isCacheable(response, plan) {
  if (!response) return false;
  if (response.type === "opaque") return true; // CDN nạp kiểu no-cors
  if (response.status !== 200) return false; // 206/3xx/4xx/5xx không lưu
  if (plan && plan.page && response.redirected) return false;
  return true;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_VERSION,
    CACHE_NAMES,
    PRECACHE_PAGES,
    PRECACHE_STATIC,
    PRECACHE_CDN,
    normalizeUrl,
    classifyRequest,
    isCacheable,
  };
}

// ----- Phần chạy trong service worker -----
if (typeof self !== "undefined" && typeof window === "undefined" && typeof self.addEventListener === "function") {
  const offlinePage = () =>
    new Response(
      '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
        "<title>Đang ngoại tuyến - Mộc Coffee</title></head>" +
        '<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem;background:#faf8f5;color:#3e2723">' +
        "<h1>Đang ngoại tuyến</h1><p>Trang này chưa được lưu trên thiết bị. Hãy kết nối mạng rồi thử lại.</p>" +
        '<p><a href="/">Về trang chủ</a></p></body></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );

  const offlineJson = () =>
    new Response(JSON.stringify({ success: false, message: OFFLINE_MESSAGE }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Moc-Offline": "1" },
    });

  async function announceOffline() {
    const windows = await self.clients.matchAll({ type: "window" });
    windows.forEach((client) => client.postMessage({ type: "moc-offline-fallback" }));
  }

  async function trim(cacheKey) {
    const cache = await caches.open(CACHE_NAMES[cacheKey]);
    const keys = await cache.keys();
    const extra = keys.length - MAX_ENTRIES[cacheKey];
    for (let i = 0; i < extra; i += 1) await cache.delete(keys[i]);
  }

  async function save(plan, key, response) {
    const cache = await caches.open(CACHE_NAMES[plan.cache]);
    await cache.put(key, response);
    await trim(plan.cache);
  }

  async function networkFirst(event, plan, key) {
    const request = event.request;
    const cache = await caches.open(CACHE_NAMES[plan.cache]);
    const cached = await cache.match(key, { ignoreSearch: Boolean(plan.ignoreSearch), ignoreVary: true });
    let timer;

    try {
      const network = fetch(request);
      // Có bản cache thì không chờ mạng chập chờn quá lâu
      const response = cached
        ? await Promise.race([
            network,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("timeout")), plan.timeoutMs);
            }),
          ])
        : await network;
      clearTimeout(timer);
      if (plan.store && isCacheable(response, plan)) event.waitUntil(save(plan, key, response.clone()));
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (cached) {
        event.waitUntil(announceOffline());
        return cached;
      }
      if (plan.page) {
        // Trang chưa từng xem: trả thông báo, không giả làm trang khác
        event.waitUntil(announceOffline());
        return offlinePage();
      }
      if (plan.cache === "api") {
        event.waitUntil(announceOffline());
        return offlineJson();
      }
      return Response.error();
    }
  }

  async function cacheFirst(event, plan, key) {
    const cache = await caches.open(CACHE_NAMES[plan.cache]);
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    try {
      const response = await fetch(event.request);
      if (plan.store && isCacheable(response, plan)) event.waitUntil(save(plan, key, response.clone()));
      return response;
    } catch (error) {
      return Response.error();
    }
  }

  // Tải trước một file CSS và các font/ảnh nó tham chiếu (url(...)) để lần mở đầu tiên khi mất mạng vẫn đủ icon + chữ.
  async function precacheCssWithAssets(cache, cssUrl) {
    const response = await fetch(cssUrl, { mode: "cors" });
    if (!response.ok) return;
    const text = await response.clone().text();
    await cache.put(normalizeUrl(cssUrl), response);

    const found = new Set();
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (/^data:/i.test(match[1])) continue;
      if (/\.(woff|ttf|eot)(\?|#|$)/i.test(match[1])) continue; // trình duyệt có service worker đều dùng được woff2
      found.add(new URL(match[1], cssUrl).href);
    }
    await Promise.allSettled(
      Array.from(found).map(async (assetUrl) => {
        const asset = await fetch(assetUrl, { mode: "cors" });
        if (asset.ok) await cache.put(normalizeUrl(assetUrl), asset);
      })
    );
  }

  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const [pages, statics] = await Promise.all([
          caches.open(CACHE_NAMES.pages),
          caches.open(CACHE_NAMES.static),
        ]);

        // allSettled: thiếu 1 file thì service worker vẫn cài được, file đó sẽ được cache khi truy cập lần đầu
        await Promise.allSettled([
          ...PRECACHE_PAGES.map(async (path) => {
            const response = await fetch(path, { cache: "reload" });
            if (isCacheable(response, { page: true })) await pages.put(normalizeUrl(path, self.location.origin), response);
          }),
          ...PRECACHE_STATIC.map(async (path) => {
            const response = await fetch(path, { cache: "reload" });
            if (isCacheable(response)) await statics.put(normalizeUrl(path, self.location.origin), response);
          }),
          ...PRECACHE_CDN.map((url) =>
            /\.css($|\?)|css2\?/.test(url)
              ? precacheCssWithAssets(statics, url)
              : fetch(url, { mode: "cors" }).then((response) => {
                  if (response.ok) return statics.put(normalizeUrl(url), response);
                  return undefined;
                })
          ),
        ]);
        // Không gọi skipWaiting ở đây: bản mới chờ người dùng bấm "Tải lại" (xem pwa.js)
      })()
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const current = new Set(Object.values(CACHE_NAMES));
        const names = await caches.keys();
        await Promise.all(
          names.filter((name) => name.startsWith("moc-") && !current.has(name)).map((name) => caches.delete(name))
        );
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  });

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const plan = classifyRequest(
      {
        url: request.url,
        method: request.method,
        mode: request.mode,
        referrer: request.referrer,
        hasRange: request.headers.has("range"),
      },
      self.location.origin
    );
    if (!plan) return; // POST/PUT/PATCH/DELETE, admin, API riêng tư...: đi thẳng mạng

    const key = normalizeUrl(request.url);
    event.respondWith(plan.strategy === "cache-first" ? cacheFirst(event, plan, key) : networkFirst(event, plan, key));
  });
}
