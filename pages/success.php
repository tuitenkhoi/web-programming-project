<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

/*
 * Lấy đơn hàng vừa tạo từ PHP Session.
 */
$order = $_SESSION['last_order'] ?? null;

/*
 * Nếu người dùng mở trực tiếp success.php
 * mà chưa tạo đơn hàng.
 */
if (!is_array($order)) {
    $_SESSION['flash'] = [
        'type' => 'warning',
        'message' => 'Không tìm thấy đơn hàng vừa tạo.',
    ];

    header('Location: menu.php');
    exit;
}

/*
 * Lấy danh sách món.
 */
$orderItems = is_array($order['items'] ?? null)
    ? $order['items']
    : [];

/*
 * Sau khi đặt thành công, giỏ hàng đã được xóa.
 */
$cartCount = 0;

/*
 * Chuyển trạng thái đơn sang tiếng Việt.
 */
$orderStatusTexts = [
    'pending' => 'Đơn mới',
    'confirmed' => 'Đã xác nhận',
    'preparing' => 'Đang chuẩn bị',
    'ready' => 'Sẵn sàng phục vụ',
    'completed' => 'Hoàn thành',
    'cancelled' => 'Đã hủy',
];

$orderStatus = (string) (
    $order['status'] ?? 'pending'
);

$orderStatusText =
    $orderStatusTexts[$orderStatus]
    ?? 'Đơn mới';

/*
 * Chuyển phương thức thanh toán sang tiếng Việt.
 */
$paymentMethodTexts = [
    'cash' => 'Tiền mặt',
    'bank_transfer' => 'Chuyển khoản',
];

$paymentMethod = (string) (
    $order['payment_method'] ?? 'cash'
);

$paymentMethodText =
    $paymentMethodTexts[$paymentMethod]
    ?? 'Tiền mặt';

/*
 * Trạng thái thanh toán.
 */
$paymentStatusTexts = [
    'pending' => 'Chưa thanh toán',
    'pending_verification' =>
        'Chờ xác nhận chuyển khoản',
    'paid' => 'Đã thanh toán',
    'failed' => 'Thanh toán thất bại',
    'refunded' => 'Đã hoàn tiền',
];

$paymentStatus = (string) (
    $order['payment_status'] ?? 'pending'
);

$paymentStatusText =
    $paymentStatusTexts[$paymentStatus]
    ?? 'Chưa thanh toán';

/*
 * Hình thức nhận món.
 */
$orderTypeText =
    ($order['order_type'] ?? '') === 'takeaway'
        ? 'Mang đi'
        : 'Dùng tại bàn';

