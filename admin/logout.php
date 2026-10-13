<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

/*
 * Chỉ xóa phiên đăng nhập quản trị.
 * Không xóa giỏ hàng của khách hàng.
 */
unset(
    $_SESSION['admin_user'],
    $_SESSION['admin_csrf_token'],
    $_SESSION['admin_flash']
);

session_regenerate_id(true);

admin_redirect('login.php');