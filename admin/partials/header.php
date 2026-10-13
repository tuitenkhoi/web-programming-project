<?php

declare(strict_types=1);

admin_require_login();

$pageTitle = $pageTitle ?? 'Quản trị';
$activePage = $activePage ?? '';

$currentAdmin = admin_user();
$flash = admin_take_flash();

$menuItems = [
    'dashboard' => [
        'dashboard.php',
        'bi-speedometer2',
        'Tổng quan'
    ],
    'products' => [
        'products.php',
        'bi-cup-straw',
        'Sản phẩm'
    ],
    'orders' => [
        'orders.php',
        'bi-receipt',
        'Đơn hàng'
    ],
    'bookings' => [
        'bookings.php',
        'bi-calendar-check',
        'Đặt bàn'
    ],
    'tables' => [
        'tables.php',
        'bi-grid-3x3-gap',
        'Sơ đồ bàn'
    ],
    'invoices' => [
        'invoices.php',
        'bi-file-earmark-text',
        'Hóa đơn'
    ],
];
?>

<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <meta
        name="description"
        content="Khu vực quản trị Mộc Coffee"
    >

    <title>
        <?= admin_e($pageTitle) ?> - Mộc Coffee
    </title>

    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
    >

    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
    >

    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >

    <link
        rel="stylesheet"
        href="../assets/css/admin.css"
    >

    <link
        rel="stylesheet"
        href="../assets/css/responsive.css"
    >
</head>

<body class="admin-body">

<div
    id="sidebar-overlay"
    class="sidebar-overlay"
></div>

<!-- Thanh menu bên trái -->
<aside
    id="admin-sidebar"
    class="admin-sidebar"
>
    <div class="admin-sidebar-header">
        <a
            href="dashboard.php"
            class="admin-logo"
        >
            <i class="bi bi-cup-hot-fill"></i>
            <span>Mộc Coffee</span>
        </a>

        <button
            type="button"
            id="close-sidebar-button"
            class="btn d-lg-none text-white"
            aria-label="Đóng menu"
        >
            <i class="bi bi-x-lg"></i>
        </button>
    </div>

    <!-- Thông tin quản trị viên -->
    <div class="admin-user-box">
        <div class="admin-avatar">
            <?= admin_e(
                mb_strtoupper(
                    mb_substr(
                        (string) (
                            $currentAdmin['full_name'] ?? 'A'
                        ),
                        0,
                        1
                    )
                )
            ) ?>
        </div>

        <div class="overflow-hidden">
            <strong>
                <?= admin_e(
                    $currentAdmin['full_name']
                    ?? 'Quản trị viên'
                ) ?>
            </strong>

            <small>
                <?= admin_e(
                    $currentAdmin['email'] ?? ''
                ) ?>
            </small>
        </div>
    </div>

    <!-- Danh sách chức năng -->
    <nav
        class="admin-navigation"
        aria-label="Menu quản trị"
    >
        <p class="admin-menu-title">
            Quản lý
        </p>

        <ul class="admin-menu">
            <?php foreach (
                $menuItems as
                $key => [$url, $icon, $label]
            ): ?>
                <li>
                    <a
                        href="<?= admin_e($url) ?>"
                        class="<?=
                            $activePage === $key
                                ? 'active'
                                : ''
                        ?>"
                    >
                        <i
                            class="bi <?= admin_e($icon) ?>"
                        ></i>

                        <span>
                            <?= admin_e($label) ?>
                        </span>
                    </a>
                </li>
            <?php endforeach; ?>
        </ul>

        <p class="admin-menu-title">
            Tài khoản
        </p>

        <ul class="admin-menu">
            <li>
                <a href="../index.php">
                    <i class="bi bi-house"></i>
                    <span>Trang khách hàng</span>
                </a>
            </li>

            <li>
                <a href="logout.php">
                    <i class="bi bi-box-arrow-right"></i>
                    <span>Đăng xuất</span>
                </a>
            </li>
        </ul>
    </nav>
</aside>

<!-- Nội dung bên phải -->
<div class="admin-main">

    <header class="admin-topbar">
        <div class="d-flex align-items-center">

            <button
                type="button"
                id="open-sidebar-button"
                class="btn btn-light d-lg-none me-2"
                aria-label="Mở menu"
            >
                <i class="bi bi-list"></i>
            </button>

            <div>
                <h1 class="h5 fw-bold mb-0">
                    <?= admin_e($pageTitle) ?>
                </h1>

                <small class="text-secondary">
                    <?= admin_e(date('d/m/Y')) ?>
                </small>
            </div>
        </div>

        <span class="badge text-bg-light border">
            <i class="bi bi-shield-check me-1"></i>
            Quản trị viên
        </span>
    </header>

    <main class="admin-content">

        <?php if ($flash !== null): ?>
            <div
                class="alert alert-<?=
                    admin_e(
                        $flash['type'] ?? 'info'
                    )
                ?> alert-dismissible fade show"
                role="alert"
            >
                <?= admin_e(
                    $flash['message'] ?? ''
                ) ?>

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                    aria-label="Đóng"
                ></button>
            </div>
        <?php endif; ?>