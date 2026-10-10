<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

/*
 * 1. Lấy dữ liệu tìm kiếm và bộ lọc từ URL.
 *
 * Ví dụ:
 * menu.php?search=ca+phe&category=1&sort=price_asc
 */
$search = trim((string) ($_GET['search'] ?? ''));

$categoryId = filter_input(
    INPUT_GET,
    'category',
    FILTER_VALIDATE_INT
);

if (!$categoryId || $categoryId < 1) {
    $categoryId = null;
}

$sort = (string) ($_GET['sort'] ?? 'default');

/*
 * 2. Chỉ chấp nhận các giá trị sắp xếp hợp lệ.
 */
$allowedSorts = [
    'default',
    'name_asc',
    'name_desc',
    'price_asc',
    'price_desc',
];

if (!in_array($sort, $allowedSorts, true)) {
    $sort = 'default';
}

/*
 * 3. Lấy danh mục đang hoạt động.
 */
$categoryStatement = $pdo->query(
    "SELECT id, name, slug
     FROM categories
     WHERE status = 1
     ORDER BY name ASC"
);

$categories = $categoryStatement->fetchAll();

/*
 * 4. Tạo điều kiện truy vấn sản phẩm.
 */
$whereConditions = [
    'p.status = 1',
    'c.status = 1',
];

$queryParameters = [];

if ($search !== '') {
    $whereConditions[] = "
        (
            p.name LIKE :search_name
            OR p.description LIKE :search_description
        )
    ";

    $searchValue = '%' . $search . '%';

    $queryParameters['search_name'] = $searchValue;
    $queryParameters['search_description'] = $searchValue;
}

if ($categoryId !== null) {
    $whereConditions[] = 'p.category_id = :category_id';
    $queryParameters['category_id'] = $categoryId;
}

/*
 * 5. Xác định cách sắp xếp.
 */
$orderBy = match ($sort) {
    'name_asc' => 'p.name ASC',
    'name_desc' => 'p.name DESC',
    'price_asc' => 'p.price ASC',
    'price_desc' => 'p.price DESC',
    default => 'p.id DESC',
};

/*
 * 6. Truy vấn sản phẩm.
 */
$productSql = "
    SELECT
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
    WHERE " . implode(' AND ', $whereConditions) . "
    ORDER BY {$orderBy}
";

$productStatement = $pdo->prepare($productSql);
$productStatement->execute($queryParameters);

$products = $productStatement->fetchAll();

