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

  if (!form) return;

  const nameInput = document.querySelector("#payment-customer-name");
  const phoneInput = document.querySelector("#payment-customer-phone");
  const emailInput = document.querySelector("#payment-customer-email");
  const tableInput = document.querySelector("#payment-table-code");
  const noteInput = document.querySelector("#payment-note");
  const itemsElement = document.querySelector("#payment-order-items");
  const emptyElement = document.querySelector("#payment-empty-order");
  const submitButton = document.querySelector("#confirm-payment-button");
  const cashContent = document.querySelector("#cash-payment-content");
  const bankContent = document.querySelector("#bank-payment-content");
  const bankConfirmation = document.querySelector("#bank-confirmation");
  const bankConfirmed = document.querySelector("#bank-transfer-confirmed");
  const successModal = document.querySelector("#payment-success-modal");

  const pendingOrder = readJSON(KEYS.pendingOrder, null);

  let submitting = false;
  let createdOrder = null;
  let completed = false;

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = value;
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
    const number = Number(value);
    const amount = Number.isFinite(number) ? number : 0;

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getItems() {
    if (!pendingOrder) return [];

    if (Array.isArray(pendingOrder.items)) {
      return pendingOrder.items;
    }

    if (Array.isArray(pendingOrder.cart)) {
      return pendingOrder.cart;
    }

    return [];
  }

  function getToppingNames(item) {
    if (!Array.isArray(item.toppings)) return [];

    return item.toppings
      .map(function (topping) {
        return typeof topping === "string"
          ? topping
          : topping?.name;
      })
      .filter((name) => typeof name === "string" && name.trim());
  }

  function getOptionText(item) {
    const parts = [];

    if (item.size) parts.push(`Size ${item.size}`);
    if (item.sugar) parts.push(`${item.sugar} đường`);
    if (item.ice) parts.push(`${item.ice} đá`);

    const toppings = getToppingNames(item);

    if (toppings.length) {
      parts.push(`Topping: ${toppings.join(", ")}`);
    }

    return parts.join(" · ");
  }

  function getPaymentMethod() {
    const value = form.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value;

    return value === "bank-transfer" || value === "bank_transfer"
      ? "bank_transfer"
      : "cash";
  }

  function showMessage(message, type = "danger") {
    form
      .querySelectorAll(".payment-api-alert")
      .forEach((element) => element.remove());

    const alert = document.createElement("div");
    alert.className = `alert alert-${type} payment-api-alert`;
    alert.setAttribute("role", "alert");
    alert.textContent = message;

    form.prepend(alert);
    alert.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function updateSubmitButton() {
    if (!submitButton) return;

    submitButton.disabled =
      submitting ||
      completed ||
      Boolean(createdOrder) ||
      getItems().length === 0 ||
      !window.MocCoffeeApi;

    if (submitting) {
      submitButton.textContent = "Đang tạo đơn hàng...";
    } else if (createdOrder || completed) {
      submitButton.textContent = "Đơn hàng đã được tạo";
    } else {
      submitButton.textContent = "Xác nhận tạo đơn hàng";
    }
  }

  function renderOrder() {
    const items = getItems();

    if (!itemsElement) {
      throw new Error("Thiếu vùng hiển thị danh sách món.");
    }

    if (items.length === 0) {
      itemsElement.innerHTML = "";
      emptyElement?.classList.remove("d-none");
      updateSubmitButton();
      return;
    }

    emptyElement?.classList.add("d-none");

    itemsElement.innerHTML = items
      .map(function (item) {
        const quantity = Number(item.quantity);
        const price = Number(item.price);

        const image =
          item.image ||
          "../assets/images/products/default-product.jpg";

        return `
          <div class="payment-order-item">
            <img
              src="${escapeHTML(image)}"
              alt="${escapeHTML(item.name || "Sản phẩm")}"
              class="payment-item-image rounded"
              data-payment-image
            />

            <div class="payment-item-content">
              <h3 class="payment-item-name h6 mb-1">
                ${escapeHTML(item.name || "Sản phẩm")}
              </h3>

              <small class="payment-item-option text-secondary">
                ${escapeHTML(getOptionText(item))}
              </small>

              <div
                class="d-flex justify-content-between align-items-center mt-1"
              >
                <small class="payment-item-quantity text-secondary">
                  x${escapeHTML(quantity)}
                </small>

                <strong class="payment-item-total">
                  ${formatCurrency(price * quantity)}
                </strong>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const takeaway = pendingOrder.orderType === "takeaway";

    setText("#payment-order-code", "Được cấp sau khi tạo đơn");
    setText(
      "#payment-order-type",
      takeaway ? "Mang đi" : "Dùng tại bàn"
    );

    if (tableInput) {
      tableInput.value = takeaway
        ? "Mang đi"
        : pendingOrder.tableCode || "";
    }

    if (nameInput) {
      nameInput.value = pendingOrder.customerName || "";
    }

    if (noteInput) {
      noteInput.value = pendingOrder.note || "";
    }

    setText("#payment-subtotal", formatCurrency(pendingOrder.subtotal));
    setText("#payment-discount", `-${formatCurrency(pendingOrder.discount)}`);
    setText("#payment-service-fee", formatCurrency(pendingOrder.serviceFee));
    setText("#payment-total", formatCurrency(pendingOrder.total));
    setText("#bank-transfer-amount", formatCurrency(pendingOrder.total));
    setText("#transfer-content", pendingOrder.id || "MOCCOFFEE");

    updateSubmitButton();
  }

  function updatePaymentMethod() {
    const isBank = getPaymentMethod() === "bank_transfer";

    cashContent?.classList.toggle("d-none", isBank);
    bankContent?.classList.toggle("d-none", !isBank);
    bankConfirmation?.classList.toggle("d-none", !isBank);

    if (bankConfirmed) {
      bankConfirmed.required = isBank;

      if (!isBank) {
        bankConfirmed.checked = false;
      }
    }
  }

  function buildPayload() {
    const takeaway = pendingOrder.orderType === "takeaway";

    return {
      customer_name: nameInput?.value.trim() || "",
      customer_phone: phoneInput?.value.trim() || "",
      customer_email: emailInput?.value.trim() || null,
      order_type: takeaway ? "takeaway" : "at_table",
      table_code: takeaway ? null : pendingOrder.tableCode,
      note: noteInput?.value.trim() || null,
      coupon_code: pendingOrder.couponCode || null,
      payment_method: getPaymentMethod(),

      items: getItems().map(function (item) {
        return {
          product_id: Number(item.id),
          quantity: Number(item.quantity),
          size: item.size || "M",
          sugar_level: item.sugar || "70%",
          ice_level: item.ice || "70%",
          toppings: getToppingNames(item),
          note: item.note || null,
        };
      }),
    };
  }

  function validatePayload(payload) {
    if (payload.customer_name.length < 2) {
      return "Họ tên phải có ít nhất 2 ký tự.";
    }

    if (!/^0\d{9}$/.test(payload.customer_phone)) {
      return "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.";
    }

    if (
      payload.order_type === "at_table" &&
      !/^[A-Z0-9-]{1,20}$/i.test(
        String(payload.table_code || "").trim()
      )
    ) {
      return "Mã bàn không hợp lệ. Vui lòng quay lại giỏ hàng.";
    }

    if (payload.items.length > 50) {
      return "Đơn hàng không được vượt quá 50 dòng sản phẩm.";
    }

    for (const item of payload.items) {
      if (
        !Number.isSafeInteger(item.product_id) ||
        item.product_id <= 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return "Giỏ hàng có món hoặc số lượng không hợp lệ.";
      }
    }

    return "";
  }

  function getPaymentStatusText(order) {
    const labels = {
      pending: "Chưa thanh toán",
      pending_verification: "Chờ xác nhận chuyển khoản",
      paid: "Đã thanh toán",
      failed: "Thanh toán thất bại",
      refunded: "Đã hoàn tiền",
    };

    return (
      labels[order.payment_status] ||
      "Chưa xác định trạng thái thanh toán"
    );
  }

  function createResult(order) {
    if (!order.order_code || !Array.isArray(order.items)) {
      throw new Error("Phản hồi tạo đơn thiếu dữ liệu.");
    }

    return {
      orderCode: order.order_code,
      invoiceCode: order.order_code,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email || "",
      },
      tableNumber: order.table_code || "Mang đi",
      note: order.note || "",
      paymentMethod: order.payment_method,
      paymentMethodName:
        order.payment_method === "bank_transfer"
          ? "Chuyển khoản ngân hàng"
          : "Tiền mặt",
      paymentStatus: getPaymentStatusText(order),
      paymentStatusCode: order.payment_status,
      orderStatus: order.status,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount_amount),
      serviceFee: Number(order.service_fee),
      total: Number(order.total_amount),
      createdAt: order.created_at,

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
    };
  }

  function showSuccess(order) {
    setText("#payment-success-title", "Tạo đơn hàng thành công");
    setText(
      "#payment-success-message",
      `Trạng thái thanh toán: ${getPaymentStatusText(order)}.`
    );
    setText("#success-order-code", order.order_code);

    if (successModal && typeof bootstrap !== "undefined") {
      bootstrap.Modal.getOrCreateInstance(successModal).show();
    } else {
      window.location.href = "success.html?type=payment";
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (submitting || completed || createdOrder) return;

    if (!window.MocCoffeeApi) {
      showMessage("Chưa tải được chức năng gọi API.");
      return;
    }

    if (!pendingOrder || getItems().length === 0) {
      showMessage("Không có món để tạo đơn. Vui lòng quay lại giỏ hàng.");
      return;
    }

    updatePaymentMethod();
    form.classList.add("was-validated");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    let payload;

    try {
      payload = buildPayload();

      const validationError = validatePayload(payload);

      if (validationError) {
        showMessage(validationError);
        return;
      }
    } catch {
      showMessage("Dữ liệu giỏ hàng không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    submitting = true;
    updateSubmitButton();

    try {
      createdOrder = await window.MocCoffeeApi.createOrder(payload);

      const result = createResult(createdOrder);

      localStorage.setItem(KEYS.lastPayment, JSON.stringify(result));
      localStorage.setItem(KEYS.resultType, "payment");

      localStorage.removeItem(KEYS.pendingOrder);
      localStorage.removeItem(KEYS.cart);
      localStorage.removeItem(KEYS.coupon);

      completed = true;
      window.MocCoffee?.updateCartCount([]);

      showSuccess(createdOrder);
    } catch (error) {
      if (createdOrder) {
        showMessage(
          `Server đã phản hồi tạo đơn ${
            createdOrder.order_code || ""
          }, nhưng bước lưu hoặc hiển thị kết quả gặp lỗi. ` +
          "Không gửi lại đơn; hãy kiểm tra danh sách đơn với nhân viên.",
          "warning"
        );
      } else {
        showMessage(
          `${error.message || "Không thể gửi yêu cầu."} ` +
          "Nếu yêu cầu bị mất kết nối sau khi gửi, hãy kiểm tra danh sách " +
          "đơn với nhân viên trước khi thử lại để tránh tạo trùng."
        );
      }
    } finally {
      submitting = false;
      updateSubmitButton();
    }
  });

  form
    .querySelectorAll('input[name="paymentMethod"]')
    .forEach(function (input) {
      input.addEventListener("change", updatePaymentMethod);
    });

  itemsElement?.addEventListener(
    "error",
    function (event) {
      const image = event.target;

      if (
        image instanceof HTMLImageElement &&
        image.matches("[data-payment-image]") &&
        image.dataset.fallbackApplied !== "true"
      ) {
        image.dataset.fallbackApplied = "true";
        image.src = "../assets/images/products/default-product.jpg";
      }
    },
    true
  );

  function bindCopy(buttonSelector, textSelector, message) {
    document
      .querySelector(buttonSelector)
      ?.addEventListener("click", async function () {
        const text = document
          .querySelector(textSelector)
          ?.textContent.trim();

        if (!text) {
          showMessage("Không có nội dung để sao chép.", "warning");
          return;
        }

        try {
          if (!navigator.clipboard) {
            throw new Error("Clipboard không khả dụng");
          }

          await navigator.clipboard.writeText(text);

          if (window.showMocCoffeeToast) {
            window.showMocCoffeeToast(message, {
              toastSelector: "#copy-toast",
              messageSelector: "#copy-toast-message",
            });
          } else {
            showMessage(message, "success");
          }
        } catch {
          showMessage(
            "Trình duyệt không cho phép sao chép tự động. " +
            "Bạn hãy chọn và sao chép nội dung thủ công.",
            "warning"
          );
        }
      });
  }

  bindCopy(
    "#copy-account-button",
    "#bank-account-number",
    "Đã sao chép số tài khoản."
  );

  bindCopy(
    "#copy-content-button",
    "#transfer-content",
    "Đã sao chép nội dung chuyển khoản."
  );

  try {
    renderOrder();
    updatePaymentMethod();

    if (!window.MocCoffeeApi) {
      showMessage("Thiếu client-api.js. Vui lòng kiểm tra script cuối trang.");
    }
  } catch (error) {
    if (submitButton) submitButton.disabled = true;

    showMessage(
      "Không thể đọc đơn tạm. Vui lòng quay lại giỏ hàng để kiểm tra."
    );
    console.error("Lỗi khởi tạo trang thanh toán:", error);
  }
});