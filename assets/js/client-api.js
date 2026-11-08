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
        ...(options.body
          ? { "Content-Type": "application/json; charset=utf-8" }
          : {}),
        ...(options.headers || {}),
        ...(token && options.auth !== false
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      body: options.body
        ? JSON.stringify(options.body)
        : undefined,
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
    getCustomerProfile,
    getCustomerOrders: async () => (await request("/customer/orders")).data || [],
    lookupOrder: async (payload) => (await request("/customer/orders/lookup", { method: "POST", body: payload, auth: false })).data,
    getVouchers: async () => (await request("/vouchers", { auth: false })).data || [],
    validateVoucher: async (code, subtotal) => (await request("/vouchers/validate", { method: "POST", body: { code, subtotal }, auth: false })).data,
    getProductReviews: async (productId) => request(`/reviews/product/${encodeURIComponent(productId)}`, { auth: false }),
    createReview: async (payload) => request("/reviews", { method: "POST", body: payload }),
  };
})();
