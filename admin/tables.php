<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * Các trạng thái bàn hợp lệ.
 */
$tableStatuses = [
    'available',
    'occupied',
    'maintenance',
];

/*
 * XỬ LÝ FORM
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();

    $action =
        (string) ($_POST['action'] ?? '');

    try {
        /*
         * THÊM HOẶC SỬA BÀN
         */
        if ($action === 'save_table') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            ) ?: null;

            $code = mb_strtoupper(
                trim(
                    (string) (
                        $_POST['table_code'] ?? ''
                    )
                ),
                'UTF-8'
            );

            $name = trim(
                (string) (
                    $_POST['table_name'] ?? ''
                )
            );

            $capacity = filter_input(
                INPUT_POST,
                'capacity',
                FILTER_VALIDATE_INT
            );

            $area = trim(
                (string) ($_POST['area'] ?? '')
            );

            $status =
                (string) (
                    $_POST['status'] ?? 'available'
                );

            /*
             * Kiểm tra dữ liệu.
             */
            if (
                !preg_match(
                    '/^[A-Z0-9-]{2,20}$/',
                    $code
                )
                || mb_strlen($name) < 2
                || !$capacity
                || $capacity < 1
                || $capacity > 20
                || !in_array(
                    $status,
                    $tableStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Vui lòng nhập đúng mã bàn, '
                    . 'tên bàn, sức chứa và trạng thái.'
                );
            }

            /*
             * Thêm bàn mới.
             */
            if ($id === null) {
                $statement = $pdo->prepare(
                    'INSERT INTO coffee_tables (
                        table_code,
                        table_name,
                        capacity,
                        area,
                        status
                    ) VALUES (
                        :table_code,
                        :table_name,
                        :capacity,
                        :area,
                        :status
                    )'
                );

                $statement->execute([
                    'table_code' => $code,
                    'table_name' => $name,
                    'capacity' => $capacity,
                    'area' =>
                        $area !== ''
                            ? $area
                            : null,
                    'status' => $status,
                ]);

                admin_flash(
                    'success',
                    'Đã thêm bàn mới.'
                );
            } else {
                /*
                 * Kiểm tra bàn cần sửa có tồn tại.
                 */
                $checkStatement = $pdo->prepare(
                    'SELECT id
                     FROM coffee_tables
                     WHERE id = :id
                     LIMIT 1'
                );

                $checkStatement->execute([
                    'id' => $id,
                ]);

                if (!$checkStatement->fetch()) {
                    throw new RuntimeException(
                        'Bàn cần sửa không tồn tại.'
                    );
                }

                /*
                 * Cập nhật bàn.
                 */
                $statement = $pdo->prepare(
                    'UPDATE coffee_tables
                     SET
                        table_code = :table_code,
                        table_name = :table_name,
                        capacity = :capacity,
                        area = :area,
                        status = :status
                     WHERE id = :id'
                );

                $statement->execute([
                    'table_code' => $code,
                    'table_name' => $name,
                    'capacity' => $capacity,
                    'area' =>
                        $area !== ''
                            ? $area
                            : null,
                    'status' => $status,
                    'id' => $id,
                ]);

                admin_flash(
                    'success',
                    'Đã cập nhật thông tin bàn.'
                );
            }
        }

        /*
         * CẬP NHẬT NHANH TRẠNG THÁI
         */
        elseif ($action === 'update_status') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            );

            $status =
                (string) ($_POST['status'] ?? '');

            if (
                !$id
                || !in_array(
                    $status,
                    $tableStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Bàn hoặc trạng thái không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'UPDATE coffee_tables
                 SET status = :status
                 WHERE id = :id'
            );

            $statement->execute([
                'status' => $status,
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã cập nhật trạng thái bàn.'
            );
        }

        /*
         * XÓA BÀN
         */
        elseif ($action === 'delete_table') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            );

            if (!$id) {
                throw new RuntimeException(
                    'Bàn không hợp lệ.'
                );
            }

            /*
             * Kiểm tra bàn đã có lịch đặt chưa.
             */
            $countStatement = $pdo->prepare(
                'SELECT COUNT(*)
                 FROM bookings
                 WHERE table_id = :id'
            );

            $countStatement->execute([
                'id' => $id,
            ]);

            if (
                (int) $countStatement
                    ->fetchColumn() > 0
            ) {
                throw new RuntimeException(
                    'Không thể xóa bàn đã có lịch đặt. '
                    . 'Hãy chuyển bàn sang trạng thái '
                    . 'bảo trì.'
                );
            }

            $statement = $pdo->prepare(
                'DELETE FROM coffee_tables
                 WHERE id = :id'
            );

            $statement->execute([
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã xóa bàn.'
            );
        } else {
            throw new RuntimeException(
                'Yêu cầu xử lý bàn không hợp lệ.'
            );
        }
    } catch (Throwable $exception) {
        $message =
            $exception instanceof RuntimeException
                ? $exception->getMessage()
                : (
                    'Không thể xử lý thông tin bàn. '
                    . 'Mã bàn có thể đã tồn tại.'
                );

        admin_flash('danger', $message);
    }

    admin_redirect('tables.php');
}

