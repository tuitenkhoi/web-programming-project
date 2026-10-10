<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

/*
 * Lấy ID sản phẩm từ URL.
 *
 * Ví dụ:
 * product-detail.php?id=1
 */
$productId = filter_input(
    INPUT_GET,
    'id',
    FILTER_VALIDATE_INT
);

if (!$productId || $productId < 1) {
    http_response_code(400);

    exit(
        '<h1>ID sản phẩm không hợp lệ</h1>
         <p><a href="menu.php">Quay lại thực đơn</a></p>'
    );
}

/*
 * Tìm sản phẩm trong MySQL.
 */
$productStatement = $pdo->prepare(
    "SELECT
        p.id,
        p.category_id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.image,
        c.name AS category_name
     FROM products AS p
     INNER JOIN categories AS c
        ON c.id = p.category_id
     WHERE p.id = :product_id
       AND p.status = 1
       AND c.status = 1
     LIMIT 1"
);

$productStatement->execute([
    'product_id' => $productId,
]);

$product = $productStatement->fetch();

/*
 * Nếu không tìm thấy sản phẩm.
 */
if (!$product) {
    http_response_code(404);

    exit(
        '<h1>Không tìm thấy sản phẩm</h1>
         <p>Sản phẩm không tồn tại hoặc đã ngừng bán.</p>
         <p><a href="menu.php">Quay lại thực đơn</a></p>'
    );
}

/*
 * Lấy tối đa bốn sản phẩm liên quan.
 *
 * Ưu tiên sản phẩm cùng danh mục.
 */
$relatedStatement = $pdo->prepare(
    "SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image,
        c.name AS category_name
     FROM products AS p
     INNER JOIN categories AS c
        ON c.id = p.category_id
     WHERE p.id <> :product_id
       AND p.status = 1
       AND c.status = 1
     ORDER BY
        (p.category_id = :category_id) DESC,
        p.id DESC
     LIMIT 4"
);

$relatedStatement->execute([
    'product_id' => $productId,
    'category_id' => (int) $product['category_id'],
]);

$relatedProducts = $relatedStatement->fetchAll();

/*
 * Hàm tạo đường dẫn hình ảnh.
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

$mainImageUrl = $productImageUrl(
    $product['image'] ?? null
);

/*
 * Mô tả mặc định.
 */
$productDescription = trim(
    (string) ($product['description'] ?? '')
);

if ($productDescription === '') {
    $productDescription =
        'Sản phẩm được chuẩn bị từ nguyên liệu chất lượng tại Mộc Coffee.';
}

/*
 * Đếm tổng số lượng trong giỏ PHP Session.
 */
$cartCount = 0;

foreach ($_SESSION['cart'] ?? [] as $cartItem) {
    $cartCount += max(
        0,
        (int) ($cartItem['quantity'] ?? 0)
    );
}

?>
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="description" content="Thông tin chi tiết món tại Mộc Coffee." />

  <title>Chi tiết món - Mộc Coffee</title>

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
              <a class="nav-link active" href="menu.php" aria-current="page">
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
  <main class="product-detail-page">
    <!-- Breadcrumb -->
    <section class="bg-light border-bottom product-breadcrumb">
      <div class="container py-3">
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item">
              <a href="../index.php">Trang chủ</a>
            </li>

            <li class="breadcrumb-item">
              <a href="menu.php">Thực đơn</a>
            </li>

            <li id="breadcrumb-product-name" class="breadcrumb-item active" aria-current="page">
              <?=
  htmlspecialchars(
      $product['name'],
      ENT_QUOTES,
      'UTF-8'
  )
?>
            </li>
          </ol>
        </nav>
      </div>
    </section>

    <!-- ==================== THÔNG TIN SẢN PHẨM ==================== -->
