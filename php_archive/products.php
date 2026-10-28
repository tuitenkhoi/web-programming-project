<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * XỬ LÝ THÊM, SỬA, XÓA DỮ LIỆU
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();

    $action = (string) ($_POST['action'] ?? '');

    try {
        /*
         * THÊM HOẶC SỬA SẢN PHẨM
         */
        if ($action === 'save_product') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            ) ?: null;

            $name = trim(
                (string) ($_POST['name'] ?? '')
            );

            $categoryId = filter_input(
                INPUT_POST,
                'category_id',
                FILTER_VALIDATE_INT
            );

            $description = trim(
                (string) ($_POST['description'] ?? '')
            );

            $price = filter_input(
                INPUT_POST,
                'price',
                FILTER_VALIDATE_FLOAT
            );

            $status =
                isset($_POST['status']) ? 1 : 0;

            if (
                mb_strlen($name) < 2
                || !$categoryId
                || $price === false
                || $price < 0
            ) {
                throw new RuntimeException(
                    'Vui lòng nhập đầy đủ tên, '
                    . 'danh mục và giá sản phẩm hợp lệ.'
                );
            }

            /*
             * Kiểm tra danh mục có tồn tại không.
             */
            $categoryStatement = $pdo->prepare(
                'SELECT id
                 FROM categories
                 WHERE id = :id
                 LIMIT 1'
            );

            $categoryStatement->execute([
                'id' => $categoryId,
            ]);

            if (!$categoryStatement->fetch()) {
                throw new RuntimeException(
                    'Danh mục được chọn không tồn tại.'
                );
            }

            /*
             * Nếu đang sửa, lấy ảnh hiện tại.
             */
            $currentImage = null;

            if ($id !== null) {
                $currentStatement = $pdo->prepare(
                    'SELECT image
                     FROM products
                     WHERE id = :id
                     LIMIT 1'
                );

                $currentStatement->execute([
                    'id' => $id,
                ]);

                $currentProduct =
                    $currentStatement->fetch();

                if (!$currentProduct) {
                    throw new RuntimeException(
                        'Sản phẩm cần sửa không tồn tại.'
                    );
                }

                $currentImage =
                    $currentProduct['image'];
            }

            $imagePath = is_string($currentImage)
                ? $currentImage
                : null;

            $uploadedFile =
                $_FILES['image'] ?? null;

            /*
             * Xử lý khi có upload ảnh mới.
             */
            if (
                is_array($uploadedFile)
                && (int) (
                    $uploadedFile['error']
                    ?? UPLOAD_ERR_NO_FILE
                ) !== UPLOAD_ERR_NO_FILE
            ) {
                if (
                    (int) $uploadedFile['error']
                    !== UPLOAD_ERR_OK
                ) {
                    throw new RuntimeException(
                        'Không thể tải hình ảnh lên. '
                        . 'Vui lòng thử lại.'
                    );
                }

                if (
                    (int) $uploadedFile['size']
                    > 2 * 1024 * 1024
                ) {
                    throw new RuntimeException(
                        'Hình ảnh không được vượt quá 2 MB.'
                    );
                }

                $fileInfo = new finfo(
                    FILEINFO_MIME_TYPE
                );

                $mime = $fileInfo->file(
                    (string) $uploadedFile['tmp_name']
                );

                $extensions = [
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                ];

                if (!isset($extensions[$mime])) {
                    throw new RuntimeException(
                        'Chỉ chấp nhận hình JPG, '
                        . 'PNG hoặc WEBP.'
                    );
                }

                $uploadDirectory =
                    __DIR__
                    . '/../backend/uploads/products';

                if (
                    !is_dir($uploadDirectory)
                    && !mkdir(
                        $uploadDirectory,
                        0775,
                        true
                    )
                    && !is_dir($uploadDirectory)
                ) {
                    throw new RuntimeException(
                        'Không thể tạo thư mục lưu hình ảnh.'
                    );
                }

                $filename =
                    date('YmdHis')
                    . '-'
                    . bin2hex(random_bytes(6))
                    . '.'
                    . $extensions[$mime];

                $destination =
                    $uploadDirectory
                    . '/'
                    . $filename;

                if (
                    !move_uploaded_file(
                        (string) $uploadedFile['tmp_name'],
                        $destination
                    )
                ) {
                    throw new RuntimeException(
                        'Không thể lưu hình ảnh sản phẩm.'
                    );
                }

                $imagePath =
                    '/uploads/products/' . $filename;
            }

            $slug = admin_unique_slug(
                $pdo,
                'products',
                $name,
                $id
            );

            /*
             * Thêm sản phẩm mới.
             */
            if ($id === null) {
                $statement = $pdo->prepare(
                    'INSERT INTO products (
                        category_id,
                        name,
                        slug,
                        description,
                        price,
                        image,
                        status
                    ) VALUES (
                        :category_id,
                        :name,
                        :slug,
                        :description,
                        :price,
                        :image,
                        :status
                    )'
                );

                $statement->execute([
                    'category_id' => $categoryId,
                    'name' => $name,
                    'slug' => $slug,
                    'description' =>
                        $description !== ''
                            ? $description
                            : null,
                    'price' => $price,
                    'image' => $imagePath,
                    'status' => $status,
                ]);

                admin_flash(
                    'success',
                    'Đã thêm sản phẩm mới.'
                );
            } else {
                /*
                 * Cập nhật sản phẩm.
                 */
                $statement = $pdo->prepare(
                    'UPDATE products
                     SET
                        category_id = :category_id,
                        name = :name,
                        slug = :slug,
                        description = :description,
                        price = :price,
                        image = :image,
                        status = :status
                     WHERE id = :id'
                );

                $statement->execute([
                    'category_id' => $categoryId,
                    'name' => $name,
                    'slug' => $slug,
                    'description' =>
                        $description !== ''
                            ? $description
                            : null,
                    'price' => $price,
                    'image' => $imagePath,
                    'status' => $status,
                    'id' => $id,
                ]);

                admin_flash(
                    'success',
                    'Đã cập nhật sản phẩm.'
                );
            }
        }

        /*
         * ẨN HOẶC HIỆN SẢN PHẨM
         */
        elseif ($action === 'toggle_product') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            );

            if (!$id) {
                throw new RuntimeException(
                    'Sản phẩm không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'UPDATE products
                 SET status = IF(status = 1, 0, 1)
                 WHERE id = :id'
            );

            $statement->execute([
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã thay đổi trạng thái sản phẩm.'
            );
        }

        /*
         * XÓA SẢN PHẨM
         */
        elseif ($action === 'delete_product') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            );

            if (!$id) {
                throw new RuntimeException(
                    'Sản phẩm không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'DELETE FROM products
                 WHERE id = :id'
            );

            $statement->execute([
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã xóa sản phẩm.'
            );
        }

        /*
         * THÊM HOẶC SỬA DANH MỤC
         */
        elseif ($action === 'save_category') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            ) ?: null;

            $name = trim(
                (string) ($_POST['name'] ?? '')
            );

            $description = trim(
                (string) (
                    $_POST['description'] ?? ''
                )
            );

            if (mb_strlen($name) < 2) {
                throw new RuntimeException(
                    'Tên danh mục phải có ít nhất 2 ký tự.'
                );
            }

            $slug = admin_unique_slug(
                $pdo,
                'categories',
                $name,
                $id
            );

            if ($id === null) {
                $statement = $pdo->prepare(
                    'INSERT INTO categories (
                        name,
                        slug,
                        description,
                        status
                    ) VALUES (
                        :name,
                        :slug,
                        :description,
                        1
                    )'
                );

                $statement->execute([
                    'name' => $name,
                    'slug' => $slug,
                    'description' =>
                        $description !== ''
                            ? $description
                            : null,
                ]);

                admin_flash(
                    'success',
                    'Đã thêm danh mục.'
                );
            } else {
                $statement = $pdo->prepare(
                    'UPDATE categories
                     SET
                        name = :name,
                        slug = :slug,
                        description = :description
                     WHERE id = :id'
                );

                $statement->execute([
                    'name' => $name,
                    'slug' => $slug,
                    'description' =>
                        $description !== ''
                            ? $description
                            : null,
                    'id' => $id,
                ]);

                admin_flash(
                    'success',
                    'Đã cập nhật danh mục.'
                );
            }
        }

        /*
         * XÓA DANH MỤC
         */
        elseif ($action === 'delete_category') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            );

            if (!$id) {
                throw new RuntimeException(
                    'Danh mục không hợp lệ.'
                );
            }

            /*
             * Không được xóa danh mục còn sản phẩm.
             */
            $countStatement = $pdo->prepare(
                'SELECT COUNT(*)
                 FROM products
                 WHERE category_id = :id'
            );

            $countStatement->execute([
                'id' => $id,
            ]);

            if (
                (int) $countStatement->fetchColumn() > 0
            ) {
                throw new RuntimeException(
                    'Không thể xóa danh mục '
                    . 'đang có sản phẩm.'
                );
            }

            $statement = $pdo->prepare(
                'DELETE FROM categories
                 WHERE id = :id'
            );

            $statement->execute([
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã xóa danh mục.'
            );
        }
    } catch (Throwable $exception) {
        $message =
            $exception instanceof RuntimeException
                ? $exception->getMessage()
                : 'Không thể xử lý yêu cầu sản phẩm.';

        admin_flash('danger', $message);
    }

    admin_redirect('products.php');
}

