<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * Các trạng thái thanh toán hợp lệ.
 */
$paymentStatuses = [
    'pending',
    'pending_verification',
    'paid',
    'failed',
    'refunded',
];

/*
 * CẬP NHẬT TRẠNG THÁI HÓA ĐƠN
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();

    $id = filter_input(
        INPUT_POST,
        'id',
        FILTER_VALIDATE_INT
    );

    $paymentStatus =
        (string) (
            $_POST['payment_status'] ?? ''
        );

    try {
        if (
            !$id
            || !in_array(
                $paymentStatus,
                $paymentStatuses,
                true
            )
        ) {
            throw new RuntimeException(
                'Hóa đơn hoặc trạng thái '
                . 'thanh toán không hợp lệ.'
            );
        }

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
                'Hóa đơn không tồn tại.'
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

        admin_flash(
            'success',
            'Đã cập nhật trạng thái hóa đơn.'
        );
    } catch (Throwable $exception) {
        $message =
            $exception instanceof RuntimeException
                ? $exception->getMessage()
                : 'Không thể cập nhật hóa đơn.';

        admin_flash('danger', $message);
    }

    admin_redirect(
        'invoices.php'
        . ($id ? '?view=' . $id : '')
    );
}

/*
 * NHẬN DỮ LIỆU BỘ LỌC
 */
$search = trim(
    (string) ($_GET['search'] ?? '')
);

$statusFilter =
    (string) ($_GET['status'] ?? '');

$methodFilter =
    (string) ($_GET['method'] ?? '');

$dateFrom = trim(
    (string) ($_GET['date_from'] ?? '')
);

$dateTo = trim(
    (string) ($_GET['date_to'] ?? '')
);

$where = ['1 = 1'];
$parameters = [];

/*
 * Tìm kiếm.
 */
if ($search !== '') {
    $where[] =
        '(o.order_code LIKE :search_code
          OR o.customer_name LIKE :search_name
          OR o.customer_phone LIKE :search_phone)';

    $searchValue = '%' . $search . '%';

    $parameters['search_code'] =
        $searchValue;

    $parameters['search_name'] =
        $searchValue;

    $parameters['search_phone'] =
        $searchValue;
}

/*
 * Lọc trạng thái thanh toán.
 */
if (
    in_array(
        $statusFilter,
        $paymentStatuses,
        true
    )
) {
    $where[] =
        'o.payment_status = :payment_status';

    $parameters['payment_status'] =
        $statusFilter;
}

/*
 * Lọc phương thức thanh toán.
 */
if (
    in_array(
        $methodFilter,
        ['cash', 'bank_transfer'],
        true
    )
) {
    $where[] =
        'o.payment_method = :payment_method';

    $parameters['payment_method'] =
        $methodFilter;
}

/*
 * Lọc từ ngày.
 */
if (
    preg_match(
        '/^\d{4}-\d{2}-\d{2}$/',
        $dateFrom
    )
) {
    $where[] =
        'DATE(o.created_at) >= :date_from';

    $parameters['date_from'] =
        $dateFrom;
}

/*
 * Lọc đến ngày.
 */
if (
    preg_match(
        '/^\d{4}-\d{2}-\d{2}$/',
        $dateTo
    )
) {
    $where[] =
        'DATE(o.created_at) <= :date_to';

    $parameters['date_to'] =
        $dateTo;
}

/*
 * LẤY DANH SÁCH HÓA ĐƠN
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

$invoices = $statement->fetchAll();

/*
 * THỐNG KÊ HÓA ĐƠN
 */
$summary = $pdo->query(
    "SELECT
        COALESCE(
            SUM(
                CASE
                    WHEN payment_status = 'paid'
                     AND DATE(created_at) = CURDATE()
                    THEN total_amount
                    ELSE 0
                END
            ),
            0
        ) AS today_revenue,

        COALESCE(
            SUM(DATE(created_at) = CURDATE()),
            0
        ) AS today_count,

        COALESCE(
            SUM(
                payment_status IN (
                    'pending',
                    'pending_verification'
                )
            ),
            0
        ) AS pending_count,

        COALESCE(
            SUM(payment_status = 'paid'),
            0
        ) AS paid_count
     FROM orders"
)->fetch();

