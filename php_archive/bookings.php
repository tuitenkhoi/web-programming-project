<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * Các trạng thái đặt bàn hợp lệ.
 */
$bookingStatuses = [
    'pending',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
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
         * THÊM HOẶC SỬA LỊCH ĐẶT
         */
        if ($action === 'save_booking') {
            $id = filter_input(
                INPUT_POST,
                'id',
                FILTER_VALIDATE_INT
            ) ?: null;

            $tableId = filter_input(
                INPUT_POST,
                'table_id',
                FILTER_VALIDATE_INT
            );

            $customerName = trim(
                (string) (
                    $_POST['customer_name'] ?? ''
                )
            );

            $customerPhone = trim(
                (string) (
                    $_POST['customer_phone'] ?? ''
                )
            );

            $customerEmail = trim(
                (string) (
                    $_POST['customer_email'] ?? ''
                )
            );

            $bookingDate = trim(
                (string) (
                    $_POST['booking_date'] ?? ''
                )
            );

            $bookingTime = trim(
                (string) (
                    $_POST['booking_time'] ?? ''
                )
            );

            $guestCount = filter_input(
                INPUT_POST,
                'guest_count',
                FILTER_VALIDATE_INT
            );

            $status =
                (string) (
                    $_POST['status'] ?? 'pending'
                );

            $note = trim(
                (string) ($_POST['note'] ?? '')
            );

            /*
             * Kiểm tra dữ liệu bắt buộc.
             */
            if (
                !$tableId
                || mb_strlen($customerName) < 2
                || !preg_match(
                    '/^0[0-9]{9}$/',
                    $customerPhone
                )
                || !preg_match(
                    '/^\d{4}-\d{2}-\d{2}$/',
                    $bookingDate
                )
                || !preg_match(
                    '/^\d{2}:\d{2}$/',
                    $bookingTime
                )
                || !$guestCount
                || $guestCount < 1
                || !in_array(
                    $status,
                    $bookingStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Vui lòng nhập đầy đủ và đúng '
                    . 'thông tin đặt bàn.'
                );
            }

            /*
             * Kiểm tra email nếu khách có nhập.
             */
            if (
                $customerEmail !== ''
                && !filter_var(
                    $customerEmail,
                    FILTER_VALIDATE_EMAIL
                )
            ) {
                throw new RuntimeException(
                    'Email khách hàng không hợp lệ.'
                );
            }

            /*
             * Kiểm tra giờ mở cửa.
             */
            if (
                $bookingTime < '07:00'
                || $bookingTime > '22:00'
            ) {
                throw new RuntimeException(
                    'Giờ đặt bàn phải từ 07:00 đến 22:00.'
                );
            }

            /*
             * Kiểm tra thông tin bàn.
             */
            $tableStatement = $pdo->prepare(
                'SELECT id, capacity, status
                 FROM coffee_tables
                 WHERE id = :id
                 LIMIT 1'
            );

            $tableStatement->execute([
                'id' => $tableId,
            ]);

            $table = $tableStatement->fetch();

            if (
                !$table
                || (string) $table['status']
                    === 'maintenance'
            ) {
                throw new RuntimeException(
                    'Bàn được chọn không tồn tại '
                    . 'hoặc đang bảo trì.'
                );
            }

            if (
                $guestCount
                > (int) $table['capacity']
            ) {
                throw new RuntimeException(
                    'Số khách vượt quá sức chứa của bàn.'
                );
            }

            /*
             * Kiểm tra trùng bàn, ngày và giờ.
             */
            $conflictSql =
                "SELECT COUNT(*)
                 FROM bookings
                 WHERE table_id = :table_id
                   AND booking_date = :booking_date
                   AND booking_time = :booking_time
                   AND status <> 'cancelled'";

            $conflictParameters = [
                'table_id' => $tableId,
                'booking_date' => $bookingDate,
                'booking_time' =>
                    $bookingTime . ':00',
            ];

            /*
             * Khi sửa, bỏ qua chính lịch hiện tại.
             */
            if ($id !== null) {
                $conflictSql .= ' AND id <> :id';

                $conflictParameters['id'] = $id;
            }

            $conflictStatement =
                $pdo->prepare($conflictSql);

            $conflictStatement->execute(
                $conflictParameters
            );

            if (
                (int) $conflictStatement
                    ->fetchColumn() > 0
            ) {
                throw new RuntimeException(
                    'Bàn đã có lịch đặt '
                    . 'tại thời điểm này.'
                );
            }

            /*
             * Thêm lịch đặt mới.
             */
            if ($id === null) {
                $statement = $pdo->prepare(
                    'INSERT INTO bookings (
                        booking_code,
                        table_id,
                        customer_name,
                        customer_phone,
                        customer_email,
                        booking_date,
                        booking_time,
                        guest_count,
                        note,
                        status
                    ) VALUES (
                        :booking_code,
                        :table_id,
                        :customer_name,
                        :customer_phone,
                        :customer_email,
                        :booking_date,
                        :booking_time,
                        :guest_count,
                        :note,
                        :status
                    )'
                );

                $statement->execute([
                    'booking_code' =>
                        admin_generate_code('BK'),
                    'table_id' => $tableId,
                    'customer_name' =>
                        $customerName,
                    'customer_phone' =>
                        $customerPhone,
                    'customer_email' =>
                        $customerEmail !== ''
                            ? $customerEmail
                            : null,
                    'booking_date' =>
                        $bookingDate,
                    'booking_time' =>
                        $bookingTime . ':00',
                    'guest_count' =>
                        $guestCount,
                    'note' =>
                        $note !== ''
                            ? $note
                            : null,
                    'status' => $status,
                ]);

                admin_flash(
                    'success',
                    'Đã tạo lịch đặt bàn.'
                );
            } else {
                /*
                 * Cập nhật lịch đặt.
                 */
                $statement = $pdo->prepare(
                    'UPDATE bookings
                     SET
                        table_id = :table_id,
                        customer_name = :customer_name,
                        customer_phone = :customer_phone,
                        customer_email = :customer_email,
                        booking_date = :booking_date,
                        booking_time = :booking_time,
                        guest_count = :guest_count,
                        note = :note,
                        status = :status
                     WHERE id = :id'
                );

                $statement->execute([
                    'table_id' => $tableId,
                    'customer_name' =>
                        $customerName,
                    'customer_phone' =>
                        $customerPhone,
                    'customer_email' =>
                        $customerEmail !== ''
                            ? $customerEmail
                            : null,
                    'booking_date' =>
                        $bookingDate,
                    'booking_time' =>
                        $bookingTime . ':00',
                    'guest_count' =>
                        $guestCount,
                    'note' =>
                        $note !== ''
                            ? $note
                            : null,
                    'status' => $status,
                    'id' => $id,
                ]);

                admin_flash(
                    'success',
                    'Đã cập nhật lịch đặt bàn.'
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
                    $bookingStatuses,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Lịch đặt hoặc trạng thái '
                    . 'không hợp lệ.'
                );
            }

            $statement = $pdo->prepare(
                'UPDATE bookings
                 SET status = :status
                 WHERE id = :id'
            );

            $statement->execute([
                'status' => $status,
                'id' => $id,
            ]);

            admin_flash(
                'success',
                'Đã cập nhật trạng thái đặt bàn.'
            );
        } else {
            throw new RuntimeException(
                'Yêu cầu xử lý không hợp lệ.'
            );
        }
    } catch (Throwable $exception) {
        $message =
            $exception instanceof RuntimeException
                ? $exception->getMessage()
                : 'Không thể xử lý lịch đặt bàn.';

        admin_flash('danger', $message);
    }

    admin_redirect('bookings.php');
}

