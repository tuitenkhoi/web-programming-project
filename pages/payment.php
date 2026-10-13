<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

/*
 * Không có giỏ hàng thì quay lại trang giỏ hàng.
 */
$cart = $_SESSION['cart'] ?? [];

if (empty($cart)) {
    $_SESSION['flash'] = [
        'type' => 'warning',
        'message' => 'Giỏ hàng đang trống.',
    ];

    header('Location: cart.php');
    exit;
}

/*
 * Khi cart.php gửi thông tin sang payment.php.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $orderType = trim(
        (string) ($_POST['order_type'] ?? 'at_table')
    );

    $tableCode = strtoupper(
        trim((string) ($_POST['table_code'] ?? ''))
    );

    $customerName = trim(
        (string) ($_POST['customer_name'] ?? '')
    );

    $note = trim(
        (string) ($_POST['note'] ?? '')
    );

    $couponCode = strtoupper(
        trim((string) ($_POST['coupon_code'] ?? ''))
    );

    if (!in_array(
        $orderType,
        ['at_table', 'takeaway'],
        true
    )) {
        $orderType = 'at_table';
    }

    /*
     * Nếu dùng tại bàn thì phải có mã bàn hợp lệ.
     */
    if (
        $orderType === 'at_table'
        && !preg_match(
            '/^[A-Z0-9-]{1,20}$/',
            $tableCode
        )
    ) {
        $_SESSION['flash'] = [
            'type' => 'danger',
            'message' => 'Vui lòng chọn mã bàn.',
        ];

        header('Location: cart.php');
        exit;
    }

    if ($orderType === 'takeaway') {
        $tableCode = '';
    }

    /*
     * Chỉ chấp nhận mã giảm giá thử nghiệm.
     */
    if (
        $couponCode !== ''
        && $couponCode !== 'MOCCOFFEE10'
    ) {
        $_SESSION['flash'] = [
            'type' => 'danger',
            'message' => 'Mã giảm giá không hợp lệ.',
        ];

        header('Location: cart.php');
        exit;
    }

    $_SESSION['checkout'] = [
        'order_type' => $orderType,
        'table_code' => $tableCode,
        'customer_name' => mb_substr(
            $customerName,
            0,
            100
        ),
        'note' => mb_substr(
            $note,
            0,
            300
        ),
        'coupon_code' => $couponCode,
    ];
}

/*
 * Nếu người dùng mở trực tiếp payment.php mà chưa đi qua cart.php.
 */
$checkout = $_SESSION['checkout'] ?? null;

if (!is_array($checkout)) {
    $_SESSION['flash'] = [
        'type' => 'warning',
        'message' => 'Vui lòng xác nhận thông tin giỏ hàng.',
    ];

    header('Location: cart.php');
    exit;
}

/*
 * Tính tổng tiền để hiển thị.
 * order-create.php sẽ kiểm tra giá lần cuối từ MySQL.
 */
$subtotal = 0;
$itemCount = 0;

foreach ($cart as $item) {
    $quantity = max(
        1,
        (int) ($item['quantity'] ?? 1)
    );

    $unitPrice = max(
        0,
        (float) ($item['unit_price'] ?? 0)
    );

    $subtotal += $unitPrice * $quantity;
    $itemCount += $quantity;
}

$discountAmount =
    ($checkout['coupon_code'] ?? '') ===
    'MOCCOFFEE10'
        ? round($subtotal * 0.10)
        : 0;

$serviceFee =
    ($checkout['order_type'] ?? '') ===
    'at_table'
        ? round(($subtotal * 0.05) / 1000) * 1000
        : 0;

$totalAmount = max(
    0,
    $subtotal - $discountAmount + $serviceFee
);

$cartCount = $itemCount;

/*
 * Xử lý đường dẫn hình ảnh.
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

/*
 * Thông báo lỗi từ order-create.php.
 */
$flash = $_SESSION['flash'] ?? null;

unset($_SESSION['flash']);