/*
 * LẤY CHI TIẾT HÓA ĐƠN
 */
$viewInvoice = null;
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

    $viewInvoice =
        $viewStatement->fetch() ?: null;

    if ($viewInvoice !== null) {
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

$pageTitle = 'Quản lý hóa đơn';
$activePage = 'invoices';

require __DIR__ . '/partials/header.php';
?>

<style>
    @media print {
        .invoice-screen-only {
            display: none !important;
        }

        #invoice-detail {
            display: block !important;
            margin: 0 !important;
            box-shadow: none !important;
        }
    }
</style>

<!-- Tiêu đề -->
<div
    class="invoice-screen-only d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
>
    <div>
        <h2 class="h3 fw-bold mb-1">
            Hóa đơn và thanh toán
        </h2>

        <p class="text-secondary mb-0">
            Theo dõi và in hóa đơn của các đơn hàng.
        </p>
    </div>
</div>

<!-- Thống kê -->
<div class="invoice-screen-only row g-3 mb-4">

    <?php
    $summaryCards = [
        [
            'Doanh thu hôm nay',
            admin_money(
                $summary['today_revenue'] ?? 0
            ),
            'success',
        ],
        [
            'Hóa đơn hôm nay',
            (int) ($summary['today_count'] ?? 0),
            'info',
        ],
        [
            'Chờ thanh toán',
            (int) ($summary['pending_count'] ?? 0),
            'warning',
        ],
        [
            'Đã thanh toán',
            (int) ($summary['paid_count'] ?? 0),
            'primary',
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
                        <?= admin_e($value) ?>
                    </h3>
                </div>
            </div>
        </div>
    <?php endforeach; ?>

</div>

<!-- Chi tiết hóa đơn -->
<?php if ($viewInvoice !== null): ?>
    <div
        id="invoice-detail"
        class="card border-0 shadow-sm mb-4"
    >
        <div
            class="card-header bg-white p-4 d-flex justify-content-between align-items-center"
        >
            <div>
                <p
                    class="text-uppercase text-secondary small fw-semibold mb-1"
                >
                    Mộc Coffee
                </p>

                <h3 class="h4 fw-bold mb-0">
                    Hóa đơn HD<?= str_pad(
                        (string) $viewInvoice['id'],
                        6,
                        '0',
                        STR_PAD_LEFT
                    ) ?>
                </h3>
            </div>

            <div class="text-end">
                <strong>
                    <?= admin_e(
                        $viewInvoice['order_code']
                    ) ?>
                </strong>

                <small class="d-block text-secondary">
                    <?= admin_e(
                        admin_datetime(
                            $viewInvoice['created_at']
                        )
                    ) ?>
                </small>
            </div>
        </div>

        <div class="card-body p-4">

            <!-- Thông tin hóa đơn -->
            <div class="row g-4 mb-4">

                <div class="col-md-4">
                    <small class="text-secondary">
                        Khách hàng
                    </small>

                    <strong class="d-block">
                        <?= admin_e(
                            $viewInvoice['customer_name']
                        ) ?>
                    </strong>

                    <span>
                        <?= admin_e(
                            $viewInvoice['customer_phone']
                        ) ?>
                    </span>
                </div>

                <div class="col-md-4">
                    <small class="text-secondary">
                        Phục vụ
                    </small>

                    <strong class="d-block">
                        <?php if (
                            $viewInvoice['order_type']
                            === 'takeaway'
                        ): ?>
                            Mang đi
                        <?php else: ?>
                            Tại bàn
                            <?= admin_e(
                                $viewInvoice['table_code']
                                ?: '—'
                            ) ?>
                        <?php endif; ?>
                    </strong>

                    <span>
                        <?=
                            $viewInvoice['payment_method']
                            === 'bank_transfer'
                                ? 'Chuyển khoản'
                                : 'Tiền mặt'
                        ?>
                    </span>
                </div>

                <div class="col-md-4">
                    <small class="text-secondary">
                        Trạng thái
                    </small>

                    <strong class="d-block">
                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $viewInvoice[
                                            'payment_status'
                                        ]
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $viewInvoice[
                                        'payment_status'
                                    ]
                                )
                            ) ?>
                        </span>
                    </strong>
                </div>

            </div>

            <!-- Danh sách món -->
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                    <tr>
                        <th>Món</th>
                        <th class="text-center">
                            Số lượng
                        </th>
                        <th class="text-end">
                            Đơn giá
                        </th>
                        <th class="text-end">
                            Thành tiền
                        </th>
                    </tr>
                    </thead>

                    <tbody>
                    <?php if (!$viewItems): ?>
                        <tr>
                            <td
                                colspan="4"
                                class="text-center text-secondary"
                            >
                                Hóa đơn chưa có món.
                            </td>
                        </tr>
                    <?php endif; ?>

                    <?php foreach (
                        $viewItems as $item
                    ): ?>
                        <tr>
                            <td>
                                <?= admin_e(
                                    $item['product_name']
                                ) ?>

                                <small
                                    class="d-block text-secondary"
                                >
                                    Size
                                    <?= admin_e(
                                        $item['size']
                                    ) ?>
                                </small>
                            </td>

                            <td class="text-center">
                                <?= (int) $item['quantity'] ?>
                            </td>

                            <td class="text-end">
                                <?= admin_e(
                                    admin_money(
                                        $item['unit_price']
                                    )
                                ) ?>
                            </td>

                            <td
                                class="text-end fw-semibold"
                            >
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

            <!-- Tổng tiền -->
            <div class="row justify-content-end">
                <div class="col-md-5 col-xl-4">

                    <div
                        class="d-flex justify-content-between py-1"
                    >
                        <span>Tạm tính</span>

                        <span>
                            <?= admin_e(
                                admin_money(
                                    $viewInvoice['subtotal']
                                )
                            ) ?>
                        </span>
                    </div>

                    <div
                        class="d-flex justify-content-between py-1"
                    >
                        <span>Giảm giá</span>

                        <span>
                            -<?= admin_e(
                                admin_money(
                                    $viewInvoice[
                                        'discount_amount'
                                    ]
                                )
                            ) ?>
                        </span>
                    </div>

                    <div
                        class="d-flex justify-content-between py-1"
                    >
                        <span>Phí dịch vụ</span>

                        <span>
                            <?= admin_e(
                                admin_money(
                                    $viewInvoice[
                                        'service_fee'
                                    ]
                                )
                            ) ?>
                        </span>
                    </div>

                    <hr>

                    <div
                        class="d-flex justify-content-between fs-5 fw-bold"
                    >
                        <span>Tổng cộng</span>

                        <span class="text-coffee">
                            <?= admin_e(
                                admin_money(
                                    $viewInvoice[
                                        'total_amount'
                                    ]
                                )
                            ) ?>
                        </span>
                    </div>

                </div>
            </div>

            <!-- Nút thao tác -->
            <div
                class="d-flex flex-wrap justify-content-end gap-2 mt-4"
            >
                <form
                    method="post"
                    action="invoices.php"
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
                        name="id"
                        value="<?=
                            (int) $viewInvoice['id']
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
                                    $viewInvoice[
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
                        class="btn btn-coffee text-nowrap"
                    >
                        Cập nhật
                    </button>
                </form>

                <button
                    type="button"
                    class="btn btn-outline-secondary"
                    onclick="window.print()"
                >
                    <i class="bi bi-printer me-1"></i>
                    In hóa đơn
                </button>

                <a
                    href="invoices.php"
                    class="btn btn-outline-secondary"
                >
                    Đóng
                </a>
            </div>

        </div>
    </div>
<?php endif; ?>

<!-- Bộ lọc -->
<div
    class="invoice-screen-only card border-0 shadow-sm mb-4"
>
    <div class="card-body p-4">
        <form
            method="get"
            action="invoices.php"
            class="row g-3 align-items-end"
        >
            <div class="col-12 col-xl-3">
                <label class="form-label fw-semibold">
                    Tìm hóa đơn
                </label>

                <input
                    type="search"
                    name="search"
                    class="form-control"
                    value="<?= admin_e($search) ?>"
                    placeholder="Mã đơn, tên, SĐT..."
                >
            </div>

            <div class="col-6 col-xl-2">
                <label class="form-label fw-semibold">
                    Từ ngày
                </label>

                <input
                    type="date"
                    name="date_from"
                    class="form-control"
                    value="<?= admin_e($dateFrom) ?>"
                >
            </div>

            <div class="col-6 col-xl-2">
                <label class="form-label fw-semibold">
                    Đến ngày
                </label>

                <input
                    type="date"
                    name="date_to"
                    class="form-control"
                    value="<?= admin_e($dateTo) ?>"
                >
            </div>

            <div class="col-6 col-xl-2">
                <label class="form-label fw-semibold">
                    Phương thức
                </label>

                <select
                    name="method"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <option
                        value="cash"
                        <?= $methodFilter === 'cash'
                            ? 'selected'
                            : ''
                        ?>
                    >
                        Tiền mặt
                    </option>

                    <option
                        value="bank_transfer"
                        <?= $methodFilter
                            === 'bank_transfer'
                                ? 'selected'
                                : ''
                        ?>
                    >
                        Chuyển khoản
                    </option>
                </select>
            </div>

            <div class="col-6 col-xl-2">
                <label class="form-label fw-semibold">
                    Trạng thái
                </label>

                <select
                    name="status"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach (
                        $paymentStatuses as $status
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

            <div class="col-12 col-xl-1 d-flex gap-2">
                <button
                    type="submit"
                    class="btn btn-coffee"
                    title="Tìm kiếm"
                >
                    <i class="bi bi-search"></i>
                </button>

                <a
                    href="invoices.php"
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

<!-- Danh sách hóa đơn -->
<div
    class="invoice-screen-only card border-0 shadow-sm"
>
    <div class="card-header bg-white p-4">
        <h3 class="h5 fw-bold mb-0">
            Danh sách hóa đơn

            <span class="badge text-bg-light border ms-1">
                <?= count($invoices) ?>
            </span>
        </h3>
    </div>

    <div class="table-responsive">
        <table
            class="table admin-table align-middle mb-0"
        >
            <thead>
            <tr>
                <th>Mã hóa đơn</th>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Phương thức</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th></th>
            </tr>
            </thead>

            <tbody>
            <?php if (!$invoices): ?>
                <tr>
                    <td
                        colspan="7"
                        class="text-center text-secondary py-5"
                    >
                        Không tìm thấy hóa đơn.
                    </td>
                </tr>
            <?php endif; ?>

            <?php foreach (
                $invoices as $invoice
            ): ?>
                <tr>
                    <td>
                        <strong>
                            HD<?= str_pad(
                                (string) $invoice['id'],
                                6,
                                '0',
                                STR_PAD_LEFT
                            ) ?>
                        </strong>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                admin_datetime(
                                    $invoice['created_at']
                                )
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?= admin_e(
                            $invoice['order_code']
                        ) ?>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= (int) $invoice['item_count'] ?>
                            món
                        </small>
                    </td>

                    <td>
                        <?= admin_e(
                            $invoice['customer_name']
                        ) ?>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                $invoice['customer_phone']
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?=
                            $invoice['payment_method']
                            === 'bank_transfer'
                                ? 'Chuyển khoản'
                                : 'Tiền mặt'
                        ?>
                    </td>

                    <td class="fw-semibold">
                        <?= admin_e(
                            admin_money(
                                $invoice['total_amount']
                            )
                        ) ?>
                    </td>

                    <td>
                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $invoice[
                                            'payment_status'
                                        ]
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $invoice[
                                        'payment_status'
                                    ]
                                )
                            ) ?>
                        </span>
                    </td>

                    <td>
                        <a
                            href="invoices.php?view=<?=
                                (int) $invoice['id']
                            ?>"
                            class="btn btn-sm btn-outline-coffee"
                            title="Xem hóa đơn"
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