/*
 * NHẬN BỘ LỌC
 */
$search = trim(
    (string) ($_GET['search'] ?? '')
);

$statusFilter =
    (string) ($_GET['status'] ?? '');

$areaFilter = trim(
    (string) ($_GET['area'] ?? '')
);

$where = ['1 = 1'];
$parameters = [];

/*
 * Tìm theo mã hoặc tên bàn.
 */
if ($search !== '') {
    $where[] =
        '(table_code LIKE :search_code
          OR table_name LIKE :search_name)';

    $searchValue = '%' . $search . '%';

    $parameters['search_code'] =
        $searchValue;

    $parameters['search_name'] =
        $searchValue;
}

/*
 * Lọc theo trạng thái.
 */
if (
    in_array(
        $statusFilter,
        $tableStatuses,
        true
    )
) {
    $where[] = 'status = :status';

    $parameters['status'] =
        $statusFilter;
}

/*
 * Lọc theo khu vực.
 */
if ($areaFilter !== '') {
    $where[] = 'area = :area';

    $parameters['area'] =
        $areaFilter;
}

/*
 * LẤY DANH SÁCH BÀN
 */
$statement = $pdo->prepare(
    'SELECT *
     FROM coffee_tables
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY table_code'
);

$statement->execute($parameters);

$tables = $statement->fetchAll();

/*
 * LẤY DANH SÁCH KHU VỰC.
 */
$areas = $pdo->query(
    "SELECT DISTINCT area
     FROM coffee_tables
     WHERE area IS NOT NULL
       AND area <> ''
     ORDER BY area"
)->fetchAll(PDO::FETCH_COLUMN);

/*
 * THỐNG KÊ BÀN
 */
$summary = $pdo->query(
    "SELECT
        COUNT(*) AS total,
        COALESCE(
            SUM(status = 'available'),
            0
        ) AS available_count,
        COALESCE(
            SUM(status = 'occupied'),
            0
        ) AS occupied_count,
        COALESCE(
            SUM(status = 'maintenance'),
            0
        ) AS maintenance_count
     FROM coffee_tables"
)->fetch();

/*
 * LẤY BÀN CẦN SỬA
 */
$editTable = null;

$editId = filter_input(
    INPUT_GET,
    'edit',
    FILTER_VALIDATE_INT
);

if ($editId) {
    $editStatement = $pdo->prepare(
        'SELECT *
         FROM coffee_tables
         WHERE id = :id
         LIMIT 1'
    );

    $editStatement->execute([
        'id' => $editId,
    ]);

    $editTable =
        $editStatement->fetch() ?: null;
}

$pageTitle = 'Quản lý sơ đồ bàn';
$activePage = 'tables';

require __DIR__ . '/partials/header.php';
?>

<!-- Tiêu đề -->
<div
    class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
>
    <div>
        <h2 class="h3 fw-bold mb-1">
            Sơ đồ bàn
        </h2>

        <p class="text-secondary mb-0">
            Quản lý vị trí, sức chứa và trạng thái bàn.
        </p>
    </div>

    <a
        href="tables.php?form=1"
        class="btn btn-coffee"
    >
        <i class="bi bi-plus-lg me-1"></i>
        Thêm bàn
    </a>
</div>

