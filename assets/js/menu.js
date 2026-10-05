"use strict";

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     1. LẤY CÁC PHẦN TỬ
  ========================================================= */

  const productList =
    document.querySelector("#product-list");

  const productItems = Array.from(
    document.querySelectorAll(".product-item")
  );

  const searchInput =
    document.querySelector("#search-input");

  const clearSearchButton =
    document.querySelector("#clear-search");

  const categoryFilter =
    document.querySelector("#category-filter");

  const sortFilter =
    document.querySelector("#sort-filter");

  const resetFilterButton =
    document.querySelector("#reset-filter");

  const categoryButtons = Array.from(
    document.querySelectorAll(".category-btn")
  );

  const productCountElement =
    document.querySelector("#product-count");

  const emptyResult =
    document.querySelector("#empty-result");

  const emptyResetFilterButton =
    document.querySelector("#empty-reset-filter");

  const cartCountElement =
    document.querySelector("#cart-count");

  const cartToast =
    document.querySelector("#cart-toast");

  /*
   * Nếu không phải trang menu thì dừng.
   */
  if (
    !productList ||
    productItems.length === 0
  ) {
    return;
  }

  /*
   * Lưu thứ tự ban đầu để khôi phục khi chọn
   * "Sắp xếp mặc định".
   */
  const originalProductOrder = [...productItems];

  let selectedCategory = "all";

  /* =========================================================
     2. CÁC HÀM HỖ TRỢ
  ========================================================= */

  function normalizeText(value) {
    /*
     * Nếu main.js đã cung cấp hàm thì sử dụng.
     */
    if (window.MocCoffee?.normalizeText) {
      return window.MocCoffee.normalizeText(value);
    }

    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function loadCart() {
    if (window.MocCoffee?.loadCart) {
      return window.MocCoffee.loadCart();
    }

    try {
      const storedCart = localStorage.getItem(
        "mocCoffeeCart"
      );

      const parsedCart = storedCart
        ? JSON.parse(storedCart)
        : [];

      return Array.isArray(parsedCart)
        ? parsedCart
        : [];
    } catch (error) {
      return [];
    }
  }

  function saveCart(cart) {
    if (window.MocCoffee?.saveCart) {
      window.MocCoffee.saveCart(cart);
      return;
    }

    localStorage.setItem(
      "mocCoffeeCart",
      JSON.stringify(cart)
    );

    updateCartCount();
  }

  function updateCartCount() {
    if (window.MocCoffee?.updateCartCount) {
      window.MocCoffee.updateCartCount();
      return;
    }

    if (!cartCountElement) {
      return;
    }

    const cart = loadCart();

    const totalQuantity = cart.reduce(
      (total, item) =>
        total + Number(item.quantity || 1),
      0
    );

    cartCountElement.textContent =
      totalQuantity;

    cartCountElement.classList.toggle(
      "d-none",
      totalQuantity === 0
    );
  }

  function createCartKey(product) {
    if (window.MocCoffee?.createCartKey) {
      return window.MocCoffee.createCartKey(product);
    }

    return [
      product.id,
      product.size || "M",
      product.sugar || "70%",
      product.ice || "70%",
      "",
      product.note || "",
    ].join("|");
  }

  function showCartToast(productName) {
    if (!cartToast) {
      return;
    }

    const toastBody =
      cartToast.querySelector(".toast-body");

    if (toastBody) {
      toastBody.textContent =
        `Đã thêm "${productName}" vào giỏ hàng.`;
    }

    if (typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(
        cartToast
      ).show();
    }
  }

  function showButtonSuccess(button) {
    if (!button) {
      return;
    }

    const originalContent = button.innerHTML;

    button.disabled = true;

    button.innerHTML =
      '<i class="bi bi-check-lg"></i>';

    button.classList.remove("btn-coffee");
    button.classList.add("btn-success");

    window.setTimeout(function () {
      button.innerHTML = originalContent;
      button.disabled = false;

      button.classList.remove("btn-success");
      button.classList.add("btn-coffee");
    }, 900);
  }

  /* =========================================================
     3. THÊM MÓN VÀO GIỎ HÀNG
  ========================================================= */

  function addProductToCart(button) {
    const productItem = button.closest(
      ".product-item"
    );

    if (!productItem) {
      return;
    }

    const product = {
      id:
        button.dataset.id ||
        productItem.dataset.id,

      name:
        button.dataset.name ||
        productItem.dataset.name,

      image:
        button.dataset.image ||
        "",

      price: Number(
        button.dataset.price ||
        productItem.dataset.price ||
        0
      ),

      quantity: 1,

      /*
       * Khi thêm nhanh từ menu, dùng tùy chọn mặc định.
       * Khách có thể vào trang chi tiết để chọn lại.
       */
      size: "M",
      sugar: "70%",
      ice: "70%",
      toppings: [],
      note: "",
    };

    product.cartKey = createCartKey(product);

    /*
     * Nếu đã có MocCoffee.addToCart từ main.js
     * thì sử dụng trực tiếp.
     */
    if (window.MocCoffee?.addToCart) {
      window.MocCoffee.addToCart(product);
    } else {
      const cart = loadCart();

      const existingItem = cart.find(
        (item) =>
          (item.cartKey ||
            createCartKey(item)) ===
          product.cartKey
      );

      if (existingItem) {
        existingItem.quantity =
          Number(existingItem.quantity || 1) + 1;
      } else {
        cart.push(product);
      }

      saveCart(cart);
    }

    updateCartCount();
    showCartToast(product.name);
    showButtonSuccess(button);
  }

  document
    .querySelectorAll(".add-to-cart")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          addProductToCart(this);
        }
      );
    });

  /* =========================================================
     4. ĐỒNG BỘ NÚT DANH MỤC
  ========================================================= */

  function updateCategoryButtons() {
    categoryButtons.forEach(function (button) {
      const isActive =
        button.dataset.category ===
        selectedCategory;

      button.classList.toggle(
        "active",
        isActive
      );

      button.classList.toggle(
        "btn-coffee",
        isActive
      );

      button.classList.toggle(
        "btn-outline-coffee",
        !isActive
      );
    });
  }

  function updateCategoryInUrl() {
    const url = new URL(window.location.href);

    if (selectedCategory === "all") {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set(
        "category",
        selectedCategory
      );
    }

    window.history.replaceState(
      {},
      "",
      url
    );
  }

  /* =========================================================
     5. LỌC SẢN PHẨM
  ========================================================= */

  function filterProducts() {
    const keyword = normalizeText(
      searchInput?.value
    );

    let visibleCount = 0;

    productItems.forEach(function (item) {
      const productName = normalizeText(
        item.dataset.name
      );

      const category = item.dataset.category;

      const matchesSearch =
        !keyword ||
        productName.includes(keyword);

      const matchesCategory =
        selectedCategory === "all" ||
        category === selectedCategory;

      const visible =
        matchesSearch && matchesCategory;

      item.classList.toggle(
        "d-none",
        !visible
      );

      /*
       * Thuộc tính aria-hidden hỗ trợ khả năng truy cập.
       */
      item.setAttribute(
        "aria-hidden",
        String(!visible)
      );

      if (visible) {
        visibleCount++;
      }
    });

    if (productCountElement) {
      productCountElement.textContent =
        visibleCount;
    }

    emptyResult?.classList.toggle(
      "d-none",
      visibleCount !== 0
    );
  }

  /* =========================================================
     6. SẮP XẾP SẢN PHẨM
  ========================================================= */

  function sortProducts() {
    const sortValue =
      sortFilter?.value || "default";

    let sortedProducts = [...productItems];

    if (sortValue === "name-asc") {
      sortedProducts.sort(function (
        firstProduct,
        secondProduct
      ) {
        return firstProduct.dataset.name.localeCompare(
          secondProduct.dataset.name,
          "vi"
        );
      });
    }

    if (sortValue === "name-desc") {
      sortedProducts.sort(function (
        firstProduct,
        secondProduct
      ) {
        return secondProduct.dataset.name.localeCompare(
          firstProduct.dataset.name,
          "vi"
        );
      });
    }

    if (sortValue === "price-asc") {
      sortedProducts.sort(function (
        firstProduct,
        secondProduct
      ) {
        return (
          Number(firstProduct.dataset.price) -
          Number(secondProduct.dataset.price)
        );
      });
    }

    if (sortValue === "price-desc") {
      sortedProducts.sort(function (
        firstProduct,
        secondProduct
      ) {
        return (
          Number(secondProduct.dataset.price) -
          Number(firstProduct.dataset.price)
        );
      });
    }

    if (sortValue === "default") {
      sortedProducts = [...originalProductOrder];
    }

    sortedProducts.forEach(function (item) {
      productList.appendChild(item);
    });

    filterProducts();
  }

  /* =========================================================
     7. CHỌN DANH MỤC
  ========================================================= */

  function selectCategory(category, updateUrl = true) {
    const validCategories = [
      "all",
      "coffee",
      "tea",
      "ice-blended",
      "cake",
    ];

    selectedCategory = validCategories.includes(
      category
    )
      ? category
      : "all";

    if (categoryFilter) {
      categoryFilter.value =
        selectedCategory;
    }

    updateCategoryButtons();
    filterProducts();

    if (updateUrl) {
      updateCategoryInUrl();
    }
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener(
      "click",
      function () {
        selectCategory(
          this.dataset.category
        );
      }
    );
  });

  categoryFilter?.addEventListener(
    "change",
    function () {
      selectCategory(this.value);
    }
  );

  /* =========================================================
     8. TÌM KIẾM
  ========================================================= */

  let searchTimer;

  searchInput?.addEventListener(
    "input",
    function () {
      /*
       * Chờ 150ms sau khi người dùng ngừng gõ.
       */
      window.clearTimeout(searchTimer);

      searchTimer = window.setTimeout(
        filterProducts,
        150
      );
    }
  );

  clearSearchButton?.addEventListener(
    "click",
    function () {
      searchInput.value = "";
      searchInput.focus();

      filterProducts();
    }
  );

  /* =========================================================
     9. SẮP XẾP
  ========================================================= */

  sortFilter?.addEventListener(
    "change",
    sortProducts
  );

  /* =========================================================
     10. ĐẶT LẠI BỘ LỌC
  ========================================================= */

  function resetFilters() {
    searchInput.value = "";
    sortFilter.value = "default";

    selectedCategory = "all";
    categoryFilter.value = "all";

    originalProductOrder.forEach(function (item) {
      productList.appendChild(item);
    });

    updateCategoryButtons();
    filterProducts();
    updateCategoryInUrl();
  }

  resetFilterButton?.addEventListener(
    "click",
    resetFilters
  );

  emptyResetFilterButton?.addEventListener(
    "click",
    resetFilters
  );

  /* =========================================================
     11. ĐỌC DANH MỤC TỪ URL
  ========================================================= */

  function initializeCategoryFromUrl() {
    const urlParams = new URLSearchParams(
      window.location.search
    );

    const categoryFromUrl =
      urlParams.get("category");

    if (categoryFromUrl) {
      selectCategory(
        categoryFromUrl,
        false
      );
    } else {
      selectCategory("all", false);
    }
  }

  /* =========================================================
     12. HỖ TRỢ PHÍM TẮT
  ========================================================= */

  document.addEventListener(
    "keydown",
    function (event) {
      /*
       * Nhấn Ctrl + K hoặc Command + K để tìm kiếm.
       */
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        searchInput?.focus();
      }

      /*
       * Nhấn Escape để xóa tìm kiếm.
       */
      if (
        event.key === "Escape" &&
        document.activeElement === searchInput
      ) {
        searchInput.value = "";
        filterProducts();
        searchInput.blur();
      }
    }
  );

  /* =========================================================
     13. XỬ LÝ ẢNH SẢN PHẨM BỊ LỖI
  ========================================================= */

  document
    .querySelectorAll(".product-card img")
    .forEach(function (image) {
      image.addEventListener(
        "error",
        function () {
          if (
            this.dataset.fallbackApplied ===
            "true"
          ) {
            return;
          }

          this.dataset.fallbackApplied = "true";

          this.src =
            "../assets/images/products/default-product.jpg";
        },
        {
          once: true,
        }
      );
    });

  /* =========================================================
     14. KHỞI TẠO TRANG
  ========================================================= */

  updateCartCount();
  initializeCategoryFromUrl();
  sortProducts();
});