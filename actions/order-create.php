<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/cart.php');
    exit;
}

$cart = $_SESSION['cart'] ?? [];
$checkout = $_SESSION['checkout'] ?? null;

if (empty($cart) || !is_array($checkout)) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Không tìm thấy thông tin đơn hàng.',
    ];

    header('Location: ../pages/cart.php');
    exit;
}

/*
 * Nhận và làm sạch dữ liệu khách hàng.
 */
$customerName = trim(
    (string) ($_POST['customer_name'] ?? '')
);

$customerPhone = trim(
    (string) ($_POST['customer_phone'] ?? '')
);

$customerEmail = trim(
    (string) ($_POST['customer_email'] ?? '')
);

$paymentMethod = trim(
    (string) ($_POST['payment_method'] ?? '')
);

$acceptedPolicy =
    ($_POST['payment_policy'] ?? '') === '1';

/*
 * Kiểm tra dữ liệu.
 */
if (mb_strlen($customerName) < 2) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Họ tên phải có ít nhất 2 ký tự.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}

if (!preg_match('/^0[0-9]{9}$/', $customerPhone)) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Số điện thoại không hợp lệ.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}

if (
    $customerEmail !== ''
    && !filter_var(
        $customerEmail,
        FILTER_VALIDATE_EMAIL
    )
) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Email không hợp lệ.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}

if (!in_array(
    $paymentMethod,
    ['cash', 'bank_transfer'],
    true
)) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Phương thức thanh toán không hợp lệ.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}