<section class="py-5">
  <div class="container">
    <div class="row g-5">

      <!-- Hình ảnh sản phẩm -->
      <div class="col-12 col-lg-6">
        <div class="product-detail-image-wrapper">

          <img
            id="product-main-image"
            src="<?=
              htmlspecialchars(
                  $mainImageUrl,
                  ENT_QUOTES,
                  'UTF-8'
              )
            ?>"
            class="img-fluid product-detail-image"
            alt="<?=
              htmlspecialchars(
                  $product['name'],
                  ENT_QUOTES,
                  'UTF-8'
              )
            ?>"
            onerror="
              this.onerror = null;
              this.src =
                '../assets/images/products/default-product.jpg';
            "
          >

          <span
            class="badge bg-danger product-detail-badge"
          >
            Đang bán
          </span>
        </div>

        <!-- Ảnh nhỏ -->
        <div class="d-flex gap-3 mt-3">
          <button
            type="button"
            class="product-thumbnail active"
          >
            <img
              src="<?=
                htmlspecialchars(
                    $mainImageUrl,
                    ENT_QUOTES,
                    'UTF-8'
                )
              ?>"
              alt="<?=
                htmlspecialchars(
                    $product['name'],
                    ENT_QUOTES,
                    'UTF-8'
                )
              ?>"
            >
          </button>
        </div>
      </div>

      <!-- Thông tin và tùy chọn -->
      <div class="col-12 col-lg-6">

        <form
          id="product-option-form"
          method="POST"
          action="../actions/cart-add.php"
        >
          <!-- ID sản phẩm gửi sang giỏ hàng -->
          <input
            type="hidden"
            name="product_id"
            value="<?= (int) $product['id'] ?>"
          >

          <!-- Danh mục -->
          <p
            class="text-uppercase text-secondary
                   fw-semibold mb-2"
          >
            <?=
              htmlspecialchars(
                  $product['category_name'],
                  ENT_QUOTES,
                  'UTF-8'
              )
            ?>
          </p>

          <!-- Tên sản phẩm -->
          <h1 class="display-6 fw-bold mb-3">
            <?=
              htmlspecialchars(
                  $product['name'],
                  ENT_QUOTES,
                  'UTF-8'
              )
            ?>
          </h1>

          <!-- Trạng thái -->
          <div
            class="d-flex flex-wrap
                   align-items-center gap-2 mb-3"
          >
            <div class="text-warning">
              <i class="bi bi-star-fill"></i>
              <i class="bi bi-star-fill"></i>
              <i class="bi bi-star-fill"></i>
              <i class="bi bi-star-fill"></i>
              <i class="bi bi-star-half"></i>
            </div>

            <strong>4.8</strong>

            <span class="text-secondary">
            </span>

            <span class="text-success">
              <i class="bi bi-check-circle-fill me-1"></i>
              Còn món
            </span>
          </div>

          <!-- Giá -->
          <div class="mb-3">
            <span
              id="product-price"
              class="fs-2 fw-bold text-danger"
            >
              <?=
                number_format(
                    (float) $product['price'],
                    0,
                    ',',
                    '.'
                )
              ?>đ
            </span>
          </div>

          <!-- Mô tả -->
          <p class="text-secondary fs-5">
            <?=
              htmlspecialchars(
                  $productDescription,
                  ENT_QUOTES,
                  'UTF-8'
              )
            ?>
          </p>

          <hr class="my-4">

          <!-- Chọn kích thước -->
          <div class="mb-4">
            <label class="form-label fw-bold">
              Chọn kích thước
              <span class="text-danger">*</span>
            </label>

            <div class="row g-3">

              <!-- Size S -->
              <div class="col-4">
                <input
                  type="radio"
                  class="btn-check size-option"
                  name="size"
                  id="size-s"
                  value="S"
                  data-extra-price="-5000"
                >

                <label
                  class="product-option-box"
                  for="size-s"
                >
                  <strong>S</strong>
                  <small>-5.000đ</small>
                </label>
              </div>

              <!-- Size M -->
              <div class="col-4">
                <input
                  type="radio"
                  class="btn-check size-option"
                  name="size"
                  id="size-m"
                  value="M"
                  data-extra-price="0"
                  checked
                >

                <label
                  class="product-option-box"
                  for="size-m"
                >
                  <strong>M</strong>
                  <small>Tiêu chuẩn</small>
                </label>
              </div>

              <!-- Size L -->
              <div class="col-4">
                <input
                  type="radio"
                  class="btn-check size-option"
                  name="size"
                  id="size-l"
                  value="L"
                  data-extra-price="10000"
                >

                <label
                  class="product-option-box"
                  for="size-l"
                >
                  <strong>L</strong>
                  <small>+10.000đ</small>
                </label>
              </div>
            </div>
          </div>

          <!-- Đường và đá -->
          <div class="row g-3 mb-4">

            <!-- Mức đường -->
            <div class="col-12 col-md-6">
              <label
                for="sugar-level"
                class="form-label fw-bold"
              >
                Mức đường
              </label>

              <select
                id="sugar-level"
                name="sugar_level"
                class="form-select"
              >
                <option value="100%">
                  100% đường
                </option>

                <option value="70%" selected>
                  70% đường
                </option>

                <option value="50%">
                  50% đường
                </option>

                <option value="30%">
                  30% đường
                </option>

                <option value="0%">
                  Không đường
                </option>
              </select>
            </div>

            <!-- Mức đá -->
            <div class="col-12 col-md-6">
              <label
                for="ice-level"
                class="form-label fw-bold"
              >
                Mức đá
              </label>

              <select
                id="ice-level"
                name="ice_level"
                class="form-select"
              >
                <option value="100%">
                  100% đá
                </option>

                <option value="70%" selected>
                  70% đá
                </option>

                <option value="50%">
                  50% đá
                </option>

                <option value="30%">
                  30% đá
                </option>

                <option value="0%">
                  Không đá
                </option>
              </select>
            </div>
          </div>

          <!-- Topping -->
          <div class="mb-4">
            <label class="form-label fw-bold">
              Topping thêm
            </label>

            <div class="row g-2">

              <!-- Trân châu -->
              <div class="col-12 col-sm-6">
                <div class="form-check topping-option">

                  <input
                    type="checkbox"
                    class="form-check-input topping-checkbox"
                    id="topping-pearl"
                    name="toppings[]"
                    value="Trân châu"
                    data-price="10000"
                  >

                  <label
                    class="form-check-label
                           d-flex justify-content-between w-100"
                    for="topping-pearl"
                  >
                    <span>Trân châu</span>
                    <strong>+10.000đ</strong>
                  </label>
                </div>
              </div>

              <!-- Thạch cà phê -->
              <div class="col-12 col-sm-6">
                <div class="form-check topping-option">

                  <input
                    type="checkbox"
                    class="form-check-input topping-checkbox"
                    id="topping-jelly"
                    name="toppings[]"
                    value="Thạch cà phê"
                    data-price="10000"
                  >

                  <label
                    class="form-check-label
                           d-flex justify-content-between w-100"
                    for="topping-jelly"
                  >
                    <span>Thạch cà phê</span>
                    <strong>+10.000đ</strong>
                  </label>
                </div>
              </div>

              <!-- Kem sữa -->
              <div class="col-12 col-sm-6">
                <div class="form-check topping-option">

                  <input
                    type="checkbox"
                    class="form-check-input topping-checkbox"
                    id="topping-cream"
                    name="toppings[]"
                    value="Kem sữa"
                    data-price="12000"
                  >

                  <label
                    class="form-check-label
                           d-flex justify-content-between w-100"
                    for="topping-cream"
                  >
                    <span>Kem sữa</span>
                    <strong>+12.000đ</strong>
                  </label>
                </div>
              </div>

              <!-- Thêm shot -->
              <div class="col-12 col-sm-6">
                <div class="form-check topping-option">

                  <input
                    type="checkbox"
                    class="form-check-input topping-checkbox"
                    id="topping-shot"
                    name="toppings[]"
                    value="Thêm shot cà phê"
                    data-price="15000"
                  >

                  <label
                    class="form-check-label
                           d-flex justify-content-between w-100"
                    for="topping-shot"
                  >
                    <span>Thêm shot cà phê</span>
                    <strong>+15.000đ</strong>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Ghi chú -->
          <div class="mb-4">
            <label
              for="product-note"
              class="form-label fw-bold"
            >
              Ghi chú cho món
            </label>

            <textarea
              id="product-note"
              name="note"
              class="form-control"
              rows="3"
              maxlength="200"
              placeholder="Ví dụ: Ít ngọt, không dùng ống hút..."
            ></textarea>

            <div class="text-end mt-1">
              <small class="text-secondary">
                <span id="product-note-count">0</span>/200
              </small>
            </div>
          </div>

          <!-- Số lượng -->
          <div class="mb-4">
            <label class="form-label fw-bold">
              Số lượng
            </label>

            <div
              class="quantity-control
                     product-quantity-control"
            >
              <button
                type="button"
                id="decrease-product-quantity"
                class="quantity-button"
                aria-label="Giảm số lượng"
              >
                <i class="bi bi-dash"></i>
              </button>

              <input
                type="number"
                id="product-quantity"
                name="quantity"
                class="quantity-input"
                value="1"
                min="1"
                max="99"
                required
              >

              <button
                type="button"
                id="increase-product-quantity"
                class="quantity-button"
                aria-label="Tăng số lượng"
              >
                <i class="bi bi-plus"></i>
              </button>
            </div>
          </div>

          <!-- Tổng tiền và nút thêm -->
          <div class="product-action-box">
            <div>
              <small class="text-secondary">
                Tổng cộng
              </small>

              <div
                id="product-total-price"
                class="fs-3 fw-bold text-danger"
              >
                <?=
                  number_format(
                      (float) $product['price'],
                      0,
                      ',',
                      '.'
                  )
                ?>đ
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-coffee btn-lg"
            >
              <i class="bi bi-cart-plus me-1"></i>
              Thêm vào giỏ
            </button>
          </div>
        </form>

        <!-- Thông tin dịch vụ -->
        <div class="row g-3 mt-3">
          <div class="col-12 col-sm-6">
            <div class="product-service-item">
              <i class="bi bi-clock"></i>

              <div>
                <strong>Chuẩn bị nhanh</strong>
                <small>Khoảng 10–15 phút</small>
              </div>
            </div>
          </div>

          <div class="col-12 col-sm-6">
            <div class="product-service-item">
              <i class="bi bi-arrow-repeat"></i>

              <div>
                <strong>Có thể tùy chỉnh</strong>
                <small>Đường, đá và topping</small>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</section>

    <!-- Thông tin bổ sung -->
    <section class="py-5 bg-light">
      <div class="container">
        <ul class="nav nav-tabs" id="product-information-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="ingredients-tab" data-bs-toggle="tab"
              data-bs-target="#ingredients-content" type="button" role="tab" aria-controls="ingredients-content"
              aria-selected="true">
              Thành phần
            </button>
          </li>

          <li class="nav-item" role="presentation">
            <button class="nav-link" id="nutrition-tab" data-bs-toggle="tab" data-bs-target="#nutrition-content"
              type="button" role="tab" aria-controls="nutrition-content" aria-selected="false">
              Thông tin dinh dưỡng
            </button>
          </li>

          <li class="nav-item" role="presentation">
            <button class="nav-link" id="reviews-tab" data-bs-toggle="tab" data-bs-target="#reviews-content"
              type="button" role="tab" aria-controls="reviews-content" aria-selected="false">
              Đánh giá
            </button>
          </li>
        </ul>

        <div class="tab-content bg-white border border-top-0 rounded-bottom p-4">
          <!-- Thành phần -->
          <div class="tab-pane fade show active" id="ingredients-content" role="tabpanel"
            aria-labelledby="ingredients-tab" tabindex="0">
            <h2 class="h5">Thành phần chính</h2>

            <ul id="product-ingredients" class="mb-0">
              <li>Cà phê rang xay nguyên chất.</li>
              <li>Sữa đặc.</li>
              <li>Nước tinh khiết.</li>
              <li>Đá viên.</li>
            </ul>
          </div>

          <!-- Dinh dưỡng -->
          <div class="tab-pane fade" id="nutrition-content" role="tabpanel" aria-labelledby="nutrition-tab"
            tabindex="0">
            <h2 class="h5">Thông tin tham khảo</h2>

            <div class="table-responsive">
              <table class="table mb-0">
                <tbody>
                  <tr>
                    <th scope="row">Năng lượng</th>
                    <td>Khoảng 180 kcal</td>
                  </tr>

                  <tr>
                    <th scope="row">Đường</th>
                    <td>Khoảng 22 g</td>
                  </tr>

                  <tr>
                    <th scope="row">Chất béo</th>
                    <td>Khoảng 5 g</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <small class="text-secondary">
              Giá trị có thể thay đổi theo kích thước và tùy chọn
              của món.
            </small>
          </div>

          <!-- Đánh giá -->
          <div class="tab-pane fade" id="reviews-content" role="tabpanel" aria-labelledby="reviews-tab" tabindex="0">
            <div class="row g-4">
              <div class="col-12 col-md-4 text-center">
                <div class="display-4 fw-bold">4.8</div>

                <div class="text-warning mb-2">
                  <i class="bi bi-star-fill"></i>
                  <i class="bi bi-star-fill"></i>
                  <i class="bi bi-star-fill"></i>
                  <i class="bi bi-star-fill"></i>
                  <i class="bi bi-star-half"></i>
                </div>

                <p class="text-secondary mb-0">
                  Dựa trên 126 đánh giá
                </p>
              </div>

              <div class="col-12 col-md-8">
                <div class="review-item">
                  <div class="d-flex justify-content-between">
                    <strong>Nguyễn Minh Anh</strong>

                    <span class="text-warning">
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                    </span>
                  </div>

                  <p class="text-secondary mb-0 mt-2">
                    Cà phê thơm, vị đậm và không quá ngọt. Phục vụ
                    nhanh.
                  </p>
                </div>

                <hr />

                <div class="review-item">
                  <div class="d-flex justify-content-between">
                    <strong>Trần Hoàng Nam</strong>

                    <span class="text-warning">
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star-fill"></i>
                      <i class="bi bi-star"></i>
                    </span>
                  </div>

                  <p class="text-secondary mb-0 mt-2">
                    Hương vị ổn, giá hợp lý và có nhiều tùy chọn.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== SẢN PHẨM LIÊN QUAN ==================== -->
