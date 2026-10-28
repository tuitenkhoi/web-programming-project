<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * Các trạng thái được phép sử dụng.
 */
$orderStatuses = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled',
];

$paymentStatuses = [
    'pending',
    'pending_verification',
    'paid',
    'failed',
    'refunded',
];

/*
 * XỬ LÝ CẬP NHẬT TRẠNG THÁI
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();

    $action =
        (string) ($_POST['action'] ?? '');

    $id = filter_input(
        INPUT_POST,
        'id',
        FILTER_VALIDATE_INT
    );

    try {
        if (!$id) {
            throw new RuntimeException(
                'Đơn hàng không hợp lệ.'
            );
        }

        /*
         * Cập nhật trạng thái đơn hàng.
         */
        if ($action === 'update_status') {
            $status =
                (string) ($_POST['status'] ?? '');

            if (
                !in_array(
                    $status,
                    $orderStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Trạng thái đơn hàng không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'UPDATE orders
                 SET status = :status
                 WHERE id = :id'
            );

            $statement->execute([
                'status' => $status,
                'id' => $id,
            ]);

            if ($statement->rowCount() === 0) {
                $checkStatement = $pdo->prepare(
                    'SELECT id
                     FROM orders
                     WHERE id = :id
                     LIMIT 1'
                );

                $checkStatement->execute([
                    'id' => $id,
                ]);

                if (!$checkStatement->fetch()) {
                    throw new RuntimeException(
                        'Đơn hàng không tồn tại.'
                    );
                }
            }

            admin_flash(
                'success',
                'Đã cập nhật trạng thái đơn hàng.'
            );
        }

        /*
         * Cập nhật trạng thái thanh toán.
         */
        elseif ($action === 'update_payment') {
            $paymentStatus =
                (string) (
                    $_POST['payment_status'] ?? ''
                );

            if (
                !in_array(
                    $paymentStatus,
                    $paymentStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Trạng thái thanh toán không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'UPDATE orders
                 SET payment_status = :payment_status
                 WHERE id = :id'
            );

            $statement->execute([
                'payment_status' => $paymentStatus,
                'id' => $id,
            ]);

            if ($statement->rowCount() === 0) {
                $checkStatement = $pdo->prepare(
                    'SELECT id
                     FROM orders
                     WHERE id = :id
                     LIMIT 1'
                );

                $checkStatement->execute([
                    'id' => $id,
                ]);

                if (!$checkStatement->fetch()) {
                    throw new RuntimeException(
                        'Đơn hàng không tồn tại.'
                    );
                }
            }

            admin_flash(
                'success',
                'Đã cập nhật trạng thái thanh toán.'
            );
        } else {
            throw new RuntimeException(
                'Yêu cầu cập nhật không hợp lệ.'
            );
        }
    } catch (Throwable $exception) {
        $message =
            $exception instanceof RuntimeException
                ? $exception->getMessage()
                : 'Không thể cập nhật đơn hàng.';

        admin_flash('danger', $message);
    }

    $redirectUrl = $id
        ? 'orders.php?view=' . $id
        : 'orders.php';

    admin_redirect($redirectUrl);
}

/*
 * NHẬN DỮ LIỆU BỘ LỌC
 */
$search = trim(
    (string) ($_GET['search'] ?? '')
);

$statusFilter =
    (string) ($_GET['status'] ?? '');

$paymentFilter =
    (string) ($_GET['payment_status'] ?? '');

$dateFilter = trim(
    (string) ($_GET['date'] ?? '')
);

$where = ['1 = 1'];
$parameters = [];

/*
 * Tìm kiếm với các tham số riêng biệt.
 */
if ($search !== '') {
    $where[] =
        '(o.order_code LIKE :search_code
          OR o.customer_name LIKE :search_name
          OR o.customer_phone LIKE :search_phone
          OR o.table_code LIKE :search_table)';

    $searchValue = '%' . $search . '%';

    $parameters['search_code'] =
        $searchValue;

    $parameters['search_name'] =
        $searchValue;

    $parameters['search_phone'] =
        $searchValue;

    $parameters['search_table'] =
        $searchValue;
}

/*
 * Lọc trạng thái đơn hàng.
 */
if (
    in_array(
        $statusFilter,
        $orderStatuses,
        true
    )
) {
    $where[] = 'o.status = :status';

    $parameters['status'] =
        $statusFilter;
}

/*
 * Lọc trạng thái thanh toán.
 */
if (
    in_array(
        $paymentFilter,
        $paymentStatuses,
        true
    )
) {
    $where[] =
        'o.payment_status = :payment_status';

    $parameters['payment_status'] =
        $paymentFilter;
}