<!-- Thống kê -->
<div class="row g-3 mb-4">

    <?php
    $summaryCards = [
        [
            'Tổng số bàn',
            $summary['total'] ?? 0,
            'secondary',
        ],
        [
            'Bàn trống',
            $summary['available_count'] ?? 0,
            'success',
        ],
        [
            'Đang sử dụng',
            $summary['occupied_count'] ?? 0,
            'primary',
        ],
        [
            'Bảo trì',
            $summary['maintenance_count'] ?? 0,
            'warning',
        ],
    ];
    ?>

    <?php foreach (
        $summaryCards as
        [$label, $value, $color]
    ): ?>
        <div class="col-6 col-xl-3">
            <div
                class="card border-0 shadow-sm h-100"
            >
                <div class="card-body">
                    <span class="text-secondary">
                        <?= admin_e($label) ?>
                    </span>

                    <h3
                        class="fw-bold text-<?=
                            admin_e($color)
                        ?> mb-0 mt-1"
                    >
                        <?= (int) $value ?>
                    </h3>
                </div>
            </div>
        </div>
    <?php endforeach; ?>

</div>

<!-- Form thêm hoặc sửa bàn -->
<?php if (
    isset($_GET['form'])
    || $editTable !== null
): ?>
    <div class="card border-0 shadow-sm mb-4">

        <div class="card-header bg-white p-4">
            <h3 class="h5 fw-bold mb-0">
                <?= $editTable
                    ? 'Cập nhật bàn'
                    : 'Thêm bàn mới'
                ?>
            </h3>
        </div>

        <div class="card-body p-4">
            <form
                method="post"
                action="tables.php"
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
                    value="save_table"
                >

                <input
                    type="hidden"
                    name="id"
                    value="<?= admin_e(
                        $editTable['id'] ?? ''
                    ) ?>"
                >

                <div class="col-md-2">
                    <label class="form-label fw-semibold">
                        Mã bàn
                    </label>

                    <input
                        type="text"
                        name="table_code"
                        class="form-control text-uppercase"
                        maxlength="20"
                        placeholder="T09"
                        value="<?= admin_e(
                            $editTable['table_code']
                            ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-3">
                    <label class="form-label fw-semibold">
                        Tên bàn
                    </label>

                    <input
                        type="text"
                        name="table_name"
                        class="form-control"
                        maxlength="100"
                        placeholder="Bàn T09"
                        value="<?= admin_e(
                            $editTable['table_name']
                            ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-3">
                    <label class="form-label fw-semibold">
                        Khu vực
                    </label>

                    <input
                        type="text"
                        name="area"
                        class="form-control"
                        list="area-options"
                        maxlength="100"
                        placeholder="Tầng trệt"
                        value="<?= admin_e(
                            $editTable['area'] ?? ''
                        ) ?>"
                    >

                    <datalist id="area-options">
                        <?php foreach ($areas as $area): ?>
                            <option
                                value="<?= admin_e($area) ?>"
                            >
                        <?php endforeach; ?>
                    </datalist>
                </div>

                <div class="col-md-2">
                    <label class="form-label fw-semibold">
                        Sức chứa
                    </label>

                    <input
                        type="number"
                        name="capacity"
                        class="form-control"
                        min="1"
                        max="20"
                        value="<?= admin_e(
                            $editTable['capacity']
                            ?? 2
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-2">
                    <label class="form-label fw-semibold">
                        Trạng thái
                    </label>

                    <select
                        name="status"
                        class="form-select"
                    >
                        <?php foreach (
                            $tableStatuses as $status
                        ): ?>
                            <option
                                value="<?= admin_e(
                                    $status
                                ) ?>"
                                <?=
                                    (
                                        $editTable['status']
                                        ?? 'available'
                                    ) === $status
                                        ? 'selected'
                                        : ''
                                ?>
                            >
                                <?= admin_e(
                                    admin_status_text(
                                        $status
                                    )
                                ) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div
                    class="col-12 d-flex justify-content-end gap-2"
                >
                    <a
                        href="tables.php"
                        class="btn btn-outline-secondary"
                    >
                        Hủy
                    </a>

                    <button
                        type="submit"
                        class="btn btn-coffee"
                    >
                        Lưu bàn
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
            action="tables.php"
            class="row g-3 align-items-end"
        >
            <div class="col-12 col-lg-5">
                <label class="form-label fw-semibold">
                    Tìm bàn
                </label>

                <input
                    type="search"
                    name="search"
                    class="form-control"
                    value="<?= admin_e($search) ?>"
                    placeholder="Mã hoặc tên bàn..."
                >
            </div>

            <div class="col-6 col-lg-3">
                <label class="form-label fw-semibold">
                    Khu vực
                </label>

                <select
                    name="area"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach ($areas as $area): ?>
                        <option
                            value="<?= admin_e($area) ?>"
                            <?=
                                $areaFilter === $area
                                    ? 'selected'
                                    : ''
                            ?>
                        >
                            <?= admin_e($area) ?>
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

                    <?php foreach (
                        $tableStatuses as $status
                    ): ?>
                        <option
                            value="<?= admin_e($status) ?>"
                            <?=
                                $statusFilter === $status
                                    ? 'selected'
                                    : ''
                            ?>
                        >
                            <?= admin_e(
                                admin_status_text($status)
                            ) ?>
                        </option>
                    <?php endforeach; ?>
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
                    href="tables.php"
                    class="btn btn-outline-secondary"
                    title="Đặt lại"
                >
                    <i
                        class="bi bi-arrow-counterclockwise"
                    ></i>
                </a>
            </div>
        </form>
    </div>
