<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/cart.php');
    exit;
}

$cartKey = trim(
    (string) ($_POST['cart_key'] ?? '')
);

if (
    $cartKey !== ''
    && isset($_SESSION['cart'][$cartKey])
) {
    unset($_SESSION['cart'][$cartKey]);

    $_SESSION['flash'] = [
        'type' => 'success',
        'message' => 'Đã xóa sản phẩm khỏi giỏ hàng.',
    ];
} else {
    $_SESSION['flash'] = [
        'type' => 'warning',
        'message' => 'Không tìm thấy sản phẩm trong giỏ hàng.',
    ];
}

header('Location: ../pages/cart.php');
exit;