/*
 * Lọc theo ngày tạo.
 */
if (
    preg_match(
        '/^\d{4}-\d{2}-\d{2}$/',
        $dateFilter
    )
) {
    $where[] =
        'DATE(o.created_at) = :created_date';

    $parameters['created_date'] =
        $dateFilter;
}

/*
 * LẤY DANH SÁCH ĐƠN HÀNG
 */
$statement = $pdo->prepare(
    'SELECT
        o.*,
        (
            SELECT COUNT(*)
            FROM order_items AS oi
            WHERE oi.order_id = o.id
        ) AS item_count
     FROM orders AS o
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY o.id DESC'
);

$statement->execute($parameters);

$orders = $statement->fetchAll();

/*
 * LẤY SỐ LIỆU TỔNG QUAN
 */
$summary = $pdo->query(
    "SELECT
        COUNT(*) AS total,
        COALESCE(
            SUM(status = 'pending'),
            0
        ) AS pending_count,
        COALESCE(
            SUM(
                status IN (
                    'confirmed',
                    'preparing',
                    'ready'
                )
            ),
            0
        ) AS processing_count,
        COALESCE(
            SUM(status = 'completed'),
            0
        ) AS completed_count
     FROM orders"
)->fetch();

/*
 * LẤY CHI TIẾT ĐƠN ĐƯỢC CHỌN
 */
$viewOrder = null;
$viewItems = [];

$viewId = filter_input(
    INPUT_GET,
    'view',
    FILTER_VALIDATE_INT
);

if ($viewId) {
    $viewStatement = $pdo->prepare(
        'SELECT *
         FROM orders
         WHERE id = :id
         LIMIT 1'
    );

    $viewStatement->execute([
        'id' => $viewId,
    ]);

    $viewOrder =
        $viewStatement->fetch() ?: null;

    if ($viewOrder !== null) {
        $itemStatement = $pdo->prepare(
            'SELECT *
             FROM order_items
             WHERE order_id = :order_id
             ORDER BY id'
        );

        $itemStatement->execute([
            'order_id' => $viewId,
        ]);

        $viewItems =
            $itemStatement->fetchAll();
    }
}

$pageTitle = 'Quản lý đơn hàng';
$activePage = 'orders';

require __DIR__ . '/partials/header.php';
?>

<!-- Tiêu đề -->
<div
    class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
>
    <div>
        <h2 class="h3 fw-bold mb-1">
            Đơn hàng
        </h2>

        <p class="text-secondary mb-0">
            Theo dõi đơn gọi món và tiến trình phục vụ.
        </p>
    </div>

    <a
        href="../pages/menu.php"
        class="btn btn-outline-coffee"
    >
        <i class="bi bi-plus-lg me-1"></i>
        Tạo đơn từ trang khách
    </a>
</div>

