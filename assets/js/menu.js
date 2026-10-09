"use strict";

document.addEventListener("DOMContentLoaded", function () {
<<<<<<< HEAD
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
=======
  const productList = document.querySelector("#product-list");
  const searchInput = document.querySelector("#search-input");
  const clearSearchButton = document.querySelector("#clear-search");
  const categoryFilter = document.querySelector("#category-filter");
  const sortFilter = document.querySelector("#sort-filter");
  const resetFilterButton = document.querySelector("#reset-filter");
  const categoryButtons = document.querySelector("#category-buttons");
  const productCountElement = document.querySelector("#product-count");
  const emptyResult = document.querySelector("#empty-result");
  const emptyResetFilterButton = document.querySelector("#empty-reset-filter");
  const cartToast = document.querySelector("#cart-toast");

  if (!productList || !window.MocCoffeeApi) return;

  const CATEGORY_ALIASES = {
    coffee: "ca-phe",
    tea: "tra-trai-cay",
    "ice-blended": "da-xay",
    cake: "banh-ngot",
  };

  const CATEGORY_ICONS = {
    "ca-phe": "bi-cup-hot",
    "tra-trai-cay": "bi-cup-straw",
    "da-xay": "bi-snow",
    "banh-ngot": "bi-cake2",
  };

  let products = [];
  let selectedCategory = "all";
  let searchTimer;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return window.MocCoffee?.normalizeText
      ? window.MocCoffee.normalizeText(value)
      : String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
  }

  function createCategoryKey(value) {
    return normalizeText(value)
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatCurrency(value) {
    return window.MocCoffee?.formatCurrency
      ? window.MocCoffee.formatCurrency(value)
      : new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(Number(value) || 0);
  }

  function getCategories() {
    const map = new Map();

    products.forEach(function (product) {
      const key = createCategoryKey(product.categoryName);
      if (!map.has(key)) {
        map.set(key, { key, name: product.categoryName });
      }
    });

    return Array.from(map.values());
  }

  function updateCategoryButtons() {
    categoryButtons?.querySelectorAll(".category-btn")
      .forEach(function (button) {
        const active = button.dataset.category === selectedCategory;
        button.classList.toggle("active", active);
        button.classList.toggle("btn-coffee", active);
        button.classList.toggle("btn-outline-coffee", !active);
      });
  }

  function renderCategoryControls() {
    const categories = getCategories();

    if (categoryFilter) {
      categoryFilter.innerHTML = [
        '<option value="all">Tất cả danh mục</option>',
        ...categories.map(
          (category) =>
            `<option value="${category.key}">${escapeHTML(category.name)}</option>`
        ),
      ].join("");
    }

    if (categoryButtons) {
      categoryButtons.innerHTML = [
        '<button type="button" class="btn category-btn" data-category="all">Tất cả</button>',
        ...categories.map(function (category) {
          const icon = CATEGORY_ICONS[category.key] || "bi-tag";
          return `<button type="button" class="btn category-btn" data-category="${category.key}"><i class="bi ${icon} me-1"></i>${escapeHTML(category.name)}</button>`;
        }),
      ].join("");
    }

    updateCategoryButtons();
  }

  function getVisibleProducts() {
    const keyword = normalizeText(searchInput?.value);
    const filtered = products.filter(function (product) {
      const categoryKey = createCategoryKey(product.categoryName);
      const matchesCategory = selectedCategory === "all" || categoryKey === selectedCategory;
      const matchesSearch = !keyword ||
        normalizeText(product.name).includes(keyword) ||
        normalizeText(product.description).includes(keyword);
      return matchesCategory && matchesSearch;
    });

    const sortValue = sortFilter?.value || "default";
    return [...filtered].sort(function (first, second) {
      if (sortValue === "name-asc") return first.name.localeCompare(second.name, "vi");
      if (sortValue === "name-desc") return second.name.localeCompare(first.name, "vi");
      if (sortValue === "price-asc") return first.price - second.price;
      if (sortValue === "price-desc") return second.price - first.price;
      return second.id - first.id;
    });
  }

  function renderProducts() {
    const visibleProducts = getVisibleProducts();
    if (productCountElement) productCountElement.textContent = visibleProducts.length;
    emptyResult?.classList.toggle("d-none", visibleProducts.length > 0);

    productList.innerHTML = visibleProducts.map(function (product) {
      return `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3 product-item" data-id="${product.id}" data-name="${escapeHTML(product.name)}" data-category="${createCategoryKey(product.categoryName)}" data-price="${product.price}">
          <article class="card product-card h-100">
            <div class="position-relative">
              <img src="${escapeHTML(product.image)}" class="card-img-top" alt="${escapeHTML(product.name)}" data-product-image />
            </div>
            <div class="card-body d-flex flex-column">
              <p class="small text-secondary mb-1">${escapeHTML(product.categoryName)}</p>
              <h3 class="card-title h5">${escapeHTML(product.name)}</h3>
              <p class="card-text text-secondary">${escapeHTML(product.description || "Món ngon tại Mộc Coffee.")}</p>
              <div class="mt-auto">
                <p class="fw-bold text-danger fs-5 mb-3">${formatCurrency(product.price)}</p>
                <div class="d-flex gap-2">
                  <a href="product-detail.html?id=${product.id}" class="btn btn-outline-coffee flex-grow-1">Chi tiết</a>
                  <button type="button" class="btn btn-coffee add-to-cart" data-product-id="${product.id}" title="Thêm vào giỏ hàng"><i class="bi bi-cart-plus"></i></button>
                </div>
              </div>
            </div>
          </article>
        </div>`;
    }).join("");
  }

  function showCartToast(productName) {
    const message = cartToast?.querySelector(".toast-body");
    if (message) message.textContent = `Đã thêm "${productName}" vào giỏ hàng.`;
    if (cartToast && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(cartToast).show();
    }
  }

  function addProductToCart(productId, button) {
    const product = products.find((item) => Number(item.id) === Number(productId));
    if (!product || !window.MocCoffee?.addToCart) return;

    window.MocCoffee.addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
>>>>>>> 3036a5bd52b830fca782721b2d9335bccd0e8296
      size: "M",
      sugar: "70%",
      ice: "70%",
      toppings: [],
      note: "",
<<<<<<< HEAD
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
=======
    });

    showCartToast(product.name);
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-check-lg"></i>';
    window.setTimeout(function () {
      button.disabled = false;
      button.innerHTML = original;
    }, 800);
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (selectedCategory === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", selectedCategory);
    window.history.replaceState({}, "", url);
  }

  function selectCategory(category, shouldUpdateUrl = true) {
    const available = ["all", ...getCategories().map((item) => item.key)];
    selectedCategory = available.includes(category) ? category : "all";
    if (categoryFilter) categoryFilter.value = selectedCategory;
    updateCategoryButtons();
    renderProducts();
    if (shouldUpdateUrl) updateUrl();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (sortFilter) sortFilter.value = "default";
    selectCategory("all");
  }

  productList.addEventListener("click", function (event) {
    const button = event.target.closest(".add-to-cart");
    if (button) addProductToCart(button.dataset.productId, button);
  });

  productList.addEventListener("error", function (event) {
    if (event.target.matches("[data-product-image]")) {
      event.target.src = "../assets/images/products/default-product.jpg";
    }
  }, true);

  categoryButtons?.addEventListener("click", function (event) {
    const button = event.target.closest(".category-btn");
    if (button) selectCategory(button.dataset.category);
  });
  categoryFilter?.addEventListener("change", function () { selectCategory(this.value); });
  searchInput?.addEventListener("input", function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderProducts, 150);
  });
  clearSearchButton?.addEventListener("click", function () {
    searchInput.value = "";
    searchInput.focus();
    renderProducts();
  });
  sortFilter?.addEventListener("change", renderProducts);
  resetFilterButton?.addEventListener("click", resetFilters);
  emptyResetFilterButton?.addEventListener("click", resetFilters);

  async function initialize() {
    productList.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-secondary" role="status"></div><p class="text-secondary mt-3 mb-0">Đang tải thực đơn...</p></div>';

    try {
      const rawProducts = await window.MocCoffeeApi.getProducts();
      products = rawProducts.map((product) =>
        window.MocCoffeeApi.normalizeProduct(product, true)
      );

      const urlCategory = new URLSearchParams(window.location.search).get("category");
      selectedCategory = CATEGORY_ALIASES[urlCategory] || urlCategory || "all";
      renderCategoryControls();
      selectCategory(selectedCategory, false);
    } catch (error) {
      if (productCountElement) productCountElement.textContent = "0";
      productList.innerHTML = `<div class="col-12"><div class="alert alert-danger text-center" role="alert"><i class="bi bi-exclamation-triangle-fill me-2"></i>${escapeHTML(error.message)}<div class="small mt-2">Hãy kiểm tra Backend tại http://localhost:3000.</div></div></div>`;
    }
  }

  initialize();
});
>>>>>>> 3036a5bd52b830fca782721b2d9335bccd0e8296
