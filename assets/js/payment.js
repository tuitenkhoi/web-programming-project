<<<<<<< HEAD
document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEYS = {
        cart: "mocCoffeeCart",
        coupon: "mocCoffeeCouponCode",
        pendingOrder: "mocCoffeePendingOrder",
        lastPayment: "mocCoffeeLastPayment",
        orders: "mocCoffeeOrders",
        resultType: "mocCoffeeLastResultType"
    };

    const paymentForm = document.getElementById("paymentForm");
    const orderItemsElement = document.getElementById("orderItems");
    const subtotalElement = document.getElementById("subtotal");
    const discountElement = document.getElementById("discount");
    const serviceFeeElement = document.getElementById("serviceFee");
    const totalElement = document.getElementById("total");

    const customerNameInput = document.getElementById("customerName");
    const customerPhoneInput = document.getElementById("customerPhone");
    const customerEmailInput = document.getElementById("customerEmail");
    const tableNumberInput = document.getElementById("tableNumber");
    const orderNoteInput = document.getElementById("orderNote");

    const bankTransferInfo = document.getElementById("bankTransferInfo");
    const cashPaymentInfo = document.getElementById("cashPaymentInfo");
    const paymentButton = document.getElementById("paymentButton");

    let pendingOrder = getLocalStorage(STORAGE_KEYS.pendingOrder, null);

    init();

    function init() {
        if (!pendingOrder || !getOrderItems().length) {
            showEmptyOrder();
            return;
        }

        renderOrder();
        setupPaymentMethods();
        setupFormSubmit();
    }

    /**
     * Lấy dữ liệu JSON từ localStorage.
     */
    function getLocalStorage(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Không thể đọc dữ liệu ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Lưu dữ liệu JSON vào localStorage.
     */
    function setLocalStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    /**
     * Hỗ trợ cả pendingOrder.items và pendingOrder.cart.
     */
    function getOrderItems() {
        if (!pendingOrder) return [];

        if (Array.isArray(pendingOrder.items)) {
            return pendingOrder.items;
        }

        if (Array.isArray(pendingOrder.cart)) {
            return pendingOrder.cart;
        }

        return [];
    }

    /**
     * Hiển thị các món trong đơn hàng.
     */
    function renderOrder() {
        const items = getOrderItems();

        if (orderItemsElement) {
            orderItemsElement.innerHTML = items
                .map((item) => {
                    const quantity = Number(item.quantity) || 1;
                    const price = Number(item.price) || 0;
                    const itemTotal = price * quantity;
                    const size = item.size ? ` - Size ${escapeHTML(item.size)}` : "";
                    const image =
                        item.image ||
                        "../assets/images/products/default-product.jpg";

                    return `
                        <div class="payment-order-item d-flex align-items-center mb-3">
                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(item.name || "Sản phẩm")}"
                                class="rounded me-3"
                                width="65"
                                height="65"
                                style="object-fit: cover;"
                                onerror="this.src='../assets/images/products/default-product.jpg'"
                            >

                            <div class="flex-grow-1">
                                <h6 class="mb-1">
                                    ${escapeHTML(item.name || "Sản phẩm")}
                                </h6>

                                <small class="text-muted">
                                    Số lượng: ${quantity}${size}
                                </small>
                            </div>

                            <strong class="text-nowrap">
                                ${formatCurrency(itemTotal)}
                            </strong>
                        </div>
                    `;
                })
                .join("");
        }

        const totals = calculateTotals(items);

        pendingOrder.subtotal = totals.subtotal;
        pendingOrder.discount = totals.discount;
        pendingOrder.serviceFee = totals.serviceFee;
        pendingOrder.total = totals.total;

        setText(subtotalElement, formatCurrency(totals.subtotal));
        setText(discountElement, `-${formatCurrency(totals.discount)}`);
        setText(serviceFeeElement, formatCurrency(totals.serviceFee));
        setText(totalElement, formatCurrency(totals.total));

        if (tableNumberInput && pendingOrder.tableNumber) {
            tableNumberInput.value = pendingOrder.tableNumber;
        }

        if (orderNoteInput && pendingOrder.note) {
            orderNoteInput.value = pendingOrder.note;
        }
    }

    /**
     * Tính lại tiền để tránh dữ liệu bị thiếu.
     */
    function calculateTotals(items) {
        const calculatedSubtotal = items.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;

            return sum + price * quantity;
        }, 0);

        const subtotal =
            Number(pendingOrder.subtotal) || calculatedSubtotal;

        const discount = Number(pendingOrder.discount) || 0;
        const serviceFee = Number(pendingOrder.serviceFee) || 0;

        const total =
            Number(pendingOrder.total) ||
            Math.max(0, subtotal - discount + serviceFee);

        return {
            subtotal,
            discount,
            serviceFee,
            total
        };
    }

    /**
     * Xử lý khi người dùng đổi phương thức thanh toán.
     */
    function setupPaymentMethods() {
        const paymentMethods = document.querySelectorAll(
            'input[name="paymentMethod"]'
        );

        paymentMethods.forEach((method) => {
            method.addEventListener("change", updatePaymentMethodDisplay);
        });

        updatePaymentMethodDisplay();
    }

    function updatePaymentMethodDisplay() {
        const selectedMethod = document.querySelector(
            'input[name="paymentMethod"]:checked'
        );

        const methodValue = selectedMethod?.value || "cash";

        if (bankTransferInfo) {
            bankTransferInfo.classList.toggle(
                "d-none",
                methodValue !== "bank-transfer" && methodValue !== "bank"
            );
        }

        if (cashPaymentInfo) {
            cashPaymentInfo.classList.toggle(
                "d-none",
                methodValue !== "cash"
            );
        }

        if (paymentButton) {
            if (
                methodValue === "bank-transfer" ||
                methodValue === "bank"
            ) {
                paymentButton.innerHTML =
                    '<i class="bi bi-qr-code me-2"></i>Xác nhận chuyển khoản';
            } else {
                paymentButton.innerHTML =
                    '<i class="bi bi-check-circle me-2"></i>Xác nhận đặt món';
            }
        }
    }

    /**
     * Xử lý xác nhận thanh toán.
     */
    function setupFormSubmit() {
        if (!paymentForm) return;

        paymentForm.addEventListener("submit", (event) => {
            event.preventDefault();

            clearValidationErrors();

            if (!validateForm()) {
                return;
            }

            completePayment();
        });
    }

    function validateForm() {
        let isValid = true;

        const customerName = customerNameInput?.value.trim() || "";
        const customerPhone = customerPhoneInput?.value.trim() || "";
        const phoneRegex = /^(0|\+84)[0-9]{9}$/;

        if (customerName.length < 2) {
            showInputError(
                customerNameInput,
                "Vui lòng nhập họ và tên."
            );
            isValid = false;
        }

        if (!phoneRegex.test(customerPhone.replace(/\s/g, ""))) {
            showInputError(
                customerPhoneInput,
                "Số điện thoại không hợp lệ."
            );
            isValid = false;
        }

        if (
            customerEmailInput &&
            customerEmailInput.value.trim() &&
            !isValidEmail(customerEmailInput.value.trim())
        ) {
            showInputError(
                customerEmailInput,
                "Địa chỉ email không hợp lệ."
            );
            isValid = false;
        }

        const selectedPaymentMethod = document.querySelector(
            'input[name="paymentMethod"]:checked'
        );

        if (!selectedPaymentMethod) {
            showMessage(
                "Vui lòng chọn phương thức thanh toán.",
                "danger"
            );
            isValid = false;
        }

        return isValid;
    }

    function completePayment() {
        const selectedPaymentMethod = document.querySelector(
            'input[name="paymentMethod"]:checked'
        );

        const paymentMethod = selectedPaymentMethod?.value || "cash";
        const orderCode = generateCode("HD");

        const completedOrder = {
            ...pendingOrder,
            orderCode,
            invoiceCode: orderCode,
            customer: {
                name: customerNameInput?.value.trim() || "",
                phone: customerPhoneInput?.value.trim() || "",
                email: customerEmailInput?.value.trim() || ""
            },
            tableNumber:
                tableNumberInput?.value.trim() ||
                pendingOrder.tableNumber ||
                "",
            note:
                orderNoteInput?.value.trim() ||
                pendingOrder.note ||
                "",
            paymentMethod,
            paymentMethodName: getPaymentMethodName(paymentMethod),
            paymentStatus:
                paymentMethod === "cash" ? "pending" : "paid",
            orderStatus: "new",
            createdAt: new Date().toISOString()
        };

        saveOrder(completedOrder);

        setLocalStorage(STORAGE_KEYS.lastPayment, completedOrder);
        localStorage.setItem(STORAGE_KEYS.resultType, "payment");

        localStorage.removeItem(STORAGE_KEYS.cart);
        localStorage.removeItem(STORAGE_KEYS.coupon);
        localStorage.removeItem(STORAGE_KEYS.pendingOrder);

        if (window.MocCoffee?.updateCartCount) {
            window.MocCoffee.updateCartCount();
        }

        setButtonLoading(true);

        setTimeout(() => {
            window.location.href = "success.html?type=payment";
        }, 700);
    }

    /**
     * Lưu đơn để trang quản trị có thể đọc sau này.
     */
    function saveOrder(order) {
        const orders = getLocalStorage(STORAGE_KEYS.orders, []);
        const validOrders = Array.isArray(orders) ? orders : [];

        validOrders.unshift(order);
        setLocalStorage(STORAGE_KEYS.orders, validOrders);
    }

    function getPaymentMethodName(method) {
        const paymentMethods = {
            cash: "Tiền mặt tại bàn",
            bank: "Chuyển khoản ngân hàng",
            "bank-transfer": "Chuyển khoản ngân hàng",
            momo: "Ví MoMo",
            zalopay: "Ví ZaloPay"
        };

        return paymentMethods[method] || "Thanh toán tại bàn";
    }

    function showEmptyOrder() {
        if (orderItemsElement) {
            orderItemsElement.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-cart-x display-4 text-muted"></i>
                    <h5 class="mt-3">Chưa có đơn hàng để thanh toán</h5>
                    <p class="text-muted">
                        Vui lòng chọn món trước khi thanh toán.
                    </p>
                    <a href="menu.html" class="btn btn-primary">
                        <i class="bi bi-cup-hot me-2"></i>
                        Xem thực đơn
                    </a>
                </div>
            `;
        }

        if (paymentButton) {
            paymentButton.disabled = true;
        }
    }

    function setButtonLoading(isLoading) {
        if (!paymentButton) return;

        paymentButton.disabled = isLoading;

        if (isLoading) {
            paymentButton.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                ></span>
                Đang xử lý...
            `;
        }
    }

    function showInputError(input, message) {
        if (!input) return;

        input.classList.add("is-invalid");

        const feedback = document.createElement("div");
        feedback.className = "invalid-feedback";
        feedback.textContent = message;

        input.parentElement.appendChild(feedback);
    }

    function clearValidationErrors() {
        document
            .querySelectorAll(".is-invalid")
            .forEach((element) => element.classList.remove("is-invalid"));

        document
            .querySelectorAll(".invalid-feedback")
            .forEach((element) => element.remove());

        document
            .querySelectorAll(".payment-alert")
            .forEach((element) => element.remove());
    }

    function showMessage(message, type = "danger") {
        const alert = document.createElement("div");

        alert.className = `alert alert-${type} payment-alert mt-3`;
        alert.textContent = message;

        if (paymentForm) {
            paymentForm.prepend(alert);
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function generateCode(prefix) {
        const date = new Date();
        const timePart = date
            .toISOString()
            .replace(/\D/g, "")
            .slice(2, 14);
        const randomPart = Math.floor(100 + Math.random() * 900);

        return `${prefix}${timePart}${randomPart}`;
    }

    function formatCurrency(amount) {
        if (window.MocCoffee?.formatCurrency) {
            return window.MocCoffee.formatCurrency(amount);
        }

        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND"
        }).format(Number(amount) || 0);
    }

    function setText(element, text) {
        if (element) {
            element.textContent = text;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
});
=======
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const KEYS = {
    cart: "mocCoffeeCart",
    coupon: "mocCoffeeCouponCode",
    pendingOrder: "mocCoffeePendingOrder",
    lastPayment: "mocCoffeeLastPayment",
    resultType: "mocCoffeeLastResultType",
  };

  const form = document.querySelector("#payment-form");
  const nameInput = document.querySelector("#payment-customer-name");
  const phoneInput = document.querySelector("#payment-customer-phone");
  const emailInput = document.querySelector("#payment-customer-email");
  const tableInput = document.querySelector("#payment-table-code");
  const noteInput = document.querySelector("#payment-note");
  const itemsElement = document.querySelector("#payment-order-items");
  const emptyElement = document.querySelector("#payment-empty-order");
  const orderCodeElement = document.querySelector("#payment-order-code");
  const orderTypeElement = document.querySelector("#payment-order-type");
  const subtotalElement = document.querySelector("#payment-subtotal");
  const discountElement = document.querySelector("#payment-discount");
  const serviceFeeElement = document.querySelector("#payment-service-fee");
  const totalElement = document.querySelector("#payment-total");
  const submitButton = document.querySelector("#confirm-payment-button");
  const cashContent = document.querySelector("#cash-payment-content");
  const bankContent = document.querySelector("#bank-payment-content");
  const successModal = document.querySelector("#payment-success-modal");
  const successOrderCode = document.querySelector("#success-order-code");

  if (!form || !window.MocCoffeeApi) return;

  const pendingOrder = readJSON(KEYS.pendingOrder, null);

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function getItems() {
    if (!pendingOrder) return [];
    return Array.isArray(pendingOrder.items)
      ? pendingOrder.items
      : Array.isArray(pendingOrder.cart)
        ? pendingOrder.cart
        : [];
  }

  function getToppingNames(item) {
    return Array.isArray(item.toppings)
      ? item.toppings
          .map((topping) =>
            typeof topping === "string"
              ? topping
              : topping.name
          )
          .filter(Boolean)
      : [];
  }

  function getOptionText(item) {
    const parts = [];
    if (item.size) parts.push(`Size ${item.size}`);
    if (item.sugar) parts.push(`${item.sugar} đường`);
    if (item.ice) parts.push(`${item.ice} đá`);
    const toppings = getToppingNames(item);
    if (toppings.length) parts.push(`Topping: ${toppings.join(", ")}`);
    return parts.join(" · ");
  }

  function renderOrder() {
    const items = getItems();

    if (!pendingOrder || items.length === 0) {
      itemsElement.innerHTML = "";
      emptyElement?.classList.remove("d-none");
      if (submitButton) submitButton.disabled = true;
      return;
    }

    emptyElement?.classList.add("d-none");
    itemsElement.innerHTML = items.map(function (item) {
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const image = item.image || "../assets/images/products/default-product.jpg";

      return `
        <div class="payment-order-item">
          <img src="${escapeHTML(image)}" alt="${escapeHTML(item.name || "Sản phẩm")}" class="payment-item-image rounded" onerror="this.src='../assets/images/products/default-product.jpg'" />
          <div class="payment-item-content">
            <h3 class="payment-item-name h6 mb-1">${escapeHTML(item.name || "Sản phẩm")}</h3>
            <small class="payment-item-option text-secondary">${escapeHTML(getOptionText(item))}</small>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <small class="payment-item-quantity text-secondary">x${quantity}</small>
              <strong class="payment-item-total">${formatCurrency(price * quantity)}</strong>
            </div>
          </div>
        </div>`;
    }).join("");

    orderCodeElement.textContent = pendingOrder.id || "Sẽ tạo khi xác nhận";
    orderTypeElement.textContent = pendingOrder.orderTypeText ||
      (pendingOrder.orderType === "takeaway" ? "Mang đi" : "Dùng tại bàn");
    tableInput.value = pendingOrder.tableCode || "";
    noteInput.value = pendingOrder.note || "";
    nameInput.value = pendingOrder.customerName || "";
    subtotalElement.textContent = formatCurrency(pendingOrder.subtotal);
    discountElement.textContent = `-${formatCurrency(pendingOrder.discount)}`;
    serviceFeeElement.textContent = formatCurrency(pendingOrder.serviceFee);
    totalElement.textContent = formatCurrency(pendingOrder.total);
  }

  function updatePaymentMethod() {
    const method = document.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value || "cash";

    cashContent?.classList.toggle("d-none", method !== "cash");
    bankContent?.classList.toggle("d-none", method !== "bank-transfer");
  }

  function showMessage(message, type = "danger") {
    form.querySelectorAll(".payment-api-alert").forEach((item) => item.remove());
    const alert = document.createElement("div");
    alert.className = `alert alert-${type} payment-api-alert`;
    alert.textContent = message;
    form.prepend(alert);
    alert.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setLoading(loading) {
    if (!submitButton) return;
    submitButton.disabled = loading;
    submitButton.innerHTML = loading
      ? '<span class="spinner-border spinner-border-sm me-2"></span>Đang tạo đơn hàng...'
      : '<i class="bi bi-shield-check me-1"></i>Xác nhận thanh toán';
  }

  function buildPayload() {
    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value || "cash";

    return {
      customer_name: nameInput.value.trim(),
      customer_phone: phoneInput.value.trim(),
      customer_email: emailInput.value.trim() || null,
      order_type: pendingOrder.orderType === "takeaway"
        ? "takeaway"
        : "at_table",
      table_code: pendingOrder.orderType === "takeaway"
        ? null
        : pendingOrder.tableCode,
      note: noteInput.value.trim() || null,
      coupon_code: pendingOrder.couponCode || null,
      payment_method: paymentMethod,
      items: getItems().map(function (item) {
        return {
          product_id: Number(item.id),
          quantity: Number(item.quantity) || 1,
          size: item.size || "M",
          sugar_level: item.sugar || "70%",
          ice_level: item.ice || "70%",
          toppings: getToppingNames(item),
          note: item.note || null,
        };
      }),
    };
  }

  function createCompletedOrder(order) {
    const paymentMethodName = order.payment_method === "bank_transfer"
      ? "Chuyển khoản ngân hàng"
      : "Tiền mặt tại bàn";

    return {
      orderCode: order.order_code,
      invoiceCode: order.order_code,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email || "",
      },
      tableNumber: order.table_code || "Mang về",
      note: order.note || "",
      paymentMethod: order.payment_method,
      paymentMethodName,
      paymentStatus: order.payment_status_text,
      orderStatus: order.status,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount_amount),
      serviceFee: Number(order.service_fee),
      total: Number(order.total_amount),
      items: order.items.map(function (item) {
        return {
          id: item.product_id,
          name: item.product_name,
          price: Number(item.unit_price),
          quantity: Number(item.quantity),
          size: item.size,
          sugar: item.sugar_level,
          ice: item.ice_level,
          toppings: item.toppings,
          note: item.note || "",
          image: window.MocCoffeeApi.resolveProductImage(
            {
              image: item.image,
              image_url: item.image_url,
            },
            true
          ),
        };
      }),
      createdAt: order.created_at,
    };
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    form.classList.add("was-validated");

    if (!pendingOrder || getItems().length === 0) {
      showMessage("Không có món để tạo đơn hàng.");
      return;
    }

    if (!form.checkValidity()) return;

    setLoading(true);

    try {
      const order = await window.MocCoffeeApi.createOrder(buildPayload());
      const completedOrder = createCompletedOrder(order);

      localStorage.setItem(KEYS.lastPayment, JSON.stringify(completedOrder));
      localStorage.setItem(KEYS.resultType, "payment");
      localStorage.removeItem(KEYS.cart);
      localStorage.removeItem(KEYS.coupon);
      localStorage.removeItem(KEYS.pendingOrder);
      window.MocCoffee?.updateCartCount([]);

      if (successOrderCode) successOrderCode.textContent = order.order_code;

      if (successModal && typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(successModal).show();
      } else {
        window.location.href = "success.html?type=payment";
      }
    } catch (error) {
      showMessage(error.message);
      setLoading(false);
    }
  });

  document.querySelectorAll('input[name="paymentMethod"]')
    .forEach((input) => input.addEventListener("change", updatePaymentMethod));

  document.querySelector("#copy-account-button")?.addEventListener("click", async function () {
    await navigator.clipboard.writeText("0123456789");
    window.showMocCoffeeToast?.("Đã sao chép số tài khoản.", {
      toastSelector: "#copy-toast",
      messageSelector: "#copy-toast-message",
    });
  });

  document.querySelector("#copy-content-button")?.addEventListener("click", async function () {
    await navigator.clipboard.writeText(pendingOrder?.id || "MOC COFFEE");
    window.showMocCoffeeToast?.("Đã sao chép nội dung chuyển khoản.", {
      toastSelector: "#copy-toast",
      messageSelector: "#copy-toast-message",
    });
  });

  renderOrder();
  updatePaymentMethod();
});
>>>>>>> 3036a5bd52b830fca782721b2d9335bccd0e8296
