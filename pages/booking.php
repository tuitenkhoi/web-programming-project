<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

/*
 * Lấy danh sách bàn đang hoạt động.
 */
$tableStatement = $pdo->query(
    "SELECT
        id,
        table_code,
        table_name,
        capacity,
        area
     FROM coffee_tables
     WHERE status = 'available'
     ORDER BY table_code ASC"
);

$tables = $tableStatement->fetchAll();

/*
 * Thông báo và dữ liệu cũ.
 */
$flash = $_SESSION['flash'] ?? null;
$old = $_SESSION['booking_old'] ?? [];
$bookingSuccess =
    $_SESSION['booking_success'] ?? null;

unset($_SESSION['flash']);

/*
 * Chỉ xóa dữ liệu cũ sau khi đã lấy ra.
 */
if (is_array($flash)) {
    unset($_SESSION['booking_old']);
}

/*
 * Đếm giỏ hàng.
 */
$cartCount = 0;

foreach ($_SESSION['cart'] ?? [] as $cartItem) {
    $cartCount += max(
        0,
        (int) ($cartItem['quantity'] ?? 0)
    );
}

/*
 * Giá trị cũ dùng cho form.
 */
$oldValue = static function (
    array $old,
    string $key
): string {
    return htmlspecialchars(
        (string) ($old[$key] ?? ''),
        ENT_QUOTES,
        'UTF-8'
    );
};