<!-- Thống kê -->
<div class="row g-3 mb-4">

    <?php
    $summaryCards = [
        [
            'Tổng đơn',
            $summary['total'] ?? 0,
            'secondary',
        ],
        [
            'Chờ xử lý',
            $summary['pending_count'] ?? 0,
            'warning',
        ],
        [
            'Đang thực hiện',
            $summary['processing_count'] ?? 0,
            'primary',
        ],
        [
            'Hoàn thành',
            $summary['completed_count'] ?? 0,
            'success',
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

<!-- Chi tiết đơn hàng -->
<?php if ($viewOrder !== null): ?>
    <div class="card border-0 shadow-sm mb-4">

        <div
            class="card-header bg-white p-4 d-flex justify-content-between align-items-center"
        >
            <div>
                <h3 class="h5 fw-bold mb-1">
                    Chi tiết
                    <?= admin_e(
                        $viewOrder['order_code']
                    ) ?>
                </h3>

                <span class="text-secondary small">
                    <?= admin_e(
                        admin_datetime(
                            $viewOrder['created_at']
                        )
                    ) ?>
                </span>
            </div>

            <a
                href="orders.php"
                class="btn btn-sm btn-outline-secondary"
                title="Đóng chi tiết"
            >
                <i class="bi bi-x-lg"></i>
            </a>
        </div>

        <div class="card-body p-4">

            <!-- Thông tin đơn hàng -->
            <div class="row g-4 mb-4">

                <div class="col-md-4">
                    <small class="text-secondary">
                        Khách hàng
                    </small>

                    <strong class="d-block">
                        <?= admin_e(
                            $viewOrder['customer_name']
                        ) ?>
                    </strong>

                    <span>
                        <?= admin_e(
                            $viewOrder['customer_phone']
                        ) ?>
                    </span>

                    <?php if (
                        !empty($viewOrder['customer_email'])
                    ): ?>
                        <span class="d-block">
                            <?= admin_e(
                                $viewOrder['customer_email']
                            ) ?>
                        </span>
                    <?php endif; ?>
                </div>

                <div class="col-md-4">
                    <small class="text-secondary">
                        Hình thức
                    </small>

                    <strong class="d-block">
                        <?php if (
                            $viewOrder['order_type']
                            === 'takeaway'
                        ): ?>
                            Mang đi
                        <?php else: ?>
                            Tại bàn
                            <?= admin_e(
                                $viewOrder['table_code']
                                ?: 'Chưa chọn'
                            ) ?>
                        <?php endif; ?>
                    </strong>

                    <span>
                        <?=
                            $viewOrder['payment_method']
                            === 'bank_transfer'
                                ? 'Chuyển khoản'
                                : 'Tiền mặt'
                        ?>
                    </span>
                </div>

                <div class="col-md-4">
                    <small class="text-secondary">
                        Tổng thanh toán
                    </small>

                    <strong
                        class="d-block fs-4 text-coffee"
                    >
                        <?= admin_e(
                            admin_money(
                                $viewOrder['total_amount']
                            )
                        ) ?>
                    </strong>

                    <span
                        class="badge text-bg-<?=
                            admin_e(
                                admin_status_class(
                                    $viewOrder[
                                        'payment_status'
                                    ]
                                )
                            )
                        ?>"
                    >
                        <?= admin_e(
                            admin_status_text(
                                $viewOrder[
                                    'payment_status'
                                ]
                            )
                        ) ?>
                    </span>
                </div>

            </div>

            <!-- Danh sách món -->
            <div class="table-responsive mb-4">
                <table class="table align-middle">
                    <thead>
                    <tr>
                        <th>Món</th>
                        <th>Tùy chọn</th>
                        <th>Đơn giá</th>
                        <th>Số lượng</th>
                        <th>Thành tiền</th>
                    </tr>
                    </thead>

                    <tbody>
                    <?php if (!$viewItems): ?>
                        <tr>
                            <td
                                colspan="5"
                                class="text-center text-secondary"
                            >
                                Đơn hàng chưa có món.
                            </td>
                        </tr>
                    <?php endif; ?>

                    <?php foreach (
                        $viewItems as $item
                    ): ?>
                        <?php
                        $toppings = json_decode(
                            (string) $item['toppings'],
                            true
                        );
                        ?>

                        <tr>
                            <td>
                                <strong>
                                    <?= admin_e(
                                        $item['product_name']
                                    ) ?>
                                </strong>
                            </td>

                            <td class="small text-secondary">
                                Size
                                <?= admin_e($item['size']) ?>

                                · Đường
                                <?= admin_e(
                                    $item['sugar_level']
                                ) ?>

                                · Đá
                                <?= admin_e(
                                    $item['ice_level']
                                ) ?>

                                <?php if (
                                    is_array($toppings)
                                    && $toppings
                                ): ?>
                                    <br>

                                    <?= admin_e(
                                        implode(
                                            ', ',
                                            $toppings
                                        )
                                    ) ?>
                                <?php endif; ?>
                            </td>

                            <td>
                                <?= admin_e(
                                    admin_money(
                                        $item['unit_price']
                                    )
                                ) ?>
                            </td>

                            <td>
                                <?= (int) $item['quantity'] ?>
                            </td>

                            <td class="fw-semibold">
                                <?= admin_e(
                                    admin_money(
                                        $item['line_total']
                                    )
                                ) ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Ghi chú -->
            <?php if (
                !empty($viewOrder['note'])
            ): ?>
                <div class="alert alert-light border">
                    <strong>Ghi chú:</strong>

                    <?= admin_e(
                        $viewOrder['note']
                    ) ?>
                </div>
            <?php endif; ?>

            <!-- Form cập nhật -->
            <div class="row g-3">

                <div class="col-md-6">
                    <form
                        method="post"
                        action="orders.php"
                        class="d-flex gap-2"
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
                            value="<?=
                                (int) $viewOrder['id']
                            ?>"
                        >

                        <select
                            name="status"
                            class="form-select"
                        >
                            <?php foreach (
                                $orderStatuses as $status
                            ): ?>
                                <option
                                    value="<?= admin_e(
                                        $status
                                    ) ?>"
                                    <?=
                                        $viewOrder['status']
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
                            class="btn btn-coffee text-nowrap"
                        >
                            Cập nhật đơn
                        </button>
                    </form>
                </div>

                <div class="col-md-6">
                    <form
                        method="post"
                        action="orders.php"
                        class="d-flex gap-2"
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
                            value="update_payment"
                        >

                        <input
                            type="hidden"
                            name="id"
                            value="<?=
                                (int) $viewOrder['id']
                            ?>"
                        >

                        <select
                            name="payment_status"
                            class="form-select"
                        >
                            <?php foreach (
                                $paymentStatuses as $status
                            ): ?>
                                <option
                                    value="<?= admin_e(
                                        $status
                                    ) ?>"
                                    <?=
                                        $viewOrder[
                                            'payment_status'
                                        ] === $status
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
                            class="btn btn-outline-coffee text-nowrap"
                        >
                            Cập nhật tiền
                        </button>
                    </form>
                </div>

            </div>
        </div>
    </div>