/*
 * LẤY THÔNG TIN BỘ LỌC
 */
$search = trim(
    (string) ($_GET['search'] ?? '')
);

$categoryFilter = filter_input(
    INPUT_GET,
    'category',
    FILTER_VALIDATE_INT
) ?: null;

$statusFilter =
    isset($_GET['status'])
    && in_array(
        (string) $_GET['status'],
        ['0', '1'],
        true
    )
        ? (string) $_GET['status']
        : '';

$where = ['1 = 1'];
$parameters = [];

if ($search !== '') {
    $where[] =
        '(p.name LIKE :search_name
          OR p.description LIKE :search_description)';

    $parameters['search_name'] =
        '%' . $search . '%';

    $parameters['search_description'] =
        '%' . $search . '%';
}

if ($categoryFilter !== null) {
    $where[] = 'p.category_id = :category_id';

    $parameters['category_id'] =
        $categoryFilter;
}

if ($statusFilter !== '') {
    $where[] = 'p.status = :status';

    $parameters['status'] =
        (int) $statusFilter;
}

/*
 * LẤY DANH SÁCH SẢN PHẨM
 */
$productStatement = $pdo->prepare(
    'SELECT
        p.*,
        c.name AS category_name
     FROM products AS p
     INNER JOIN categories AS c
        ON c.id = p.category_id
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY p.id DESC'
);