/*
 * 7. Đếm sản phẩm trong giỏ hàng PHP Session.
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

  <meta name="description" content="Thực đơn đồ uống và bánh ngọt tại Mộc Coffee." />

  <title>Thực đơn - Mộc Coffee</title>

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
        <!-- Logo -->
        <a class="navbar-brand d-flex align-items-center fw-bold" href="../index.php">
          <i class="bi bi-cup-hot-fill me-2"></i>
          Mộc Coffee
        </a>

        <!-- Nút mở menu trên điện thoại -->
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar"
          aria-controls="mainNavbar" aria-expanded="false" aria-label="Mở menu điều hướng">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Menu điều hướng -->
        <div class="collapse navbar-collapse" id="mainNavbar">
          <ul class="navbar-nav ms-auto align-items-lg-center">
            <li class="nav-item">
              <a class="nav-link" href="../index.php">
                Trang chủ
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="menu.php">
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
    <!-- Banner trang thực đơn -->
    <section class="page-banner menu-banner">
      <div class="container text-center text-white">
        <h1 class="display-5 fw-bold">Thực đơn Mộc Coffee</h1>

        <p class="lead mb-0">
          Khám phá những thức uống và món bánh được chuẩn bị mỗi
          ngày.
        </p>
      </div>
    </section>

    <!-- Breadcrumb -->
    <section class="bg-light border-bottom">
      <div class="container py-3">
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item">
              <a href="../index.php">Trang chủ</a>
            </li>

            <li class="breadcrumb-item active" aria-current="page">
              Thực đơn
            </li>
          </ol>
        </nav>
      </div>
    </section>

    <!-- ==================== TÌM KIẾM VÀ BỘ LỌC ==================== -->
<section class="py-4 bg-white sticky-filter">
  <div class="container">

    <form method="GET" action="menu.php">
      <div class="row g-3 align-items-end">

        <!-- Tìm kiếm -->
        <div class="col-12 col-lg-5">
          <label
            for="search-input"
            class="form-label fw-semibold"
          >
            Tìm kiếm món
          </label>

          <div class="input-group">
            <span class="input-group-text bg-white">
              <i class="bi bi-search"></i>
            </span>

            <input
              type="search"
              id="search-input"
              name="search"
              class="form-control"
              placeholder="Nhập tên món cần tìm..."
              value="<?=
                htmlspecialchars(
                    $search,
                    ENT_QUOTES,
                    'UTF-8'
                )
              ?>"
            >
          </div>
        </div>

        <!-- Lọc danh mục -->
        <div class="col-12 col-md-6 col-lg-3">
          <label
            for="category-filter"
            class="form-label fw-semibold"
          >
            Danh mục
          </label>

          <select
            id="category-filter"
            name="category"
            class="form-select"
          >
            <option value="">
              Tất cả danh mục
            </option>

            <?php foreach ($categories as $category): ?>

              <option
                value="<?= (int) $category['id'] ?>"
                <?=
                  $categoryId === (int) $category['id']
                      ? 'selected'
                      : ''
                ?>
              >
                <?=
                  htmlspecialchars(
                      $category['name'],
                      ENT_QUOTES,
                      'UTF-8'
                  )
                ?>
              </option>

            <?php endforeach; ?>
          </select>
        </div>

        <!-- Sắp xếp -->
        <div class="col-12 col-md-6 col-lg-3">
          <label
            for="sort-filter"
            class="form-label fw-semibold"
          >
            Sắp xếp
          </label>

          <select
            id="sort-filter"
            name="sort"
            class="form-select"
          >
            <option
              value="default"
              <?= $sort === 'default' ? 'selected' : '' ?>
            >
              Mặc định
            </option>

            <option
              value="name_asc"
              <?= $sort === 'name_asc' ? 'selected' : '' ?>
            >
              Tên A–Z
            </option>

            <option
              value="name_desc"
              <?= $sort === 'name_desc' ? 'selected' : '' ?>
            >
              Tên Z–A
            </option>

            <option
              value="price_asc"
              <?= $sort === 'price_asc' ? 'selected' : '' ?>
            >
              Giá thấp đến cao
            </option>

            <option
              value="price_desc"
              <?= $sort === 'price_desc' ? 'selected' : '' ?>
            >
              Giá cao đến thấp
            </option>
          </select>
        </div>

        <!-- Nút tìm kiếm -->
        <div class="col-6 col-lg-1">
          <button
            type="submit"
            class="btn btn-coffee w-100"
            title="Áp dụng bộ lọc"
          >
            <i class="bi bi-search"></i>
          </button>
        </div>

        <!-- Nút xóa bộ lọc -->
        <div class="col-6 d-lg-none">
          <a
            href="menu.php"
            class="btn btn-outline-secondary w-100"
          >
            Xóa bộ lọc
          </a>
        </div>
      </div>
    </form>

    <!-- Các nút lọc nhanh -->
    <div
      class="d-flex flex-wrap gap-2
             justify-content-center mt-4"
    >
      <a
        href="menu.php"
        class="btn <?=
          $categoryId === null
              ? 'btn-coffee'
              : 'btn-outline-coffee'
        ?>"
      >
        Tất cả
      </a>

      <?php foreach ($categories as $category): ?>

        <a
          href="menu.php?category=<?=
            (int) $category['id']
          ?>"
          class="btn <?=
            $categoryId === (int) $category['id']
                ? 'btn-coffee'
                : 'btn-outline-coffee'
          ?>"
        >
          <?=
            htmlspecialchars(
                $category['name'],
                ENT_QUOTES,
                'UTF-8'
            )
          ?>
        </a>

      <?php endforeach; ?>

      <?php if (
          $search !== ''
          || $categoryId !== null
          || $sort !== 'default'
      ): ?>

        <a
          href="menu.php"
          class="btn btn-outline-danger"
        >
          <i class="bi bi-x-circle me-1"></i>
          Xóa bộ lọc
        </a>

      <?php endif; ?>
    </div>
  </div>
</section>

    <!-- ==================== DANH SÁCH MÓN ==================== -->
<section class="py-5 bg-light">
  <div class="container">

    <!-- Tiêu đề và số lượng -->
    <div
      class="d-flex flex-column flex-md-row
             justify-content-between align-items-md-center mb-4"
    >
      <div>
        <p class="text-uppercase text-secondary fw-semibold mb-2">
          Khám phá hương vị
        </p>

        <h2 class="section-title mb-0">
          Danh sách món
        </h2>
      </div>

      <p class="text-secondary mt-2 mb-0">
        Hiển thị
        <strong><?= count($products) ?></strong>
        món
      </p>
    </div>

    <?php if (empty($products)): ?>

      <!-- Không có sản phẩm phù hợp -->
      <div class="text-center py-5">
        <i class="bi bi-search display-3 text-secondary"></i>

        <h3 class="h4 mt-3">
          Không tìm thấy món phù hợp
        </h3>

        <p class="text-secondary">
          Hãy thử thay đổi từ khóa hoặc chọn danh mục khác.
        </p>

        <a href="menu.php" class="btn btn-coffee">
          Xem tất cả món
        </a>
      </div>

    <?php else: ?>

      <!-- Danh sách sản phẩm -->
      <div class="row g-4">

        <?php foreach ($products as $index => $product): ?>

          <?php
          /*
           * Xử lý hình ảnh sản phẩm.
           */
          $image = trim(
              (string) ($product['image'] ?? '')
          );

          if ($image === '') {
              $imageUrl =
                  '../assets/images/products/default-product.jpg';
          } elseif (
              filter_var($image, FILTER_VALIDATE_URL)
          ) {
              $imageUrl = $image;
          } elseif (
              strpos($image, '/uploads/') === 0
          ) {
              $imageUrl = '../backend' . $image;
          } else {
              $imageUrl =
                  '../assets/images/products/'
                  . basename($image);
          }

          /*
           * Mô tả mặc định.
           */
          $description = trim(
              (string) ($product['description'] ?? '')
          );

          if ($description === '') {
              $description =
                  'Sản phẩm được chuẩn bị từ nguyên liệu chất lượng.';
          }
          ?>

          <div class="col-12 col-sm-6 col-lg-4 col-xl-3">

            <article class="card product-card h-100">

              <!-- Hình sản phẩm -->
              <div class="position-relative">

                <img
                  src="<?=
                    htmlspecialchars(
                        $imageUrl,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>"
                  class="card-img-top"
                  alt="<?=
                    htmlspecialchars(
                        $product['name'],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>"
                  loading="lazy"
                  onerror="
                    this.onerror = null;
                    this.src =
                      '../assets/images/products/default-product.jpg';
                  "
                >

                <?php if ($index === 0): ?>

                  <span
                    class="badge bg-danger
                           position-absolute top-0 start-0 m-3"
                  >
                    Nổi bật
                  </span>

                <?php endif; ?>

              </div>

              <!-- Nội dung sản phẩm -->
              <div class="card-body d-flex flex-column">

                <p class="small text-secondary mb-1">
                  <?=
                    htmlspecialchars(
                        $product['category_name'],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </p>

                <h3 class="card-title h5">
                  <?=
                    htmlspecialchars(
                        $product['name'],
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </h3>

                <p class="card-text text-secondary">
                  <?=
                    htmlspecialchars(
                        $description,
                        ENT_QUOTES,
                        'UTF-8'
                    )
                  ?>
                </p>

                <div class="mt-auto">

                  <p class="fw-bold text-danger fs-5 mb-3">
                    <?=
                      number_format(
                          (float) $product['price'],
                          0,
                          ',',
                          '.'
                      )
                    ?>đ
                  </p>

                  <div class="d-flex gap-2">

                    <!-- Xem chi tiết -->
                    <a
                      href="product-detail.php?id=<?=
                        (int) $product['id']
                      ?>"
                      class="btn btn-outline-coffee flex-grow-1"
                    >
                      Chi tiết
                    </a>

                    <!-- Thêm nhanh vào giỏ -->
                    <form
                      method="POST"
                      action="../actions/cart-add.php"
                    >
                      <input
                        type="hidden"
                        name="product_id"
                        value="<?= (int) $product['id'] ?>"
                      >

                      <input
                        type="hidden"
                        name="quantity"
                        value="1"
                      >

                      <input
                        type="hidden"
                        name="size"
                        value="M"
                      >

                      <input
                        type="hidden"
                        name="sugar_level"
                        value="70%"
                      >

                      <input
                        type="hidden"
                        name="ice_level"
                        value="70%"
                      >

                      <button
                        type="submit"
                        class="btn btn-coffee"
                        title="Thêm vào giỏ hàng"
                      >
                        <i class="bi bi-cart-plus"></i>
                      </button>
                    </form>

                  </div>
                </div>
              </div>
            </article>
          </div>

        <?php endforeach; ?>

      </div>

    <?php endif; ?>

  </div>
</section>
    <!-- Phần đặt bàn -->
    <section class="booking-callout py-5">
      <div class="container text-center text-white">
        <h2 class="fw-bold">Bạn muốn dùng món tại quán?</h2>

        <p class="lead mb-4">
          Đặt bàn trước để lựa chọn vị trí phù hợp và được phục vụ
          nhanh chóng.
        </p>

        <a href="booking.php" class="btn btn-light btn-lg">
          <i class="bi bi-calendar2-check me-1"></i>
          Đặt bàn ngay
        </a>
      </div>
    </section>
  </main>

  <!-- ==================== FOOTER ==================== -->
  <footer class="bg-dark text-white pt-5">
    <div class="container">
      <div class="row g-4">
        <!-- Giới thiệu -->
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

        <!-- Liên kết -->
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

        <!-- Giờ mở cửa -->
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

        <!-- Liên hệ -->
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

  <!-- Thông báo thêm vào giỏ -->
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

  <!-- Nút trở về đầu trang -->
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

  const backToTopButton =
    document.getElementById("back-to-top");

  if (backToTopButton) {
    window.addEventListener("scroll", function () {
      backToTopButton.classList.toggle(
        "show",
        window.scrollY > 300
      );
    });

    backToTopButton.addEventListener(
      "click",
      function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );
  }
</script>


</body>


</html>

</html>