/*
 * Xử lý hình ảnh sản phẩm.
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

  <meta name="description" content="Thông báo giao dịch thành công tại Mộc Coffee." />

  <title>Hoàn tất - Mộc Coffee</title>

  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />

  <!-- Bootstrap Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

  <!-- CSS của dự án -->
  <link rel="stylesheet" href="../assets/css/style.css" />
  <link rel="stylesheet" href="../assets/css/responsive.css" />
</head>

<body class="bg-light">
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

  <main>
  <!-- Banner thành công -->
  <section class="py-5 bg-light">
    <div class="container">

      <div
        class="card border-0 shadow-sm
               mx-auto overflow-hidden"
        style="max-width: 960px"
      >
        <div class="card-body p-4 p-md-5">

          <!-- Biểu tượng thành công -->
          <div class="text-center mb-5">

            <div
              class="d-inline-flex align-items-center
                     justify-content-center
                     rounded-circle bg-success
                     text-white mb-4"
              style="width: 90px; height: 90px"
            >
              <i
                class="bi bi-check-lg"
                style="font-size: 3rem"
              ></i>
            </div>

            <h1 class="display-6 fw-bold">
              Đặt hàng thành công!
            </h1>

            <p class="text-secondary fs-5">
              Cảm ơn bạn đã đặt món tại Mộc Coffee.
              Đơn hàng đang được nhân viên tiếp nhận.
            </p>

            <div
              class="d-inline-block bg-light
                     rounded px-4 py-3 mt-2"
            >
              <span class="text-secondary d-block">
                Mã đơn hàng
              </span>

              <strong
                class="fs-4 text-coffee"
              >
                <?=
                  htmlspecialchars(
                      $order['order_code'],
                      ENT_QUOTES,
                      'UTF-8'
                  )
                ?>
              </strong>
            </div>
          </div>

          <!-- Trạng thái -->
          <div
            class="row g-3 text-center mb-5"
          >
            <div class="col-12 col-md-4">
              <div class="border rounded p-3 h-100">
                <i
                  class="bi bi-receipt
                         fs-3 text-coffee"
                ></i>

                <span
                  class="d-block text-secondary mt-2"
                >
                  Trạng thái đơn
                </span>

                <strong>
                  <?=
                    htmlspecialchars(
                        $orderStatusText,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>
              </div>
            </div>

            <div class="col-12 col-md-4">
              <div class="border rounded p-3 h-100">
                <i
                  class="bi bi-wallet2
                         fs-3 text-coffee"
                ></i>

                <span
                  class="d-block text-secondary mt-2"
                >
                  Thanh toán
                </span>

                <strong>
                  <?=
                    htmlspecialchars(
                        $paymentMethodText,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>

                <small
                  class="d-block text-secondary"
                >
                  <?=
                    htmlspecialchars(
                        $paymentStatusText,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </small>
              </div>
            </div>

            <div class="col-12 col-md-4">
              <div class="border rounded p-3 h-100">
                <i
                  class="bi bi-shop
                         fs-3 text-coffee"
                ></i>

                <span
                  class="d-block text-secondary mt-2"
                >
                  Hình thức
                </span>

                <strong>
                  <?=
                    htmlspecialchars(
                        $orderTypeText,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>

                <?php if (
                    !empty($order['table_code'])
                ): ?>

                  <small
                    class="d-block text-secondary"
                  >
                    Bàn:
                    <?=
                      htmlspecialchars(
                          $order['table_code'],
                          ENT_QUOTES,
                          'UTF-8'
                      )
                    ?>
                  </small>

                <?php endif; ?>
              </div>
            </div>
          </div>

          <!-- Thông tin khách -->
          <div class="card bg-light border-0 mb-4">
            <div class="card-body">

              <h2 class="h5 mb-3">
                <i class="bi bi-person me-2"></i>
                Thông tin khách hàng
              </h2>

              <div class="row g-3">

                <div class="col-12 col-md-6">
                  <span class="text-secondary d-block">
                    Họ và tên
                  </span>

                  <strong>
                    <?=
                      htmlspecialchars(
                          $order['customer_name'],
                          ENT_QUOTES,
                          'UTF-8'
                      )
                    ?>
                  </strong>
                </div>

                <div class="col-12 col-md-6">
                  <span class="text-secondary d-block">
                    Số điện thoại
                  </span>

                  <strong>
                    <?=
                      htmlspecialchars(
                          $order['customer_phone'],
                          ENT_QUOTES,
                          'UTF-8'
                      )
                    ?>
                  </strong>
                </div>

                <?php if (
                    !empty($order['customer_email'])
                ): ?>

                  <div class="col-12">
                    <span class="text-secondary d-block">
                      Email
                    </span>

                    <strong>
                      <?=
                        htmlspecialchars(
                            $order['customer_email'],
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

          <!-- Chi tiết món -->
          <div class="mb-4">

            <h2 class="h5 mb-3">
              <i class="bi bi-bag-check me-2"></i>
              Chi tiết đơn hàng
            </h2>

            <div class="table-responsive">
              <table
                class="table align-middle
                       border rounded"
              >
                <thead class="table-light">
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn giá</th>
                    <th>Số lượng</th>
                    <th class="text-end">
                      Thành tiền
                    </th>
                  </tr>
                </thead>

                <tbody>

                  <?php foreach (
                      $orderItems as $item
                  ): ?>

                    <?php
                    $imageUrl = $productImageUrl(
                        $item['product_image'] ?? null
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
                            . (
                                $item['sugar_level']
                                ?? '70%'
                            ),
                        'Đá '
                            . (
                                $item['ice_level']
                                ?? '70%'
                            ),
                    ];

                    if (!empty($toppings)) {
                        $options[] = implode(
                            ', ',
                            $toppings
                        );
                    }
                    ?>

                    <tr>
                      <td>
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
                                  $item['product_name'],
                                  ENT_QUOTES,
                                  'UTF-8'
                              )
                            ?>"
                            width="64"
                            height="64"
                            class="rounded object-fit-cover"
                          >

                          <div>
                            <strong>
                              <?=
                                htmlspecialchars(
                                    $item['product_name'],
                                    ENT_QUOTES,
                                    'UTF-8'
                                )
                              ?>
                            </strong>

                            <small
                              class="d-block text-secondary"
                            >
                              <?=
                                htmlspecialchars(
                                    implode(
                                        ' | ',
                                        $options
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
                                class="d-block text-secondary"
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

                      <td>
                        <?=
                          number_format(
                              (float) $item['unit_price'],
                              0,
                              ',',
                              '.'
                          )
                        ?>đ
                      </td>

                      <td>
                        <?= (int) $item['quantity'] ?>
                      </td>

                      <td class="text-end">
                        <strong class="text-danger">
                          <?=
                            number_format(
                                (float) $item['line_total'],
                                0,
                                ',',
                                '.'
                            )
                          ?>đ
                        </strong>
                      </td>
                    </tr>

                  <?php endforeach; ?>

                </tbody>
              </table>
            </div>
          </div>

          <!-- Tổng tiền -->
          <div class="row justify-content-end mb-5">
            <div class="col-12 col-md-6 col-lg-5">

              <div
                class="d-flex justify-content-between mb-2"
              >
                <span class="text-secondary">
                  Tạm tính
                </span>

                <strong>
                  <?=
                    number_format(
                        (float) $order['subtotal'],
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>

              <div
                class="d-flex justify-content-between mb-2"
              >
                <span class="text-secondary">
                  Giảm giá
                </span>

                <strong class="text-success">
                  -<?=
                    number_format(
                        (float) $order['discount_amount'],
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>

              <div
                class="d-flex justify-content-between mb-2"
              >
                <span class="text-secondary">
                  Phí phục vụ
                </span>

                <strong>
                  <?=
                    number_format(
                        (float) $order['service_fee'],
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

                <strong class="fs-3 text-danger">
                  <?=
                    number_format(
                        (float) $order['total_amount'],
                        0,
                        ',',
                        '.'
                    )
                  ?>đ
                </strong>
              </div>
            </div>
          </div>

          <!-- Thông báo chuyển khoản -->
          <?php if (
              $paymentMethod === 'bank_transfer'
          ): ?>

            <div class="alert alert-warning">
              <i
                class="bi bi-info-circle-fill me-2"
              ></i>

              Đơn hàng đang chờ nhân viên xác nhận
              giao dịch chuyển khoản.
            </div>

          <?php endif; ?>

          <!-- Nút hành động -->
          <div
            class="d-flex flex-column flex-md-row
                   justify-content-center gap-3"
          >
            <a
              href="menu.php"
              class="btn btn-coffee btn-lg"
            >
              <i class="bi bi-cup-straw me-1"></i>
              Tiếp tục chọn món
            </a>

            <button
              type="button"
              id="print-order-button"
              class="btn btn-outline-coffee btn-lg"
            >
              <i class="bi bi-printer me-1"></i>
              In đơn hàng
            </button>

            <a
              href="../index.php"
              class="btn btn-outline-secondary btn-lg"
            >
              <i class="bi bi-house me-1"></i>
              Về trang chủ
            </a>
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

  <!-- ==================== TEMPLATE DÒNG SẢN PHẨM ==================== -->
  <template id="result-order-item-template">
    <tr>
      <td>
        <div class="d-flex align-items-center">
          <img src="" alt="" class="result-product-image rounded" />

          <div class="ms-3">
            <strong class="result-product-name"></strong>

            <small class="result-product-option text-secondary d-block"></small>
          </div>
        </div>
      </td>

      <td class="result-product-quantity text-center"></td>
      <td class="result-product-price text-end"></td>
      <td class="result-product-total text-end fw-semibold"></td>
    </tr>
  </template>

  <!-- Toast sao chép -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="copy-toast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i class="bi bi-check-circle-fill text-success me-2"></i>

        <strong class="me-auto">Mộc Coffee</strong>

        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>

      <div class="toast-body">
        Đã sao chép mã thành công.
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
  const printButton =
    document.getElementById(
      "print-order-button"
    );

  printButton?.addEventListener(
    "click",
    function () {
      window.print();
    }
  );

  const yearElement =
    document.getElementById("current-year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }
</script>
</body>

</html>