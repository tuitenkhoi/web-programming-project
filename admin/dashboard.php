<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

admin_require_login();

/*
 * Giá trị mặc định cho các ô thống kê.
 */
$stats = [
    'revenue' => 0,
    'orders' => 0,
    'bookings' => 0,
    'tables' => 0,
    'available_tables' => 0,
    'products' => 0,
];

/*
 * Doanh thu đã thanh toán trong ngày.
 */
$stats['revenue'] = (float) $pdo->query(
    "SELECT COALESCE(SUM(total_amount), 0)
     FROM orders
     WHERE payment_status = 'paid'
       AND created_at >= CURDATE()
       AND created_at < CURDATE() + INTERVAL 1 DAY"
)->fetchColumn();

/*
 * Số đơn hàng được tạo hôm nay.
 */
$stats['orders'] = (int) $pdo->query(
    "SELECT COUNT(*)
     FROM orders
     WHERE created_at >= CURDATE()
       AND created_at < CURDATE() + INTERVAL 1 DAY"
)->fetchColumn();

/*
 * Số lịch đặt bàn hôm nay, không tính lịch đã hủy.
 */
$stats['bookings'] = (int) $pdo->query(
    "SELECT COUNT(*)
     FROM bookings
     WHERE booking_date = CURDATE()
       AND status <> 'cancelled'"
)->fetchColumn();

/*
 * Tổng số bàn.
 */
$stats['tables'] = (int) $pdo->query(
    "SELECT COUNT(*)
     FROM coffee_tables"
)->fetchColumn();

/*
 * Số bàn đang trống.
 */
$stats['available_tables'] = (int) $pdo->query(
    "SELECT COUNT(*)
     FROM coffee_tables
     WHERE status = 'available'"
)->fetchColumn();

/*
 * Số sản phẩm đang bán.
 */
$stats['products'] = (int) $pdo->query(
    "SELECT COUNT(*)
     FROM products
     WHERE status = 1"
)->fetchColumn();

/*
 * Lấy 7 đơn hàng mới nhất.
 */
$recentOrders = $pdo->query(
    "SELECT
        id,
        order_code,
        customer_name,
        table_code,
        total_amount,
        payment_status,
        status,
        created_at
     FROM orders
     ORDER BY id DESC
     LIMIT 7"
)->fetchAll();

/*
 * Lấy 6 lịch đặt bàn sắp tới.
 */
$upcomingBookings = $pdo->query(
    "SELECT
        b.id,
        b.booking_code,
        b.customer_name,
        b.booking_date,
        b.booking_time,
        b.guest_count,
        b.status,
        t.table_code
     FROM bookings AS b
     INNER JOIN coffee_tables AS t
        ON t.id = b.table_id
     WHERE b.status IN ('pending', 'confirmed')
       AND TIMESTAMP(
            b.booking_date,
            b.booking_time
       ) >= NOW()
     ORDER BY
        b.booking_date,
        b.booking_time
     LIMIT 6"
)->fetchAll();

/*
 * Thiết lập tiêu đề và menu đang được chọn.
 */
$pageTitle = 'Tổng quan';
$activePage = 'dashboard';

require __DIR__ . '/partials/header.php';
?>

<!-- Tiêu đề trang -->
<section class="mb-4">
    <p class="text-secondary mb-1">
        Xin chào,
        <?= admin_e(
            admin_user()['full_name']
            ?? 'Quản trị viên'
        ) ?>!
    </p>

    <h2 class="h3 fw-bold mb-0">
        Tình hình hoạt động hôm nay
    </h2>
</section>

<!-- Các ô thống kê -->
<div class="row g-4 mb-4">

    <!-- Doanh thu -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div
            class="card border-0 shadow-sm admin-stat-card h-100"
        >
            <div
                class="card-body d-flex justify-content-between align-items-center"
            >
                <div>
                    <p class="text-secondary mb-1">
                        Doanh thu đã thu
                    </p>

                    <h3 class="fw-bold mb-0">
                        <?= admin_e(
                            admin_money(
                                $stats['revenue']
                            )
                        ) ?>
                    </h3>
                </div>

                <div
                    class="admin-stat-icon bg-success-subtle text-success"
                >
                    <i class="bi bi-cash-stack"></i>
                </div>
            </div>
        </div>
    </div>

    <!-- Đơn hàng -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div
            class="card border-0 shadow-sm admin-stat-card h-100"
        >
            <div
                class="card-body d-flex justify-content-between align-items-center"
            >
                <div>
                    <p class="text-secondary mb-1">
                        Đơn hàng hôm nay
                    </p>

                    <h3 class="fw-bold mb-0">
                        <?= (int) $stats['orders'] ?>
                    </h3>
                </div>

                <div
                    class="admin-stat-icon bg-primary-subtle text-primary"
                >
                    <i class="bi bi-receipt"></i>
                </div>
            </div>
        </div>
    </div>

    <!-- Lịch đặt bàn -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div
            class="card border-0 shadow-sm admin-stat-card h-100"
        >
            <div
                class="card-body d-flex justify-content-between align-items-center"
            >
                <div>
                    <p class="text-secondary mb-1">
                        Lịch đặt hôm nay
                    </p>

                    <h3 class="fw-bold mb-0">
                        <?= (int) $stats['bookings'] ?>
                    </h3>
                </div>

                <div
                    class="admin-stat-icon bg-warning-subtle text-warning"
                >
                    <i class="bi bi-calendar-check"></i>
                </div>
            </div>
        </div>
    </div>

    <!-- Bàn trống -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div
            class="card border-0 shadow-sm admin-stat-card h-100"
        >
            <div
                class="card-body d-flex justify-content-between align-items-center"
            >
                <div>
                    <p class="text-secondary mb-1">
                        Bàn đang trống
                    </p>

                    <h3 class="fw-bold mb-0">
                        <?= (int) $stats['available_tables'] ?>
                        /
                        <?= (int) $stats['tables'] ?>
                    </h3>
                </div>

                <div
                    class="admin-stat-icon bg-info-subtle text-info"
                >
                    <i class="bi bi-grid-3x3-gap"></i>
                </div>
            </div>
        </div>
    </div>

