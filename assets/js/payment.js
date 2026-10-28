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
