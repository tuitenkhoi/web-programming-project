<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

/*
 * Chỉ chấp nhận dữ liệu gửi bằng POST.
 */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/menu.php');
    exit;
}

/*
 * Lấy dữ liệu từ form.
 */
$productId = filter_input(
    INPUT_POST,
    'product_id',
    FILTER_VALIDATE_INT
);

$quantity = filter_input(
    INPUT_POST,
    'quantity',
    FILTER_VALIDATE_INT
);

$size = strtoupper(
    trim((string) ($_POST['size'] ?? 'M'))
);

$sugarLevel = trim(
    (string) ($_POST['sugar_level'] ?? '70%')
);

$iceLevel = trim(
    (string) ($_POST['ice_level'] ?? '70%')
);

$note = trim(
    (string) ($_POST['note'] ?? '')
);

$submittedToppings = $_POST['toppings'] ?? [];

if (!is_array($submittedToppings)) {
    $submittedToppings = [];
}

/*
 * Kiểm tra ID và số lượng.
 */
if (!$productId || $productId < 1) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Sản phẩm không hợp lệ.',
    ];

    header('Location: ../pages/menu.php');
    exit;
}

if (!$quantity || $quantity < 1 || $quantity > 99) {
    $quantity = 1;
}

/*
 * Danh sách giá trị hợp lệ.
 */
$sizePrices = [
    'S' => -5000,
    'M' => 0,
    'L' => 10000,
];

$toppingPrices = [
    'Trân châu' => 10000,
    'Thạch cà phê' => 10000,
    'Kem sữa' => 12000,
    'Thêm shot cà phê' => 15000,
];

$allowedLevels = [
    '0%',
    '30%',
    '50%',
    '70%',
    '100%',
];

/*
 * Kiểm tra size.
 */
if (!array_key_exists($size, $sizePrices)) {
    $size = 'M';
}

/*
 * Kiểm tra mức đường và đá.
 */
if (!in_array($sugarLevel, $allowedLevels, true)) {
    $sugarLevel = '70%';
}

if (!in_array($iceLevel, $allowedLevels, true)) {
    $iceLevel = '70%';
}

/*
 * Chỉ giữ các topping hợp lệ.
 */
$toppings = [];

foreach ($submittedToppings as $topping) {
    $topping = trim((string) $topping);

    if (array_key_exists($topping, $toppingPrices)) {
        $toppings[] = $topping;
    }
}

$toppings = array_values(array_unique($toppings));

sort($toppings);

/*
 * Giới hạn độ dài ghi chú.
 */
$note = mb_substr($note, 0, 200);

/*
 * Lấy sản phẩm thật từ MySQL.
 *
 * Không nhận tên hoặc giá sản phẩm từ trình duyệt.
 */
$productStatement = $pdo->prepare(
    "SELECT
        p.id,
        p.name,
        p.price,
        p.image
     FROM products AS p
     INNER JOIN categories AS c
        ON c.id = p.category_id
     WHERE p.id = :product_id
       AND p.status = 1
       AND c.status = 1
     LIMIT 1"
);

$productStatement->execute([
    'product_id' => $productId,
]);

$product = $productStatement->fetch();

if (!$product) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Sản phẩm không tồn tại hoặc đã ngừng bán.',
    ];

    header('Location: ../pages/menu.php');
    exit;
}

/*
 * Tính giá topping.
 */
$toppingTotal = 0;

foreach ($toppings as $topping) {
    $toppingTotal += $toppingPrices[$topping];
}

/*
 * Tính đơn giá.
 */
$basePrice = (float) $product['price'];

$unitPrice = max(
    0,
    $basePrice
    + $sizePrices[$size]
    + $toppingTotal
);

/*
 * Tạo khóa riêng cho từng cấu hình món.
 *
 * Cùng một sản phẩm nhưng khác size hoặc topping
 * sẽ là hai dòng khác nhau trong giỏ hàng.
 */
$cartKey = sha1(
    $productId
    . '|'
    . $size
    . '|'
    . $sugarLevel
    . '|'
    . $iceLevel
    . '|'
    . implode(',', $toppings)
    . '|'
    . $note
);

if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = [];
}

/*
 * Nếu cấu hình món đã tồn tại thì tăng số lượng.
 */
if (isset($_SESSION['cart'][$cartKey])) {
    $oldQuantity = (int) (
        $_SESSION['cart'][$cartKey]['quantity'] ?? 0
    );

    $_SESSION['cart'][$cartKey]['quantity'] = min(
        99,
        $oldQuantity + $quantity
    );
} else {
    $_SESSION['cart'][$cartKey] = [
        'cart_key' => $cartKey,
        'product_id' => (int) $product['id'],
        'name' => $product['name'],
        'image' => $product['image'],
        'base_price' => $basePrice,
        'unit_price' => $unitPrice,
        'size' => $size,
        'sugar_level' => $sugarLevel,
        'ice_level' => $iceLevel,
        'toppings' => $toppings,
        'note' => $note,
        'quantity' => $quantity,
    ];
}

$_SESSION['flash'] = [
    'type' => 'success',
    'message' => 'Đã thêm sản phẩm vào giỏ hàng.',
];

header('Location: ../pages/cart.php');
exit;