document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEYS = {
        lastBooking: "mocCoffeeLastBooking",
        lastPayment: "mocCoffeeLastPayment",
        resultType: "mocCoffeeLastResultType"
    };

    const successIcon = document.getElementById("successIcon");
    const successTitle = document.getElementById("successTitle");
    const successMessage = document.getElementById("successMessage");
    const successDetails = document.getElementById("successDetails");

    const printButton = document.getElementById("printButton");
    const homeButton = document.getElementById("homeButton");
    const continueButton = document.getElementById("continueButton");

    const urlParameters = new URLSearchParams(
        window.location.search
    );

    const resultType =
        urlParameters.get("type") ||
        localStorage.getItem(STORAGE_KEYS.resultType) ||
        "payment";

    initializeSuccessPage();

    /**
     * Khởi tạo trang thông báo thành công.
     */
    function initializeSuccessPage() {
        setSuccessIcon();

        if (resultType === "booking") {
            showBookingResult();
        } else {
            showPaymentResult();
        }

        handleButtons();
    }

    /**
     * Hiển thị biểu tượng thành công.
     */
    function setSuccessIcon() {
        if (!successIcon) {
            return;
        }

        successIcon.innerHTML = `
            <i class="bi bi-check-circle-fill"></i>
        `;

        successIcon.classList.add("text-success");
    }

    /**
     * Hiển thị kết quả đặt bàn.
     */
    function showBookingResult() {
        const booking = getStorage(
            STORAGE_KEYS.lastBooking,
            null
        );

        document.title = "Đặt bàn thành công | Mộc Coffee";

        setText(
            successTitle,
            "Đặt bàn thành công!"
        );

        setText(
            successMessage,
            "Mộc Coffee đã nhận được yêu cầu đặt bàn của bạn. Nhân viên sẽ liên hệ để xác nhận trong thời gian sớm nhất."
        );

        if (!booking) {
            showMissingData(
                "Không tìm thấy thông tin đặt bàn."
            );

            return;
        }

        const bookingCode =
            booking.bookingCode ||
            booking.code ||
            "Đang cập nhật";

        const customerName =
            booking.customerName ||
            booking.fullName ||
            booking.name ||
            booking.customer?.name ||
            "Chưa cung cấp";

        const customerPhone =
            booking.customerPhone ||
            booking.phone ||
            booking.customer?.phone ||
            "Chưa cung cấp";

        const bookingDate =
            booking.bookingDate ||
            booking.date ||
            "";

        const bookingTime =
            booking.bookingTime ||
            booking.time ||
            "";

        const numberOfGuests =
            booking.numberOfGuests ||
            booking.guests ||
            booking.guestCount ||
            1;

        const tableName =
            booking.tableName ||
            booking.tableNumber ||
            booking.table ||
            "Nhân viên sẽ sắp xếp";

        if (successDetails) {
            successDetails.innerHTML = `
                <div class="success-information">
                    <div class="text-center mb-4">
                        <p class="text-muted mb-1">
                            Mã đặt bàn
                        </p>

                        <h3 class="text-primary fw-bold mb-0">
                            ${escapeHTML(bookingCode)}
                        </h3>
                    </div>

                    <div class="row g-3">
                        ${createInformationItem(
                "Họ và tên",
                customerName,
                "bi-person"
            )}

                        ${createInformationItem(
                "Số điện thoại",
                customerPhone,
                "bi-telephone"
            )}

                        ${createInformationItem(
                "Ngày đặt bàn",
                formatDate(bookingDate),
                "bi-calendar3"
            )}

                        ${createInformationItem(
                "Giờ đến",
                bookingTime || "Chưa xác định",
                "bi-clock"
            )}

                        ${createInformationItem(
                "Số khách",
                `${numberOfGuests} khách`,
                "bi-people"
            )}

                        ${createInformationItem(
                "Bàn",
                tableName,
                "bi-grid"
            )}
                    </div>

                    ${booking.note
                    ? `
                                <div class="alert alert-light border mt-4 mb-0">
                                    <strong>
                                        <i class="bi bi-chat-left-text me-2"></i>
                                        Ghi chú:
                                    </strong>

                                    ${escapeHTML(booking.note)}
                                </div>
                            `
                    : ""
                }

                    <div class="alert alert-warning mt-4 mb-0">
                        <i class="bi bi-info-circle me-2"></i>
                        Vui lòng đến trước giờ đặt khoảng 10 phút.
                        Bàn có thể được giữ tối đa 15 phút.
                    </div>
                </div>
            `;
        }

        /*
         * Gán dữ liệu cho các thẻ riêng nếu success.html có sử dụng.
         */
        setTextById("resultCode", bookingCode);
        setTextById("bookingCode", bookingCode);
        setTextById("bookingCustomerName", customerName);
        setTextById("bookingPhone", customerPhone);
        setTextById("bookingDate", formatDate(bookingDate));
        setTextById("bookingTime", bookingTime);
        setTextById("bookingGuests", `${numberOfGuests} khách`);
        setTextById("bookingTable", tableName);

        if (continueButton) {
            continueButton.href = "menu.html";
            continueButton.innerHTML = `
                <i class="bi bi-cup-hot me-2"></i>
                Xem thực đơn
            `;
        }

        if (printButton) {
            printButton.classList.add("d-none");
        }
    }

    /**
     * Hiển thị kết quả thanh toán hoặc đặt món.
     */
    function showPaymentResult() {
        const payment = getStorage(
            STORAGE_KEYS.lastPayment,
            null
        );

        document.title =
            "Thanh toán thành công | Mộc Coffee";

        setText(
            successTitle,
            "Đặt món thành công!"
        );

        setText(
            successMessage,
            "Đơn hàng của bạn đã được ghi nhận. Nhân viên Mộc Coffee sẽ chuẩn bị và phục vụ món trong thời gian sớm nhất."
        );

        if (!payment) {
            showMissingData(
                "Không tìm thấy thông tin đơn hàng."
            );

            return;
        }

        const orderCode =
            payment.orderCode ||
            payment.invoiceCode ||
            payment.code ||
            "Đang cập nhật";

        const customerName =
            payment.customer?.name ||
            payment.customerName ||
            payment.name ||
            "Khách hàng";

        const customerPhone =
            payment.customer?.phone ||
            payment.customerPhone ||
            payment.phone ||
            "Chưa cung cấp";

        const tableNumber =
            payment.tableNumber ||
            payment.table ||
            "Mang về";

        const paymentMethod =
            payment.paymentMethodName ||
            getPaymentMethodName(payment.paymentMethod);

        const totalAmount =
            Number(payment.total) || 0;

        const createdAt =
            payment.createdAt ||
            new Date().toISOString();

        const products = getPaymentProducts(payment);

        if (successDetails) {
            successDetails.innerHTML = `
                <div class="success-information">
                    <div class="text-center mb-4">
                        <p class="text-muted mb-1">
                            Mã đơn hàng
                        </p>

                        <h3 class="text-primary fw-bold mb-0">
                            ${escapeHTML(orderCode)}
                        </h3>
                    </div>

                    <div class="row g-3">
                        ${createInformationItem(
                "Khách hàng",
                customerName,
                "bi-person"
            )}

                        ${createInformationItem(
                "Số điện thoại",
                customerPhone,
                "bi-telephone"
            )}

                        ${createInformationItem(
                "Bàn",
                tableNumber,
                "bi-grid"
            )}

                        ${createInformationItem(
                "Phương thức",
                paymentMethod,
                "bi-credit-card"
            )}

                        ${createInformationItem(
                "Thời gian",
                formatDateTime(createdAt),
                "bi-clock"
            )}

                        ${createInformationItem(
                "Trạng thái",
                payment.paymentStatus ||
                "Đã tiếp nhận",
                "bi-check-circle"
            )}
                    </div>

                    ${products.length > 0
                    ? createProductList(products)
                    : ""
                }

                    <div class="border-top mt-4 pt-3">
                        ${createMoneyRow(
                    "Tạm tính",
                    Number(payment.subtotal) || 0
                )}

                        ${createMoneyRow(
                    "Giảm giá",
                    -(Number(payment.discount) || 0)
                )}

                        ${createMoneyRow(
                    "Phí phục vụ",
                    Number(payment.serviceFee) || 0
                )}

                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <strong class="fs-5">
                                Tổng thanh toán
                            </strong>

                            <strong class="fs-4 text-primary">
                                ${formatCurrency(totalAmount)}
                            </strong>
                        </div>
                    </div>

                    ${payment.note
                    ? `
                                <div class="alert alert-light border mt-4 mb-0">
                                    <strong>
                                        <i class="bi bi-chat-left-text me-2"></i>
                                        Ghi chú:
                                    </strong>

                                    ${escapeHTML(payment.note)}
                                </div>
                            `
                    : ""
                }
                </div>
            `;
        }

        /*
         * Gán dữ liệu cho các thẻ riêng nếu success.html sử dụng.
         */
        setTextById("resultCode", orderCode);
        setTextById("orderCode", orderCode);
        setTextById("paymentCustomerName", customerName);
        setTextById("paymentPhone", customerPhone);
        setTextById("paymentTable", tableNumber);
        setTextById("paymentMethod", paymentMethod);
        setTextById("paymentTime", formatDateTime(createdAt));
        setTextById("totalAmount", formatCurrency(totalAmount));

        if (continueButton) {
            continueButton.href = "menu.html";
            continueButton.innerHTML = `
                <i class="bi bi-plus-circle me-2"></i>
                Gọi thêm món
            `;
        }
    }

    /**
     * Lấy sản phẩm từ đơn hàng.
     */
    function getPaymentProducts(payment) {
        if (Array.isArray(payment.items)) {
            return payment.items;
        }

        if (Array.isArray(payment.cart)) {
            return payment.cart;
        }

        return [];
    }

    /**
     * Tạo HTML danh sách sản phẩm.
     */
    function createProductList(products) {
        const productHTML = products
            .map(function (product) {
                const quantity =
                    Number(product.quantity) || 1;

                const price =
                    Number(product.price) || 0;

                const toppingNames =
                    Array.isArray(product.toppings)
                        ? product.toppings
                            .map(function (topping) {
                                return topping.name;
                            })
                            .join(", ")
                        : "";

                return `
                    <div class="d-flex justify-content-between py-2 border-bottom">
                        <div>
                            <span class="fw-semibold">
                                ${escapeHTML(product.name)}
                            </span>

                            <small class="text-muted">
                                × ${quantity}
                            </small>

                            ${product.size
                        ? `
                                        <small class="text-muted d-block">
                                            Size: ${escapeHTML(product.size)}
                                        </small>
                                    `
                        : ""
                    }

                            ${toppingNames
                        ? `
                                        <small class="text-muted d-block">
                                            Topping:
                                            ${escapeHTML(toppingNames)}
                                        </small>
                                    `
                        : ""
                    }
                        </div>

                        <span class="text-nowrap">
                            ${formatCurrency(price * quantity)}
                        </span>
                    </div>
                `;
            })
            .join("");

        return `
            <div class="mt-4">
                <h5 class="mb-3">
                    <i class="bi bi-receipt me-2"></i>
                    Chi tiết đơn hàng
                </h5>

                ${productHTML}
            </div>
        `;
    }

    /**
     * Tạo một ô thông tin.
     */
    function createInformationItem(label, value, icon) {
        return `
            <div class="col-md-6">
                <div class="border rounded p-3 h-100">
                    <small class="text-muted d-block mb-1">
                        <i class="bi ${icon} me-1"></i>
                        ${escapeHTML(label)}
                    </small>

                    <strong>
                        ${escapeHTML(value)}
                    </strong>
                </div>
            </div>
        `;
    }

    /**
     * Tạo một dòng tiền.
     */
    function createMoneyRow(label, amount) {
        let amountText;

        if (amount < 0) {
            amountText =
                `-${formatCurrency(Math.abs(amount))}`;
        } else {
            amountText = formatCurrency(amount);
        }

        return `
            <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">
                    ${escapeHTML(label)}
                </span>

                <span>
                    ${amountText}
                </span>
            </div>
        `;
    }

    /**
     * Xử lý các nút.
     */
    function handleButtons() {
        if (printButton) {
            printButton.addEventListener(
                "click",
                function () {
                    window.print();
                }
            );
        }

        if (homeButton) {
            homeButton.addEventListener(
                "click",
                function () {
                    window.location.href = "../index.html";
                }
            );
        }
    }

    /**
     * Hiển thị khi không tìm thấy dữ liệu.
     */
    function showMissingData(message) {
        setText(
            successTitle,
            "Không tìm thấy thông tin"
        );

        setText(successMessage, message);

        if (successIcon) {
            successIcon.innerHTML = `
                <i class="bi bi-exclamation-circle-fill"></i>
            `;

            successIcon.classList.remove("text-success");
            successIcon.classList.add("text-warning");
        }

        if (successDetails) {
            successDetails.innerHTML = `
                <div class="alert alert-warning text-center">
                    <i class="bi bi-info-circle me-2"></i>
                    ${escapeHTML(message)}
                </div>
            `;
        }

        if (printButton) {
            printButton.classList.add("d-none");
        }
    }

    function getPaymentMethodName(method) {
        const paymentMethods = {
            cash: "Tiền mặt tại bàn",
            bank: "Chuyển khoản ngân hàng",
            "bank-transfer": "Chuyển khoản ngân hàng",
            momo: "Ví MoMo",
            zalopay: "Ví ZaloPay"
        };

        return (
            paymentMethods[method] ||
            "Thanh toán tại bàn"
        );
    }

    function getStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);

            return data
                ? JSON.parse(data)
                : defaultValue;
        } catch (error) {
            console.error(
                `Không thể đọc dữ liệu ${key}:`,
                error
            );

            return defaultValue;
        }
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

    function formatDate(dateValue) {
        if (!dateValue) {
            return "Chưa xác định";
        }

        /*
         * Thêm T00:00:00 để tránh bị lệch ngày
         * do múi giờ khi dateValue có dạng YYYY-MM-DD.
         */
        const date = new Date(
            dateValue.includes("T")
                ? dateValue
                : `${dateValue}T00:00:00`
        );

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function formatDateTime(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Chưa xác định";
        }

        return new Intl.DateTimeFormat("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    function setTextById(id, value) {
        const element = document.getElementById(id);

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
});