</div>

<!-- Sơ đồ bàn -->
<div class="row g-4">

    <?php if (!$tables): ?>
        <div class="col-12">
            <div class="card border-0 shadow-sm">
                <div
                    class="card-body text-center text-secondary py-5"
                >
                    Không tìm thấy bàn phù hợp.
                </div>
            </div>
        </div>
    <?php endif; ?>

    <?php foreach ($tables as $table): ?>
        <?php
        /*
         * Chọn ảnh ổn định dựa trên ID bàn.
         */
        $tableImageNumber =
            (((int) $table['id'] - 1) % 6) + 1;
        ?>

        <div
            class="col-12 col-sm-6 col-xl-4 col-xxl-3"
        >
            <div
                class="card border-0 shadow-sm h-100 overflow-hidden"
            >
                <img
                    src="../assets/images/tables/table-<?=
                        $tableImageNumber
                    ?>.jpg"
                    class="card-img-top object-fit-cover"
                    height="150"
                    alt="<?= admin_e(
                        $table['table_name']
                    ) ?>"
                >

                <div class="card-body p-4">

                    <div
                        class="d-flex justify-content-between align-items-start gap-2 mb-3"
                    >
                        <div>
                            <h3 class="h5 fw-bold mb-1">
                                <?= admin_e(
                                    $table['table_name']
                                ) ?>
                            </h3>

                            <span class="text-secondary small">
                                <?= admin_e(
                                    $table['table_code']
                                ) ?>

                                ·

                                <?= admin_e(
                                    $table['area']
                                    ?: 'Chưa phân khu'
                                ) ?>
                            </span>
                        </div>

                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $table['status']
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $table['status']
                                )
                            ) ?>
                        </span>
                    </div>

                    <p class="mb-3">
                        <i class="bi bi-people me-1"></i>

                        Sức chứa:

                        <strong>
                            <?= (int) $table['capacity'] ?>
                            khách
                        </strong>
                    </p>

                    <!-- Cập nhật nhanh trạng thái -->
                    <form
                        method="post"
                        action="tables.php"
                        class="d-flex gap-2 mb-3"
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
                            value="update_status"
                        >

                        <input
                            type="hidden"
                            name="id"
                            value="<?= (int) $table['id'] ?>"
                        >

                        <select
                            name="status"
                            class="form-select form-select-sm"
                        >
                            <?php foreach (
                                $tableStatuses as $status
                            ): ?>
                                <option
                                    value="<?= admin_e(
                                        $status
                                    ) ?>"
                                    <?=
                                        $table['status']
                                        === $status
                                            ? 'selected'
                                            : ''
                                    ?>
                                >
                                    <?= admin_e(
                                        admin_status_text(
                                            $status
                                        )
                                    ) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>

                        <button
                            type="submit"
                            class="btn btn-sm btn-outline-coffee"
                        >
                            Lưu
                        </button>
                    </form>

                    <div class="d-flex gap-2">
                        <a
                            href="tables.php?edit=<?=
                                (int) $table['id']
                            ?>"
                            class="btn btn-sm btn-outline-primary flex-grow-1"
                        >
                            <i class="bi bi-pencil me-1"></i>
                            Sửa
                        </a>

                        <form
                            method="post"
                            action="tables.php"
                            onsubmit="return confirm('Bạn chắc chắn muốn xóa bàn này?');"
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
                                value="delete_table"
                            >

                            <input
                                type="hidden"
                                name="id"
                                value="<?= (int) $table['id'] ?>"
                            >

                            <button
                                type="submit"
                                class="btn btn-sm btn-outline-danger"
                                title="Xóa bàn"
                            >
                                <i class="bi bi-trash"></i>
                            </button>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    <?php endforeach; ?>

</div>

<?php

require __DIR__ . '/partials/footer.php';