/*
 * LẤY DANH SÁCH BÀN KHÔNG BẢO TRÌ
 */
$tables = $pdo->query(
    "SELECT *
     FROM coffee_tables
     WHERE status <> 'maintenance'
     ORDER BY table_code"
)->fetchAll();

/*
 * NHẬN BỘ LỌC
 */
$search = trim(
    (string) ($_GET['search'] ?? '')
);

$statusFilter =
    (string) ($_GET['status'] ?? '');

$dateFilter = trim(
    (string) ($_GET['date'] ?? '')
);

$where = ['1 = 1'];
$parameters = [];

/*
 * Tìm kiếm bằng các tham số riêng biệt.
 */
if ($search !== '') {
    $where[] =
        '(b.booking_code LIKE :search_code
          OR b.customer_name LIKE :search_name
          OR b.customer_phone LIKE :search_phone
          OR t.table_code LIKE :search_table)';

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
 * Lọc trạng thái.
 */
if (
    in_array(
        $statusFilter,
        $bookingStatuses,
        true
    )
) {
    $where[] = 'b.status = :status';

    $parameters['status'] =
        $statusFilter;
}

/*
 * Lọc ngày đặt.
 */
if (
    preg_match(
        '/^\d{4}-\d{2}-\d{2}$/',
        $dateFilter
    )
) {
    $where[] =
        'b.booking_date = :booking_date';

    $parameters['booking_date'] =
        $dateFilter;
}

