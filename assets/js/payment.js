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