$productStatement->execute($parameters);

$products = $productStatement->fetchAll();

/*
 * LẤY DANH SÁCH DANH MỤC
 */
$categories = $pdo->query(
    'SELECT
        c.*,
        COUNT(p.id) AS product_count
     FROM categories AS c
     LEFT JOIN products AS p
        ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name'
)->fetchAll();

/*
 * LẤY SẢN PHẨM CẦN SỬA
 */
$editProduct = null;

$editId = filter_input(
    INPUT_GET,
    'edit',
    FILTER_VALIDATE_INT
);

if ($editId) {
    $statement = $pdo->prepare(
        'SELECT *
         FROM products
         WHERE id = :id
         LIMIT 1'
    );

    $statement->execute([
        'id' => $editId,
    ]);

    $editProduct =
        $statement->fetch() ?: null;
}

/*
 * LẤY DANH MỤC CẦN SỬA
 */
$editCategory = null;

$editCategoryId = filter_input(
    INPUT_GET,
    'category_edit',
    FILTER_VALIDATE_INT
);

if ($editCategoryId) {
    $statement = $pdo->prepare(
        'SELECT *
         FROM categories
         WHERE id = :id
         LIMIT 1'
    );

    $statement->execute([
        'id' => $editCategoryId,
    ]);

    $editCategory =
        $statement->fetch() ?: null;
}