/*
 * LẤY DANH SÁCH LỊCH ĐẶT
 */
$statement = $pdo->prepare(
    'SELECT
        b.*,
        t.table_code,
        t.table_name,
        t.area,
        t.capacity
     FROM bookings AS b
     INNER JOIN coffee_tables AS t
        ON t.id = b.table_id
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY
        b.booking_date DESC,
        b.booking_time DESC,
        b.id DESC'
);

$statement->execute($parameters);

$bookings = $statement->fetchAll();

/*
 * THỐNG KÊ
 */
$summary = $pdo->query(
    "SELECT
        COUNT(*) AS total,
        COALESCE(
            SUM(
                booking_date = CURDATE()
                AND status <> 'cancelled'
            ),
            0
        ) AS today_count,
        COALESCE(
            SUM(status = 'pending'),
            0
        ) AS pending_count,
        COALESCE(
            SUM(status = 'confirmed'),
            0
        ) AS confirmed_count
     FROM bookings"
)->fetch();

/*
 * LẤY LỊCH ĐẶT CẦN SỬA
 */
$editBooking = null;

$editId = filter_input(
    INPUT_GET,
    'edit',
    FILTER_VALIDATE_INT
);

if ($editId) {
    $editStatement = $pdo->prepare(
        'SELECT *
         FROM bookings
         WHERE id = :id
         LIMIT 1'
    );

    $editStatement->execute([
        'id' => $editId,
    ]);

    $editBooking =
        $editStatement->fetch() ?: null;
}

$pageTitle = 'Quản lý đặt bàn';
$activePage = 'bookings';

require __DIR__ . '/partials/header.php';
?>

<!-- Tiêu đề -->
<div
    class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
>
    <div>
        <h2 class="h3 fw-bold mb-1">
            Lịch đặt bàn
        </h2>

        <p class="text-secondary mb-0">
            Tiếp nhận và cập nhật yêu cầu đặt bàn của khách.
        </p>
    </div>

    <a
        href="bookings.php?form=1"
        class="btn btn-coffee"
    >
        <i class="bi bi-calendar-plus me-1"></i>
        Thêm lịch đặt
    </a>
</div>

