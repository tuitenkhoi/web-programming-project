<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

$cart = $_SESSION['cart'] ?? [];

$itemCount = 0;
$subtotal = 0;

foreach ($cart as $item) {
    $quantity = max(
        1,
        (int) ($item['quantity'] ?? 1)
    );

    $unitPrice = max(
        0,
        (float) ($item['unit_price'] ?? 0)
    );

    $itemCount += $quantity;
    $subtotal += $unitPrice * $quantity;
}

/*
 * Lấy thông báo một lần rồi xóa khỏi Session.
 */
$flash = $_SESSION['flash'] ?? null;

unset($_SESSION['flash']);

/*
 * Tạo đường dẫn ảnh trong trang pages/cart.php.
 */
$productImageUrl = static function (?string $image): string {
    $image = trim((string) $image);

    if ($image === '') {
        return '../assets/images/products/default-product.jpg';
    }

    if (filter_var($image, FILTER_VALIDATE_URL)) {
        return $image;
    }

    if (strpos($image, '/uploads/') === 0) {
        return '../backend' . $image;
    }

    return '../assets/images/products/' . basename($image);
};

?>
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="description" content="Giỏ hàng và đơn gọi món tại Mộc Coffee." />

  <title>Giỏ hàng - Mộc Coffee</title>

  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />

  <!-- Bootstrap Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

  <!-- CSS của dự án -->
  <link rel="stylesheet" href="../assets/css/style.css" />
  <link rel="stylesheet" href="../assets/css/responsive.css" />
</head>

