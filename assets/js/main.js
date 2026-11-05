"use strict";

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     1. CÁC HÀM TIỆN ÍCH
  ========================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  function formatCurrency(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(number);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function generateCode(prefix = "MC") {
    const timePart = Date.now()
      .toString()
      .slice(-6);

    const randomPart = Math.floor(
      Math.random() * 90 + 10
    );

    return `${prefix}${timePart}${randomPart}`;
  }

  function getCurrentDateTime() {
    const now = new Date();

    return {
      iso: now.toISOString(),

      date: now.toLocaleDateString("vi-VN"),

      time: now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),

      full: now.toLocaleString("vi-VN"),
    };
  }

  /* =========================================================
     2. QUẢN LÝ GIỎ HÀNG DÙNG CHUNG
  ========================================================= */

  const CART_STORAGE_KEY = "mocCoffeeCart";

  function loadCart() {
    try {
      const storedCart = localStorage.getItem(
        CART_STORAGE_KEY
      );

      if (!storedCart) {
        return [];
      }

      const parsedCart = JSON.parse(storedCart);

      return Array.isArray(parsedCart)
        ? parsedCart
        : [];
    } catch (error) {
      console.error(
        "Không thể đọc dữ liệu giỏ hàng:",
        error
      );

      return [];
    }
  }

  function saveCart(cart) {
    const validCart = Array.isArray(cart)
      ? cart
      : [];

    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(validCart)
    );

    /*
     * Thông báo cho các phần khác trên cùng trang biết
     * giỏ hàng vừa thay đổi.
     */
    window.dispatchEvent(
      new CustomEvent("mocCoffeeCartUpdated", {
        detail: {
          cart: validCart,
        },
      })
    );

    updateCartCount(validCart);
  }

  function getTotalCartQuantity(cart = loadCart()) {
    return cart.reduce(function (total, item) {
      const quantity = Math.max(
        1,
        Number(item.quantity || 1)
      );

      return total + quantity;
    }, 0);
  }

  function updateCartCount(cart = loadCart()) {
    const cartCountElements = $$("#cart-count");
    const totalQuantity = getTotalCartQuantity(cart);

    cartCountElements.forEach(function (element) {
      element.textContent = totalQuantity;

      element.classList.toggle(
        "d-none",
        totalQuantity === 0
      );

      element.setAttribute(
        "aria-label",
        `${totalQuantity} sản phẩm trong giỏ hàng`
      );
    });
  }

  function createCartKey(item) {
    if (item.cartKey) {
      return String(item.cartKey);
    }

    const toppings = Array.isArray(item.toppings)
      ? item.toppings
        .map(function (topping) {
          if (typeof topping === "string") {
            return topping;
          }

          return topping.name || "";
        })
        .filter(Boolean)
        .sort()
        .join("-")
      : "";

    return [
      item.id,
      item.size || "M",
      item.sugar || "70%",
      item.ice || "70%",
      toppings,
      item.note || "",
    ].join("|");
  }

  function addToCart(product) {
    const cart = loadCart();

    const cartItem = {
      id: String(
        product.id ||
        product.productId ||
        Date.now()
      ),

      name:
        product.name ||
        product.productName ||
        "Sản phẩm",

      image:
        product.image ||
        product.imageUrl ||
        "../assets/images/products/default-product.jpg",

      price: Number(
        product.price ||
        product.finalPrice ||
        product.unitPrice ||
        0
      ),

      quantity: Math.max(
        1,
        Number(product.quantity || 1)
      ),

      size: product.size || "M",

      sugar:
        product.sugar ||
        product.sugarLevel ||
        "70%",

      ice:
        product.ice ||
        product.iceLevel ||
        "70%",

      toppings: Array.isArray(product.toppings)
        ? product.toppings
        : [],

      note: product.note || "",

      options: product.options || "",
    };

    cartItem.cartKey = createCartKey(cartItem);

    const existingItem = cart.find(
      (item) =>
        createCartKey(item) === cartItem.cartKey
    );

    if (existingItem) {
      existingItem.quantity =
        Number(existingItem.quantity || 1) +
        cartItem.quantity;
    } else {
      cart.push(cartItem);
    }

    saveCart(cart);

    return cartItem;
  }

  function removeFromCart(cartKey) {
    const cart = loadCart();

    const newCart = cart.filter(
      (item) => createCartKey(item) !== cartKey
    );

    saveCart(newCart);

    return newCart;
  }

  function clearCart() {
    localStorage.removeItem(CART_STORAGE_KEY);

    window.dispatchEvent(
      new CustomEvent("mocCoffeeCartUpdated", {
        detail: {
          cart: [],
        },
      })
    );

    updateCartCount([]);
  }

  /*
   * Các hàm này được gắn vào window để menu.js,
   * product-detail.js, cart.js có thể sử dụng.
   */
  window.MocCoffee = {
    formatCurrency,
    normalizeText,
    generateCode,
    getCurrentDateTime,
    loadCart,
    saveCart,
    addToCart,
    removeFromCart,
    clearCart,
    createCartKey,
    updateCartCount,
    getTotalCartQuantity,
  };

  updateCartCount();

  /*
   * Cập nhật số lượng giỏ hàng nếu localStorage thay đổi
   * từ một tab trình duyệt khác.
   */
  window.addEventListener(
    "storage",
    function (event) {
      if (event.key === CART_STORAGE_KEY) {
        updateCartCount();
      }
    }
  );

  window.addEventListener(
    "mocCoffeeCartUpdated",
    function (event) {
      updateCartCount(event.detail?.cart);
    }
  );

  /* =========================================================
     3. HIỂN THỊ NĂM HIỆN TẠI
  ========================================================= */

  const currentYear = new Date().getFullYear();

  $$(
    "#current-year, .current-year, [data-current-year]"
  ).forEach(function (element) {
    element.textContent = currentYear;
  });

  /* =========================================================
     4. NÚT QUAY LẠI ĐẦU TRANG
  ========================================================= */

  const backToTopButton = $("#back-to-top");

  function updateBackToTopButton() {
    if (!backToTopButton) {
      return;
    }

    const shouldShow = window.scrollY > 400;

    backToTopButton.classList.toggle(
      "show",
      shouldShow
    );

    backToTopButton.classList.toggle(
      "d-none",
      !shouldShow
    );
  }

  if (backToTopButton) {
    backToTopButton.classList.add("d-none");

    backToTopButton.addEventListener(
      "click",
      function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    );

    window.addEventListener(
      "scroll",
      updateBackToTopButton,
      {
        passive: true,
      }
    );

    updateBackToTopButton();
  }

  /* =========================================================
     5. HIỆU ỨNG THANH ĐIỀU HƯỚNG
  ========================================================= */

  const mainNavbar = $(".navbar.fixed-top");

  function updateNavbarStyle() {
    if (!mainNavbar) {
      return;
    }

    mainNavbar.classList.toggle(
      "navbar-scrolled",
      window.scrollY > 50
    );
  }

  window.addEventListener(
    "scroll",
    updateNavbarStyle,
    {
      passive: true,
    }
  );

  updateNavbarStyle();

  /* =========================================================
     6. ĐÓNG MENU BOOTSTRAP TRÊN ĐIỆN THOẠI
  ========================================================= */

  const navbarCollapse = $("#mainNavbar");

  if (
    navbarCollapse &&
    typeof bootstrap !== "undefined"
  ) {
    const navbarLinks = $$(
      ".navbar-nav .nav-link, .navbar-nav .btn",
      navbarCollapse
    );

    navbarLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        if (
          window.innerWidth < 992 &&
          navbarCollapse.classList.contains("show")
        ) {
          const collapse =
            bootstrap.Collapse.getOrCreateInstance(
              navbarCollapse
            );

          collapse.hide();
        }
      });
    });
  }

  /* =========================================================
     7. CUỘN MƯỢT ĐẾN CÁC SECTION
  ========================================================= */

  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      const targetId = this.getAttribute("href");

      /*
       * Các liên kết href="#" chỉ là liên kết minh họa.
       */
      if (!targetId || targetId === "#") {
        event.preventDefault();
        return;
      }

      const targetElement =
        document.querySelector(targetId);

      if (!targetElement) {
        return;
      }

      event.preventDefault();

      const navbarHeight =
        mainNavbar?.offsetHeight || 0;

      const targetPosition =
        targetElement.getBoundingClientRect().top +
        window.scrollY -
        navbarHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });

      /*
       * Cập nhật URL nhưng không tải lại trang.
       */
      history.pushState(null, "", targetId);
    });
  });

  /* =========================================================
     8. ĐÁNH DẤU MENU HIỆN TẠI
  ========================================================= */

  function setActiveNavigation() {
    const currentFile =
      window.location.pathname
        .split("/")
        .pop() || "index.html";

    const navigationLinks = $$(
      ".navbar-nav .nav-link"
    );

    navigationLinks.forEach(function (link) {
      const href = link
        .getAttribute("href")
        ?.split("?")[0]
        .split("#")[0];

      if (!href) {
        return;
      }

      const linkFile =
        href.split("/").pop() || "index.html";

      /*
       * Không tự đánh dấu liên kết anchor như
       * Giới thiệu và Liên hệ.
       */
      if (
        link.getAttribute("href").includes("#")
      ) {
        return;
      }

      link.classList.toggle(
        "active",
        linkFile === currentFile
      );
    });
  }

  setActiveNavigation();

  /* =========================================================
     9. BOOTSTRAP TOOLTIP
  ========================================================= */

  if (typeof bootstrap !== "undefined") {
    $$('[data-bs-toggle="tooltip"]').forEach(
      function (element) {
        bootstrap.Tooltip.getOrCreateInstance(
          element
        );
      }
    );
  }

  /* =========================================================
     10. XỬ LÝ ẢNH LỖI
  ========================================================= */

  const isInsideSubFolder =
    window.location.pathname.includes("/pages/") ||
    window.location.pathname.includes("/admin/");

  const defaultProductImage = isInsideSubFolder
    ? "../assets/images/products/default-product.jpg"
    : "assets/images/products/default-product.jpg";

  $$(
    ".product-card img, " +
    ".cart-product-image, " +
    ".payment-item-image, " +
    ".result-product-image, " +
    ".admin-product-image"
  ).forEach(function (image) {
    image.addEventListener(
      "error",
      function () {
        /*
         * Ngăn lặp vô hạn nếu chính ảnh mặc định cũng thiếu.
         */
        if (this.dataset.fallbackApplied === "true") {
          return;
        }

        this.dataset.fallbackApplied = "true";
        this.src = defaultProductImage;
      },
      {
        once: true,
      }
    );
  });

  /* =========================================================
     11. CHỐNG GỬI FORM NHIỀU LẦN
  ========================================================= */

  $$("form[data-prevent-double-submit]").forEach(
    function (form) {
      form.addEventListener("submit", function () {
        const submitButton = form.querySelector(
          'button[type="submit"]'
        );

        if (!submitButton) {
          return;
        }

        submitButton.disabled = true;

        window.setTimeout(function () {
          submitButton.disabled = false;
        }, 1500);
      });
    }
  );

  /* =========================================================
     12. HIỂN THỊ THÔNG BÁO CHUNG
  ========================================================= */

  window.showMocCoffeeToast = function (
    message,
    options = {}
  ) {
    const toastElement =
      document.querySelector(
        options.toastSelector || "#cart-toast"
      ) ||
      document.querySelector("#copy-toast") ||
      document.querySelector("#admin-toast");

    if (
      !toastElement ||
      typeof bootstrap === "undefined"
    ) {
      return;
    }

    const messageElement =
      toastElement.querySelector(
        options.messageSelector ||
        ".toast-body"
      );

    if (messageElement) {
      messageElement.textContent = message;
    }

    bootstrap.Toast.getOrCreateInstance(
      toastElement
    ).show();
  };

  /* =========================================================
     13. ĐỊNH DẠNG CÁC Ô SỐ ĐIỆN THOẠI
  ========================================================= */

  $$('input[type="tel"]').forEach(function (input) {
    input.addEventListener("input", function () {
      this.value = this.value
        .replace(/\D/g, "")
        .slice(0, 10);
    });
  });

  /* =========================================================
     14. THEO DÕI KẾT NỐI MẠNG
  ========================================================= */

  function showConnectionMessage(message, type) {
    let alertElement =
      document.querySelector("#connection-alert");

    if (!alertElement) {
      alertElement = document.createElement("div");

      alertElement.id = "connection-alert";

      alertElement.className =
        "connection-alert alert position-fixed " +
        "top-0 start-50 translate-middle-x mt-3 shadow";

      alertElement.style.zIndex = "2000";

      document.body.appendChild(alertElement);
    }

    alertElement.className =
      "connection-alert alert position-fixed " +
      "top-0 start-50 translate-middle-x mt-3 shadow " +
      (type === "success"
        ? "alert-success"
        : "alert-warning");

    alertElement.innerHTML =
      `<i class="bi ${type === "success"
        ? "bi-wifi"
        : "bi-wifi-off"
      } me-2"></i>${message}`;

    alertElement.classList.remove("d-none");

    window.setTimeout(function () {
      alertElement.classList.add("d-none");
    }, 3000);
  }

  window.addEventListener("offline", function () {
    showConnectionMessage(
      "Bạn đang ngoại tuyến. Một số chức năng có thể không hoạt động.",
      "warning"
    );
  });

  window.addEventListener("online", function () {
    showConnectionMessage(
      "Kết nối mạng đã được khôi phục.",
      "success"
    );
  });
});