$pageTitle = 'Quản lý sản phẩm';
$activePage = 'products';

require __DIR__ . '/partials/header.php';
?>

<!-- Tiêu đề -->
<div
    class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
>
    <div>
        <h2 class="h3 fw-bold mb-1">
            Thực đơn Mộc Coffee
        </h2>

        <p class="text-secondary mb-0">
            Thêm, sửa, ẩn và tìm kiếm sản phẩm bằng PHP.
        </p>
    </div>

    <div class="d-flex gap-2">
        <a
            href="products.php?category_form=1"
            class="btn btn-outline-coffee"
        >
            <i class="bi bi-tags me-1"></i>
            Thêm danh mục
        </a>

        <a
            href="products.php?form=1"
            class="btn btn-coffee"
        >
            <i class="bi bi-plus-lg me-1"></i>
            Thêm sản phẩm
        </a>
    </div>
</div>

<!-- Form thêm/sửa sản phẩm -->
<?php if (
    isset($_GET['form'])
    || $editProduct !== null
): ?>
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white p-4">
            <h3 class="h5 fw-bold mb-0">
                <?= $editProduct
                    ? 'Cập nhật sản phẩm'
                    : 'Thêm sản phẩm mới'
                ?>
            </h3>
        </div>

        <div class="card-body p-4">
            <form
                method="post"
                action="products.php"
                enctype="multipart/form-data"
                class="row g-3"
            >
                <input
                    type="hidden"
                    name="csrf_token"
                    value="<?= admin_e(
                        admin_csrf_token()
                    ) ?>"
                >

                <input
                    type="hidden"
                    name="action"
                    value="save_product"
                >

                <input
                    type="hidden"
                    name="id"
                    value="<?= admin_e(
                        $editProduct['id'] ?? ''
                    ) ?>"
                >

                <div class="col-12 col-md-6">
                    <label
                        for="product-name"
                        class="form-label fw-semibold"
                    >
                        Tên sản phẩm
                    </label>

                    <input
                        type="text"
                        id="product-name"
                        name="name"
                        class="form-control"
                        minlength="2"
                        maxlength="150"
                        value="<?= admin_e(
                            $editProduct['name'] ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-12 col-md-3">
                    <label
                        for="product-category"
                        class="form-label fw-semibold"
                    >
                        Danh mục
                    </label>

                    <select
                        id="product-category"
                        name="category_id"
                        class="form-select"
                        required
                    >
                        <option value="">
                            Chọn danh mục
                        </option>

                        <?php foreach (
                            $categories as $category
                        ): ?>
                            <option
                                value="<?= (int) $category['id'] ?>"
                                <?=
                                    (int) (
                                        $editProduct['category_id']
                                        ?? 0
                                    )
                                    === (int) $category['id']
                                        ? 'selected'
                                        : ''
                                ?>
                            >
                                <?= admin_e(
                                    $category['name']
                                ) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="col-12 col-md-3">
                    <label
                        for="product-price"
                        class="form-label fw-semibold"
                    >
                        Giá bán
                    </label>

                    <input
                        type="number"
                        id="product-price"
                        name="price"
                        class="form-control"
                        min="0"
                        step="1000"
                        value="<?= admin_e(
                            $editProduct['price'] ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-12 col-md-8">
                    <label
                        for="product-description"
                        class="form-label fw-semibold"
                    >
                        Mô tả
                    </label>

                    <textarea
                        id="product-description"
                        name="description"
                        class="form-control"
                        rows="3"
                        maxlength="1000"
                    ><?= admin_e(
                        $editProduct['description'] ?? ''
                    ) ?></textarea>
                </div>

                <div class="col-12 col-md-4">
                    <label
                        for="product-image"
                        class="form-label fw-semibold"
                    >
                        Hình ảnh (tối đa 2 MB)
                    </label>

                    <input
                        type="file"
                        id="product-image"
                        name="image"
                        class="form-control"
                        accept="image/jpeg,image/png,image/webp"
                    >

                    <?php if (
                        !empty($editProduct['image'])
                    ): ?>
                        <small class="text-secondary">
                            Giữ trống nếu không đổi ảnh.
                        </small>
                    <?php endif; ?>
                </div>

                <div class="col-12">
                    <div class="form-check form-switch">
                        <input
                            type="checkbox"
                            id="product-status"
                            name="status"
                            class="form-check-input"
                            <?=
                                !$editProduct
                                || (int) $editProduct['status']
                                    === 1
                                    ? 'checked'
                                    : ''
                            ?>
                        >

                        <label
                            for="product-status"
                            class="form-check-label"
                        >
                            Đang bán
                        </label>
                    </div>
                </div>

                <div
                    class="col-12 d-flex justify-content-end gap-2"
                >
                    <a
                        href="products.php"
                        class="btn btn-outline-secondary"
                    >
                        Hủy
                    </a>

                    <button
                        type="submit"
                        class="btn btn-coffee"
                    >
                        <i class="bi bi-check-lg me-1"></i>
                        Lưu sản phẩm
                    </button>
                </div>
            </form>
        </div>
    </div>