<body>
  <!-- ==================== HEADER ==================== -->
  <header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top shadow">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center fw-bold" href="../index.php">
          <i class="bi bi-cup-hot-fill me-2"></i>
          Mộc Coffee
        </a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar"
          aria-controls="mainNavbar" aria-expanded="false" aria-label="Mở menu điều hướng">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="mainNavbar">
          <ul class="navbar-nav ms-auto align-items-lg-center">
            <li class="nav-item">
              <a class="nav-link" href="../index.php">
                Trang chủ
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link" href="menu.php">
                Thực đơn
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link" href="../index.php#about">
                Giới thiệu
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link" href="../index.php#contact">
                Liên hệ
              </a>
            </li>

            <li class="nav-item ms-lg-2">
              <a class="btn btn-outline-light" href="booking.php">
                <i class="bi bi-calendar-check me-1"></i>
                Đặt bàn
              </a>
            </li>

            <li class="nav-item ms-lg-2 mt-2 mt-lg-0">
              <a class="btn btn-coffee position-relative active" href="cart.php" aria-current="page">
                <i class="bi bi-cart3 me-1"></i>
                Giỏ hàng

                <span id="cart-count"
                  class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  0
                </span>
              </a>
            </li>

            <li class="nav-item ms-lg-2 mt-2 mt-lg-0">
              <a class="nav-link" href="../admin/login.html" title="Đăng nhập quản trị">
                <i class="bi bi-person-circle fs-5"></i>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  </header>

  <!-- ==================== MAIN ==================== -->
  <main>
  <!-- Banner -->
  <section class="page-banner cart-banner">
    <div class="container text-center text-white">
      <h1 class="display-5 fw-bold">
        Giỏ hàng của bạn
      </h1>

      <p class="lead mb-0">
        Kiểm tra món, số lượng và tổng tiền trước khi gửi đơn.
      </p>
    </div>
  </section>

  <!-- Breadcrumb -->
  <section class="bg-light border-bottom">
    <div class="container py-3">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <a href="../index.php">
              Trang chủ
            </a>
          </li>

          <li class="breadcrumb-item">
            <a href="menu.php">
              Thực đơn
            </a>
          </li>

          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Giỏ hàng
          </li>
        </ol>
      </nav>
    </div>
  </section>

  <!-- Các bước gọi món -->
  <section class="py-4 bg-white border-bottom">
    <div class="container">
      <div class="booking-steps">

        <div class="booking-step active">
          <span class="step-number">
            <i class="bi bi-check-lg"></i>
          </span>

          <span class="step-label">
            Chọn món
          </span>
        </div>

        <div class="step-line active"></div>

        <div class="booking-step active">
          <span class="step-number">2</span>

          <span class="step-label">
            Giỏ hàng
          </span>
        </div>

        <div class="step-line"></div>

        <div class="booking-step">
          <span class="step-number">3</span>

          <span class="step-label">
            Thanh toán
          </span>
        </div>

      </div>
    </div>
  </section>

  <!-- Nội dung -->
  <section class="py-5 bg-light">
    <div class="container">

      <!-- Thông báo -->
      <?php if (is_array($flash)): ?>

        <div
          class="alert alert-<?=
            htmlspecialchars(
                $flash['type'] ?? 'info',
                ENT_QUOTES,
                'UTF-8'
            )
          ?> alert-dismissible fade show"
          role="alert"
        >
          <?=
            htmlspecialchars(
                $flash['message'] ?? '',
                ENT_QUOTES,
                'UTF-8'
            )
          ?>

          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="alert"
            aria-label="Đóng"
          ></button>
        </div>

      <?php endif; ?>

      <?php if (empty($cart)): ?>

        <!-- Giỏ hàng trống -->
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center py-5">

            <div class="empty-cart-icon mb-4">
              <i class="bi bi-cart-x"></i>
            </div>

            <h2 class="h3 fw-bold">
              Giỏ hàng đang trống
            </h2>

            <p class="text-secondary mb-4">
              Bạn chưa thêm món nào vào giỏ hàng.
            </p>

            <a
              href="menu.php"
              class="btn btn-coffee btn-lg"
            >
              <i class="bi bi-cup-straw me-1"></i>
              Xem thực đơn
            </a>
          </div>
        </div>

      <?php else: ?>

        <div class="row g-4">

          <!-- Danh sách sản phẩm -->
          <div class="col-12 col-lg-8">
            <div class="card border-0 shadow-sm">

              <div
                class="card-header bg-white
                       d-flex flex-column flex-sm-row
                       justify-content-between
                       align-items-sm-center p-4"
              >
                <div>
                  <h2 class="h4 mb-1">
                    <i class="bi bi-bag-check me-2"></i>
                    Món đã chọn
                  </h2>

                  <p class="text-secondary mb-0">
                    Có
                    <strong><?= $itemCount ?></strong>
                    sản phẩm trong giỏ hàng.
                  </p>
                </div>

                <form
                  method="POST"
                  action="../actions/cart-clear.php"
                  class="mt-3 mt-sm-0"
                  onsubmit="
                    return confirm(
                      'Bạn có chắc muốn xóa toàn bộ giỏ hàng?'
                    );
                  "
                >
                  <button
                    type="submit"
                    class="btn btn-outline-danger btn-sm"
                  >
                    <i class="bi bi-trash3 me-1"></i>
                    Xóa toàn bộ
                  </button>
                </form>
              </div>

              <!-- Form cập nhật số lượng -->
              <form
                method="POST"
                action="../actions/cart-update.php"
              >
                <div class="card-body p-0">
                  <div class="table-responsive">

                    <table
                      class="table cart-table
                             align-middle mb-0"
                    >
                      <thead class="table-light">
                        <tr>
                          <th class="ps-4">
                            Sản phẩm
                          </th>

                          <th>Đơn giá</th>

                          <th>Số lượng</th>

                          <th>Thành tiền</th>

                          <th class="text-center pe-4">
                            Xóa
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        <?php foreach (
                            $cart as $cartKey => $item
                        ): ?>

                          <?php
                          $quantity = max(
                              1,
                              (int) $item['quantity']
                          );

                          $unitPrice = max(
                              0,
                              (float) $item['unit_price']
                          );

                          $lineTotal =
                              $unitPrice * $quantity;

                          $imageUrl = $productImageUrl(
                              $item['image'] ?? null
                          );

                          $toppings = is_array(
                              $item['toppings'] ?? null
                          )
                              ? $item['toppings']
                              : [];

                          $optionTexts = [
                              'Size '
                                  . ($item['size'] ?? 'M'),
                              'Đường '
                                  . ($item['sugar_level'] ?? '70%'),
                              'Đá '
                                  . ($item['ice_level'] ?? '70%'),
                          ];

                          if (!empty($toppings)) {
                              $optionTexts[] = implode(
                                  ', ',
                                  $toppings
                              );
                          }
                          ?>

                          <tr>
                            <!-- Sản phẩm -->
                            <td class="ps-4">
                              <div
                                class="d-flex
                                       align-items-center gap-3"
                              >
                                <img
                                  src="<?=
                                    htmlspecialchars(
                                        $imageUrl,
                                        ENT_QUOTES,
                                        'UTF-8'
                                    )
                                  ?>"
                                  alt="<?=
                                    htmlspecialchars(
                                        $item['name'],
                                        ENT_QUOTES,
                                        'UTF-8'
                                    )
                                  ?>"
                                  width="72"
                                  height="72"
                                  class="rounded object-fit-cover"
                                >

                                <div>
                                  <strong>
                                    <?=
                                      htmlspecialchars(
                                          $item['name'],
                                          ENT_QUOTES,
                                          'UTF-8'
                                      )
                                    ?>
                                  </strong>

                                  <small
                                    class="d-block
                                           text-secondary"
                                  >
                                    <?=
                                      htmlspecialchars(
                                          implode(
                                              ' | ',
                                              $optionTexts
                                          ),
                                          ENT_QUOTES,
                                          'UTF-8'
                                      )
                                    ?>
                                  </small>

                                  <?php if (
                                      !empty($item['note'])
                                  ): ?>
                                    <small
                                      class="d-block
                                             text-secondary"
                                    >
                                      Ghi chú:
                                      <?=
                                        htmlspecialchars(
                                            $item['note'],
                                            ENT_QUOTES,
                                            'UTF-8'
                                        )
                                      ?>
                                    </small>
                                  <?php endif; ?>
                                </div>
                              </div>
                            </td>

                            <!-- Đơn giá -->
                            <td>
                              <?=
                                number_format(
                                    $unitPrice,
                                    0,
                                    ',',
                                    '.'
                                )
                              ?>đ
                            </td>

                            <!-- Số lượng -->
                            <td>
                              <input
                                type="number"
                                name="quantities[<?=
                                  htmlspecialchars(
                                      $cartKey,
                                      ENT_QUOTES,
                                      'UTF-8'
                                  )
                                ?>]"
                                value="<?= $quantity ?>"
                                min="0"
                                max="99"
                                class="form-control"
                                style="width: 85px"
                              >
                            </td>

                            <!-- Thành tiền -->
                            <td>
                              <strong class="text-danger">
                                <?=
                                  number_format(
                                      $lineTotal,
                                      0,
                                      ',',
                                      '.'
                                  )
                                ?>đ
                              </strong>
                            </td>

                            <!-- Xóa -->
                            <td class="text-center pe-4">
                              <button
                                type="submit"
                                formaction="../actions/cart-remove.php"
                                name="cart_key"
                                value="<?=
                                  htmlspecialchars(
                                      $cartKey,
                                      ENT_QUOTES,
                                      'UTF-8'
                                  )
                                ?>"
                                class="btn btn-outline-danger
                                       btn-sm"
                                title="Xóa sản phẩm"
                              >
                                <i class="bi bi-trash3"></i>
                              </button>
                            </td>
                          </tr>

                        <?php endforeach; ?>

                      </tbody>
                    </table>
                  </div>
                </div>

                <div
                  class="card-footer bg-white p-4
                         d-flex flex-column flex-sm-row
                         justify-content-between gap-2"
                >
                  <a
                    href="menu.php"
                    class="btn btn-outline-coffee"
                  >
                    <i class="bi bi-arrow-left me-1"></i>
                    Tiếp tục chọn món
                  </a>

                  <button
                    type="submit"
                    class="btn btn-coffee"
                  >
                    <i
                      class="bi bi-arrow-clockwise me-1"
                    ></i>
                    Cập nhật giỏ hàng
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Tóm tắt đơn -->
          <div class="col-12 col-lg-4">
            <form
              method="POST"
              action="payment.php"
              class="card border-0 shadow-sm
                     cart-summary"
            >
              <div class="card-body p-4">

                <h2 class="h4 mb-4">
                  <i class="bi bi-receipt me-2"></i>
                  Thông tin đơn hàng
                </h2>

                <!-- Hình thức nhận món -->
                <div class="mb-3">
                  <label class="form-label fw-semibold">
                    Hình thức nhận món
                  </label>

                  <div class="form-check">
                    <input
                      type="radio"
                      name="order_type"
                      id="order-at-table"
                      value="at_table"
                      class="form-check-input"
                      checked
                    >

                    <label
                      for="order-at-table"
                      class="form-check-label"
                    >
                      Dùng tại bàn
                    </label>
                  </div>

                  <div class="form-check">
                    <input
                      type="radio"
                      name="order_type"
                      id="order-takeaway"
                      value="takeaway"
                      class="form-check-input"
                    >

                    <label
                      for="order-takeaway"
                      class="form-check-label"
                    >
                      Mang đi
                    </label>
                  </div>
                </div>

                <!-- Mã bàn -->
                <div
                  class="mb-3"
                  id="table-code-group"
                >
                  <label
                    for="table-code"
                    class="form-label fw-semibold"
                  >
                    Mã bàn
                  </label>

                  <select
                    id="table-code"
                    name="table_code"
                    class="form-select"
                  >
                    <option value="">
                      Chọn mã bàn
                    </option>

                    <?php for (
                        $tableNumber = 1;
                        $tableNumber <= 8;
                        $tableNumber++
                    ): ?>

                      <?php
                      $tableCode = 'T'
                          . str_pad(
                              (string) $tableNumber,
                              2,
                              '0',
                              STR_PAD_LEFT
                          );
                      ?>

                      <option value="<?= $tableCode ?>">
                        Bàn <?= $tableCode ?>
                      </option>

                    <?php endfor; ?>
                  </select>
                </div>

                <!-- Tên khách -->
                <div class="mb-3">
                  <label
                    for="customer-name"
                    class="form-label fw-semibold"
                  >
                    Tên khách hàng
                  </label>

                  <input
                    type="text"
                    id="customer-name"
                    name="customer_name"
                    class="form-control"
                    maxlength="100"
                    placeholder="Nhập tên của bạn"
                  >
                </div>

                <!-- Ghi chú -->
                <div class="mb-3">
                  <label
                    for="order-note"
                    class="form-label fw-semibold"
                  >
                    Ghi chú chung
                  </label>

                  <textarea
                    id="order-note"
                    name="note"
                    class="form-control"
                    rows="3"
                    maxlength="300"
                  ></textarea>
                </div>

                <!-- Mã giảm giá -->
                <div class="mb-4">
                  <label
                    for="coupon-code"
                    class="form-label fw-semibold"
                  >
                    Mã giảm giá
                  </label>

                  <input
                    type="text"
                    id="coupon-code"
                    name="coupon_code"
                    class="form-control text-uppercase"
                    maxlength="30"
                    placeholder="MOCCOFFEE10"
                  >

                  <small class="text-secondary">
                    Mã thử nghiệm:
                    <strong>MOCCOFFEE10</strong>
                  </small>
                </div>

                <hr>

                <div
                  class="d-flex justify-content-between mb-3"
                >
                  <span class="text-secondary">
                    Tạm tính
                  </span>

                  <strong>
                    <?=
                      number_format(
                          $subtotal,
                          0,
                          ',',
                          '.'
                      )
                    ?>đ
                  </strong>
                </div>

                <div
                  class="d-flex justify-content-between
                         align-items-center mb-4"
                >
                  <span class="fs-5 fw-semibold">
                    Tổng tạm tính
                  </span>

                  <strong class="fs-4 text-danger">
                    <?=
                      number_format(
                          $subtotal,
                          0,
                          ',',
                          '.'
                      )
                    ?>đ
                  </strong>
                </div>

                <button
                  type="submit"
                  class="btn btn-coffee
                         btn-lg w-100"
                >
                  Tiến hành thanh toán
                  <i class="bi bi-arrow-right ms-1"></i>
                </button>

                <small
                  class="d-block text-secondary
                         text-center mt-3"
                >
                  Giá cuối cùng sẽ được PHP kiểm tra lại.
                </small>
              </div>
            </form>
          </div>

        </div>

      <?php endif; ?>

    </div>
  </section>
