"use strict";

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     1. LẤY CÁC PHẦN TỬ
  ========================================================= */

  const cartContent =
    document.querySelector("#cart-content");

  const emptyCart =
    document.querySelector("#empty-cart");

  const cartTableBody =
    document.querySelector("#cart-table-body");

  const cartRowTemplate =
    document.querySelector("#cart-row-template");

  const cartCountElement =
    document.querySelector("#cart-count");

  const cartItemCountElement =
    document.querySelector("#cart-item-count");

  const cartSubtotalElement =
    document.querySelector("#cart-subtotal");

  const cartDiscountElement =
    document.querySelector("#cart-discount");

  const serviceFeeElement =
    document.querySelector("#service-fee");

  const cartTotalElement =
    document.querySelector("#cart-total");

  const couponInput =
    document.querySelector("#coupon-input");

  const couponButton =
    document.querySelector("#apply-coupon-button");

  const couponMessage =
    document.querySelector("#coupon-message");

  const checkoutButton =
    document.querySelector("#checkout-button");

  const updateCartButton =
    document.querySelector("#update-cart-button");

  const confirmClearCartButton =
    document.querySelector("#confirm-clear-cart");

  const clearCartButton =
    document.querySelector("#open-clear-cart-modal");

  const orderAtTableRadio =
    document.querySelector("#order-at-table");

  const orderTakeawayRadio =
    document.querySelector("#order-takeaway");

  const tableCodeGroup =
    document.querySelector("#table-code-group");

  const tableCodeSelect =
    document.querySelector("#table-code");

  const tableCodeError =
    document.querySelector("#table-code-error");

  const customerNameInput =
    document.querySelector("#order-customer-name");

  const orderNoteInput =
    document.querySelector("#order-note");

  const orderNoteCount =
    document.querySelector("#order-note-count");

  /*
   * Nếu đây không phải trang giỏ hàng thì dừng.
   */
  if (
    !cartTableBody ||
    !cartRowTemplate ||
    !cartContent ||
    !emptyCart
  ) {
    return;
  }

  /* =========================================================
     2. HẰNG SỐ VÀ BIẾN
  ========================================================= */

  const CART_STORAGE_KEY = "mocCoffeeCart";

  const ORDER_STORAGE_KEY =
    "mocCoffeePendingOrder";

  const COUPON_STORAGE_KEY =
    "mocCoffeeCouponCode";

  const SERVICE_FEE_PERCENT = 5;

  let cart = loadCart();

  let appliedCouponCode =
    localStorage.getItem(COUPON_STORAGE_KEY) || "";

  let appliedVoucher = null;

  /* =========================================================
     3. CÁC HÀM HỖ TRỢ
  ========================================================= */

  function formatCurrency(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(number);
  }

  function generateOrderCode() {
    const timePart = Date.now()
      .toString()
      .slice(-6);

    const randomPart = Math.floor(
      Math.random() * 90 + 10
    );

    return `OD${timePart}${randomPart}`;
  }

  async function loadAvailableTables() {
    if (!tableCodeSelect) {
      return;
    }

    tableCodeSelect.disabled = true;
    tableCodeSelect.innerHTML =
      '<option value="">Đang tải danh sách bàn...</option>';

    try {
      const response = await fetch("/api/tables");
      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          data?.message || "Không tải được danh sách bàn."
        );
      }

      const availableTables = data.filter(
        (table) => table.status === "available"
      );

      tableCodeSelect.innerHTML =
        '<option value="">Chọn bàn còn trống</option>';

      availableTables.forEach(function (table) {
        const option = document.createElement("option");
        option.value = table.table_code;
        option.textContent =
          `${table.table_name || `Bàn ${table.table_code}`} ` +
          `(${Number(table.capacity || 0)} người)`;
        tableCodeSelect.appendChild(option);
      });

      if (!availableTables.length) {
        tableCodeSelect.innerHTML =
          '<option value="">Hiện không có bàn trống</option>';
      }

      tableCodeSelect.disabled = false;

      // Khách quét mã QR trên bàn: tự chọn đúng bàn đó (kể cả khi bàn đã "có khách")
      const scanned = window.MocTable?.get?.();
      const scannedTable = scanned
        ? data.find((table) => table.table_code === scanned.code && table.status !== "maintenance")
        : null;

      if (scannedTable && orderAtTableRadio) {
        let option = Array.from(tableCodeSelect.options).find(
          (item) => item.value === scannedTable.table_code
        );

        if (!option) {
          option = document.createElement("option");
          option.value = scannedTable.table_code;
          option.textContent = scannedTable.table_name || `Bàn ${scannedTable.table_code}`;
          tableCodeSelect.appendChild(option);
        }

        tableCodeSelect.value = scannedTable.table_code;
        orderAtTableRadio.checked = true;
        updateOrderType();
      }
    } catch (error) {
      tableCodeSelect.innerHTML =
        '<option value="">Không tải được danh sách bàn</option>';
      tableCodeSelect.disabled = true;
      showToast(error.message, "danger");
    }
  }

  function showToast(message, type = "success") {
    const toastElement =
      document.querySelector("#cart-toast");

    const toastMessage =
      document.querySelector("#toast-message");

    const toastIcon =
      document.querySelector("#toast-icon");

    if (toastMessage) {
      toastMessage.textContent = message;
    }

    if (toastIcon) {
      toastIcon.className = "bi me-2";

      if (type === "danger") {
        toastIcon.classList.add(
          "bi-x-circle-fill",
          "text-danger"
        );
      } else if (type === "warning") {
        toastIcon.classList.add(
          "bi-exclamation-triangle-fill",
          "text-warning"
        );
      } else {
        toastIcon.classList.add(
          "bi-check-circle-fill",
          "text-success"
        );
      }
    }

    if (
      toastElement &&
      typeof bootstrap !== "undefined"
    ) {
      bootstrap.Toast.getOrCreateInstance(
        toastElement
      ).show();
    }
  }

  function hideModal(selector) {
    const modalElement =
      document.querySelector(selector);

    if (
      !modalElement ||
      typeof bootstrap === "undefined"
    ) {
      return;
    }

    const modal =
      bootstrap.Modal.getInstance(modalElement) ||
      bootstrap.Modal.getOrCreateInstance(
        modalElement
      );

    modal.hide();
  }

  function createCartKey(item) {
    if (item.cartKey) {
      return String(item.cartKey);
    }

    if (item.key) {
      return String(item.key);
    }

    const toppings = Array.isArray(item.toppings)
      ? item.toppings
          .map((topping) =>
            typeof topping === "string"
              ? topping
              : topping.name
          )
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

  function resolveImagePath(imagePath) {
    if (!imagePath) {
      return "../assets/images/products/default-product.jpg";
    }

    /*
     * Nếu đường dẫn được lưu từ index.html dạng:
     * assets/images/...
     * thì thêm ../ vì cart.html nằm trong thư mục pages.
     */
    if (imagePath.startsWith("assets/")) {
      return `../${imagePath}`;
    }

    return imagePath;
  }

  function normalizeCartItem(item) {
    const normalizedItem = {
      id: String(
        item.id || item.productId || Date.now()
      ),

      name:
        item.name ||
        item.productName ||
        "Sản phẩm",

      image: resolveImagePath(
        item.image || item.imageUrl
      ),

      price: Number(
        item.price ||
          item.unitPrice ||
          item.finalPrice ||
          0
      ),

      // Giá gốc của món (chưa cộng size/topping), dùng khi khách đổi size/topping trong giỏ
      basePrice:
        item.basePrice !== undefined &&
        item.basePrice !== null &&
        Number.isFinite(Number(item.basePrice))
          ? Number(item.basePrice)
          : undefined,

      quantity: Math.max(
        1,
        Number(item.quantity || 1)
      ),

      size: item.size || "M",

      sugar:
        item.sugar ||
        item.sugarLevel ||
        "70%",

      ice:
        item.ice ||
        item.iceLevel ||
        "70%",

      toppings: Array.isArray(item.toppings)
        ? item.toppings
        : [],

      note: item.note || "",

      options: item.options || "",
    };

    normalizedItem.cartKey =
      createCartKey({
        ...item,
        ...normalizedItem,
      });

    return normalizedItem;
  }

  /* =========================================================
     4. ĐỌC VÀ LƯU LOCALSTORAGE
  ========================================================= */

  function loadCart() {
    try {
      const storedCart = localStorage.getItem(
        CART_STORAGE_KEY
      );

      const parsedCart = storedCart
        ? JSON.parse(storedCart)
        : [];

      if (!Array.isArray(parsedCart)) {
        return [];
      }

      return parsedCart.map(normalizeCartItem);
    } catch (error) {
      console.error("Không thể đọc giỏ hàng:", error);
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart)
    );
  }

  /* =========================================================
     5. HIỂN THỊ TÙY CHỌN CỦA MÓN
  ========================================================= */

  function getToppingNames(toppings) {
    if (!Array.isArray(toppings) || toppings.length === 0) {
      return "";
    }

    return toppings
      .map((topping) => {
        if (typeof topping === "string") {
          return topping;
        }

        return topping.name || "";
      })
      .filter(Boolean)
      .join(", ");
  }

  function createOptionText(item) {
    if (item.options) {
      return item.options;
    }

    const optionParts = [];

    if (item.size) {
      optionParts.push(`Size ${item.size}`);
    }

    if (item.sugar) {
      optionParts.push(`${item.sugar} đường`);
    }

    if (item.ice) {
      optionParts.push(`${item.ice} đá`);
    }

    const toppingNames =
      getToppingNames(item.toppings);

    if (toppingNames) {
      optionParts.push(`Topping: ${toppingNames}`);
    }

    return optionParts.join(" · ");
  }

  /* =========================================================
     6. TÍNH TIỀN
  ========================================================= */

  function getCartTotals() {
    const subtotal = cart.reduce(
      (total, item) =>
        total + item.price * item.quantity,
      0
    );

    let discount = 0;

    if (appliedVoucher && subtotal >= Number(appliedVoucher.min_order || 0)) {
      discount = appliedVoucher.discount_type === "percent"
        ? Math.round(subtotal * Number(appliedVoucher.value) / 100)
        : Math.round(Number(appliedVoucher.value));

      if (appliedVoucher.max_discount !== null) {
        discount = Math.min(discount, Number(appliedVoucher.max_discount));
      }

      discount = Math.max(0, Math.min(discount, subtotal));
    }

    const useAtTable =
      orderAtTableRadio?.checked ?? true;

    /*
     * Dùng tại bàn có phí phục vụ 5%.
     * Làm tròn đến 1.000 đồng.
     */
    const rawServiceFee = useAtTable
      ? (subtotal * SERVICE_FEE_PERCENT) / 100
      : 0;

    const serviceFee =
      Math.round(rawServiceFee / 1000) * 1000;

    const total = Math.max(
      0,
      subtotal - discount + serviceFee
    );

    return {
      subtotal,
      discount,
      serviceFee,
      total,
    };
  }

  function getTotalQuantity() {
    return cart.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  function updateSummary() {
    const totals = getCartTotals();
    const totalQuantity = getTotalQuantity();

    cartCountElement.textContent = totalQuantity;
    cartItemCountElement.textContent = totalQuantity;

    cartSubtotalElement.textContent =
      formatCurrency(totals.subtotal);

    cartDiscountElement.textContent =
      `-${formatCurrency(totals.discount)}`;

    serviceFeeElement.textContent =
      formatCurrency(totals.serviceFee);

    cartTotalElement.textContent =
      formatCurrency(totals.total);

    cartCountElement.classList.toggle(
      "d-none",
      totalQuantity === 0
    );

    if (checkoutButton) {
      checkoutButton.disabled = cart.length === 0;
    }

    if (clearCartButton) {
      clearCartButton.disabled = cart.length === 0;
    }
  }

  /* =========================================================
     7. HIỂN THỊ GIỎ HÀNG
  ========================================================= */

  function renderCart() {
    cartTableBody.innerHTML = "";

    if (cart.length === 0) {
      cartContent.classList.add("d-none");
      emptyCart.classList.remove("d-none");

      updateSummary();
      saveCart();

      return;
    }

    cartContent.classList.remove("d-none");
    emptyCart.classList.add("d-none");

    cart.forEach(function (item) {
      const fragment =
        cartRowTemplate.content.cloneNode(true);

      const row = fragment.querySelector(".cart-row");

      const imageElement = fragment.querySelector(
        ".cart-product-image"
      );

      const nameElement = fragment.querySelector(
        ".cart-product-name"
      );

      const optionElement = fragment.querySelector(
        ".cart-product-option"
      );

      const priceElement = fragment.querySelector(
        ".cart-product-price"
      );

      const quantityInput = fragment.querySelector(
        ".quantity-input"
      );

      const totalElement = fragment.querySelector(
        ".cart-product-total"
      );

      row.dataset.cartKey = item.cartKey;

      imageElement.src = item.image;
      imageElement.alt = item.name;

      /*
       * Nếu ảnh lỗi thì dùng ảnh mặc định.
       */
      imageElement.addEventListener(
        "error",
        function () {
          this.src =
            "../assets/images/products/default-product.jpg";
        },
        {
          once: true,
        }
      );

      nameElement.textContent = item.name;

      optionElement.textContent =
        createOptionText(item) ||
        "Không có tùy chọn";

      priceElement.textContent =
        formatCurrency(item.price);

      quantityInput.value = item.quantity;

      totalElement.textContent = formatCurrency(
        item.price * item.quantity
      );

      cartTableBody.appendChild(fragment);
    });

    updateSummary();
    saveCart();
  }

  /* =========================================================
     8. TÌM SẢN PHẨM TRONG GIỎ
  ========================================================= */

  function findCartItem(cartKey) {
    return cart.find(
      (item) => item.cartKey === cartKey
    );
  }

  function findCartItemIndex(cartKey) {
    return cart.findIndex(
      (item) => item.cartKey === cartKey
    );
  }

  /* =========================================================
     9. THAY ĐỔI SỐ LƯỢNG VÀ XÓA MÓN
  ========================================================= */

  cartTableBody.addEventListener(
    "click",
    function (event) {
      const row = event.target.closest(".cart-row");

      if (!row) {
        return;
      }

      const cartKey = row.dataset.cartKey;
      const item = findCartItem(cartKey);

      if (!item) {
        return;
      }

      const decreaseButton = event.target.closest(
        ".decrease-quantity"
      );

      const increaseButton = event.target.closest(
        ".increase-quantity"
      );

      const removeButton = event.target.closest(
        ".remove-item-button"
      );

      const editNoteButton = event.target.closest(
        ".edit-note-button"
      );

      const editOptionsButton = event.target.closest(
        ".edit-options-button"
      );

      if (editOptionsButton) {
        openOptionsModal(item);

        return;
      }

      if (decreaseButton) {
        if (item.quantity > 1) {
          item.quantity--;
          renderCart();
        }

        return;
      }

      if (increaseButton) {
        if (item.quantity < 99) {
          item.quantity++;
          renderCart();
        }

        return;
      }

      if (removeButton) {
        window.MocConfirm.show({
          title: "Xóa món khỏi giỏ hàng",
          message: `Xóa '${item.name}' khỏi giỏ hàng?`,
          danger: true,
          onConfirm: function () {
            const itemIndex = findCartItemIndex(cartKey);

            if (itemIndex !== -1) {
              const removedItem = cart[itemIndex];

              cart.splice(itemIndex, 1);
              renderCart();

              showToast(
                `Đã xóa ${removedItem.name} khỏi giỏ hàng.`
              );
            }
          },
        });

        return;
      }

      if (editNoteButton) {
        const newNote = window.prompt(
          `Ghi chú cho món "${item.name}":`,
          item.note
        );

        if (newNote !== null) {
          item.note = newNote.trim();

          /*
           * Cập nhật lại cartKey vì ghi chú là một phần
           * của phiên bản món.
           */
          item.cartKey = [
            item.id,
            item.size,
            item.sugar,
            item.ice,
            getToppingNames(item.toppings),
            item.note,
          ].join("|");

          renderCart();

          showToast("Đã cập nhật ghi chú cho món.");
        }
      }
    }
  );

  cartTableBody.addEventListener(
    "change",
    function (event) {
      if (
        !event.target.classList.contains(
          "quantity-input"
        )
      ) {
        return;
      }

      const row = event.target.closest(".cart-row");
      const item = findCartItem(
        row?.dataset.cartKey
      );

      if (!item) {
        return;
      }

      let quantity = Number(event.target.value);

      if (!Number.isInteger(quantity) || quantity < 1) {
        quantity = 1;
      }

      if (quantity > 99) {
        quantity = 99;
      }

      item.quantity = quantity;
      renderCart();
    }
  );

  /* =========================================================
     9B. ĐỔI SIZE VÀ TOPPING CỦA MỘT MÓN TRONG GIỎ
     (xử lý tính giá nằm trong cart-options.js)
  ========================================================= */

  const Options = window.MocCartOptions;

  const optionsModalElement =
    document.querySelector("#cart-options-modal");

  const optionsProductName =
    document.querySelector("#cart-options-product");

  const optionsToppingList =
    document.querySelector("#cart-options-toppings");

  const optionsPriceElement =
    document.querySelector("#cart-options-price");

  const optionsSaveButton =
    document.querySelector("#cart-options-save");

  let toppingsPromise = null;
  let editingCartKey = null;
  let editingBasePrice = 0;
  let editingToppingsReady = false; // false: chưa tải được danh sách topping
  let editingExistingToppings = []; // topping hiện có của món đang sửa

  /*
   * Danh sách topping đang bán (do admin quản lý).
   * Chỉ tải một lần; nếu lỗi thì lần sau tải lại.
   */
  let editingProduct = null;

  function loadToppings() {
    if (!toppingsPromise) {
      toppingsPromise = window.MocCoffeeApi
        .getToppings()
        .catch(function (error) {
          toppingsPromise = null;
          throw error;
        });
    }

    return toppingsPromise;
  }

  function getSelectedOptionSize() {
    return (
      optionsModalElement.querySelector(
        'input[name="cartOptionSize"]:checked'
      )?.value || "M"
    );
  }

  function getSelectedOptionToppings() {
    return Array.from(
      optionsToppingList.querySelectorAll(
        ".cart-topping-checkbox:checked"
      )
    ).map(function (checkbox) {
      return {
        name: checkbox.value,
        price: Number(checkbox.dataset.price || 0),
      };
    });
  }

  // Topping đang được chọn (chưa tải được danh sách thì coi như giữ nguyên topping cũ)
  function getEditingToppings() {
    return editingToppingsReady
      ? getSelectedOptionToppings()
      : editingExistingToppings;
  }

  function updateOptionsPrice() {
    optionsPriceElement.textContent = formatCurrency(
      Options.calcUnitPrice(
        editingBasePrice,
        getSelectedOptionSize(),
        getEditingToppings()
      )
    );
  }

  function showOptionsMessage(text) {
    optionsToppingList.textContent = "";

    const column = document.createElement("div");
    column.className = "col-12";

    const message = document.createElement("p");
    message.className = "text-secondary small mb-0";
    message.textContent = text;

    column.appendChild(message);
    optionsToppingList.appendChild(column);
  }

  function renderOptionsToppings(toppings, selectedNames) {
    optionsToppingList.textContent = "";

    if (!toppings.length) {
      showOptionsMessage("Hiện chưa có topping nào.");

      return;
    }

    toppings.forEach(function (topping) {
      const id = `cart-topping-${topping.id}`;

      const column = document.createElement("div");
      column.className = "col-12 col-sm-6";

      const wrapper = document.createElement("div");
      wrapper.className = "form-check topping-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className =
        "form-check-input cart-topping-checkbox";
      checkbox.id = id;
      checkbox.value = topping.name;
      checkbox.dataset.price = String(topping.price);
      checkbox.checked = selectedNames.has(topping.name);

      const label = document.createElement("label");
      label.className =
        "form-check-label d-flex justify-content-between w-100";
      label.htmlFor = id;

      const name = document.createElement("span");
      name.textContent = topping.name;

      const price = document.createElement("strong");
      price.textContent = `+${formatCurrency(topping.price)}`;

      label.append(name, price);
      wrapper.append(checkbox, label);
      column.appendChild(wrapper);
      optionsToppingList.appendChild(column);
    });
  }

  async function openOptionsModal(item) {
    if (!Options || !optionsModalElement) {
      return;
    }

    editingCartKey = item.cartKey;
    editingBasePrice = Options.getBasePrice(item);
    editingToppingsReady = false;
    editingExistingToppings = Options.normalizeToppings(item.toppings);

    optionsProductName.textContent = item.name;

    optionsModalElement
      .querySelectorAll('input[name="cartOptionSize"]')
      .forEach(function (radio) {
        radio.checked = radio.value === item.size;
      });

    showOptionsMessage("Đang tải topping...");
    updateOptionsPrice();

    if (typeof bootstrap !== "undefined") {
      bootstrap.Modal.getOrCreateInstance(
        optionsModalElement
      ).show();
    }

    /*
     * Lấy giá món mới nhất từ máy chủ để đơn giá sau khi sửa luôn đúng
     * (admin có thể đã đổi giá). Không lấy được thì dùng giá đã lưu.
     */
    editingProduct = null;
    const freshPrice = window.MocCoffeeApi
      .getProductById(item.id)
      .then(function (product) {
        const price = Number(product?.price);

        editingProduct = product || null;

        return Number.isFinite(price) ? price : null;
      })
      .catch(function () {
        return null;
      });

    try {
      const [toppings, price] = await Promise.all([
        loadToppings(),
        freshPrice,
      ]);

      if (editingCartKey !== item.cartKey) {
        return;
      }

      if (price !== null) {
        editingBasePrice = price;
      }

      // chỉ hiện topping áp dụng cho món này; topping đang chọn vẫn giữ để không mất
      const keep = new Set(item.toppings.map(Options.toppingName));
      const usable = editingProduct
        ? toppings.filter(function (topping) {
            return (
              keep.has(topping.name) ||
              Options.appliesTo(
                topping,
                Number(editingProduct.id),
                Number(editingProduct.category_id)
              )
            );
          })
        : toppings;

      renderOptionsToppings(usable, keep);

      editingToppingsReady = true;
    } catch (error) {
      showOptionsMessage(
        "Không tải được danh sách topping. Bạn vẫn có thể đổi size; topping hiện tại được giữ nguyên."
      );
    }

    updateOptionsPrice();
  }

  optionsModalElement?.addEventListener(
    "change",
    function (event) {
      if (
        event.target.matches(
          'input[name="cartOptionSize"], .cart-topping-checkbox'
        )
      ) {
        updateOptionsPrice();
      }
    }
  );

  optionsSaveButton?.addEventListener(
    "click",
    function () {
      if (!editingCartKey) {
        return;
      }

      const itemsBefore = cart.length;

      /*
       * Chưa tải được danh sách topping thì không có ô nào được tích,
       * nên phải giữ topping cũ chứ không được xóa hết.
       */
      const result = Options.applyOptions(
        cart,
        editingCartKey,
        {
          size: getSelectedOptionSize(),
          toppings: getEditingToppings(),
          basePrice: editingBasePrice,
        }
      );

      cart = result.cart;
      editingCartKey = null;

      hideModal("#cart-options-modal");
      renderCart();

      showToast(
        cart.length < itemsBefore
          ? "Đã cập nhật món và gộp với món giống nhau trong giỏ."
          : "Đã cập nhật size, topping cho món."
      );
    }
  );

  /*
   * Đồng bộ giỏ với danh sách topping đang bán:
   * topping đã ngừng bán thì bỏ khỏi giỏ, giá đổi thì tính lại.
   */
  function syncToppingsWithShop() {
    if (!Options) {
      return;
    }

    loadToppings()
      .then(function (toppings) {
        const result = Options.reconcile(cart, toppings);

        if (!result.changed) {
          return;
        }

        cart = result.cart;
        renderCart();

        if (result.removed.length) {
          showToast(
            `Topping ${result.removed.join(", ")} đã ngừng bán nên được bỏ khỏi giỏ hàng.`,
            "warning"
          );
        } else if (result.priceChanged) {
          showToast(
            "Giá topping đã thay đổi, giỏ hàng đã được cập nhật.",
            "warning"
          );
        }
      })
      .catch(function (error) {
        console.error("Không thể đồng bộ topping:", error);
      });
  }

  /* =========================================================
     10. XÓA TOÀN BỘ GIỎ HÀNG
  ========================================================= */

  confirmClearCartButton?.addEventListener(
    "click",
    function () {
      cart = [];
      appliedCouponCode = "";
      appliedVoucher = null;

      localStorage.removeItem(COUPON_STORAGE_KEY);

      if (couponInput) {
        couponInput.value = "";
      }

      if (couponMessage) {
        couponMessage.textContent = "";
        couponMessage.className = "small mt-2";
      }

      renderCart();
      hideModal("#clear-cart-modal");

      showToast("Đã xóa toàn bộ giỏ hàng.");
    }
  );

  /* =========================================================
     11. MÃ GIẢM GIÁ
  ========================================================= */

  function displayCouponSuccess() {
    if (!couponMessage) {
      return;
    }

    couponMessage.className =
      "small mt-2 text-success";

    couponMessage.innerHTML =
      '<i class="bi bi-check-circle-fill me-1"></i>' +
      `Đã áp dụng ${appliedVoucher?.name || appliedCouponCode}.`;
  }

  function displayCouponError(message) {
    if (!couponMessage) {
      return;
    }

    couponMessage.className =
      "small mt-2 text-danger";

    couponMessage.innerHTML =
      '<i class="bi bi-x-circle-fill me-1"></i>' +
      message;
  }

  async function applyCoupon() {
    const enteredCode = couponInput.value
      .trim()
      .toUpperCase();

    couponInput.value = enteredCode;

    if (!enteredCode) {
      displayCouponError(
        "Vui lòng nhập mã giảm giá."
      );

      return;
    }

    if (cart.length === 0) {
      displayCouponError(
        "Giỏ hàng đang trống."
      );

      return;
    }

    couponButton.disabled = true;

    try {
      const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      appliedVoucher = await window.MocCoffeeApi.validateVoucher(
        enteredCode,
        subtotal
      );
      appliedCouponCode = enteredCode;
      localStorage.setItem(COUPON_STORAGE_KEY, appliedCouponCode);
      displayCouponSuccess();
      updateSummary();
      showToast("Áp dụng voucher thành công.");
    } catch (error) {
      appliedCouponCode = "";
      appliedVoucher = null;
      localStorage.removeItem(COUPON_STORAGE_KEY);
      displayCouponError(error.message || "Voucher không hợp lệ.");
      updateSummary();
    } finally {
      couponButton.disabled = false;
    }
  }

  couponButton?.addEventListener(
    "click",
    applyCoupon
  );

  couponInput?.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCoupon();
      }
    }
  );

  /* =========================================================
     12. HÌNH THỨC NHẬN MÓN
  ========================================================= */

  function updateOrderType() {
    const useAtTable =
      orderAtTableRadio.checked;

    tableCodeGroup?.classList.toggle(
      "d-none",
      !useAtTable
    );

    if (!useAtTable) {
      tableCodeSelect.value = "";
      tableCodeError?.classList.add("d-none");
    }

    updateSummary();
  }

  orderAtTableRadio?.addEventListener(
    "change",
    updateOrderType
  );

  orderTakeawayRadio?.addEventListener(
    "change",
    updateOrderType
  );

  tableCodeSelect?.addEventListener(
    "change",
    function () {
      if (this.value) {
        tableCodeError?.classList.add("d-none");
      }
    }
  );

  /* =========================================================
     13. ĐẾM KÝ TỰ GHI CHÚ
  ========================================================= */

  orderNoteInput?.addEventListener(
    "input",
    function () {
      orderNoteCount.textContent =
        this.value.length;
    }
  );

  /* =========================================================
     14. CẬP NHẬT GIỎ HÀNG
  ========================================================= */

  updateCartButton?.addEventListener(
    "click",
    function () {
      saveCart();
      renderCart();

      showToast("Giỏ hàng đã được cập nhật.");
    }
  );

  /* =========================================================
     15. CHUYỂN SANG THANH TOÁN
  ========================================================= */

  checkoutButton?.addEventListener(
    "click",
    function () {
      if (cart.length === 0) {
        showToast(
          "Giỏ hàng đang trống.",
          "warning"
        );

        return;
      }

      const useAtTable =
        orderAtTableRadio.checked;

      if (
        useAtTable &&
        !tableCodeSelect.value
      ) {
        tableCodeError?.classList.remove("d-none");

        tableCodeSelect.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        tableCodeSelect.focus();

        return;
      }

      tableCodeError?.classList.add("d-none");

      const totals = getCartTotals();

      const pendingOrder = {
        id: generateOrderCode(),

        items: cart,

        orderType: useAtTable
          ? "at-table"
          : "takeaway",

        orderTypeText: useAtTable
          ? "Dùng tại bàn"
          : "Mang đi",

        tableCode: useAtTable
          ? tableCodeSelect.value
          : "",

        customerName:
          customerNameInput?.value.trim() || "",

        note:
          orderNoteInput?.value.trim() || "",

        couponCode: appliedCouponCode,

        subtotal: totals.subtotal,
        discount: totals.discount,
        serviceFee: totals.serviceFee,
        total: totals.total,

        status: "new",
        statusText: "Đơn mới",

        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        ORDER_STORAGE_KEY,
        JSON.stringify(pendingOrder)
      );

      localStorage.setItem(
        "mocCoffeeLastResultType",
        "payment"
      );

      window.location.href = "payment.html";
    }
  );

  /* =========================================================
     16. KHỞI TẠO
  ========================================================= */

  if (appliedCouponCode && couponInput) {
    couponInput.value = appliedCouponCode;
    applyCoupon();
  }

  updateOrderType();
  renderCart();
  loadAvailableTables();
  syncToppingsWithShop();
});