?>
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="description" content="Thanh toán đơn hàng tại Mộc Coffee." />

  <title>Thanh toán - Mộc Coffee</title>

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
              <a class="btn btn-coffee position-relative" href="cart.php">
                <i class="bi bi-cart3 me-1"></i>
                Giỏ hàng

                <span id="cart-count"
                  class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  <?= $cartCount ?>
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
  <section class="page-banner payment-banner">
    <div class="container text-center text-white">
      <h1 class="display-5 fw-bold">
        Thanh toán
      </h1>

      <p class="lead mb-0">
        Kiểm tra thông tin và xác nhận đơn hàng.
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
            <a href="cart.php">
              Giỏ hàng
            </a>
          </li>

          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Thanh toán
          </li>

        </ol>
      </nav>
    </div>
  </section>

  <!-- Các bước -->
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
          <span class="step-number">
            <i class="bi bi-check-lg"></i>
          </span>

          <span class="step-label">
            Giỏ hàng
          </span>
        </div>

        <div class="step-line active"></div>

        <div class="booking-step active">
          <span class="step-number">3</span>

          <span class="step-label">
            Thanh toán
          </span>
        </div>

      </div>
    </div>
  </section>

  <!-- Nội dung thanh toán -->
  <section class="py-5 bg-light">
    <div class="container">

      <?php if (is_array($flash)): ?>

        <div
          class="alert alert-<?=
            htmlspecialchars(
                $flash['type'] ?? 'danger',
                ENT_QUOTES,
                'UTF-8'
            )
          ?>"
          role="alert"
        >
          <?=
            htmlspecialchars(
                $flash['message'] ?? '',
                ENT_QUOTES,
                'UTF-8'
            )
          ?>
        </div>

      <?php endif; ?>

      <div class="row g-4">

        <!-- Form thông tin khách hàng -->
        <div class="col-12 col-lg-7">
          <form
            method="POST"
            action="../actions/order-create.php"
            class="card border-0 shadow-sm"
          >
            <div class="card-body p-4 p-md-5">

              <h2 class="h4 mb-4">
                <i class="bi bi-person-lines-fill me-2"></i>
                Thông tin khách hàng
              </h2>

              <!-- Họ tên -->
              <div class="mb-3">
                <label
                  for="customer-name"
                  class="form-label fw-semibold"
                >
                  Họ và tên
                  <span class="text-danger">*</span>
                </label>

                <input
                  type="text"
                  id="customer-name"
                  name="customer_name"
                  class="form-control"
                  value="<?=
                    htmlspecialchars(
                        $checkout['customer_name'] ?? '',
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>"
                  minlength="2"
                  maxlength="100"
                  required
                >
              </div>

              <!-- Số điện thoại -->
              <div class="mb-3">
                <label
                  for="customer-phone"
                  class="form-label fw-semibold"
                >
                  Số điện thoại
                  <span class="text-danger">*</span>
                </label>

                <input
                  type="tel"
                  id="customer-phone"
                  name="customer_phone"
                  class="form-control"
                  placeholder="Ví dụ: 0901234567"
                  pattern="0[0-9]{9}"
                  maxlength="10"
                  required
                >

                <small class="text-secondary">
                  Gồm 10 chữ số và bắt đầu bằng số 0.
                </small>
              </div>

              <!-- Email -->
              <div class="mb-4">
                <label
                  for="customer-email"
                  class="form-label fw-semibold"
                >
                  Email
                </label>

                <input
                  type="email"
                  id="customer-email"
                  name="customer_email"
                  class="form-control"
                  maxlength="150"
                  placeholder="example@email.com"
                >
              </div>

              <hr class="my-4">

              <!-- Thông tin nhận món -->
              <h2 class="h4 mb-4">
                <i class="bi bi-shop me-2"></i>
                Thông tin nhận món
              </h2>

              <div class="row g-3 mb-4">

                <div class="col-12 col-md-6">
                  <span class="text-secondary d-block">
                    Hình thức
                  </span>

                  <strong>
                    <?=
                      ($checkout['order_type'] ?? '')
                          === 'takeaway'
                              ? 'Mang đi'
                              : 'Dùng tại bàn'
                    ?>
                  </strong>
                </div>

                <div class="col-12 col-md-6">
                  <span class="text-secondary d-block">
                    Mã bàn
                  </span>

                  <strong>
                    <?=
                      htmlspecialchars(
                          $checkout['table_code']
                              ?: 'Không áp dụng',
                          ENT_QUOTES,
                          'UTF-8'
                      )
                    ?>
                  </strong>
                </div>

                <?php if (
                    !empty($checkout['note'])
                ): ?>

                  <div class="col-12">
                    <span class="text-secondary d-block">
                      Ghi chú
                    </span>

                    <strong>
                      <?=
                        htmlspecialchars(
                            $checkout['note'],
                            ENT_QUOTES,
                            'UTF-8'
                        )
                      ?>
                    </strong>
                  </div>

                <?php endif; ?>

              </div>

              <hr class="my-4">

              <!-- Phương thức thanh toán -->
              <h2 class="h4 mb-4">
                <i class="bi bi-wallet2 me-2"></i>
                Phương thức thanh toán
              </h2>

              <div class="row g-3 mb-4">

                <!-- Tiền mặt -->
                <div class="col-12 col-md-6">
                  <input
                    type="radio"
                    class="btn-check"
                    name="payment_method"
                    id="payment-cash"
                    value="cash"
                    checked
                  >

                  <label
                    class="payment-option h-100"
                    for="payment-cash"
                  >
                    <div class="payment-option-icon">
                      <i class="bi bi-cash-stack"></i>
                    </div>

                    <div>
                      <strong>Tiền mặt</strong>

                      <small class="d-block">
                        Thanh toán tại quầy hoặc tại bàn
                      </small>
                    </div>
                  </label>
                </div>

                <!-- Chuyển khoản -->
                <div class="col-12 col-md-6">
                  <input
                    type="radio"
                    class="btn-check"
                    name="payment_method"
                    id="payment-bank"
                    value="bank_transfer"
                  >

                  <label
                    class="payment-option h-100"
                    for="payment-bank"
                  >
                    <div class="payment-option-icon">
                      <i class="bi bi-qr-code"></i>
                    </div>

                    <div>
                      <strong>Chuyển khoản</strong>

                      <small class="d-block">
                        Quét mã QR ngân hàng
                      </small>
                    </div>
                  </label>
                </div>

              </div>

              <!-- Nội dung chuyển khoản -->
              <div
                id="bank-payment-content"
                class="card bg-light border-0 mb-4 d-none"
              >
                <div class="card-body text-center">

                  <img
                    src="../assets/images/qr-payment.png"
                    alt="Mã QR thanh toán"
                    class="img-fluid mb-3"
                    style="max-width: 220px"
                  >

                  <p class="mb-1">
                    <strong>Ngân hàng:</strong>
                    Mộc Coffee Bank
                  </p>

                  <p class="mb-1">
                    <strong>Số tài khoản:</strong>
                    0123456789
                  </p>

                  <p class="mb-0">
                    <strong>Số tiền:</strong>

                    <span class="text-danger fw-bold">
                      <?=
                        number_format(
                            $totalAmount,
                            0,
                            ',',
                            '.'
                        )
                      ?>đ
                    </span>
                  </p>
                </div>
              </div>

              <!-- Đồng ý chính sách -->
              <div class="form-check mb-4">
                <input
                  type="checkbox"
                  id="payment-policy"
                  name="payment_policy"
                  value="1"
                  class="form-check-input"
                  required
                >

                <label
                  for="payment-policy"
                  class="form-check-label"
                >
                  Tôi xác nhận thông tin đơn hàng chính xác
                  và đồng ý với chính sách của Mộc Coffee.
                </label>
              </div>

              <button
                type="submit"
                class="btn btn-coffee btn-lg w-100"
              >
                <i class="bi bi-check-circle me-1"></i>
                Xác nhận đặt hàng
              </button>

              <a
                href="cart.php"
                class="btn btn-outline-secondary w-100 mt-3"
              >
                <i class="bi bi-arrow-left me-1"></i>
                Quay lại giỏ hàng
              </a>

            </div>
          </form>
        </div>

        <!-- Tóm tắt đơn hàng -->
        <div class="col-12 col-lg-5">
          <div
            class="card border-0 shadow-sm
                   payment-summary"
          >
            <div class="card-body p-4">

              <h2 class="h4 mb-4">
                <i class="bi bi-receipt me-2"></i>
                Đơn hàng của bạn
              </h2>

              <!-- Danh sách món -->
              <?php foreach ($cart as $item): ?>

                <?php
                $quantity = max(
                    1,
                    (int) ($item['quantity'] ?? 1)
                );

                $unitPrice = max(
                    0,
                    (float) (
                        $item['unit_price'] ?? 0
                    )
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

                $options = [
                    'Size '
                        . ($item['size'] ?? 'M'),
                    'Đường '
                        . ($item['sugar_level'] ?? '70%'),
                    'Đá '
                        . ($item['ice_level'] ?? '70%'),
                ];

                if (!empty($toppings)) {
                    $options[] = implode(
                        ', ',
                        $toppings
                    );
                }
                ?>

                <div
                  class="d-flex gap-3
                         border-bottom pb-3 mb-3"
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

                  <div class="flex-grow-1">

                    <div
                      class="d-flex
                             justify-content-between gap-2"
                    >
                      <strong>
                        <?=
                          htmlspecialchars(
                              $item['name'],
                              ENT_QUOTES,
                              'UTF-8'
                          )
                        ?>
                      </strong>

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
                    </div>

                    <small class="text-secondary d-block">
                      <?=
                        htmlspecialchars(
                            implode(' | ', $options),
                            ENT_QUOTES,
                            'UTF-8'
                        )
                      ?>
                    </small>

                    <small class="text-secondary">
                      Số lượng: <?= $quantity ?>
                    </small>

                  </div>
                </div>

              <?php endforeach; ?>

              <!-- Tổng tiền -->
              <div
                class="d-flex
                       justify-content-between mb-2"
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
                class="d-flex
                       justify-content-between mb-2"
              >
                <span class="text-secondary">
                  Giảm giá
                </span>

                <strong class="text-success">
                  -<?=
                    number_format(
                        $discountAmount,
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>

              <div
                class="d-flex
                       justify-content-between mb-3"
              >
                <span class="text-secondary">
                  Phí phục vụ
                </span>

                <strong>
                  <?=
                    number_format(
                        $serviceFee,
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>

              <hr>

              <div
                class="d-flex justify-content-between
                       align-items-center"
              >
                <span class="fs-5 fw-semibold">
                  Tổng thanh toán
                </span>

                <strong class="fs-4 text-danger">
                  <?=
                    number_format(
                        $totalAmount,
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>

              <?php if (
                  !empty($checkout['coupon_code'])
              ): ?>

                <div class="alert alert-success mt-3 mb-0">
                  Đã áp dụng mã:
                  <strong>
                    <?=
                      htmlspecialchars(
                          $checkout['coupon_code'],
                          ENT_QUOTES,
                          'UTF-8'
                      )
                    ?>
                  </strong>
                </div>

              <?php endif; ?>

            </div>
          </div>
        </div>

      </div>
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

  <!-- ==================== TEMPLATE MÓN HÀNG ==================== -->
  <template id="payment-item-template">
    <div class="payment-order-item">
      <img src="" alt="" class="payment-item-image rounded" />

      <div class="payment-item-content">
        <h3 class="payment-item-name h6 mb-1"></h3>

        <small class="payment-item-option text-secondary"></small>

        <div class="d-flex justify-content-between align-items-center mt-1">
          <small class="payment-item-quantity text-secondary">
            x1
          </small>

          <strong class="payment-item-total"></strong>
        </div>
      </div>
    </div>
  </template>

  <!-- Modal điều khoản -->
  <div class="modal fade" id="policy-modal" tabindex="-1" aria-labelledby="policy-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content border-0">
        <div class="modal-header">
          <h2 class="modal-title h5" id="policy-title">
            Điều khoản thanh toán
          </h2>

          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
        </div>

        <div class="modal-body">
          <ol class="mb-0">
            <li class="mb-2">
              Khách hàng cần kiểm tra chính xác các món và số lượng
              trước khi xác nhận thanh toán.
            </li>

            <li class="mb-2">
              Đối với chuyển khoản, khách hàng cần nhập đúng nội
              dung theo hướng dẫn.
            </li>

            <li class="mb-2">
              Đơn hàng chỉ được xác nhận thanh toán sau khi quán
              nhận được giao dịch.
            </li>

            <li>
              Nếu có sai sót, khách hàng cần liên hệ nhân viên để
              được hỗ trợ.
            </li>
          </ol>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-coffee" data-bs-dismiss="modal">
            Tôi đã hiểu
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal thanh toán thành công -->
  <div class="modal fade" id="payment-success-modal" tabindex="-1" aria-labelledby="payment-success-title"
    aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0">
        <div class="modal-body text-center p-5">
          <div class="success-icon mb-3">
            <i class="bi bi-check-circle-fill"></i>
          </div>

          <h2 class="h3 fw-bold" id="payment-success-title">
            Gửi yêu cầu thành công
          </h2>

          <p id="payment-success-message" class="text-secondary">
            Yêu cầu thanh toán của bạn đã được gửi đến nhân viên.
          </p>

          <div class="bg-light rounded p-3 mb-4">
            <span class="text-secondary">Mã đơn hàng:</span>

            <strong id="success-order-code" class="ms-1">
              MC000000
            </strong>
          </div>

          <a href="success.html" class="btn btn-coffee">
            Xem kết quả
          </a>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast thông báo sao chép -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="copy-toast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i class="bi bi-check-circle-fill text-success me-2"></i>

        <strong class="me-auto">Mộc Coffee</strong>

        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>

      <div id="copy-toast-message" class="toast-body">
        Đã sao chép thông tin.
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
  const cashRadio =
    document.getElementById("payment-cash");

  const bankRadio =
    document.getElementById("payment-bank");

  const bankContent =
    document.getElementById(
      "bank-payment-content"
    );

  function updatePaymentContent() {
    if (!bankContent) {
      return;
    }

    bankContent.classList.toggle(
      "d-none",
      !bankRadio.checked
    );
  }

  cashRadio?.addEventListener(
    "change",
    updatePaymentContent
  );

  bankRadio?.addEventListener(
    "change",
    updatePaymentContent
  );

  updatePaymentContent();

  const yearElement =
    document.getElementById("current-year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }
</script>


</body>


</html>

</html>