</div>

<div class="row g-4">

    <!-- Đơn hàng gần đây -->
    <div class="col-12 col-xl-7">
        <div class="card border-0 shadow-sm h-100">

            <div
                class="card-header bg-white border-0 p-4 d-flex justify-content-between align-items-center"
            >
                <div>
                    <h2 class="h5 fw-bold mb-1">
                        Đơn hàng gần đây
                    </h2>

                    <p class="text-secondary small mb-0">
                        Dữ liệu mới nhất từ bảng orders
                    </p>
                </div>

                <a
                    href="orders.php"
                    class="btn btn-sm btn-outline-coffee"
                >
                    Xem tất cả
                </a>
            </div>

            <div class="table-responsive">
                <table
                    class="table admin-table align-middle mb-0"
                >
                    <thead>
                    <tr>
                        <th>Mã đơn</th>
                        <th>Khách hàng</th>
                        <th>Bàn</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái</th>
                    </tr>
                    </thead>

                    <tbody>
                    <?php if (!$recentOrders): ?>
                        <tr>
                            <td
                                colspan="5"
                                class="text-center text-secondary py-5"
                            >
                                Chưa có đơn hàng.
                            </td>
                        </tr>
                    <?php endif; ?>

                    <?php foreach (
                        $recentOrders as $order
                    ): ?>
                        <tr>
                            <td>
                                <a
                                    href="orders.php?view=<?=
                                        (int) $order['id']
                                    ?>"
                                    class="fw-semibold"
                                >
                                    <?= admin_e(
                                        $order['order_code']
                                    ) ?>
                                </a>

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
                            </td>

                            <td>
                                <?= admin_e(
                                    $order['table_code']
                                    ?: 'Mang đi'
                                ) ?>
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
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

        </div>
    </div>

    <!-- Lịch đặt bàn sắp tới -->
    <div class="col-12 col-xl-5">
        <div class="card border-0 shadow-sm h-100">

            <div
                class="card-header bg-white border-0 p-4 d-flex justify-content-between align-items-center"
            >
                <div>
                    <h2 class="h5 fw-bold mb-1">
                        Lịch đặt sắp tới
                    </h2>

                    <p class="text-secondary small mb-0">
                        Lịch chờ xử lý hoặc đã xác nhận
                    </p>
                </div>

                <a
                    href="bookings.php"
                    class="btn btn-sm btn-outline-coffee"
                >
                    Quản lý
                </a>
            </div>

            <div class="card-body pt-0">

                <?php if (!$upcomingBookings): ?>
                    <div
                        class="text-center text-secondary py-5"
                    >
                        <i
                            class="bi bi-calendar2-check fs-1 d-block mb-2"
                        ></i>

                        Chưa có lịch đặt sắp tới.
                    </div>
                <?php endif; ?>

                <?php foreach (
                    $upcomingBookings as $booking
                ): ?>
                    <div
                        class="border rounded-3 p-3 mb-3"
                    >
                        <div
                            class="d-flex justify-content-between gap-3"
                        >
                            <div>
                                <strong>
                                    <?= admin_e(
                                        $booking['customer_name']
                                    ) ?>
                                </strong>

                                <small
                                    class="d-block text-secondary"
                                >
                                    <?= admin_e(
                                        $booking['booking_code']
                                    ) ?>

                                    ·

                                    <?= admin_e(
                                        $booking['table_code']
                                    ) ?>

                                    ·

                                    <?= (int) $booking['guest_count'] ?>
                                    khách
                                </small>
                            </div>

                            <span
                                class="badge text-bg-<?=
                                    admin_e(
                                        admin_status_class(
                                            $booking['status']
                                        )
                                    )
                                ?> align-self-start"
                            >
                                <?= admin_e(
                                    admin_status_text(
                                        $booking['status']
                                    )
                                ) ?>
                            </span>
                        </div>

                        <div class="mt-2 small">
                            <i class="bi bi-clock me-1"></i>

                            <?= admin_e(
                                admin_datetime(
                                    $booking['booking_date']
                                    . ' '
                                    . $booking['booking_time']
                                )
                            ) ?>
                        </div>
                    </div>
                <?php endforeach; ?>

            </div>
        </div>
    </div>

</div>

<!-- Thao tác nhanh -->
<div class="card border-0 shadow-sm mt-4">
    <div
        class="card-body p-4 d-flex flex-wrap gap-4 align-items-center"
    >
        <div>
            <span class="text-secondary">
                Sản phẩm đang bán
            </span>

            <strong class="d-block fs-4">
                <?= (int) $stats['products'] ?>
            </strong>
        </div>

        <div class="ms-auto d-flex flex-wrap gap-2">
            <a
                href="products.php?form=1"
                class="btn btn-coffee"
            >
                <i class="bi bi-plus-lg me-1"></i>
                Thêm sản phẩm
            </a>

            <a
                href="bookings.php?form=1"
                class="btn btn-outline-coffee"
            >
                <i class="bi bi-calendar-plus me-1"></i>
                Thêm lịch đặt
            </a>
        </div>
    </div>
</div>

<?php

require __DIR__ . '/partials/footer.php';