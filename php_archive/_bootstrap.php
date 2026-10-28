<?php

declare(strict_types=1);

/*
 * Nạp session, kết nối database và các hàm dùng chung
 * của phần giao diện khách hàng.
 */
require_once __DIR__ . '/../includes/init.php';

/*
 * Chuyển ký tự đặc biệt thành mã HTML.
 * Dùng khi hiển thị dữ liệu ra giao diện để tránh XSS.
 */
function admin_e(mixed $value): string
{
    return htmlspecialchars(
        (string) $value,
        ENT_QUOTES,
        'UTF-8'
    );
}

/*
 * Chuyển hướng sang một trang khác.
 */
function admin_redirect(string $location): void
{
    header('Location: ' . $location);
    exit;
}

/*
 * Lấy thông tin quản trị viên đang đăng nhập.
 */
function admin_user(): ?array
{
    $user = $_SESSION['admin_user'] ?? null;

    return is_array($user) ? $user : null;
}

/*
 * Bắt buộc phải đăng nhập trước khi xem trang quản trị.
 */
function admin_require_login(): void
{
    if (admin_user() === null) {
        $_SESSION['admin_login_error'] =
            'Vui lòng đăng nhập để truy cập khu vực quản trị.';

        admin_redirect('login.php');
    }
}

/*
 * Tạo mã CSRF dùng để bảo vệ các form.
 */
function admin_csrf_token(): string
{
    if (empty($_SESSION['admin_csrf_token'])) {
        $_SESSION['admin_csrf_token'] =
            bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['admin_csrf_token'];
}

/*
 * Kiểm tra mã CSRF được gửi lên từ form.
 */
function admin_verify_csrf(): void
{
    $submittedToken =
        (string) ($_POST['csrf_token'] ?? '');

    $sessionToken =
        (string) ($_SESSION['admin_csrf_token'] ?? '');

    if (
        $submittedToken === ''
        || $sessionToken === ''
        || !hash_equals($sessionToken, $submittedToken)
    ) {
        http_response_code(419);

        exit(
            'Phiên làm việc không hợp lệ. '
            . 'Vui lòng quay lại và thử lại.'
        );
    }
}

/*
 * Lưu thông báo tạm thời vào session.
 */
function admin_flash(
    string $type,
    string $message
): void {
    $_SESSION['admin_flash'] = [
        'type' => $type,
        'message' => $message,
    ];
}

/*
 * Lấy thông báo và xóa khỏi session.
 */
function admin_take_flash(): ?array
{
    $flash = $_SESSION['admin_flash'] ?? null;

    unset($_SESSION['admin_flash']);

    return is_array($flash) ? $flash : null;
}
/*
 * Định dạng tiền Việt Nam.
 */
function admin_money(
    float|int|string|null $amount
): string {
    return number_format(
        (float) $amount,
        0,
        ',',
        '.'
    ) . ' ₫';
}

/*
 * Định dạng ngày giờ.
 */
function admin_datetime(
    ?string $value,
    string $format = 'd/m/Y H:i'
): string {
    if (!$value) {
        return '—';
    }

    $timestamp = strtotime($value);

    if ($timestamp === false) {
        return '—';
    }

    return date($format, $timestamp);
}

/*
 * Chuyển trạng thái trong database thành tiếng Việt.
 */
function admin_status_text(string $status): string
{
    $labels = [
        'pending' => 'Chờ xử lý',
        'pending_verification' => 'Chờ xác minh',
        'confirmed' => 'Đã xác nhận',
        'preparing' => 'Đang chuẩn bị',
        'ready' => 'Sẵn sàng',
        'completed' => 'Hoàn thành',
        'cancelled' => 'Đã hủy',
        'seated' => 'Đã nhận bàn',
        'available' => 'Bàn trống',
        'occupied' => 'Đang sử dụng',
        'maintenance' => 'Bảo trì',
        'paid' => 'Đã thanh toán',
        'failed' => 'Thất bại',
        'refunded' => 'Đã hoàn tiền',
    ];

    return $labels[$status] ?? $status;
}

/*
 * Chọn màu Bootstrap phù hợp với trạng thái.
 */
function admin_status_class(string $status): string
{
    return match ($status) {
        'completed',
        'confirmed',
        'available',
        'paid' => 'success',

        'preparing',
        'occupied',
        'pending_verification' => 'primary',

        'ready',
        'seated' => 'info',

        'pending',
        'maintenance' => 'warning',

        'cancelled',
        'failed',
        'refunded' => 'danger',

        default => 'secondary',
    };
}
/*
 * Chuyển tên tiếng Việt thành slug.
 * Ví dụ: Cà phê sữa đá -> ca-phe-sua-da
 */
function admin_slug(string $value): string
{
    $map = [
        'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ' => 'a',
        'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ' => 'e',
        'ì|í|ị|ỉ|ĩ' => 'i',
        'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ' => 'o',
        'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ' => 'u',
        'ỳ|ý|ỵ|ỷ|ỹ' => 'y',
        'đ' => 'd',
    ];

    $value = mb_strtolower(
        trim($value),
        'UTF-8'
    );

    foreach ($map as $pattern => $replacement) {
        $value = preg_replace(
            '/(' . $pattern . ')/u',
            $replacement,
            $value
        ) ?? $value;
    }

    $value = preg_replace(
        '/[^a-z0-9]+/',
        '-',
        $value
    ) ?? '';

    return trim($value, '-');
}

/*
 * Tạo slug không trùng trong database.
 */
function admin_unique_slug(
    PDO $pdo,
    string $table,
    string $name,
    ?int $ignoreId = null
): string {
    if (
        !in_array(
            $table,
            ['categories', 'products'],
            true
        )
    ) {
        throw new InvalidArgumentException(
            'Bảng tạo slug không hợp lệ.'
        );
    }

    $base = admin_slug($name);

    if ($base === '') {
        $base = 'moc-coffee';
    }

    $slug = $base;
    $suffix = 2;

    while (true) {
        $sql = "SELECT id
                FROM {$table}
                WHERE slug = :slug";

        $parameters = [
            'slug' => $slug,
        ];

        if ($ignoreId !== null) {
            $sql .= ' AND id <> :id';
            $parameters['id'] = $ignoreId;
        }

        $sql .= ' LIMIT 1';

        $statement = $pdo->prepare($sql);
        $statement->execute($parameters);

        if (!$statement->fetch()) {
            return $slug;
        }

        $slug = $base . '-' . $suffix;
        $suffix++;
    }
}

/*
 * Xác định đường dẫn hiển thị ảnh sản phẩm.
 */
function admin_product_image(?string $image): string
{
    $image = trim((string) $image);

    if ($image === '') {
        return '../assets/images/products/default-product.jpg';
    }

    if (preg_match('#^https?://#i', $image)) {
        return $image;
    }

    if (
        str_starts_with(
            $image,
            '/uploads/products/'
        )
    ) {
        return '../backend' . $image;
    }

    if (
        str_starts_with(
            $image,
            'uploads/products/'
        )
    ) {
        return '../backend/' . $image;
    }

    if (str_contains($image, '/')) {
        return '../' . ltrim($image, '/');
    }

    return '../assets/images/products/'
        . rawurlencode($image);
}
/*
 * Tạo mã tự động.
 * Ví dụ: BK202610131315301234
 */
function admin_generate_code(string $prefix): string
{
    return $prefix
        . date('YmdHis')
        . random_int(1000, 9999);
}