<?php endif; ?>

<!-- Form thêm/sửa danh mục -->
<?php if (
    isset($_GET['category_form'])
    || $editCategory !== null
): ?>
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white p-4">
            <h3 class="h5 fw-bold mb-0">
                <?= $editCategory
                    ? 'Cập nhật danh mục'
                    : 'Thêm danh mục'
                ?>
            </h3>
        </div>

        <div class="card-body p-4">
            <form
                method="post"
                action="products.php"
                class="row g-3 align-items-end"
            >
                <input
                    type="hidden"
                    name="csrf_token"
                    value="<?= admin_e(
                        admin_csrf_token()
                    ) ?>"
                >

                <input
                    type="hidden"
                    name="action"
                    value="save_category"
                >

                <input
                    type="hidden"
                    name="id"
                    value="<?= admin_e(
                        $editCategory['id'] ?? ''
                    ) ?>"
                >

                <div class="col-12 col-md-4">
                    <label class="form-label fw-semibold">
                        Tên danh mục
                    </label>

                    <input
                        type="text"
                        name="name"
                        class="form-control"
                        minlength="2"
                        maxlength="100"
                        value="<?= admin_e(
                            $editCategory['name'] ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-12 col-md-6">
                    <label class="form-label fw-semibold">
                        Mô tả
                    </label>

                    <input
                        type="text"
                        name="description"
                        class="form-control"
                        value="<?= admin_e(
                            $editCategory['description']
                            ?? ''
                        ) ?>"
                    >
                </div>

                <div class="col-12 col-md-2 d-flex gap-2">
                    <a
                        href="products.php"
                        class="btn btn-outline-secondary"
                    >
                        Hủy
                    </a>

                    <button
                        type="submit"
                        class="btn btn-coffee"
                    >
                        Lưu
                    </button>
                </div>
            </form>
        </div>
    </div>
<?php endif; ?>