if (!$acceptedPolicy) {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => 'Bạn cần đồng ý với chính sách.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}

/*
 * Bảng giá phía server.
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

try {
    $pdo->beginTransaction();

    /*
     * Câu lệnh tìm sản phẩm được chuẩn bị một lần.
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

    $calculatedItems = [];
    $subtotal = 0;

    /*
     * Kiểm tra lại từng món và giá từ MySQL.
     */
    foreach ($cart as $item) {
        $productId = (int) (
            $item['product_id'] ?? 0
        );

        $quantity = (int) (
            $item['quantity'] ?? 0
        );

        $size = strtoupper(
            trim((string) ($item['size'] ?? 'M'))
        );

        $sugarLevel = trim(
            (string) (
                $item['sugar_level'] ?? '70%'
            )
        );

        $iceLevel = trim(
            (string) (
                $item['ice_level'] ?? '70%'
            )
        );

        $note = mb_substr(
            trim((string) ($item['note'] ?? '')),
            0,
            200
        );

        $toppings = is_array(
            $item['toppings'] ?? null
        )
            ? $item['toppings']
            : [];

        if (
            $productId < 1
            || $quantity < 1
            || $quantity > 99
        ) {
            throw new RuntimeException(
                'Dữ liệu giỏ hàng không hợp lệ.'
            );
        }

        if (!array_key_exists($size, $sizePrices)) {
            throw new RuntimeException(
                'Kích thước sản phẩm không hợp lệ.'
            );
        }

        $productStatement->execute([
            'product_id' => $productId,
        ]);

        $product = $productStatement->fetch();

        if (!$product) {
            throw new RuntimeException(
                'Có sản phẩm không còn được bán.'
            );
        }

        $validToppings = [];
        $toppingTotal = 0;

        foreach ($toppings as $topping) {
            $topping = trim((string) $topping);

            if (
                array_key_exists(
                    $topping,
                    $toppingPrices
                )
            ) {
                $validToppings[] = $topping;
                $toppingTotal +=
                    $toppingPrices[$topping];
            }
        }

        $unitPrice = max(
            0,
            (float) $product['price']
            + $sizePrices[$size]
            + $toppingTotal
        );

        $lineTotal = $unitPrice * $quantity;

        $subtotal += $lineTotal;

        $calculatedItems[] = [
            'product_id' => (int) $product['id'],
            'product_name' => $product['name'],
            'product_image' => $product['image'],
            'unit_price' => $unitPrice,
            'quantity' => $quantity,
            'line_total' => $lineTotal,
            'size' => $size,
            'sugar_level' => $sugarLevel,
            'ice_level' => $iceLevel,
            'toppings' => $validToppings,
            'note' => $note,
        ];
    }

    $couponCode = strtoupper(
        trim(
            (string) (
                $checkout['coupon_code'] ?? ''
            )
        )
    );

    $orderType = $checkout['order_type']
        === 'takeaway'
            ? 'takeaway'
            : 'at_table';

    $tableCode = $orderType === 'at_table'
        ? trim(
            (string) (
                $checkout['table_code'] ?? ''
            )
        )
        : null;

    $orderNote = mb_substr(
        trim(
            (string) ($checkout['note'] ?? '')
        ),
        0,
        300
    );

    $discountAmount =
        $couponCode === 'MOCCOFFEE10'
            ? round($subtotal * 0.10)
            : 0;

    $serviceFee =
        $orderType === 'at_table'
            ? round(
                ($subtotal * 0.05) / 1000
            ) * 1000
            : 0;

    $totalAmount = max(
        0,
        $subtotal
        - $discountAmount
        + $serviceFee
    );

    $paymentStatus =
        $paymentMethod === 'bank_transfer'
            ? 'pending_verification'
            : 'pending';

    /*
     * Tạo mã đơn.
     */
    $orderCode =
        'MC'
        . date('YmdHis')
        . str_pad(
            (string) random_int(0, 9999),
            4,
            '0',
            STR_PAD_LEFT
        );

    /*
     * Thêm đơn hàng.
     */
    $orderStatement = $pdo->prepare(
        "INSERT INTO orders (
            order_code,
            customer_name,
            customer_phone,
            customer_email,
            order_type,
            table_code,
            note,
            coupon_code,
            subtotal,
            discount_amount,
            service_fee,
            total_amount,
            payment_method,
            payment_status,
            status
         ) VALUES (
            :order_code,
            :customer_name,
            :customer_phone,
            :customer_email,
            :order_type,
            :table_code,
            :note,
            :coupon_code,
            :subtotal,
            :discount_amount,
            :service_fee,
            :total_amount,
            :payment_method,
            :payment_status,
            'pending'
         )"
    );

    $orderStatement->execute([
        'order_code' => $orderCode,
        'customer_name' => $customerName,
        'customer_phone' => $customerPhone,
        'customer_email' =>
            $customerEmail !== ''
                ? $customerEmail
                : null,
        'order_type' => $orderType,
        'table_code' => $tableCode,
        'note' =>
            $orderNote !== ''
                ? $orderNote
                : null,
        'coupon_code' =>
            $couponCode !== ''
                ? $couponCode
                : null,
        'subtotal' => $subtotal,
        'discount_amount' => $discountAmount,
        'service_fee' => $serviceFee,
        'total_amount' => $totalAmount,
        'payment_method' => $paymentMethod,
        'payment_status' => $paymentStatus,
    ]);

    $orderId = (int) $pdo->lastInsertId();

    /*
     * Câu lệnh thêm chi tiết đơn.
     */
    $itemStatement = $pdo->prepare(
        "INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            product_image,
            unit_price,
            quantity,
            line_total,
            size,
            sugar_level,
            ice_level,
            toppings,
            note
         ) VALUES (
            :order_id,
            :product_id,
            :product_name,
            :product_image,
            :unit_price,
            :quantity,
            :line_total,
            :size,
            :sugar_level,
            :ice_level,
            :toppings,
            :note
         )"
    );

    foreach ($calculatedItems as $item) {
        $itemStatement->execute([
            'order_id' => $orderId,
            'product_id' => $item['product_id'],
            'product_name' => $item['product_name'],
            'product_image' =>
                $item['product_image'],
            'unit_price' => $item['unit_price'],
            'quantity' => $item['quantity'],
            'line_total' => $item['line_total'],
            'size' => $item['size'],
            'sugar_level' =>
                $item['sugar_level'],
            'ice_level' => $item['ice_level'],
            'toppings' => json_encode(
                $item['toppings'],
                JSON_UNESCAPED_UNICODE
            ),
            'note' =>
                $item['note'] !== ''
                    ? $item['note']
                    : null,
        ]);
    }

    $pdo->commit();

    /*
     * Lưu thông tin để success.php hiển thị.
     */
    $_SESSION['last_order'] = [
        'id' => $orderId,
        'order_code' => $orderCode,
        'customer_name' => $customerName,
        'customer_phone' => $customerPhone,
        'customer_email' => $customerEmail,
        'order_type' => $orderType,
        'table_code' => $tableCode,
        'subtotal' => $subtotal,
        'discount_amount' => $discountAmount,
        'service_fee' => $serviceFee,
        'total_amount' => $totalAmount,
        'payment_method' => $paymentMethod,
        'payment_status' => $paymentStatus,
        'status' => 'pending',
        'items' => $calculatedItems,
    ];

    /*
     * Chỉ xóa giỏ hàng sau khi database thành công.
     */
    $_SESSION['cart'] = [];

    unset($_SESSION['checkout']);

    header(
        'Location: ../pages/success.php'
    );

    exit;
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        'Lỗi tạo đơn hàng PHP: '
        . $exception->getMessage()
    );

    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' =>
            'Không thể tạo đơn hàng. Vui lòng thử lại.',
    ];

    header('Location: ../pages/payment.php');
    exit;
}