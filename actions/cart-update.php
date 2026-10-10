<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/cart.php');
    exit;
}

$quantities = $_POST['quantities'] ?? [];

if (!is_array($quantities)) {
    $quantities = [];
}

foreach ($quantities as $cartKey => $quantity) {
    $cartKey = (string) $cartKey;
    $quantity = filter_var(
        $quantity,
        FILTER_VALIDATE_INT
    );

    if (!isset($_SESSION['cart'][$cartKey])) {
        continue;
    }

    /*
     * Số lượng bằng 0 thì xóa món.
     */
    if ($quantity === 0) {
        unset($_SESSION['cart'][$cartKey]);
        continue;
    }

    /*
     * Chỉ chấp nhận từ 1 đến 99.
     */
    if (
        $quantity === false
        || $quantity < 1
        || $quantity > 99
    ) {
        continue;
    }

    $_SESSION['cart'][$cartKey]['quantity'] =
        $quantity;
}

$_SESSION['flash'] = [
    'type' => 'success',
    'message' => 'Giỏ hàng đã được cập nhật.',
];

header('Location: ../pages/cart.php');
exit;