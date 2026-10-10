<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/cart.php');
    exit;
}

$_SESSION['cart'] = [];

$_SESSION['flash'] = [
    'type' => 'success',
    'message' => 'Đã xóa toàn bộ giỏ hàng.',
];

header('Location: ../pages/cart.php');
exit;