?>
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="description" content="Đặt bàn trực tuyến tại Mộc Coffee." />

  <title>Đặt bàn - Mộc Coffee</title>

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
              <a class="btn btn-outline-light active" href="booking.php" aria-current="page">
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
  <section class="page-banner booking-banner">
    <div class="container text-center text-white">
      <h1 class="display-5 fw-bold">
        Đặt bàn tại Mộc Coffee
      </h1>

      <p class="lead mb-0">
        Chọn bàn và thời gian phù hợp trước khi đến quán.
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

          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Đặt bàn
          </li>

        </ol>
      </nav>
    </div>
  </section>

  <!-- Nội dung -->
  <section class="py-5 bg-light">
    <div class="container">

      <!-- Thông báo đặt bàn thành công -->
      <?php if (
          ($_GET['success'] ?? '') === '1'
          && is_array($bookingSuccess)
      ): ?>

        <div
          class="alert alert-success
                 border-0 shadow-sm p-4 mb-4"
        >
          <div
            class="d-flex flex-column
                   flex-md-row align-items-md-center gap-3"
          >
            <i
              class="bi bi-check-circle-fill"
              style="font-size: 3rem"
            ></i>

            <div>
              <h2 class="h4">
                Đặt bàn thành công!
              </h2>

              <p class="mb-1">
                Mã đặt bàn:

                <strong>
                  <?=
                    htmlspecialchars(
                        $bookingSuccess[
                            'booking_code'
                        ],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>
              </p>

              <p class="mb-1">
                Bàn:

                <strong>
                  <?=
                    htmlspecialchars(
                        $bookingSuccess[
                            'table_code'
                        ],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>

                −

                <?=
                  htmlspecialchars(
                      $bookingSuccess['area'] ?? '',
                      ENT_QUOTES,
                      'UTF-8'
                  )
                ?>
              </p>

              <p class="mb-0">
                Thời gian:

                <strong>
                  <?=
                    date(
                        'd/m/Y',
                        strtotime(
                            $bookingSuccess[
                                'booking_date'
                            ]
                        )
                    )
                  ?>

                  lúc

                  <?=
                    htmlspecialchars(
                        substr(
                            $bookingSuccess[
                                'booking_time'
                            ],
                            0,
                            5
                        ),
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </strong>
              </p>
            </div>
          </div>
        </div>

      <?php endif; ?>

      <!-- Thông báo lỗi -->
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

        <!-- Form đặt bàn -->
        <div class="col-12 col-lg-8">
          <form
            method="POST"
            action="../actions/booking-create.php"
            class="card border-0 shadow-sm"
          >
            <div class="card-body p-4 p-md-5">

              <h2 class="h4 mb-4">
                <i
                  class="bi bi-calendar-check me-2"
                ></i>
                Thông tin đặt bàn
              </h2>

              <div class="row g-3">

                <!-- Họ tên -->
                <div class="col-12 col-md-6">
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
                      $oldValue(
                          $old,
                          'customer_name'
                      )
                    ?>"
                    minlength="2"
                    maxlength="100"
                    required
                  >
                </div>

                <!-- Điện thoại -->
                <div class="col-12 col-md-6">
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
                    value="<?=
                      $oldValue(
                          $old,
                          'customer_phone'
                      )
                    ?>"
                    pattern="0[0-9]{9}"
                    maxlength="10"
                    placeholder="0901234567"
                    required
                  >
                </div>

                <!-- Email -->
                <div class="col-12">
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
                    value="<?=
                      $oldValue(
                          $old,
                          'customer_email'
                      )
                    ?>"
                    maxlength="150"
                  >
                </div>

                <!-- Ngày -->
                <div class="col-12 col-md-6">
                  <label
                    for="booking-date"
                    class="form-label fw-semibold"
                  >
                    Ngày đặt
                    <span class="text-danger">*</span>
                  </label>

                  <input
                    type="date"
                    id="booking-date"
                    name="booking_date"
                    class="form-control"
                    value="<?=
                      $oldValue(
                          $old,
                          'booking_date'
                      )
                    ?>"
                    min="<?= date('Y-m-d') ?>"
                    required
                  >
                </div>

                <!-- Giờ -->
                <div class="col-12 col-md-6">
                  <label
                    for="booking-time"
                    class="form-label fw-semibold"
                  >
                    Giờ đến
                    <span class="text-danger">*</span>
                  </label>

                  <input
                    type="time"
                    id="booking-time"
                    name="booking_time"
                    class="form-control"
                    value="<?=
                      $oldValue(
                          $old,
                          'booking_time'
                      )
                    ?>"
                    min="07:00"
                    max="22:00"
                    required
                  >
                </div>

                <!-- Số khách -->
                <div class="col-12 col-md-6">
                  <label
                    for="guest-count"
                    class="form-label fw-semibold"
                  >
                    Số lượng khách
                    <span class="text-danger">*</span>
                  </label>

                  <input
                    type="number"
                    id="guest-count"
                    name="guest_count"
                    class="form-control"
                    value="<?=
                      $oldValue(
                          $old,
                          'guest_count'
                      )
                    ?>"
                    min="1"
                    max="20"
                    required
                  >
                </div>

                <!-- Chọn bàn -->
                <div class="col-12 col-md-6">
                  <label
                    for="table-id"
                    class="form-label fw-semibold"
                  >
                    Chọn bàn
                    <span class="text-danger">*</span>
                  </label>

                  <select
                    id="table-id"
                    name="table_id"
                    class="form-select"
                    required
                  >
                    <option value="">
                      Chọn bàn phù hợp
                    </option>

                    <?php foreach (
                        $tables as $table
                    ): ?>

                      <option
                        value="<?=
                          (int) $table['id']
                        ?>"
                        <?=
                          (int) (
                              $old['table_id'] ?? 0
                          )
                          === (int) $table['id']
                              ? 'selected'
                              : ''
                        ?>
                      >
                        <?=
                          htmlspecialchars(
                              $table['table_code'],
                              ENT_QUOTES,
                              'UTF-8'
                          )
                        ?>

                        −

                        <?=
                          htmlspecialchars(
                              $table['area'] ?? '',
                              ENT_QUOTES,
                              'UTF-8'
                          )
                        ?>

                        − Tối đa

                        <?= (int) $table['capacity'] ?>

                        khách
                      </option>

                    <?php endforeach; ?>
                  </select>
                </div>

                <!-- Ghi chú -->
                <div class="col-12">
                  <label
                    for="booking-note"
                    class="form-label fw-semibold"
                  >
                    Ghi chú
                  </label>

                  <textarea
                    id="booking-note"
                    name="note"
                    class="form-control"
                    rows="4"
                    maxlength="300"
                    placeholder="Ví dụ: Cần ghế trẻ em..."
                  ><?= $oldValue($old, 'note') ?></textarea>
                </div>

                <!-- Chính sách -->
                <div class="col-12">
                  <div class="form-check">

                    <input
                      type="checkbox"
                      id="booking-policy"
                      name="booking_policy"
                      value="1"
                      class="form-check-input"
                      required
                    >

                    <label
                      for="booking-policy"
                      class="form-check-label"
                    >
                      Tôi xác nhận thông tin đặt bàn
                      là chính xác.
                    </label>

                  </div>
                </div>

                <!-- Nút đặt -->
                <div class="col-12">
                  <button
                    type="submit"
                    class="btn btn-coffee
                           btn-lg w-100"
                  >
                    <i
                      class="bi bi-calendar-check me-1"
                    ></i>
                    Xác nhận đặt bàn
                  </button>
                </div>

              </div>
            </div>
          </form>
        </div>

        <!-- Thông tin hỗ trợ -->
        <div class="col-12 col-lg-4">

          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body p-4">

              <h2 class="h5">
                <i class="bi bi-clock me-2"></i>
                Giờ nhận đặt bàn
              </h2>

              <p class="text-secondary mb-2">
                Mỗi ngày:
              </p>

              <strong>07:00 – 22:00</strong>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body p-4">

              <h2 class="h5">
                <i class="bi bi-info-circle me-2"></i>
                Lưu ý
              </h2>

              <ul class="text-secondary ps-3 mb-0">
                <li class="mb-2">
                  Vui lòng đến đúng giờ đã đặt.
                </li>

                <li class="mb-2">
                  Bàn được giữ trong 15 phút.
                </li>

                <li class="mb-2">
                  Mỗi lượt đặt bàn dự kiến kéo dài
                  khoảng hai giờ.
                </li>

                <li>
                  Liên hệ quán nếu cần thay đổi
                  thông tin.
                </li>
              </ul>
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-body p-4">

              <h2 class="h5">
                <i class="bi bi-headset me-2"></i>
                Liên hệ hỗ trợ
              </h2>

              <a
                href="tel:0123456789"
                class="text-decoration-none fw-semibold"
              >
                <i class="bi bi-telephone-fill me-1"></i>
                0123 456 789
              </a>
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

  <!-- Modal xác nhận đặt bàn thành công -->
  <div class="modal fade" id="booking-success-modal" tabindex="-1" aria-labelledby="booking-success-title"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0">
        <div class="modal-body text-center p-5">
          <div class="success-icon mb-3">
            <i class="bi bi-check-circle-fill"></i>
          </div>

          <h2 class="h3 fw-bold" id="booking-success-title">
            Đặt bàn thành công
          </h2>

          <p class="text-secondary">
            Yêu cầu đặt bàn của bạn đã được ghi nhận.
          </p>

          <div class="bg-light rounded p-3 mb-4">
            <span class="text-secondary">Mã đặt bàn:</span>
            <strong id="booking-code" class="ms-1">
              MC000000
            </strong>
          </div>

          <a href="success.php" class="btn btn-coffee">
            Xem thông tin đặt bàn
          </a>

          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
            Đóng
          </button>
        </div>
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
  const yearElement =
    document.getElementById("current-year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }
</script>
</body>

</html>