<!-- Bộ lọc -->
<div class="card border-0 shadow-sm mb-4">
    <div class="card-body p-4">
        <form
            method="get"
            action="products.php"
            class="row g-3 align-items-end"
        >
            <div class="col-12 col-lg-5">
                <label class="form-label fw-semibold">
                    Tìm sản phẩm
                </label>

                <input
                    type="search"
                    name="search"
                    class="form-control"
                    placeholder="Tên hoặc mô tả..."
                    value="<?= admin_e($search) ?>"
                >
            </div>

            <div class="col-6 col-lg-3">
                <label class="form-label fw-semibold">
                    Danh mục
                </label>

                <select
                    name="category"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach (
                        $categories as $category
                    ): ?>
                        <option
                            value="<?= (int) $category['id'] ?>"
                            <?=
                                $categoryFilter
                                === (int) $category['id']
                                    ? 'selected'
                                    : ''
                            ?>
                        >
                            <?= admin_e(
                                $category['name']
                            ) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold">
                    Trạng thái
                </label>

                <select
                    name="status"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <option
                        value="1"
                        <?= $statusFilter === '1'
                            ? 'selected'
                            : ''
                        ?>
                    >
                        Đang bán
                    </option>

                    <option
                        value="0"
                        <?= $statusFilter === '0'
                            ? 'selected'
                            : ''
                        ?>
                    >
                        Tạm ẩn
                    </option>
                </select>
            </div>

            <div class="col-12 col-lg-2 d-flex gap-2">
                <button
                    type="submit"
                    class="btn btn-coffee flex-grow-1"
                >
                    Lọc
                </button>

                <a
                    href="products.php"
                    class="btn btn-outline-secondary"
                    title="Đặt lại bộ lọc"
                >
                    <i
                        class="bi bi-arrow-counterclockwise"
                    ></i>
                </a>
            </div>
        </form>
    </div>
</div>

<!-- Danh sách sản phẩm -->
<div class="card border-0 shadow-sm mb-4">
    <div class="card-header bg-white p-4">
        <h3 class="h5 fw-bold mb-0">
            Danh sách sản phẩm

            <span class="badge text-bg-light border ms-1">
                <?= count($products) ?>
            </span>
        </h3>
    </div>

    <div class="table-responsive">
        <table
            class="table admin-table align-middle mb-0"
        >
            <thead>
            <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th class="text-end">Thao tác</th>
            </tr>
            </thead>

            <tbody>
            <?php if (!$products): ?>
                <tr>
                    <td
                        colspan="6"
                        class="text-center text-secondary py-5"
                    >
                        Không tìm thấy sản phẩm phù hợp.
                    </td>
                </tr>
            <?php endif; ?>

            <?php foreach (
                $products as $product
            ): ?>
                <tr>
                    <td>
                        <div
                            class="d-flex align-items-center gap-3"
                        >
                            <img
                                src="<?= admin_e(
                                    admin_product_image(
                                        $product['image']
                                    )
                                ) ?>"
                                alt="<?= admin_e(
                                    $product['name']
                                ) ?>"
                                width="58"
                                height="58"
                                class="rounded-3 object-fit-cover"
                            >

                            <div>
                                <strong>
                                    <?= admin_e(
                                        $product['name']
                                    ) ?>
                                </strong>

                                <small
                                    class="d-block text-secondary"
                                >
                                    #<?= (int) $product['id'] ?>
                                    ·
                                    <?= admin_e(
                                        $product['slug']
                                    ) ?>
                                </small>
                            </div>
                        </div>
                    </td>

                    <td>
                        <?= admin_e(
                            $product['category_name']
                        ) ?>
                    </td>

                    <td class="fw-semibold">
                        <?= admin_e(
                            admin_money(
                                $product['price']
                            )
                        ) ?>
                    </td>

                    <td>
                        <span
                            class="badge text-bg-<?=
                                (int) $product['status'] === 1
                                    ? 'success'
                                    : 'secondary'
                            ?>"
                        >
                            <?=
                                (int) $product['status'] === 1
                                    ? 'Đang bán'
                                    : 'Tạm ẩn'
                            ?>
                        </span>
                    </td>

                    <td>
                        <?= admin_e(
                            admin_datetime(
                                $product['updated_at']
                            )
                        ) ?>
                    </td>

                    <td class="text-end">
                        <a
                            href="products.php?edit=<?=
                                (int) $product['id']
                            ?>"
                            class="btn btn-sm btn-outline-primary"
                            title="Sửa"
                        >
                            <i class="bi bi-pencil"></i>
                        </a>

                        <form
                            method="post"
                            action="products.php"
                            class="d-inline"
                        >
                            <input
                                type="hidden"
                                name="csrf_token"
                                value="<?= admin_e(
                                    admin_csrf_token()
                                ) ?>"
                            >

                            <input
                                type="hidden"
                                name="action"
                                value="toggle_product"
                            >

                            <input
                                type="hidden"
                                name="id"
                                value="<?= (int) $product['id'] ?>"
                            >

                            <button
                                type="submit"
                                class="btn btn-sm btn-outline-warning"
                                title="Đổi trạng thái"
                            >
                                <i
                                    class="bi bi-eye<?=
                                        (int) $product['status']
                                            === 1
                                            ? '-slash'
                                            : ''
                                    ?>"
                                ></i>
                            </button>
                        </form>

                        <form
                            method="post"
                            action="products.php"
                            class="d-inline"
                            onsubmit="return confirm('Bạn chắc chắn muốn xóa sản phẩm này?');"
                        >
                            <input
                                type="hidden"
                                name="csrf_token"
                                value="<?= admin_e(
                                    admin_csrf_token()
                                ) ?>"
                            >

                            <input
                                type="hidden"
                                name="action"
                                value="delete_product"
                            >

                            <input
                                type="hidden"
                                name="id"
                                value="<?= (int) $product['id'] ?>"
                            >

                            <button
                                type="submit"
                                class="btn btn-sm btn-outline-danger"
                                title="Xóa"
                            >
                                <i class="bi bi-trash"></i>
                            </button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Danh mục sản phẩm -->