</main>

  <!-- ==================== FOOTER ==================== -->
  <footer class="bg-dark text-white pt-5">
    <div class="container">
      <div class="row g-4">
        <div class="col-12 col-md-6 col-lg-4">
          <h2 class="h4 fw-bold">
            <i class="bi bi-cup-hot-fill me-2"></i>
            Mộc Coffee
          </h2>

          <p class="text-white-50">
            Không gian cà phê gần gũi với dịch vụ đặt bàn, gọi món
            và thanh toán thuận tiện.
          </p>

          <div class="d-flex gap-3">
            <a href="#" class="text-white fs-5" aria-label="Facebook">
              <i class="bi bi-facebook"></i>
            </a>

            <a href="#" class="text-white fs-5" aria-label="Instagram">
              <i class="bi bi-instagram"></i>
            </a>

            <a href="#" class="text-white fs-5" aria-label="TikTok">
              <i class="bi bi-tiktok"></i>
            </a>
          </div>
        </div>

        <div class="col-6 col-md-3 col-lg-2">
          <h3 class="h5">Liên kết</h3>

          <ul class="list-unstyled footer-links">
            <li>
              <a href="../index.php">Trang chủ</a>
            </li>

            <li>
              <a href="menu.php">Thực đơn</a>
            </li>

            <li>
              <a href="booking.php">Đặt bàn</a>
            </li>

            <li>
              <a href="cart.php">Giỏ hàng</a>
            </li>
          </ul>
        </div>

        <div class="col-6 col-md-3 col-lg-3">
          <h3 class="h5">Giờ mở cửa</h3>

          <ul class="list-unstyled text-white-50">
            <li class="mb-2">
              Thứ 2 – Thứ 6: 07:00 – 22:00
            </li>

            <li class="mb-2">
              Thứ 7 – Chủ nhật: 07:00 – 23:00
            </li>
          </ul>
        </div>

        <div class="col-12 col-lg-3">
          <h3 class="h5">Liên hệ</h3>

          <ul class="list-unstyled text-white-50">
            <li class="mb-2">
              <i class="bi bi-geo-alt-fill me-2"></i>
              19 Nguyễn Hữu Thọ, Quận 7, TP.HCM
            </li>

            <li class="mb-2">
              <i class="bi bi-telephone-fill me-2"></i>
              0123 456 789
            </li>

            <li class="mb-2">
              <i class="bi bi-envelope-fill me-2"></i>
              moccoffee@example.com
            </li>
          </ul>
        </div>
      </div>

      <hr class="border-secondary mt-4" />

      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center py-3">
        <p class="text-white-50 mb-2 mb-md-0">
          &copy; <span id="current-year">2026</span> Mộc Coffee.
          All rights reserved.
        </p>

        <a href="#" class="text-white-50">
          Điều khoản và chính sách
        </a>
      </div>
    </div>
  </footer>


  <!-- Modal xác nhận xóa toàn bộ -->
  <div class="modal fade" id="clear-cart-modal" tabindex="-1" aria-labelledby="clear-cart-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0">
        <div class="modal-header">
          <h2 class="modal-title h5" id="clear-cart-title">
            Xác nhận xóa giỏ hàng
          </h2>

          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
        </div>

        <div class="modal-body">
          Bạn có chắc chắn muốn xóa toàn bộ món trong giỏ hàng
          không?
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
            Hủy
          </button>

          <button type="button" id="confirm-clear-cart" class="btn btn-danger">
            <i class="bi bi-trash3 me-1"></i>
            Xóa toàn bộ
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast thông báo -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="cart-toast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i id="toast-icon" class="bi bi-check-circle-fill text-success me-2"></i>

        <strong class="me-auto">Mộc Coffee</strong>

        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>

      <div id="toast-message" class="toast-body">
        Giỏ hàng đã được cập nhật.
      </div>
    </div>
  </div>

  <!-- Nút quay lại đầu trang -->
  <button type="button" id="back-to-top" class="btn btn-coffee rounded-circle" title="Quay lại đầu trang"
    aria-label="Quay lại đầu trang">
    <i class="bi bi-arrow-up"></i>
  </button>

  <!-- Bootstrap JavaScript -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

  <!-- JavaScript của dự án -->
  <script>
  const atTableRadio =
    document.getElementById("order-at-table");

  const takeawayRadio =
    document.getElementById("order-takeaway");

  const tableCodeGroup =
    document.getElementById("table-code-group");

  const tableCode =
    document.getElementById("table-code");

  function updateOrderType() {
    if (!tableCodeGroup) {
      return;
    }

    const useAtTable =
      atTableRadio && atTableRadio.checked;

    tableCodeGroup.classList.toggle(
      "d-none",
      !useAtTable
    );

    if (!useAtTable && tableCode) {
      tableCode.value = "";
    }
  }

  atTableRadio?.addEventListener(
    "change",
    updateOrderType
  );

  takeawayRadio?.addEventListener(
    "change",
    updateOrderType
  );

  updateOrderType();

  const yearElement =
    document.getElementById("current-year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }
</script>
</body>

</html>