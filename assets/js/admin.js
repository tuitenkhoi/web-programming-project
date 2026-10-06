"use strict";

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     1. CÁC HÀM DÙNG CHUNG
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

  function setText(selector, value) {
    const element = $(selector);

    if (element) {
      element.textContent = value;
    }
  }

  function hideModal(modalSelector) {
    const modalElement = $(modalSelector);

    if (!modalElement || typeof bootstrap === "undefined") {
      return;
    }

    const modal =
      bootstrap.Modal.getInstance(modalElement) ||
      bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.hide();
  }

  function showToast(message, type = "success") {
    const toastElement =
      $("#admin-toast") || $("#login-toast");

    if (!toastElement || typeof bootstrap === "undefined") {
      return;
    }

    const messageElement =
      $("#admin-toast-message") ||
      $("#login-toast-message");

    const iconElement = $("#admin-toast-icon");

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (iconElement) {
      iconElement.className = "bi me-2";

      if (type === "danger") {
        iconElement.classList.add(
          "bi-x-circle-fill",
          "text-danger"
        );
      } else if (type === "warning") {
        iconElement.classList.add(
          "bi-exclamation-triangle-fill",
          "text-warning"
        );
      } else {
        iconElement.classList.add(
          "bi-check-circle-fill",
          "text-success"
        );
      }
    }

    bootstrap.Toast.getOrCreateInstance(toastElement).show();
  }

  async function copyText(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(message || "Đã sao chép thông tin.");
    } catch (error) {
      showToast("Không thể sao chép thông tin.", "danger");
    }
  }

  function getDataRow(selector, id) {
    return $$(selector).find(
      (row) => row.dataset.id === id
    );
  }

  function resetBootstrapValidation(form) {
    if (!form) return;

    form.classList.remove("was-validated");
  }

  /* =========================================================
     2. SIDEBAR, NĂM HIỆN TẠI VÀ GIAO DIỆN CHUNG
  ========================================================= */

  const sidebar = $("#admin-sidebar");
  const sidebarOverlay = $("#sidebar-overlay");
  const openSidebarButton = $("#open-sidebar-button");
  const closeSidebarButton = $("#close-sidebar-button");

  function openSidebar() {
    sidebar?.classList.add("show");
    sidebarOverlay?.classList.add("show");
    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    sidebar?.classList.remove("show");
    sidebarOverlay?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  }

  openSidebarButton?.addEventListener("click", openSidebar);
  closeSidebarButton?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 992) {
      closeSidebar();
    }
  });

  const currentYear = new Date().getFullYear();

  setText("#current-year", currentYear);
  setText("#cover-current-year", currentYear);

  $$("[data-bs-toggle='tooltip']").forEach((element) => {
    if (typeof bootstrap !== "undefined") {
      new bootstrap.Tooltip(element);
    }
  });

  /* =========================================================
     3. TRANG ĐĂNG NHẬP
  ========================================================= */

  function initializeLoginPage() {
    const loginForm = $("#admin-login-form");

    if (!loginForm) return;

    const usernameInput = $("#login-username");
    const passwordInput = $("#login-password");
    const rememberInput = $("#remember-login");
    const togglePasswordButton = $("#toggle-password-button");
    const passwordIcon = $("#password-toggle-icon");
    const fillDemoButton = $("#fill-demo-account-button");
    const errorAlert = $("#login-error-alert");
    const errorMessage = $("#login-error-message");
    const successAlert = $("#login-success-alert");
    const submitButton = $("#login-submit-button");
    const buttonContent = $("#login-button-content");
    const loadingContent = $("#login-loading-content");

    const rememberedUsername =
      localStorage.getItem("mocCoffeeAdminUsername");

    if (rememberedUsername) {
      usernameInput.value = rememberedUsername;
      rememberInput.checked = true;
    }

    togglePasswordButton?.addEventListener("click", function () {
      const isPassword =
        passwordInput.type === "password";

      passwordInput.type = isPassword ? "text" : "password";

      passwordIcon.className = isPassword
        ? "bi bi-eye-slash"
        : "bi bi-eye";

      togglePasswordButton.setAttribute(
        "aria-label",
        isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
      );
    });

    fillDemoButton?.addEventListener("click", function () {
      usernameInput.value = "admin";
      passwordInput.value = "123456";

      errorAlert?.classList.add("d-none");

      showToast("Đã điền tài khoản thử nghiệm.");
    });

    $("#copy-demo-username")?.addEventListener(
      "click",
      function () {
        copyText("admin", "Đã sao chép tên đăng nhập.");
      }
    );

    $("#copy-demo-password")?.addEventListener(
      "click",
      function () {
        copyText("123456", "Đã sao chép mật khẩu.");
      }
    );

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();

      errorAlert?.classList.add("d-none");
      successAlert?.classList.add("d-none");

      loginForm.classList.add("was-validated");

      if (!loginForm.checkValidity()) {
        return;
      }

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      submitButton.disabled = true;
      buttonContent?.classList.add("d-none");
      loadingContent?.classList.remove("d-none");

      window.setTimeout(function () {
        if (username === "admin" && password === "123456") {
          if (rememberInput.checked) {
            localStorage.setItem(
              "mocCoffeeAdminUsername",
              username
            );
          } else {
            localStorage.removeItem(
              "mocCoffeeAdminUsername"
            );
          }

          sessionStorage.setItem(
            "mocCoffeeAdminLoggedIn",
            "true"
          );

          successAlert?.classList.remove("d-none");

          window.setTimeout(function () {
            window.location.href = "dashboard.html";
          }, 800);
        } else {
          errorMessage.textContent =
            "Tên đăng nhập hoặc mật khẩu không chính xác.";

          errorAlert?.classList.remove("d-none");

          submitButton.disabled = false;
          buttonContent?.classList.remove("d-none");
          loadingContent?.classList.add("d-none");
        }
      }, 700);
    });

    const forgotPasswordForm = $("#forgot-password-form");

    forgotPasswordForm?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        forgotPasswordForm.classList.add(
          "was-validated"
        );

        if (!forgotPasswordForm.checkValidity()) {
          return;
        }

        $("#forgot-password-message")?.classList.remove(
          "d-none"
        );
      }
    );
  }

  // Trang đăng nhập thật được xử lý trong admin-api.js.

  /* =========================================================
     4. DASHBOARD
  ========================================================= */

  function initializeDashboard() {
    const greetingElement = $("#dashboard-greeting");

    if (!greetingElement) return;

    const now = new Date();
    const hour = now.getHours();

    let greeting = "Xin chào";

    if (hour < 11) {
      greeting = "Chào buổi sáng";
    } else if (hour < 18) {
      greeting = "Chào buổi chiều";
    } else {
      greeting = "Chào buổi tối";
    }

    greetingElement.textContent =
      `${greeting}, Quản lý!`;

    const dateText = now.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    setText("#current-date", dateText);

    $("#refresh-dashboard-button")?.addEventListener(
      "click",
      function () {
        this.querySelector("i")?.classList.add("spin");

        window.setTimeout(() => {
          this.querySelector("i")?.classList.remove("spin");
          showToast("Dữ liệu Dashboard đã được cập nhật.");
        }, 600);
      }
    );

    $("#revenue-period-filter")?.addEventListener(
      "change",
      function () {
        showToast(
          `Đã chuyển thống kê sang ${this.options[this.selectedIndex].text}.`
        );
      }
    );
  }

  initializeDashboard();

  /* =========================================================
     5. QUẢN LÝ ĐẶT BÀN
  ========================================================= */

  const bookingStatusInformation = {
    pending: {
      text: "Chờ xác nhận",
      className: "text-bg-warning",
    },
    confirmed: {
      text: "Đã xác nhận",
      className: "text-bg-success",
    },
    arrived: {
      text: "Đã đến",
      className: "text-bg-primary",
    },
    completed: {
      text: "Hoàn thành",
      className: "text-bg-secondary",
    },
    cancelled: {
      text: "Đã hủy",
      className: "text-bg-danger",
    },
  };

  function updateBookingStatus(row, status) {
    if (!row || !bookingStatusInformation[status]) return;

    row.dataset.status = status;

    const badge = $(".badge", row);
    const information = bookingStatusInformation[status];

    if (badge) {
      badge.className = `badge ${information.className}`;
      badge.textContent = information.text;
    }
  }

  function initializeBookingsPage() {
    const rows = $$(".booking-row");

    if (!rows.length) return;

    const searchInput = $("#booking-search-input");
    const dateFilter = $("#booking-date-filter");
    const areaFilter = $("#booking-area-filter");
    const statusFilter = $("#booking-status-filter");

    function filterBookings() {
      const keyword = normalizeText(searchInput?.value);
      const selectedDate = dateFilter?.value || "";
      const selectedArea = areaFilter?.value || "all";
      const selectedStatus =
        statusFilter?.value || "all";

      let visibleCount = 0;

      rows.forEach((row) => {
        const searchableText = normalizeText(
          `${row.dataset.id} ${row.dataset.name} ${row.dataset.phone}`
        );

        const matchSearch =
          !keyword || searchableText.includes(keyword);

        const matchDate =
          !selectedDate ||
          row.dataset.date === selectedDate;

        const matchArea =
          selectedArea === "all" ||
          row.dataset.area === selectedArea;

        const matchStatus =
          selectedStatus === "all" ||
          row.dataset.status === selectedStatus;

        const visible =
          matchSearch &&
          matchDate &&
          matchArea &&
          matchStatus;

        row.classList.toggle("d-none", !visible);

        if (visible) visibleCount++;
      });

      setText("#visible-booking-count", visibleCount);

      $("#empty-booking-result")?.classList.toggle(
        "d-none",
        visibleCount !== 0
      );
    }

    searchInput?.addEventListener("input", filterBookings);
    dateFilter?.addEventListener("change", filterBookings);
    areaFilter?.addEventListener("change", filterBookings);
    statusFilter?.addEventListener(
      "change",
      filterBookings
    );

    $("#reset-booking-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        dateFilter.value = "";
        areaFilter.value = "all";
        statusFilter.value = "all";
        filterBookings();
      }
    );

    $$(".view-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".booking-row",
          this.dataset.id
        );

        if (!row) return;

        const cells = $$("td", row);
        const information =
          bookingStatusInformation[row.dataset.status];

        setText(
          "#detail-booking-id",
          `#${row.dataset.id}`
        );

        setText(
          "#detail-customer-name",
          row.dataset.name
        );

        setText(
          "#detail-customer-phone",
          row.dataset.phone
        );

        setText(
          "#detail-booking-datetime",
          `${cells[2]?.innerText.trim() || ""}`
        );

        setText(
          "#detail-table-name",
          cells[3]?.querySelector("strong")
            ?.textContent || ""
        );

        setText(
          "#detail-area",
          cells[3]?.querySelector("small")
            ?.textContent.trim() || ""
        );

        setText(
          "#detail-guest-count",
          cells[4]?.textContent.trim() || ""
        );

        const detailBadge = $("#detail-booking-status");

        if (detailBadge && information) {
          detailBadge.className =
            `badge ${information.className}`;

          detailBadge.textContent = information.text;
        }

        $("#detail-edit-button")?.setAttribute(
          "data-id",
          row.dataset.id
        );
      });
    });

    $$(".edit-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".booking-row",
          this.dataset.id
        );

        if (!row) return;

        setText(
          "#booking-form-title",
          `Chỉnh sửa ${row.dataset.id}`
        );

        $("#admin-booking-id").value = row.dataset.id;
        $("#admin-customer-name").value =
          row.dataset.name;
        $("#admin-customer-phone").value =
          row.dataset.phone;
        $("#admin-booking-date").value =
          row.dataset.date;
        $("#admin-booking-area").value =
          row.dataset.area;
        $("#admin-booking-status").value =
          row.dataset.status;
      });
    });

    $("#open-add-booking-button")?.addEventListener(
      "click",
      function () {
        const form = $("#admin-booking-form");

        form?.reset();
        resetBootstrapValidation(form);

        setText(
          "#booking-form-title",
          "Thêm yêu cầu đặt bàn"
        );

        $("#admin-booking-id").value = "";
      }
    );

    $$(".confirm-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".booking-row",
          this.dataset.id
        );

        updateBookingStatus(row, "confirmed");
        filterBookings();

        showToast("Đã xác nhận yêu cầu đặt bàn.");
      });
    });

    $$(".arrived-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".booking-row",
          this.dataset.id
        );

        updateBookingStatus(row, "arrived");
        filterBookings();

        showToast("Đã xác nhận khách đến quán.");
      });
    });

    $$(".complete-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".booking-row",
          this.dataset.id
        );

        updateBookingStatus(row, "completed");
        filterBookings();

        showToast("Đặt bàn đã hoàn thành.");
      });
    });

    $$(".cancel-booking-button").forEach((button) => {
      button.addEventListener("click", function () {
        $("#cancel-booking-id").value =
          this.dataset.id;

        setText(
          "#cancel-booking-code",
          `#${this.dataset.id}`
        );
      });
    });

    $("#confirm-cancel-booking")?.addEventListener(
      "click",
      function () {
        const reasonInput = $("#cancel-booking-reason");
        const errorElement = $("#cancel-reason-error");

        if (!reasonInput.value.trim()) {
          errorElement?.classList.remove("d-none");
          return;
        }

        errorElement?.classList.add("d-none");

        const row = getDataRow(
          ".booking-row",
          $("#cancel-booking-id").value
        );

        updateBookingStatus(row, "cancelled");
        filterBookings();

        reasonInput.value = "";
        hideModal("#cancel-booking-modal");

        showToast("Đã hủy yêu cầu đặt bàn.");
      }
    );

    $("#admin-booking-form")?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        this.classList.add("was-validated");

        if (!this.checkValidity()) return;

        const id = $("#admin-booking-id").value;

        if (id) {
          const row = getDataRow(".booking-row", id);

          if (row) {
            row.dataset.name =
              $("#admin-customer-name").value.trim();

            row.dataset.phone =
              $("#admin-customer-phone").value.trim();

            row.dataset.date =
              $("#admin-booking-date").value;

            row.dataset.area =
              $("#admin-booking-area").value;

            updateBookingStatus(
              row,
              $("#admin-booking-status").value
            );

            const customerCell = $$("td", row)[1];

            if (customerCell) {
              customerCell.querySelector("strong").textContent =
                row.dataset.name;

              customerCell.querySelector("small").textContent =
                row.dataset.phone;
            }
          }
        }

        hideModal("#booking-form-modal");
        filterBookings();

        showToast(
          id
            ? "Đã cập nhật thông tin đặt bàn."
            : "Đã thêm yêu cầu đặt bàn mới."
        );
      }
    );

    $("#print-booking-button")?.addEventListener(
      "click",
      () => window.print()
    );
  }

  initializeBookingsPage();

  /* =========================================================
     6. QUẢN LÝ ĐƠN HÀNG
  ========================================================= */

  const orderStatusInformation = {
    new: {
      text: "Đơn mới",
      className: "text-bg-danger",
    },
    preparing: {
      text: "Đang chế biến",
      className: "text-bg-warning",
    },
    ready: {
      text: "Sẵn sàng phục vụ",
      className: "text-bg-primary",
    },
    served: {
      text: "Đã phục vụ",
      className: "text-bg-secondary",
    },
    payment: {
      text: "Chờ thanh toán",
      className: "text-bg-info",
    },
    completed: {
      text: "Hoàn thành",
      className: "text-bg-success",
    },
    cancelled: {
      text: "Đã hủy",
      className: "text-bg-secondary",
    },
  };

  function updateOrderStatus(row, status) {
    if (!row || !orderStatusInformation[status]) return;

    row.dataset.status = status;

    const badge = $(".badge", row);
    const information = orderStatusInformation[status];

    if (badge) {
      badge.className = `badge ${information.className}`;
      badge.textContent = information.text;
    }
  }

  function initializeOrdersPage() {
    const rows = $$(".order-row");

    if (!rows.length) return;

    const searchInput = $("#order-search-input");
    const dateFilter = $("#order-date-filter");
    const typeFilter = $("#order-type-filter");
    const statusFilter = $("#order-status-filter");

    let quickStatus = "all";

    function filterOrders() {
      const keyword = normalizeText(searchInput?.value);
      const selectedDate = dateFilter?.value || "";
      const selectedType = typeFilter?.value || "all";
      const selectedStatus =
        statusFilter?.value || "all";

      let visibleCount = 0;

      rows.forEach((row) => {
        const searchableText = normalizeText(
          `${row.dataset.id} ${row.dataset.table} ${row.dataset.customer}`
        );

        const matchSearch =
          !keyword || searchableText.includes(keyword);

        const matchDate =
          !selectedDate ||
          row.dataset.date === selectedDate;

        const matchType =
          selectedType === "all" ||
          row.dataset.type === selectedType;

        const matchSelectStatus =
          selectedStatus === "all" ||
          row.dataset.status === selectedStatus;

        const matchQuickStatus =
          quickStatus === "all" ||
          row.dataset.status === quickStatus;

        const visible =
          matchSearch &&
          matchDate &&
          matchType &&
          matchSelectStatus &&
          matchQuickStatus;

        row.classList.toggle("d-none", !visible);

        if (visible) visibleCount++;
      });

      setText("#visible-order-count", visibleCount);

      $("#empty-order-result")?.classList.toggle(
        "d-none",
        visibleCount !== 0
      );
    }

    searchInput?.addEventListener("input", filterOrders);
    dateFilter?.addEventListener("change", filterOrders);
    typeFilter?.addEventListener("change", filterOrders);
    statusFilter?.addEventListener("change", filterOrders);

    $$(".order-status-tab").forEach((button) => {
      button.addEventListener("click", function () {
        $$(".order-status-tab").forEach((item) =>
          item.classList.remove("active")
        );

        this.classList.add("active");
        quickStatus = this.dataset.status;

        filterOrders();
      });
    });

    $("#reset-order-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        dateFilter.value = "";
        typeFilter.value = "all";
        statusFilter.value = "all";
        quickStatus = "all";

        $$(".order-status-tab").forEach((button) => {
          button.classList.toggle(
            "active",
            button.dataset.status === "all"
          );
        });

        filterOrders();
      }
    );

    $$(".update-order-status-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".order-row",
          this.dataset.id
        );

        updateOrderStatus(row, this.dataset.status);
        filterOrders();

        showToast("Đã cập nhật trạng thái đơn hàng.");
      });
    });

    $$(".view-order-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".order-row",
          this.dataset.id
        );

        if (!row) return;

        const cells = $$("td", row);
        const status =
          orderStatusInformation[row.dataset.status];

        setText("#detail-order-id", `#${row.dataset.id}`);
        setText(
          "#detail-order-customer",
          row.dataset.customer
        );

        setText(
          "#detail-order-table",
          row.dataset.type === "takeaway"
            ? "Mang đi"
            : `Bàn ${row.dataset.table}`
        );

        setText(
          "#detail-order-time",
          cells[3]?.innerText.trim() || ""
        );

        setText(
          "#detail-order-total",
          formatCurrency(row.dataset.amount)
        );

        const badge = $("#detail-order-status");

        if (badge && status) {
          badge.className =
            `badge ${status.className}`;

          badge.textContent = status.text;
        }
      });
    });

    $$(".cancel-order-button").forEach((button) => {
      button.addEventListener("click", function () {
        $("#cancel-order-id").value = this.dataset.id;

        setText(
          "#cancel-order-code",
          `#${this.dataset.id}`
        );
      });
    });

    $("#confirm-cancel-order")?.addEventListener(
      "click",
      function () {
        const reasonInput = $("#cancel-order-reason");
        const errorElement = $("#cancel-order-error");

        if (!reasonInput.value.trim()) {
          errorElement?.classList.remove("d-none");
          return;
        }

        errorElement?.classList.add("d-none");

        const row = getDataRow(
          ".order-row",
          $("#cancel-order-id").value
        );

        updateOrderStatus(row, "cancelled");
        filterOrders();

        reasonInput.value = "";
        hideModal("#cancel-order-modal");

        showToast("Đã hủy đơn hàng.");
      }
    );

    const orderItemsContainer = $("#admin-order-items");
    const orderItemTemplate = $("#admin-order-item-template");
    const discountInput = $("#admin-order-discount");

    function calculateAdminOrder() {
      let subtotal = 0;

      $$(".admin-order-item-row").forEach((row) => {
        const productSelect = $(
          ".order-product-select",
          row
        );

        const quantityInput = $(
          ".order-item-quantity",
          row
        );

        const selectedOption =
          productSelect?.selectedOptions[0];

        const price = Number(
          selectedOption?.dataset.price || 0
        );

        const quantity = Math.max(
          1,
          Number(quantityInput?.value || 1)
        );

        const rowTotal = price * quantity;

        const priceElement = $(".order-item-price", row);
        const totalElement = $(".order-item-total", row);

        if (priceElement) {
          priceElement.textContent = formatCurrency(price);
        }

        if (totalElement) {
          totalElement.textContent =
            formatCurrency(rowTotal);
        }

        subtotal += rowTotal;
      });

      const discount = Math.max(
        0,
        Number(discountInput?.value || 0)
      );

      const total = Math.max(0, subtotal - discount);

      setText(
        "#admin-order-subtotal",
        formatCurrency(subtotal)
      );

      setText(
        "#admin-order-total",
        formatCurrency(total)
      );
    }

    orderItemsContainer?.addEventListener(
      "change",
      calculateAdminOrder
    );

    orderItemsContainer?.addEventListener(
      "input",
      calculateAdminOrder
    );

    orderItemsContainer?.addEventListener(
      "click",
      function (event) {
        const removeButton = event.target.closest(
          ".remove-order-item"
        );

        if (!removeButton) return;

        const rows = $$(".admin-order-item-row");

        if (rows.length <= 1) {
          showToast(
            "Đơn hàng phải có ít nhất một món.",
            "warning"
          );

          return;
        }

        removeButton
          .closest(".admin-order-item-row")
          ?.remove();

        calculateAdminOrder();
      }
    );

    $("#add-order-item-button")?.addEventListener(
      "click",
      function () {
        if (!orderItemTemplate || !orderItemsContainer) {
          return;
        }

        orderItemsContainer.appendChild(
          orderItemTemplate.content.cloneNode(true)
        );

        calculateAdminOrder();
      }
    );

    discountInput?.addEventListener(
      "input",
      calculateAdminOrder
    );

    $$("input[name='adminOrderType']").forEach(
      (radio) => {
        radio.addEventListener("change", function () {
          const tableGroup = $("#admin-order-table-group");
          const tableSelect = $("#admin-order-table");

          const useAtTable =
            $("#admin-order-at-table")?.checked;

          tableGroup?.classList.toggle(
            "d-none",
            !useAtTable
          );

          if (!useAtTable && tableSelect) {
            tableSelect.value = "";
          }
        });
      }
    );

    $("#admin-order-form")?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        this.classList.add("was-validated");

        const atTable =
          $("#admin-order-at-table")?.checked;

        const selectedTable =
          $("#admin-order-table")?.value;

        if (atTable && !selectedTable) {
          showToast("Vui lòng chọn bàn.", "warning");
          return;
        }

        const hasProduct = $$(".order-product-select").some(
          (select) => select.value
        );

        if (!hasProduct) {
          $("#admin-order-items-error")?.classList.remove(
            "d-none"
          );

          return;
        }

        $("#admin-order-items-error")?.classList.add(
          "d-none"
        );

        hideModal("#order-form-modal");

        showToast(
          $("#admin-order-id").value
            ? "Đã cập nhật đơn hàng."
            : "Đã tạo đơn hàng mới."
        );
      }
    );

    $("#print-order-list")?.addEventListener(
      "click",
      () => window.print()
    );

    $("#print-order-detail")?.addEventListener(
      "click",
      () => window.print()
    );

    calculateAdminOrder();
  }

  initializeOrdersPage();

  /* =========================================================
     7. QUẢN LÝ SẢN PHẨM
  ========================================================= */

  const productStatusInformation = {
    available: {
      text: "Đang bán",
      className: "text-bg-success",
    },
    unavailable: {
      text: "Tạm hết món",
      className: "text-bg-warning",
    },
    hidden: {
      text: "Ngừng bán",
      className: "text-bg-danger",
    },
  };

  function updateProductStatus(row, status) {
    if (!row || !productStatusInformation[status]) return;

    row.dataset.status = status;

    const badge = $(".badge", row);
    const information = productStatusInformation[status];

    if (badge) {
      badge.className = `badge ${information.className}`;
      badge.textContent = information.text;
    }
  }

  function initializeProductsPage() {
    const rows = $$(".admin-product-row");

    if (!rows.length) return;

    const searchInput = $("#product-search-input");
    const categoryFilter = $("#product-category-filter");
    const statusFilter = $("#product-status-filter");

    function filterProducts() {
      const keyword = normalizeText(searchInput?.value);
      const category =
        categoryFilter?.value || "all";
      const status = statusFilter?.value || "all";

      let visibleCount = 0;

      rows.forEach((row) => {
        const searchableText = normalizeText(
          `${row.dataset.id} ${row.dataset.name}`
        );

        const visible =
          (!keyword ||
            searchableText.includes(keyword)) &&
          (category === "all" ||
            row.dataset.category === category) &&
          (status === "all" ||
            row.dataset.status === status);

        row.classList.toggle("d-none", !visible);

        if (visible) visibleCount++;
      });

      setText("#visible-product-count", visibleCount);

      $("#empty-product-result")?.classList.toggle(
        "d-none",
        visibleCount !== 0
      );
    }

    searchInput?.addEventListener("input", filterProducts);
    categoryFilter?.addEventListener(
      "change",
      filterProducts
    );
    statusFilter?.addEventListener(
      "change",
      filterProducts
    );

    $("#reset-product-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        categoryFilter.value = "all";
        statusFilter.value = "all";
        $("#product-sort").value = "default";

        filterProducts();
      }
    );

    $("#product-sort")?.addEventListener(
      "change",
      function () {
        const body = $("#product-table-body");
        const sortedRows = [...rows];

        sortedRows.sort((first, second) => {
          if (this.value === "name-asc") {
            return first.dataset.name.localeCompare(
              second.dataset.name,
              "vi"
            );
          }

          if (this.value === "name-desc") {
            return second.dataset.name.localeCompare(
              first.dataset.name,
              "vi"
            );
          }

          if (this.value === "price-asc") {
            return (
              Number(first.dataset.price) -
              Number(second.dataset.price)
            );
          }

          if (this.value === "price-desc") {
            return (
              Number(second.dataset.price) -
              Number(first.dataset.price)
            );
          }

          return 0;
        });

        sortedRows.forEach((row) => body?.appendChild(row));
      }
    );

    $$(".change-product-status").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".admin-product-row",
          this.dataset.id
        );

        updateProductStatus(row, this.dataset.status);
        filterProducts();

        showToast("Đã cập nhật trạng thái món.");
      });
    });

    $$(".view-product-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".admin-product-row",
          this.dataset.id
        );

        if (!row) return;

        const image = $("img", row);
        const cells = $$("td", row);
        const status =
          productStatusInformation[row.dataset.status];

        setText(
          "#detail-product-id",
          `#${row.dataset.id}`
        );

        setText(
          "#detail-product-name",
          row.dataset.name
        );

        setText(
          "#detail-product-category",
          cells[2]?.textContent.trim() || ""
        );

        setText(
          "#detail-product-price",
          formatCurrency(row.dataset.price)
        );

        setText(
          "#detail-product-sold",
          cells[4]?.textContent.trim() || ""
        );

        const detailImage = $("#detail-product-image");

        if (detailImage && image) {
          detailImage.src = image.src;
          detailImage.alt = row.dataset.name;
        }

        const badge = $("#detail-product-status");

        if (badge && status) {
          badge.className =
            `badge ${status.className}`;

          badge.textContent = status.text;
        }

        $("#detail-edit-product-button")?.setAttribute(
          "data-id",
          row.dataset.id
        );
      });
    });

    $$(".edit-product-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".admin-product-row",
          this.dataset.id
        );

        if (!row) return;

        setText(
          "#product-form-title",
          `Chỉnh sửa ${row.dataset.name}`
        );

        $("#admin-product-id").value = row.dataset.id;
        $("#admin-product-name").value =
          row.dataset.name;
        $("#admin-product-category").value =
          row.dataset.category;
        $("#admin-product-price").value =
          row.dataset.price;
        $("#admin-product-status").value =
          row.dataset.status;

        const image = $("img", row);

        if (image && $("#product-image-preview")) {
          $("#product-image-preview").src = image.src;
        }
      });
    });

    $("#open-add-product-button")?.addEventListener(
      "click",
      function () {
        const form = $("#admin-product-form");

        form?.reset();
        resetBootstrapValidation(form);

        setText("#product-form-title", "Thêm món mới");

        $("#admin-product-id").value = "";
        $("#product-description-count").textContent = "0";
      }
    );

    $("#admin-product-description")?.addEventListener(
      "input",
      function () {
        setText(
          "#product-description-count",
          this.value.length
        );
      }
    );

    $("#admin-product-image")?.addEventListener(
      "change",
      function () {
        const file = this.files[0];

        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast(
            "Hình ảnh không được vượt quá 2MB.",
            "warning"
          );

          this.value = "";
          return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
          $("#product-image-preview").src =
            event.target.result;
        };

        reader.readAsDataURL(file);
      }
    );

    $("#admin-product-form")?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        this.classList.add("was-validated");

        if (!this.checkValidity()) return;

        const id = $("#admin-product-id").value;

        if (id) {
          const row = getDataRow(
            ".admin-product-row",
            id
          );

          if (row) {
            row.dataset.name =
              $("#admin-product-name").value.trim();

            row.dataset.category =
              $("#admin-product-category").value;

            row.dataset.price =
              $("#admin-product-price").value;

            updateProductStatus(
              row,
              $("#admin-product-status").value
            );

            const cells = $$("td", row);

            cells[0].querySelector("strong").textContent =
              row.dataset.name;

            cells[3].textContent = formatCurrency(
              row.dataset.price
            );
          }
        }

        hideModal("#product-form-modal");
        filterProducts();

        showToast(
          id
            ? "Đã cập nhật thông tin món."
            : "Đã thêm món mới."
        );
      }
    );

    $$(".delete-product-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".admin-product-row",
          this.dataset.id
        );

        $("#delete-product-id").value = this.dataset.id;

        setText(
          "#delete-product-name",
          row?.dataset.name || ""
        );
      });
    });

    $("#confirm-delete-product")?.addEventListener(
      "click",
      function () {
        const row = getDataRow(
          ".admin-product-row",
          $("#delete-product-id").value
        );

        row?.remove();

        hideModal("#delete-product-modal");
        showToast("Đã xóa món khỏi thực đơn.");

        filterProducts();
      }
    );

    $("#product-list-view")?.addEventListener(
      "click",
      function () {
        $("#product-table-view")?.classList.remove("d-none");
        $("#product-grid-container")?.classList.add("d-none");

        this.className = "btn btn-coffee";

        $("#product-grid-view").className =
          "btn btn-outline-coffee";
      }
    );

    $("#product-grid-view")?.addEventListener(
      "click",
      function () {
        const grid = $("#product-grid-container");

        grid.innerHTML = '<div class="row g-4"></div>';

        const gridRow = $(".row", grid);

        rows
          .filter((row) => !row.classList.contains("d-none"))
          .forEach((row) => {
            const image = $("img", row);
            const information =
              productStatusInformation[row.dataset.status];

            const column = document.createElement("div");

            column.className =
              "col-12 col-sm-6 col-lg-4 col-xl-3";

            column.innerHTML = `
              <div class="card h-100 border-0 shadow-sm">
                <img
                  src="${image?.src || ""}"
                  class="card-img-top admin-grid-product-image"
                  alt="${row.dataset.name}"
                />

                <div class="card-body">
                  <h3 class="h5">${row.dataset.name}</h3>

                  <p class="fw-bold text-danger">
                    ${formatCurrency(row.dataset.price)}
                  </p>

                  <span class="badge ${information.className}">
                    ${information.text}
                  </span>
                </div>
              </div>
            `;

            gridRow.appendChild(column);
          });

        $("#product-table-view")?.classList.add("d-none");
        grid.classList.remove("d-none");

        this.className = "btn btn-coffee";

        $("#product-list-view").className =
          "btn btn-outline-coffee";
      }
    );
  }

  // Trang sản phẩm thật được xử lý trong admin-api.js.

  /* =========================================================
     8. QUẢN LÝ BÀN
  ========================================================= */

  const tableStatusInformation = {
    available: {
      text: "Bàn trống",
      className: "available",
      badge: "text-bg-success",
    },
    occupied: {
      text: "Đang sử dụng",
      className: "occupied",
      badge: "text-bg-danger",
    },
    reserved: {
      text: "Đã đặt trước",
      className: "reserved",
      badge: "text-bg-warning",
    },
    cleaning: {
      text: "Đang dọn dẹp",
      className: "cleaning",
      badge: "text-bg-info",
    },
    maintenance: {
      text: "Bảo trì",
      className: "maintenance",
      badge: "text-bg-secondary",
    },
  };

  function updateTableStatus(item, status) {
    const information = tableStatusInformation[status];

    if (!item || !information) return;

    item.dataset.status = status;

    const card = $(".table-management-card", item);
    const label = $(".table-status-label", item);

    if (card) {
      Object.values(tableStatusInformation).forEach(
        (statusItem) =>
          card.classList.remove(statusItem.className)
      );

      card.classList.add(information.className);
    }

    if (label) {
      label.textContent = information.text;
    }
  }

  function initializeTablesPage() {
    const items = $$(".admin-table-item");

    if (!items.length) return;

    const searchInput = $("#table-search-input");
    const areaFilter = $("#table-area-filter");
    const statusFilter = $("#table-status-filter");

    function filterTables() {
      const keyword = normalizeText(searchInput?.value);
      const area = areaFilter?.value || "all";
      const status = statusFilter?.value || "all";

      let visibleCount = 0;

      items.forEach((item) => {
        const searchableText = normalizeText(
          `${item.dataset.id} ${item.dataset.name}`
        );

        const visible =
          (!keyword ||
            searchableText.includes(keyword)) &&
          (area === "all" ||
            item.dataset.area === area) &&
          (status === "all" ||
            item.dataset.status === status);

        item.classList.toggle("d-none", !visible);

        if (visible) visibleCount++;
      });

      setText("#visible-table-count", visibleCount);

      $("#empty-table-result")?.classList.toggle(
        "d-none",
        visibleCount !== 0
      );
    }

    searchInput?.addEventListener("input", filterTables);
    areaFilter?.addEventListener("change", filterTables);
    statusFilter?.addEventListener("change", filterTables);

    $("#reset-table-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        areaFilter.value = "all";
        statusFilter.value = "all";
        filterTables();
      }
    );

    $$(".change-table-status").forEach((button) => {
      button.addEventListener("click", function () {
        const item = getDataRow(
          ".admin-table-item",
          this.dataset.id
        );

        updateTableStatus(item, this.dataset.status);
        filterTables();

        showToast("Đã cập nhật trạng thái bàn.");
      });
    });

    $$(".view-table-button").forEach((button) => {
      button.addEventListener("click", function () {
        const item = getDataRow(
          ".admin-table-item",
          this.dataset.id
        );

        if (!item) return;

        const information =
          tableStatusInformation[item.dataset.status];

        setText("#detail-table-code", item.dataset.id);
        setText("#detail-table-name", item.dataset.name);
        setText(
          "#detail-table-capacity",
          `${item.dataset.capacity} người`
        );

        const areaNames = {
          indoor: "Trong nhà",
          outdoor: "Ngoài trời",
          balcony: "Ban công",
        };

        setText(
          "#detail-table-area",
          areaNames[item.dataset.area]
        );

        const badge = $("#detail-table-status");

        if (badge) {
          badge.className =
            `badge ${information.badge}`;

          badge.textContent = information.text;
        }

        $("#detail-edit-table-button")?.setAttribute(
          "data-id",
          item.dataset.id
        );
      });
    });

    $$(".edit-table-button").forEach((button) => {
      button.addEventListener("click", function () {
        const item = getDataRow(
          ".admin-table-item",
          this.dataset.id
        );

        if (!item) return;

        setText(
          "#table-form-title",
          `Chỉnh sửa ${item.dataset.name}`
        );

        $("#admin-table-original-id").value =
          item.dataset.id;

        $("#admin-table-code").value =
          item.dataset.id;

        $("#admin-table-name").value =
          item.dataset.name;

        $("#admin-table-area").value =
          item.dataset.area;

        $("#admin-table-capacity").value =
          item.dataset.capacity;

        $("#admin-table-status").value =
          item.dataset.status;
      });
    });

    $("#open-add-table-button")?.addEventListener(
      "click",
      function () {
        const form = $("#admin-table-form");

        form?.reset();
        resetBootstrapValidation(form);

        setText("#table-form-title", "Thêm bàn mới");

        $("#admin-table-original-id").value = "";
      }
    );

    $("#admin-table-form")?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        this.classList.add("was-validated");

        if (!this.checkValidity()) return;

        const originalId =
          $("#admin-table-original-id").value;

        if (originalId) {
          const item = getDataRow(
            ".admin-table-item",
            originalId
          );

          if (item) {
            item.dataset.name =
              $("#admin-table-name").value.trim();

            item.dataset.area =
              $("#admin-table-area").value;

            item.dataset.capacity =
              $("#admin-table-capacity").value;

            updateTableStatus(
              item,
              $("#admin-table-status").value
            );

            const title = $("h4", item);
            const capacity = $(".table-card-body p", item);

            if (title) {
              title.textContent = item.dataset.name;
            }

            if (capacity) {
              capacity.textContent =
                `${item.dataset.capacity} người`;
            }
          }
        }

        hideModal("#table-form-modal");
        filterTables();

        showToast(
          originalId
            ? "Đã cập nhật thông tin bàn."
            : "Đã thêm bàn mới."
        );
      }
    );

    $("#refresh-tables-button")?.addEventListener(
      "click",
      function () {
        this.querySelector("i")?.classList.add("spin");

        window.setTimeout(() => {
          this.querySelector("i")?.classList.remove("spin");
          showToast("Đã làm mới trạng thái bàn.");
        }, 500);
      }
    );
  }

  initializeTablesPage();

  /* =========================================================
     9. QUẢN LÝ HÓA ĐƠN
  ========================================================= */

  const invoiceStatusInformation = {
    pending: {
      text: "Chờ thanh toán",
      className: "text-bg-warning",
    },
    paid: {
      text: "Đã thanh toán",
      className: "text-bg-success",
    },
    cancelled: {
      text: "Đã hủy",
      className: "text-bg-danger",
    },
  };

  function updateInvoiceStatus(row, status) {
    const information = invoiceStatusInformation[status];

    if (!row || !information) return;

    row.dataset.status = status;

    const badge = $(".badge", row);

    if (badge) {
      badge.className = `badge ${information.className}`;
      badge.textContent = information.text;
    }
  }

  function initializeInvoicesPage() {
    const rows = $$(".invoice-row");

    if (!rows.length) return;

    const searchInput = $("#invoice-search-input");
    const dateFrom = $("#invoice-date-from");
    const dateTo = $("#invoice-date-to");
    const methodFilter = $("#payment-method-filter");
    const statusFilter = $("#invoice-status-filter");

    function filterInvoices() {
      const keyword = normalizeText(searchInput?.value);
      const fromValue = dateFrom?.value || "";
      const toValue = dateTo?.value || "";
      const method = methodFilter?.value || "all";
      const status = statusFilter?.value || "all";

      let visibleCount = 0;

      rows.forEach((row) => {
        const searchableText = normalizeText(
          `${row.dataset.id} ${row.dataset.order} ${row.dataset.customer}`
        );

        const rowDate = row.dataset.date;

        const visible =
          (!keyword ||
            searchableText.includes(keyword)) &&
          (!fromValue || rowDate >= fromValue) &&
          (!toValue || rowDate <= toValue) &&
          (method === "all" ||
            row.dataset.method === method) &&
          (status === "all" ||
            row.dataset.status === status);

        row.classList.toggle("d-none", !visible);

        if (visible) visibleCount++;
      });

      setText("#visible-invoice-count", visibleCount);

      $("#empty-invoice-result")?.classList.toggle(
        "d-none",
        visibleCount !== 0
      );
    }

    searchInput?.addEventListener("input", filterInvoices);
    dateFrom?.addEventListener("change", filterInvoices);
    dateTo?.addEventListener("change", filterInvoices);
    methodFilter?.addEventListener(
      "change",
      filterInvoices
    );
    statusFilter?.addEventListener(
      "change",
      filterInvoices
    );

    $("#reset-invoice-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        dateFrom.value = "";
        dateTo.value = "";
        methodFilter.value = "all";
        statusFilter.value = "all";

        filterInvoices();
      }
    );

    $("#invoice-sort")?.addEventListener(
      "change",
      function () {
        const body = $("#invoice-table-body");
        const sortedRows = [...rows];

        sortedRows.sort((first, second) => {
          if (this.value === "oldest") {
            return first.dataset.date.localeCompare(
              second.dataset.date
            );
          }

          if (this.value === "amount-desc") {
            return (
              Number(second.dataset.amount) -
              Number(first.dataset.amount)
            );
          }

          if (this.value === "amount-asc") {
            return (
              Number(first.dataset.amount) -
              Number(second.dataset.amount)
            );
          }

          return second.dataset.date.localeCompare(
            first.dataset.date
          );
        });

        sortedRows.forEach((row) => body?.appendChild(row));
      }
    );

    $$(".view-invoice-button").forEach((button) => {
      button.addEventListener("click", function () {
        const row = getDataRow(
          ".invoice-row",
          this.dataset.id
        );

        if (!row) return;

        const cells = $$("td", row);
        const information =
          invoiceStatusInformation[row.dataset.status];

        setText(
          "#detail-invoice-id",
          `#${row.dataset.id}`
        );

        setText(
          "#detail-order-id",
          `#${row.dataset.order}`
        );

        setText(
          "#detail-invoice-customer",
          row.dataset.customer
        );

        setText(
          "#detail-invoice-time",
          cells[3]?.innerText.trim() || ""
        );

        setText(
          "#detail-invoice-total",
          formatCurrency(row.dataset.amount)
        );

        setText(
          "#detail-payment-method",
          row.dataset.method === "cash"
            ? "Tiền mặt"
            : "Chuyển khoản"
        );

        const badge = $("#detail-invoice-status");

        if (badge && information) {
          badge.className =
            `badge ${information.className}`;

          badge.textContent = information.text;
        }
      });
    });

    $$(".confirm-payment-button").forEach((button) => {
      button.addEventListener("click", function () {
        $("#confirm-payment-invoice-id").value =
          this.dataset.id;

        setText(
          "#confirm-payment-code",
          `#${this.dataset.id}`
        );
      });
    });

    $("#submit-confirm-payment")?.addEventListener(
      "click",
      function () {
        const row = getDataRow(
          ".invoice-row",
          $("#confirm-payment-invoice-id").value
        );

        if (row) {
          row.dataset.method =
            $("#confirm-payment-method").value;

          updateInvoiceStatus(row, "paid");
        }

        hideModal("#confirm-payment-modal");
        filterInvoices();

        showToast("Đã xác nhận thanh toán hóa đơn.");
      }
    );

    $$(".cancel-invoice-button").forEach((button) => {
      button.addEventListener("click", function () {
        $("#cancel-invoice-id").value =
          this.dataset.id;

        setText(
          "#cancel-invoice-code",
          `#${this.dataset.id}`
        );
      });
    });

    $("#submit-cancel-invoice")?.addEventListener(
      "click",
      function () {
        const reason = $("#cancel-invoice-reason");
        const errorElement = $("#cancel-invoice-error");

        if (!reason.value.trim()) {
          errorElement?.classList.remove("d-none");
          return;
        }

        errorElement?.classList.add("d-none");

        const row = getDataRow(
          ".invoice-row",
          $("#cancel-invoice-id").value
        );

        updateInvoiceStatus(row, "cancelled");

        reason.value = "";

        hideModal("#cancel-invoice-modal");
        filterInvoices();

        showToast("Đã hủy hóa đơn.");
      }
    );

    const invoiceOrderValues = {
      OD086: 185000,
      OD085: 268000,
      OD084: 139000,
    };

    function calculateInvoiceForm() {
      const subtotal = Number(
        $("#invoice-subtotal")?.value || 0
      );

      const discount = Number(
        $("#invoice-discount")?.value || 0
      );

      const serviceFee = Number(
        $("#invoice-service-fee")?.value || 0
      );

      const total = Math.max(
        0,
        subtotal + serviceFee - discount
      );

      setText(
        "#invoice-form-total",
        formatCurrency(total)
      );
    }

    $("#invoice-order-id")?.addEventListener(
      "change",
      function () {
        $("#invoice-subtotal").value =
          invoiceOrderValues[this.value] || 0;

        calculateInvoiceForm();
      }
    );

    $("#invoice-discount")?.addEventListener(
      "input",
      calculateInvoiceForm
    );

    $("#invoice-service-fee")?.addEventListener(
      "input",
      calculateInvoiceForm
    );

    $("#invoice-form")?.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        this.classList.add("was-validated");

        if (!this.checkValidity()) return;

        hideModal("#invoice-form-modal");

        showToast("Đã tạo hóa đơn mới.");
      }
    );

    $$(".print-one-invoice-button").forEach((button) => {
      button.addEventListener("click", () => window.print());
    });

    $("#print-detail-invoice")?.addEventListener(
      "click",
      () => window.print()
    );

    $("#print-invoice-list")?.addEventListener(
      "click",
      () => window.print()
    );

    $("#export-invoice-excel")?.addEventListener(
      "click",
      function () {
        showToast(
          "Chức năng xuất Excel sẽ được kết nối ở giai đoạn PHP."
        );
      }
    );

    $("#export-invoice-pdf")?.addEventListener(
      "click",
      function () {
        showToast(
          "Chức năng xuất PDF sẽ được kết nối ở giai đoạn PHP."
        );
      }
    );

    calculateInvoiceForm();
  }

  initializeInvoicesPage();

  /* =========================================================
     10. CÁC NÚT XUẤT DỮ LIỆU MÔ PHỎNG
  ========================================================= */

  $("#export-excel-button")?.addEventListener(
    "click",
    function () {
      showToast(
        "Chức năng xuất Excel sẽ được kết nối bằng PHP."
      );
    }
  );

  /* =========================================================
     11. XỬ LÝ ĐĂNG XUẤT
  ========================================================= */

  $$('a[href="login.html"]').forEach((link) => {
    if (!link.textContent.includes("Đăng xuất")) return;

    link.addEventListener("click", function () {
      sessionStorage.removeItem(
        "mocCoffeeAdminLoggedIn"
      );
    });
  });
});
