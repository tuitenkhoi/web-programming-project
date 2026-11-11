"use strict";

(function () {
  const CUSTOMER_TOKEN_KEY = "mocCoffeeCustomerToken";
  const CUSTOMER_PROFILE_KEY = "mocCoffeeCustomerProfile";
  const API_ORIGIN = window.location.origin;
  const API_BASE_URL = `${API_ORIGIN}/api`;

  async function request(path, options = {}) {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        // FormData (upload file) thì để trình duyệt tự đặt Content-Type kèm boundary
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json; charset=utf-8" }
          : {}),
        ...(options.headers || {}),
        ...(token && options.auth !== false
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      body: !options.body
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
    });

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Phản hồi từ máy chủ không hợp lệ.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || "Không thể kết nối đến máy chủ."
      );
    }

    return result;
  }

  function setCustomerSession(data) {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(data.user));
  }

  function clearCustomerSession() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  }

  // Đăng xuất thật: gọi API thu hồi token trước, rồi mới xóa localStorage (lỗi mạng vẫn xóa cục bộ)
  async function customerLogout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch (error) {
      /* token hết hạn/mất mạng: bỏ qua, vẫn đăng xuất phía trình duyệt */
    }
    clearCustomerSession();
  }

  // Đường dẫn ảnh đại diện; chưa có thì dùng ảnh mặc định
  function avatarUrl(avatar, insidePages = true) {
    if (avatar) return `${API_ORIGIN}${avatar}`;
    return insidePages ? "../assets/images/default-avatar.png" : "assets/images/default-avatar.png";
  }

  // Gửi hồ sơ mới (FormData: full_name, phone, avatar) rồi cập nhật bản lưu trong trình duyệt
  async function updateProfile(formData) {
    const result = await request("/auth/customer/me", { method: "PATCH", body: formData });
    const current = getCustomerProfile() || {};
    const profile = { ...current, full_name: result.data.full_name, phone: result.data.phone || "", avatar: result.data.avatar || "" };
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
    return result.data;
  }


  // ----- Guard phía khách: trang nào cần đăng nhập thì gọi MocAuthGuard.requireLogin() ở đầu trang -----
  // Chưa có token: nhớ trang hiện tại, báo "Bạn cần đăng nhập để tiếp tục" rồi chuyển sang trang đăng nhập.
  // Đăng nhập xong thì account-ui.js gọi afterLoginUrl() để quay lại đúng trang đó.
  const AFTER_LOGIN_KEY = "mocAfterLogin";

  // Chỉ nhận đường dẫn nội bộ ("/..." hoặc "pages/..."), chặn "//evil.com" và "http://..." (open redirect)
  function isSafeInternalPath(path) {
    return typeof path === "string" && path.length > 0 && path.length < 500 &&
      !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith("//") && !path.includes("\\");
  }

  function showGuardToast(text) {
    const toast = document.createElement("div");
    toast.setAttribute("role", "alert");
    toast.className = "alert alert-warning shadow position-fixed top-0 start-50 translate-middle-x mt-5";
    toast.style.zIndex = "2000";
    toast.textContent = text;
    document.body.appendChild(toast);
  }

  const MocAuthGuard = {
    // Trả true nếu đã đăng nhập. Chưa đăng nhập: trả false và đang chuyển trang (code phía sau nên dừng lại).
    requireLogin(options = {}) {
      if (localStorage.getItem(CUSTOMER_TOKEN_KEY)) return true;

      const current = window.location.pathname + window.location.search;
      try { sessionStorage.setItem(AFTER_LOGIN_KEY, current); } catch (error) { /* bỏ qua */ }

      const loginPage = options.redirectTo || "/pages/account.html";
      const target = `${loginPage}?login=1&next=${encodeURIComponent(current)}`;

      showGuardToast("Bạn cần đăng nhập để tiếp tục");
      setTimeout(() => { window.location.href = target; }, 1200);
      return false;
    },

    // Địa chỉ cần quay lại sau khi đăng nhập (đọc 1 lần rồi xóa); không có thì trả fallback
    afterLoginUrl(fallback) {
      let saved = null;
      try {
        saved = sessionStorage.getItem(AFTER_LOGIN_KEY);
        sessionStorage.removeItem(AFTER_LOGIN_KEY);
      } catch (error) { /* bỏ qua */ }

      const next = new URLSearchParams(window.location.search).get("next");
      const candidate = saved || next;
      return isSafeInternalPath(candidate) ? candidate : fallback;
    },
  };

  function getCustomerProfile() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOMER_PROFILE_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function customerLogin(email, password) {
    const result = await request("/auth/customer/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    setCustomerSession(result.data);
    return result.data;
  }

  async function customerRegister(payload) {
    const result = await request("/auth/customer/register", {
      method: "POST", body: payload, auth: false,
    });
    setCustomerSession(result.data);
    return result.data;
  }

  function resolveProductImage(product, insidePages = true) {
    const fallback = insidePages
      ? "../assets/images/products/default-product.jpg"
      : "assets/images/products/default-product.jpg";

    const image = product?.image_url || product?.image || "";

    if (!image) {
      return fallback;
    }

    if (/^https?:\/\//i.test(image)) {
      return image;
    }

    if (image.startsWith("/uploads/")) {
      return `${API_ORIGIN}${image}`;
    }

    if (image.startsWith("assets/")) {
      return insidePages ? `../${image}` : image;
    }

    if (image.startsWith("../assets/")) {
      return insidePages ? image : image.replace(/^\.\.\//, "");
    }

    return insidePages
      ? `../assets/images/products/${image}`
      : `assets/images/products/${image}`;
  }

  function normalizeProduct(product, insidePages = true) {
    return {
      id: Number(product.id),
      categoryId: Number(product.category_id),
      categoryName: product.category_name || "Chưa phân loại",
      name: product.name || "Sản phẩm",
      slug: product.slug || String(product.id),
      description: product.description || "",
      price: Number(product.price) || 0,
      image: resolveProductImage(product, insidePages),
      status: Number(product.status ?? 1),
    };
  }

  async function getProducts(options = {}) {
    const searchParams = new URLSearchParams();

    if (options.search) {
      searchParams.set("search", options.search);
    }

    if (options.categoryId) {
      searchParams.set("category_id", options.categoryId);
    }

    const query = searchParams.toString();
    const result = await request(
      `/products${query ? `?${query}` : ""}`
    );

    return result.data || [];
  }

  async function getProductById(productId) {
    const result = await request(
      `/products/${encodeURIComponent(productId)}`
    );

    return result.data;
  }

  async function createOrder(order) {
    const result = await request("/orders", {
      method: "POST",
      body: order,
    });

    return result.data;
  }

  // Gửi yêu cầu đặt bàn lên server
  async function createBooking(booking) {
    const result = await request("/bookings", {
      method: "POST",
      body: booking,
    });

    return result.data;
  }

  window.MocAuthGuard = MocAuthGuard;

  window.MocCoffeeApi = {
    API_ORIGIN,
    API_BASE_URL,
    request,
    resolveProductImage,
    normalizeProduct,
    getProducts,
    getProductById,
    createOrder,
    createBooking,
    customerLogin,
    customerRegister,
    setCustomerSession,
    clearCustomerSession,
    customerLogout,
    avatarUrl,
    updateProfile,
    getCustomerProfile,
    changePassword: async (payload) => (await request("/auth/customer/change-password", { method: "POST", body: payload })).message,
    savePreferences: async (payload) => (await request("/auth/customer/preferences", { method: "PATCH", body: payload })).data,
    getMe: async () => (await request("/auth/customer/me")).data,
    getCustomerOrders: async () => (await request("/customer/orders")).data || [],
    lookupOrder: async (payload) => (await request("/customer/orders/lookup", { method: "POST", body: payload, auth: false })).data,
    getVouchers: async () => (await request("/vouchers", { auth: false })).data || [],
    validateVoucher: async (code, subtotal) => (await request("/vouchers/validate", { method: "POST", body: { code, subtotal }, auth: false })).data,
    getProductReviews: async (productId) => request(`/reviews/product/${encodeURIComponent(productId)}`, { auth: false }),
    createReview: async (payload) => request("/reviews", { method: "POST", body: payload }),
  };
})();