<!-- Thống kê -->
<div class="row g-3 mb-4">

    <?php
    $summaryCards = [
        [
            'Tổng lịch đặt',
            $summary['total'] ?? 0,
            'secondary',
        ],
        [
            'Hôm nay',
            $summary['today_count'] ?? 0,
            'info',
        ],
        [
            'Chờ xử lý',
            $summary['pending_count'] ?? 0,
            'warning',
        ],
        [
            'Đã xác nhận',
            $summary['confirmed_count'] ?? 0,
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

<!-- Form thêm hoặc sửa -->
<?php if (
    isset($_GET['form'])
    || $editBooking !== null
): ?>
    <div class="card border-0 shadow-sm mb-4">

        <div class="card-header bg-white p-4">
            <h3 class="h5 fw-bold mb-0">
                <?= $editBooking
                    ? 'Cập nhật lịch đặt'
                    : 'Tạo lịch đặt mới'
                ?>
            </h3>
        </div>

        <div class="card-body p-4">
            <form
                method="post"
                action="bookings.php"
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
                    value="save_booking"
                >

                <input
                    type="hidden"
                    name="id"
                    value="<?= admin_e(
                        $editBooking['id'] ?? ''
                    ) ?>"
                >

                <div class="col-md-4">
                    <label class="form-label fw-semibold">
                        Họ tên khách
                    </label>

                    <input
                        type="text"
                        name="customer_name"
                        class="form-control"
                        minlength="2"
                        maxlength="100"
                        value="<?= admin_e(
                            $editBooking[
                                'customer_name'
                            ] ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-4">
                    <label class="form-label fw-semibold">
                        Số điện thoại
                    </label>

                    <input
                        type="tel"
                        name="customer_phone"
                        class="form-control"
                        pattern="0[0-9]{9}"
                        maxlength="10"
                        value="<?= admin_e(
                            $editBooking[
                                'customer_phone'
                            ] ?? ''
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-4">
                    <label class="form-label fw-semibold">
                        Email
                    </label>

                    <input
                        type="email"
                        name="customer_email"
                        class="form-control"
                        maxlength="150"
                        value="<?= admin_e(
                            $editBooking[
                                'customer_email'
                            ] ?? ''
                        ) ?>"
                    >
                </div>

                <div class="col-md-3">
                    <label class="form-label fw-semibold">
                        Ngày đặt
                    </label>

                    <input
                        type="date"
                        name="booking_date"
                        class="form-control"
                        value="<?= admin_e(
                            $editBooking['booking_date']
                            ?? date('Y-m-d')
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-3">
                    <label class="form-label fw-semibold">
                        Giờ đặt
                    </label>

                    <input
                        type="time"
                        name="booking_time"
                        class="form-control"
                        min="07:00"
                        max="22:00"
                        value="<?= admin_e(
                            isset(
                                $editBooking['booking_time']
                            )
                                ? substr(
                                    (string) $editBooking[
                                        'booking_time'
                                    ],
                                    0,
                                    5
                                )
                                : '08:00'
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-2">
                    <label class="form-label fw-semibold">
                        Số khách
                    </label>

                    <input
                        type="number"
                        name="guest_count"
                        class="form-control"
                        min="1"
                        max="20"
                        value="<?= admin_e(
                            $editBooking['guest_count']
                            ?? 2
                        ) ?>"
                        required
                    >
                </div>

                <div class="col-md-2">
                    <label class="form-label fw-semibold">
                        Bàn
                    </label>

                    <select
                        name="table_id"
                        class="form-select"
                        required
                    >
                        <option value="">
                            Chọn bàn
                        </option>

                        <?php foreach (
                            $tables as $table
                        ): ?>
                            <option
                                value="<?= (int) $table['id'] ?>"
                                <?=
                                    (int) (
                                        $editBooking['table_id']
                                        ?? 0
                                    )
                                    === (int) $table['id']
                                        ? 'selected'
                                        : ''
                                ?>
                            >
                                <?= admin_e(
                                    $table['table_code']
                                ) ?>
                                ·
                                <?= (int) $table['capacity'] ?>
                                chỗ
                            </option>
                        <?php endforeach; ?>
                    </select>
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
                            $bookingStatuses as $status
                        ): ?>
                            <option
                                value="<?= admin_e(
                                    $status
                                ) ?>"
                                <?=
                                    (
                                        $editBooking['status']
                                        ?? 'pending'
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

                <div class="col-12">
                    <label class="form-label fw-semibold">
                        Ghi chú
                    </label>

                    <textarea
                        name="note"
                        class="form-control"
                        rows="2"
                        maxlength="300"
                    ><?= admin_e(
                        $editBooking['note'] ?? ''
                    ) ?></textarea>
                </div>

                <div
                    class="col-12 d-flex justify-content-end gap-2"
                >
                    <a
                        href="bookings.php"
                        class="btn btn-outline-secondary"
                    >
                        Hủy
                    </a>

                    <button
                        type="submit"
                        class="btn btn-coffee"
                    >
                        Lưu lịch đặt
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
            action="bookings.php"
            class="row g-3 align-items-end"
        >
            <div class="col-12 col-lg-5">
                <label class="form-label fw-semibold">
                    Tìm kiếm
                </label>

                <input
                    type="search"
                    name="search"
                    class="form-control"
                    value="<?= admin_e($search) ?>"
                    placeholder="Mã đặt, khách hàng, SĐT, bàn..."
                >
            </div>

            <div class="col-6 col-lg-3">
                <label class="form-label fw-semibold">
                    Ngày đặt
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
                    Trạng thái
                </label>

                <select
                    name="status"
                    class="form-select"
                >
                    <option value="">Tất cả</option>

                    <?php foreach (
                        $bookingStatuses as $status
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
                    href="bookings.php"
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

<!-- Danh sách lịch đặt -->
<div class="card border-0 shadow-sm">
    <div class="card-header bg-white p-4">
        <h3 class="h5 fw-bold mb-0">
            Danh sách đặt bàn

            <span class="badge text-bg-light border ms-1">
                <?= count($bookings) ?>
            </span>
        </h3>
    </div>

    <div class="table-responsive">
        <table
            class="table admin-table align-middle mb-0"
        >
            <thead>
            <tr>
                <th>Mã đặt</th>
                <th>Khách hàng</th>
                <th>Thời gian</th>
                <th>Bàn</th>
                <th>Số khách</th>
                <th>Trạng thái</th>
                <th class="text-end">Thao tác</th>
            </tr>
            </thead>

            <tbody>
            <?php if (!$bookings): ?>
                <tr>
                    <td
                        colspan="7"
                        class="text-center text-secondary py-5"
                    >
                        Không tìm thấy lịch đặt bàn.
                    </td>
                </tr>
            <?php endif; ?>

            <?php foreach (
                $bookings as $booking
            ): ?>
                <tr>
                    <td>
                        <strong>
                            <?= admin_e(
                                $booking['booking_code']
                            ) ?>
                        </strong>

                        <small
                            class="d-block text-secondary"
                        >
                            Tạo
                            <?= admin_e(
                                admin_datetime(
                                    $booking['created_at']
                                )
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?= admin_e(
                            $booking['customer_name']
                        ) ?>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                $booking['customer_phone']
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?= admin_e(
                            admin_datetime(
                                $booking['booking_date']
                                . ' '
                                . $booking['booking_time']
                            )
                        ) ?>
                    </td>

                    <td>
                        <strong>
                            <?= admin_e(
                                $booking['table_code']
                            ) ?>
                        </strong>

                        <small
                            class="d-block text-secondary"
                        >
                            <?= admin_e(
                                $booking['area']
                            ) ?>
                        </small>
                    </td>

                    <td>
                        <?= (int) $booking['guest_count'] ?>
                    </td>

                    <td>
                        <span
                            class="badge text-bg-<?=
                                admin_e(
                                    admin_status_class(
                                        $booking['status']
                                    )
                                )
                            ?>"
                        >
                            <?= admin_e(
                                admin_status_text(
                                    $booking['status']
                                )
                            ) ?>
                        </span>
                    </td>

                    <td class="text-end">
                        <!-- Sửa -->
                        <a
                            href="bookings.php?edit=<?=
                                (int) $booking['id']
                            ?>"
                            class="btn btn-sm btn-outline-primary"
                            title="Sửa"
                        >
                            <i class="bi bi-pencil"></i>
                        </a>

                        <!-- Hủy hoặc khôi phục -->
                        <form
                            method="post"
                            action="bookings.php"
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
                                value="update_status"
                            >

                            <input
                                type="hidden"
                                name="id"
                                value="<?=
                                    (int) $booking['id']
                                ?>"
                            >

                            <input
                                type="hidden"
                                name="status"
                                value="<?=
                                    $booking['status']
                                    === 'cancelled'
                                        ? 'pending'
                                        : 'cancelled'
                                ?>"
                            >

                            <button
                                type="submit"
                                class="btn btn-sm btn-outline-<?=
                                    $booking['status']
                                    === 'cancelled'
                                        ? 'success'
                                        : 'danger'
                                ?>"
                                title="<?=
                                    $booking['status']
                                    === 'cancelled'
                                        ? 'Khôi phục'
                                        : 'Hủy lịch'
                                ?>"
                                onclick="return confirm('Bạn chắc chắn muốn thay đổi trạng thái lịch đặt này?');"
                            >
                                <i
                                    class="bi bi-<?=
                                        $booking['status']
                                        === 'cancelled'
                                            ? 'arrow-counterclockwise'
                                            : 'x-lg'
                                    ?>"
                                ></i>
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