<section class="py-5">
  <div class="container">

    <div
      class="d-flex justify-content-between
             align-items-end mb-4"
    >
      <div>
        <p class="text-uppercase text-secondary fw-semibold mb-2">
          Có thể bạn sẽ thích
        </p>

        <h2 class="section-title mb-0">
          Món liên quan
        </h2>
      </div>

      <a
        href="menu.php"
        class="btn btn-outline-coffee
               d-none d-sm-inline-block"
      >
        Xem tất cả
      </a>
    </div>

    <?php if (empty($relatedProducts)): ?>

      <div class="alert alert-info text-center">
        Chưa có sản phẩm liên quan.
      </div>

    <?php else: ?>

      <div class="row g-4">

        <?php foreach ($relatedProducts as $relatedProduct): ?>

          <?php
          $relatedImageUrl = $productImageUrl(
              $relatedProduct['image'] ?? null
          );

          $relatedDescription = trim(
              (string) (
                  $relatedProduct['description'] ?? ''
              )
          );

          if ($relatedDescription === '') {
              $relatedDescription =
                  'Sản phẩm được chuẩn bị tại Mộc Coffee.';
          }
          ?>

          <div class="col-12 col-sm-6 col-lg-3">

            <article class="card product-card h-100">

              <img
                src="<?=
                  htmlspecialchars(
                      $relatedImageUrl,
                      ENT_QUOTES,
                      'UTF-8'
                  )
                ?>"
                class="card-img-top"
                alt="<?=
                  htmlspecialchars(
                      $relatedProduct['name'],
                      ENT_QUOTES,
                      'UTF-8'
                  )
                ?>"
                onerror="
                  this.onerror = null;
                  this.src =
                    '../assets/images/products/default-product.jpg';
                "
              >

              <div class="card-body d-flex flex-column">

                <p class="small text-secondary mb-1">
                  <?=
                    htmlspecialchars(
                        $relatedProduct['category_name'],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </p>

                <h3 class="h5">
                  <?=
                    htmlspecialchars(
                        $relatedProduct['name'],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </h3>

                <p class="text-secondary">
                  <?=
                    htmlspecialchars(
                        $relatedDescription,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </p>

                <div
                  class="d-flex justify-content-between
                         align-items-center mt-auto"
                >
                  <strong class="text-danger">
                    <?=
                      number_format(
                          (float) $relatedProduct['price'],
                          0,
                          ',',
                          '.'
                      )
                    ?>đ
                  </strong>

                  <a
                    href="product-detail.php?id=<?=
                      (int) $relatedProduct['id']
                    ?>"
                    class="btn btn-sm btn-coffee"
                  >
                    Xem món
                  </a>
                </div>
              </div>
            </article>
          </div>

        <?php endforeach; ?>

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
            <li><a href="../index.php">Trang chủ</a></li>
            <li><a href="menu.php">Thực đơn</a></li>
            <li><a href="booking.php">Đặt bàn</a></li>
            <li><a href="cart.php">Giỏ hàng</a></li>
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

  <!-- Toast thông báo thêm vào giỏ -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="cart-toast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i class="bi bi-check-circle-fill text-success me-2"></i>

        <strong class="me-auto">Mộc Coffee</strong>

        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>

      <div class="toast-body">
        Đã thêm món vào giỏ hàng.
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
  const basePrice = <?=
    json_encode(
        (float) $product['price'],
        JSON_UNESCAPED_UNICODE
    )
  ?>;

  const quantityInput =
    document.getElementById("product-quantity");

  const decreaseButton =
    document.getElementById(
      "decrease-product-quantity"
    );

  const increaseButton =
    document.getElementById(
      "increase-product-quantity"
    );

  const totalElement =
    document.getElementById(
      "product-total-price"
    );

  const noteInput =
    document.getElementById("product-note");

  const noteCount =
    document.getElementById("product-note-count");

  function formatCurrency(value) {
    return new Intl.NumberFormat(
      "vi-VN"
    ).format(value) + "đ";
  }

  function calculateTotal() {
    let sizeExtra = 0;
    let toppingTotal = 0;

    const selectedSize =
      document.querySelector(
        'input[name="size"]:checked'
      );

    if (selectedSize) {
      sizeExtra = Number(
        selectedSize.dataset.extraPrice || 0
      );
    }

    document
      .querySelectorAll(
        ".topping-checkbox:checked"
      )
      .forEach(function (checkbox) {
        toppingTotal += Number(
          checkbox.dataset.price || 0
        );
      });

    const quantity = Math.max(
      1,
      Math.min(
        99,
        Number(quantityInput.value) || 1
      )
    );

    quantityInput.value = quantity;

    const unitPrice = Math.max(
      0,
      basePrice + sizeExtra + toppingTotal
    );

    totalElement.textContent =
      formatCurrency(unitPrice * quantity);
  }

  decreaseButton.addEventListener(
    "click",
    function () {
      quantityInput.value = Math.max(
        1,
        Number(quantityInput.value) - 1
      );

      calculateTotal();
    }
  );

  increaseButton.addEventListener(
    "click",
    function () {
      quantityInput.value = Math.min(
        99,
        Number(quantityInput.value) + 1
      );

      calculateTotal();
    }
  );

  quantityInput.addEventListener(
    "input",
    calculateTotal
  );

  document
    .querySelectorAll(
      ".size-option, .topping-checkbox"
    )
    .forEach(function (element) {
      element.addEventListener(
        "change",
        calculateTotal
      );
    });

  noteInput.addEventListener(
    "input",
    function () {
      noteCount.textContent =
        noteInput.value.length;
    }
  );

  calculateTotal();
</script>

</body>


</html>

</html>