<div class="card border-0 shadow-sm">
    <div class="card-header bg-white p-4">
        <h3 class="h5 fw-bold mb-0">
            Danh mục sản phẩm
        </h3>
    </div>

    <div class="table-responsive">
        <table class="table align-middle mb-0">
            <thead>
            <tr>
                <th>Tên danh mục</th>
                <th>Slug</th>
                <th>Số sản phẩm</th>
                <th class="text-end">Thao tác</th>
            </tr>
            </thead>

            <tbody>
            <?php foreach (
                $categories as $category
            ): ?>
                <tr>
                    <td>
                        <strong>
                            <?= admin_e(
                                $category['name']
                            ) ?>
                        </strong>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                $category['description']
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <code>
                            <?= admin_e(
                                $category['slug']
                            ) ?>
                        </code>
                    </td>

                    <td>
                        <?= (int) $category['product_count'] ?>
                    </td>

                    <td class="text-end">
                        <a
                            href="products.php?category_edit=<?=
                                (int) $category['id']
                            ?>"
                            class="btn btn-sm btn-outline-primary"
                            title="Sửa danh mục"
                        >
                            <i class="bi bi-pencil"></i>
                        </a>

                        <form
                            method="post"
                            action="products.php"
                            class="d-inline"
                            onsubmit="return confirm('Xóa danh mục này?');"
                        >
                            <input
                                type="hidden"
                                name="csrf_token"
                                value="<?= admin_e(
                                    admin_csrf_token()
                                ) ?>"
                            >

                            <input
                                type="hidden"
                                name="action"
                                value="delete_category"
                            >

                            <input
                                type="hidden"
                                name="id"
                                value="<?= (int) $category['id'] ?>"
                            >

                            <button
                                type="submit"
                                class="btn btn-sm btn-outline-danger"
                                title="Xóa danh mục"
                                <?=
                                    (int) $category['product_count']
                                        > 0
                                        ? 'disabled'
                                        : ''
                                ?>
                            >
                                <i class="bi bi-trash"></i>
                            </button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<?php

require __DIR__ . '/partials/footer.php';