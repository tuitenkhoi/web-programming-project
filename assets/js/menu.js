"use strict";

document.addEventListener("DOMContentLoaded", function () {
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
  const emptyTitle = document.querySelector("#empty-title");
  const emptyHint = document.querySelector("#empty-hint");
  const emptyClearSearchButton = document.querySelector("#empty-clear-search");
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

  const tagFilter = document.querySelector("#tag-filter");

  let products = [];
  let tagList = [];              // [{ id, name, count }]
  let selectedTags = new Set();  // id nhãn đang lọc (AND)
  let selectedCategory = "all";
  let searchTimer;

  // Kiểu hiển thị (grid | list) lưu trong localStorage "mocPrefs" cùng theme/font_size,
  // và đồng bộ lên DB (users.menu_view) khi khách đã đăng nhập.
  const PREFS_KEY = "mocPrefs";
  const VIEW_MODES = ["grid", "list"];
  let viewMode = "grid";

  const SEARCH_DEBOUNCE_MS = 300;

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

  // Bọc từ khóa trong <mark>. So khớp không phân biệt hoa/thường và dấu tiếng Việt
  // (giống bộ lọc), nhưng văn bản gốc được ESCAPE từng đoạn trước khi chèn HTML.
  function highlight(text, keyword) {
    const source = String(text ?? "");
    const needle = normalizeText(keyword);

    if (!needle) return escapeHTML(source);

    // Chuẩn hóa từng ký tự gốc và nhớ vị trí gốc của từng ký tự đã chuẩn hóa
    let normalized = "";
    const owner = [];

    Array.from(source).reduce(function (offset, character) {
      const piece = character.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      for (let i = 0; i < piece.length; i++) owner.push(offset);
      normalized += piece;

      return offset + character.length;
    }, 0);

    const ranges = [];
    let from = 0;

    while (from <= normalized.length - needle.length) {
      const hit = normalized.indexOf(needle, from);
      if (hit === -1) break;

      const start = owner[hit];
      const lastOwner = owner[hit + needle.length - 1];
      // Kết thúc ở cuối ký tự gốc chứa ký tự chuẩn hóa cuối cùng
      const end = lastOwner + (String.fromCodePoint(source.codePointAt(lastOwner)).length);

      ranges.push([start, end]);
      from = hit + needle.length;
    }

    if (!ranges.length) return escapeHTML(source);

    let html = "";
    let cursor = 0;

    ranges.forEach(function ([start, end]) {
      if (start < cursor) return;
      html += escapeHTML(source.slice(cursor, start));
      html += "<mark>" + escapeHTML(source.slice(start, end)) + "</mark>";
      cursor = end;
    });

    return html + escapeHTML(source.slice(cursor));
  }

  function readStoredViewMode() {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}").menu_view;
      return VIEW_MODES.includes(stored) ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredViewMode(mode) {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ ...(prefs && typeof prefs === "object" ? prefs : {}), menu_view: mode })
      );
    } catch (error) {
      /* localStorage bị chặn: bỏ qua, vẫn đổi được kiểu hiển thị trong phiên này */
    }
  }

  function truncate(text, max) {
    const value = String(text ?? "").trim();
    return value.length > max ? value.slice(0, max).trimEnd() + "…" : value;
  }

  function updateViewButtons() {
    document.querySelectorAll("#menu-view-toggle [data-view]").forEach(function (button) {
      const active = button.dataset.view === viewMode;

      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("btn-coffee", active);
      button.classList.toggle("btn-outline-coffee", !active);
    });

    productList.classList.toggle("is-list", viewMode === "list");
  }

  function setViewMode(mode, { persist = true } = {}) {
    if (!VIEW_MODES.includes(mode) || mode === viewMode) return;

    viewMode = mode;
    updateViewButtons();
    renderProducts(); // vẽ lại từ dữ liệu đang có, KHÔNG gọi lại API

    if (!persist) return;

    writeStoredViewMode(mode);

    if (window.MocCoffeeApi.getCustomerProfile?.()) {
      window.MocCoffeeApi
        .request("/auth/customer/preferences", { method: "PATCH", body: { menu_view: mode } })
        .catch(function () { /* chưa lưu được lên server: vẫn còn trong trình duyệt */ });
    }
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
        map.set(key, {
          key,
          name: product.categoryName,
        });
      }
    });

    return Array.from(map.values());
  }

  function updateCategoryButtons() {
    categoryButtons
      ?.querySelectorAll(".category-btn")
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

          return `
            <button
              type="button"
              class="btn category-btn"
              data-category="${category.key}"
            >
              <i class="bi ${icon} me-1"></i>
              ${escapeHTML(category.name)}
            </button>
          `;
        }),
      ].join("");
    }

    updateCategoryButtons();
  }

  function productTags(product) {
    return Array.isArray(product.raw?.tags) ? product.raw.tags : [];
  }

  function tagChipsHtml(product) {
    const tags = productTags(product);
    if (!tags.length) return "";

    return `<div class="product-tags" aria-label="Nhãn">${tags
      .map(function (tag) {
        return `<span class="product-tag">${escapeHTML(tag.name)}</span>`;
      })
      .join("")}</div>`;
  }

  function renderTagStrip() {
    if (!tagFilter) return;

    tagFilter.classList.toggle("d-none", tagList.length === 0);
    tagFilter.innerHTML =
      tagList
        .map(function (tag) {
          const active = selectedTags.has(tag.id);
          return `<button type="button" class="btn btn-sm tag-chip ${active ? "btn-coffee active" : "btn-outline-coffee"}" data-tag-id="${tag.id}" aria-pressed="${active}">${escapeHTML(tag.name)}</button>`;
        })
        .join("") +
      (selectedTags.size
        ? '<button type="button" class="btn btn-sm btn-link text-secondary" data-tag-clear>Bỏ chọn nhãn</button>'
        : "");
  }

  function toggleTag(tagId) {
    if (selectedTags.has(tagId)) selectedTags.delete(tagId);
    else selectedTags.add(tagId);

    renderTagStrip();
    renderProducts();
    updateUrl();
  }

  // Nhãn có món đang bán; ưu tiên API /tags, lỗi thì tự suy ra từ danh sách món
  async function loadTags() {
    let list = [];

    try {
      const result = await window.MocCoffeeApi.request("/tags", { auth: false });
      list = (result.data || [])
        .filter((tag) => Number(tag.product_count) > 0)
        .map((tag) => ({ id: Number(tag.id), name: tag.name, count: Number(tag.product_count) }));
    } catch (error) {
      const seen = new Map();
      products.forEach(function (product) {
        productTags(product).forEach(function (tag) {
          const entry = seen.get(Number(tag.id)) || { id: Number(tag.id), name: tag.name, count: 0 };
          entry.count += 1;
          seen.set(entry.id, entry);
        });
      });
      list = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    tagList = list;
    // Bỏ các nhãn trên URL không còn tồn tại
    selectedTags = new Set(Array.from(selectedTags).filter((id) => list.some((tag) => tag.id === id)));
    renderTagStrip();
    renderProducts();
  }

  function getVisibleProducts() {
    const keyword = normalizeText(searchInput?.value);

    const filtered = products.filter(function (product) {
      const categoryKey = createCategoryKey(product.categoryName);

      const matchesCategory =
        selectedCategory === "all" ||
        categoryKey === selectedCategory;

      const matchesSearch =
        !keyword ||
        normalizeText(product.name).includes(keyword) ||
        normalizeText(product.description).includes(keyword);

      // Lọc nhãn là AND và cộng dồn với danh mục + từ khóa
      const matchesTags =
        selectedTags.size === 0 ||
        Array.from(selectedTags).every(function (tagId) {
          return productTags(product).some(function (tag) {
            return Number(tag.id) === tagId;
          });
        });

      return matchesCategory && matchesSearch && matchesTags;
    });

    const sortValue = sortFilter?.value || "default";

    return [...filtered].sort(function (first, second) {
      if (sortValue === "name-asc") {
        return first.name.localeCompare(second.name, "vi");
      }

      if (sortValue === "name-desc") {
        return second.name.localeCompare(first.name, "vi");
      }

      if (sortValue === "price-asc") {
        return first.price - second.price;
      }

      if (sortValue === "price-desc") {
        return second.price - first.price;
      }

      return second.id - first.id;
    });
  }

  function renderEmptyState(isEmpty) {
    if (!isEmpty) return;

    const keyword = (searchInput?.value || "").trim();

    // Từ khóa chỉ đi qua textContent nên không thể chèn HTML
    if (emptyTitle) {
      emptyTitle.textContent = keyword
        ? `Không tìm thấy sản phẩm nào cho "${keyword}"`
        : "Không tìm thấy món phù hợp";
    }

    if (emptyHint) {
      emptyHint.textContent = keyword
        ? "Hãy thử từ khóa khác, chọn danh mục khác hoặc bỏ bớt nhãn."
        : "Hãy thử thay đổi từ khóa, chọn danh mục khác hoặc bỏ bớt nhãn.";
    }

    emptyClearSearchButton?.classList.toggle("d-none", !keyword);
  }

  function renderProducts() {
    const searchKeyword = (searchInput?.value || "").trim();

    const visibleProducts = getVisibleProducts();

    if (productCountElement) {
      productCountElement.textContent = visibleProducts.length;
    }

    emptyResult?.classList.toggle(
      "d-none",
      visibleProducts.length > 0
    );

    renderEmptyState(visibleProducts.length === 0);

    productList.innerHTML = visibleProducts
      .map(function (product) {
        return viewMode === "list"
          ? renderListRow(product, searchKeyword)
          : renderGridCard(product, searchKeyword);
      })
      .join("");
  }

  function badgesHtml(product) {
    return window.MocBadges ? window.MocBadges.render(product) : "";
  }

  function renderListRow(product, searchKeyword) {
    const description = truncate(product.description || "Món ngon tại Mộc Coffee.", 80);

    return `
      <div
        class="col-12 product-item"
        data-id="${product.id}"
        data-name="${escapeHTML(product.name)}"
        data-category="${createCategoryKey(product.categoryName)}"
        data-price="${product.price}"
      >
        <article class="card product-card product-card-list">
          <div class="product-list-row">
            <img
              src="${escapeHTML(product.image)}"
              alt="${escapeHTML(product.name)}"
              data-product-image
              loading="lazy"
            />

            <div class="product-list-info">
              <p class="small text-secondary mb-1">${escapeHTML(product.categoryName)}</p>
              ${tagChipsHtml(product)}
              <h3 class="card-title h5 mb-1">${highlight(product.name, searchKeyword)}</h3>
              <p class="card-text text-secondary mb-0">${highlight(description, searchKeyword)}</p>
            </div>

            <div class="product-list-badges">${badgesHtml(product)}</div>

            <div class="product-list-price fw-bold fs-5">${formatCurrency(product.price)}</div>

            <div class="product-list-actions">
              <a href="product-detail.html?id=${product.id}" class="btn btn-outline-coffee">
                Chi tiết
              </a>

              <button
                type="button"
                class="btn btn-coffee add-to-cart"
                data-product-id="${product.id}"
                title="Thêm vào giỏ hàng"
                aria-label="Thêm ${escapeHTML(product.name)} vào giỏ hàng"
              >
                <i class="bi bi-cart-plus"></i>
              </button>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function renderGridCard(product, searchKeyword) {
    return `
          <div
            class="col-12 col-sm-6 col-lg-4 col-xl-3 product-item"
            data-id="${product.id}"
            data-name="${escapeHTML(product.name)}"
            data-category="${createCategoryKey(product.categoryName)}"
            data-price="${product.price}"
          >
            <article class="card product-card h-100">
              <div class="position-relative">
                <img
                  src="${escapeHTML(product.image)}"
                  class="card-img-top"
                  alt="${escapeHTML(product.name)}"
                  data-product-image
                  loading="lazy"
                />
                <div class="product-badges">${badgesHtml(product)}</div>
              </div>

              <div class="card-body d-flex flex-column">
                <p class="small text-secondary mb-1">
                  ${escapeHTML(product.categoryName)}
                </p>
                ${tagChipsHtml(product)}

                <h3 class="card-title h5">
                  ${highlight(product.name, searchKeyword)}
                </h3>

                <p class="card-text text-secondary">
                  ${highlight(
                    product.description || "Món ngon tại Mộc Coffee.",
                    searchKeyword
                  )}
                </p>

                <div class="mt-auto">
                  <p class="fw-bold text-danger fs-5 mb-3">
                    ${formatCurrency(product.price)}
                  </p>

                  <div class="d-flex gap-2">
                    <a
                      href="product-detail.html?id=${product.id}"
                      class="btn btn-outline-coffee flex-grow-1"
                    >
                      Chi tiết
                    </a>

                    <button
                      type="button"
                      class="btn btn-coffee add-to-cart"
                      data-product-id="${product.id}"
                      title="Thêm vào giỏ hàng"
                    >
                      <i class="bi bi-cart-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        `;
  }

  function showCartToast(productName) {
    const message = cartToast?.querySelector(".toast-body");

    if (message) {
      message.textContent = `Đã thêm "${productName}" vào giỏ hàng.`;
    }

    if (cartToast && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(cartToast).show();
    }
  }

  function addProductToCart(productId, button) {
    const product = products.find(
      (item) => Number(item.id) === Number(productId)
    );

    if (!product || !window.MocCoffee?.addToCart) return;

    window.MocCoffee.addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
      size: "M",
      sugar: "70%",
      ice: "70%",
      toppings: [],
      note: "",
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

    if (selectedCategory === "all") {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set("category", selectedCategory);
    }

    if (selectedTags.size) {
      url.searchParams.set("tags", Array.from(selectedTags).join(","));
    } else {
      url.searchParams.delete("tags");
    }

    window.history.replaceState({}, "", url);
  }

  function selectCategory(category, shouldUpdateUrl = true) {
    const available = [
      "all",
      ...getCategories().map((item) => item.key),
    ];

    selectedCategory = available.includes(category)
      ? category
      : "all";

    if (categoryFilter) {
      categoryFilter.value = selectedCategory;
    }

    updateCategoryButtons();
    renderProducts();

    if (shouldUpdateUrl) {
      updateUrl();
    }
  }

  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (sortFilter) sortFilter.value = "default";

    selectedTags = new Set();
    renderTagStrip();
    selectCategory("all");
  }

  productList.addEventListener("click", function (event) {
    const button = event.target.closest(".add-to-cart");

    if (button) {
      addProductToCart(button.dataset.productId, button);
    }
  });

  productList.addEventListener(
    "error",
    function (event) {
      if (
        event.target instanceof HTMLImageElement &&
        event.target.matches("[data-product-image]") &&
        event.target.dataset.fallbackApplied !== "true"
      ) {
        event.target.dataset.fallbackApplied = "true";
        event.target.src =
          "../assets/images/products/default-product.jpg";
      }
    },
    true
  );

  categoryButtons?.addEventListener("click", function (event) {
    const button = event.target.closest(".category-btn");

    if (button) {
      selectCategory(button.dataset.category);
    }
  });

  tagFilter?.addEventListener("click", function (event) {
    if (event.target.closest("[data-tag-clear]")) {
      selectedTags = new Set();
      renderTagStrip();
      renderProducts();
      updateUrl();
      return;
    }

    const chip = event.target.closest("[data-tag-id]");
    if (chip) toggleTag(Number(chip.dataset.tagId));
  });

  categoryFilter?.addEventListener("change", function () {
    selectCategory(this.value);
  });

  searchInput?.addEventListener("input", function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderProducts, SEARCH_DEBOUNCE_MS);
  });

  clearSearchButton?.addEventListener("click", function () {
    window.clearTimeout(searchTimer);

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    renderProducts();
  });

  document.querySelector("#menu-view-toggle")?.addEventListener("click", function (event) {
    const button = event.target.closest("[data-view]");

    if (button) setViewMode(button.dataset.view);
  });

  emptyClearSearchButton?.addEventListener("click", function () {
    window.clearTimeout(searchTimer);

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    renderProducts();
  });

  sortFilter?.addEventListener("change", renderProducts);
  resetFilterButton?.addEventListener("click", resetFilters);
  emptyResetFilterButton?.addEventListener("click", resetFilters);

  async function initialize() {
    productList.innerHTML = `
      <div class="col-12 text-center py-5">
        <div
          class="spinner-border text-secondary"
          role="status"
        ></div>
        <p class="text-secondary mt-3 mb-0">
          Đang tải thực đơn...
        </p>
      </div>
    `;

    try {
      const rawProducts = await window.MocCoffeeApi.getProducts();

      products = rawProducts.map((product) => ({
        ...window.MocCoffeeApi.normalizeProduct(product, true),
        raw: product, // giữ nguyên dữ liệu API để vẽ chip trạng thái
      }));

      const urlCategory = new URLSearchParams(
        window.location.search
      ).get("category");

      selectedCategory =
        CATEGORY_ALIASES[urlCategory] || urlCategory || "all";

      renderCategoryControls();

      selectedTags = new Set(
        (new URLSearchParams(window.location.search).get("tags") || "")
          .split(",")
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      const storedView = readStoredViewMode();
      if (storedView) viewMode = storedView;
      updateViewButtons();

      selectCategory(selectedCategory, false);
      loadTags(); // không chặn việc hiển thị thực đơn

      // Chưa có lựa chọn trong trình duyệt này: lấy từ tài khoản (thiết bị khác đã chọn)
      if (!storedView && window.MocCoffeeApi.getCustomerProfile?.()) {
        window.MocCoffeeApi
          .request("/auth/customer/me")
          .then(function (result) {
            const serverView = result.data?.menu_view;

            if (VIEW_MODES.includes(serverView)) {
              writeStoredViewMode(serverView);
              setViewMode(serverView, { persist: false });
            }
          })
          .catch(function () { /* bỏ qua: dùng mặc định dạng lưới */ });
      }
    } catch (error) {
      if (productCountElement) {
        productCountElement.textContent = "0";
      }

      emptyResult?.classList.add("d-none");

      productList.innerHTML = `
        <div class="col-12">
          <div
            class="alert alert-danger text-center"
            role="alert"
          >
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${escapeHTML(error.message)}
            <div class="small mt-2">
              Hãy kiểm tra kết nối và API sản phẩm của backend.
            </div>
          </div>
        </div>
      `;
    }
  }

  initialize();
});