<?php endif; ?>

<!-- Bộ lọc đơn hàng -->
<div class="card border-0 shadow-sm mb-4">
    <div class="card-body p-4">
        <form
            method="get"
            action="orders.php"
            class="row g-3 align-items-end"
        >
            <div class="col-12 col-lg-4">
                <label class="form-label fw-semibold">
                    Tìm kiếm
                </label>

                <input
                    type="search"
                    name="search"
                    class="form-control"
                    value="<?= admin_e($search) ?>"
                    placeholder="Mã đơn, khách hàng, SĐT, bàn..."
                >
            </div>

            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold">
                    Ngày
                </label>

                <input
                    type="date"
                    name="date"
                    class="form-control"
                    value="<?= admin_e($dateFilter) ?>"
                >
            </div>

            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold">
                    Đơn hàng
                </label>

                <select
                    name="status"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach (
                        $orderStatuses as $status
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

            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold">
                    Thanh toán
                </label>

                <select
                    name="payment_status"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach (
                        $paymentStatuses as $status
                    ): ?>
                        <option
                            value="<?= admin_e($status) ?>"
                            <?=
                                $paymentFilter === $status
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

            <div
                class="col-6 col-lg-2 d-flex gap-2"
            >
                <button
                    type="submit"
                    class="btn btn-coffee flex-grow-1"
                >
                    Lọc
                </button>

                <a
                    href="orders.php"
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

<!-- Danh sách đơn hàng -->
<div class="card border-0 shadow-sm">
    <div class="card-header bg-white p-4">
        <h3 class="h5 fw-bold mb-0">
            Danh sách đơn hàng

            <span class="badge text-bg-light border ms-1">
                <?= count($orders) ?>
            </span>
        </h3>
    </div>

    <div class="table-responsive">
        <table
            class="table admin-table align-middle mb-0"
        >
            <thead>
            <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Hình thức</th>
                <th>Số món</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Đơn hàng</th>
                <th></th>
            </tr>
            </thead>

            <tbody>
            <?php if (!$orders): ?>
                <tr>
                    <td
                        colspan="8"
                        class="text-center text-secondary py-5"
                    >
                        Không tìm thấy đơn hàng.
                    </td>
                </tr>
            <?php endif; ?>

            <?php foreach ($orders as $order): ?>
                <tr>
                    <td>
                        <strong>
                            <?= admin_e(
                                $order['order_code']
                            ) ?>
                        </strong>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                admin_datetime(
                                    $order['created_at']
                                )
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?= admin_e(
                            $order['customer_name']
                        ) ?>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                $order['customer_phone']
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?php if (
                            $order['order_type']
                            === 'takeaway'
                        ): ?>
                            Mang đi
                        <?php else: ?>
                            Bàn
                            <?= admin_e(
                                $order['table_code']
                                ?: '—'
                            ) ?>
                        <?php endif; ?>
                    </td>

                    <td>
                        <?= (int) $order['item_count'] ?>
                    </td>

                    <td class="fw-semibold">
                        <?= admin_e(
                            admin_money(
                                $order['total_amount']
                            )
                        ) ?>
                    </td>

                    <td>
                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $order[
                                            'payment_status'
                                        ]
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $order[
                                        'payment_status'
                                    ]
                                )
                            ) ?>
                        </span>
                    </td>

                    <td>
                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $order['status']
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $order['status']
                                )
                            ) ?>
                        </span>
                    </td>

                    <td>
                        <a
                            href="orders.php?view=<?=
                                (int) $order['id']
                            ?>"
                            class="btn btn-sm btn-outline-coffee"
                            title="Xem chi tiết"
                        >
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<?php

require __DIR__ . '/partials/footer.php';