<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/init.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../pages/booking.php');
    exit;
}

/*
 * Nhận dữ liệu.
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

$bookingDate = trim(
    (string) ($_POST['booking_date'] ?? '')
);

$bookingTime = trim(
    (string) ($_POST['booking_time'] ?? '')
);

$tableId = filter_input(
    INPUT_POST,
    'table_id',
    FILTER_VALIDATE_INT
);

$guestCount = filter_input(
    INPUT_POST,
    'guest_count',
    FILTER_VALIDATE_INT
);

$note = mb_substr(
    trim((string) ($_POST['note'] ?? '')),
    0,
    300
);

$acceptedPolicy =
    ($_POST['booking_policy'] ?? '') === '1';

/*
 * Lưu lại dữ liệu nếu có lỗi.
 */
$_SESSION['booking_old'] = [
    'customer_name' => $customerName,
    'customer_phone' => $customerPhone,
    'customer_email' => $customerEmail,
    'booking_date' => $bookingDate,
    'booking_time' => $bookingTime,
    'table_id' => $tableId,
    'guest_count' => $guestCount,
    'note' => $note,
];

/*
 * Hàm quay lại trang đặt bàn khi có lỗi.
 */
$redirectWithError = static function (
    string $message
): never {
    $_SESSION['flash'] = [
        'type' => 'danger',
        'message' => $message,
    ];

    header('Location: ../pages/booking.php');
    exit;
};

/*
 * Kiểm tra dữ liệu.
 */
if (mb_strlen($customerName) < 2) {
    $redirectWithError(
        'Họ tên phải có ít nhất 2 ký tự.'
    );
}

if (!preg_match('/^0[0-9]{9}$/', $customerPhone)) {
    $redirectWithError(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
    );
}

if (
    $customerEmail !== ''
    && !filter_var(
        $customerEmail,
        FILTER_VALIDATE_EMAIL
    )
) {
    $redirectWithError('Email không hợp lệ.');
}

if (!$tableId || $tableId < 1) {
    $redirectWithError('Vui lòng chọn bàn.');
}

if (
    !$guestCount
    || $guestCount < 1
    || $guestCount > 20
) {
    $redirectWithError(
        'Số lượng khách phải từ 1 đến 20.'
    );
}

/*
 * Kiểm tra ngày giờ.
 */
$timezone = new DateTimeZone(
    'Asia/Ho_Chi_Minh'
);

$bookingDateTime =
    DateTimeImmutable::createFromFormat(
        'Y-m-d H:i',
        $bookingDate . ' ' . $bookingTime,
        $timezone
    );

if (
    !$bookingDateTime
    || $bookingDateTime->format('Y-m-d H:i')
        !== $bookingDate . ' ' . $bookingTime
) {
    $redirectWithError(
        'Ngày hoặc giờ đặt bàn không hợp lệ.'
    );
}

$now = new DateTimeImmutable(
    'now',
    $timezone
);

if ($bookingDateTime <= $now) {
    $redirectWithError(
        'Thời gian đặt bàn phải nằm trong tương lai.'
    );
}

/*
 * Giờ hoạt động từ 07:00 đến 22:00.
 */
$bookingHourMinute =
    $bookingDateTime->format('H:i');

if (
    $bookingHourMinute < '07:00'
    || $bookingHourMinute > '22:00'
) {
    $redirectWithError(
        'Quán nhận đặt bàn từ 07:00 đến 22:00.'
    );
}

if (!$acceptedPolicy) {
    $redirectWithError(
        'Bạn cần đồng ý với chính sách đặt bàn.'
    );
}

try {
    $pdo->beginTransaction();

    /*
     * Khóa dòng bàn trong quá trình kiểm tra.
     */
    $tableStatement = $pdo->prepare(
        "SELECT
            id,
            table_code,
            table_name,
            capacity,
            area,
            status
         FROM coffee_tables
         WHERE id = :table_id
         LIMIT 1
         FOR UPDATE"
    );

    $tableStatement->execute([
        'table_id' => $tableId,
    ]);

    $table = $tableStatement->fetch();

    if (!$table) {
        throw new RuntimeException(
            'Bàn không tồn tại.'
        );
    }

    if ($table['status'] !== 'available') {
        throw new RuntimeException(
            'Bàn đang tạm ngừng phục vụ.'
        );
    }

    if ($guestCount > (int) $table['capacity']) {
        throw new RuntimeException(
            'Số khách vượt quá sức chứa của bàn.'
        );
    }

    /*
     * Không cho đặt trùng bàn trong khoảng hai giờ.
     */
    $conflictStatement = $pdo->prepare(
        "SELECT COUNT(*)
         FROM bookings
         WHERE table_id = :table_id
           AND booking_date = :booking_date
           AND status IN ('pending', 'confirmed')
           AND ABS(
               TIMESTAMPDIFF(
                   MINUTE,
                   booking_time,
                   :booking_time
               )
           ) < 120"
    );

    $conflictStatement->execute([
        'table_id' => $tableId,
        'booking_date' => $bookingDate,
        'booking_time' => $bookingTime,
    ]);

    $conflictCount = (int) (
        $conflictStatement->fetchColumn()
    );

    if ($conflictCount > 0) {
        throw new RuntimeException(
            'Bàn đã được đặt trong khung giờ này. Vui lòng chọn bàn hoặc giờ khác.'
        );
    }

    /*
     * Tạo mã đặt bàn.
     */
    $bookingCode =
        'BK'
        . date('YmdHis')
        . str_pad(
            (string) random_int(0, 9999),
            4,
            '0',
            STR_PAD_LEFT
        );

    /*
     * Thêm phiếu đặt bàn.
     */
    $insertStatement = $pdo->prepare(
        "INSERT INTO bookings (
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
            'pending'
         )"
    );

    $insertStatement->execute([
        'booking_code' => $bookingCode,
        'table_id' => $tableId,
        'customer_name' => $customerName,
        'customer_phone' => $customerPhone,
        'customer_email' =>
            $customerEmail !== ''
                ? $customerEmail
                : null,
        'booking_date' => $bookingDate,
        'booking_time' => $bookingTime,
        'guest_count' => $guestCount,
        'note' =>
            $note !== ''
                ? $note
                : null,
    ]);

    $bookingId = (int) $pdo->lastInsertId();

    $pdo->commit();

    /*
     * Lưu kết quả để booking.php hiển thị.
     */
    $_SESSION['booking_success'] = [
        'id' => $bookingId,
        'booking_code' => $bookingCode,
        'table_code' => $table['table_code'],
        'table_name' => $table['table_name'],
        'area' => $table['area'],
        'customer_name' => $customerName,
        'customer_phone' => $customerPhone,
        'customer_email' => $customerEmail,
        'booking_date' => $bookingDate,
        'booking_time' => $bookingTime,
        'guest_count' => $guestCount,
        'status' => 'pending',
    ];

    unset($_SESSION['booking_old']);

    header(
        'Location: ../pages/booking.php?success=1'
    );

    exit;
} catch (RuntimeException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $redirectWithError(
        $exception->getMessage()
    );
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        'Lỗi đặt bàn PHP: '
        . $exception->getMessage()
    );

    $redirectWithError(
        'Không thể đặt bàn. Vui lòng thử lại.'
    );
}