<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

/*
 * Nếu đã đăng nhập thì không cần xem lại trang login.
 */
if (admin_user() !== null) {
    admin_redirect('dashboard.php');
}

/*
 * Lấy thông báo đăng nhập từ session, nếu có.
 */
$error = (string) (
    $_SESSION['admin_login_error'] ?? ''
);

unset($_SESSION['admin_login_error']);

$email = '';

/*
 * Xử lý khi người dùng nhấn nút Đăng nhập.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();

    $email = strtolower(
        trim((string) ($_POST['email'] ?? ''))
    );

    $password =
        (string) ($_POST['password'] ?? '');

    /*
     * Kiểm tra dữ liệu form.
     */
    if (
        !filter_var($email, FILTER_VALIDATE_EMAIL)
        || $password === ''
    ) {
        $error =
            'Vui lòng nhập đúng email và mật khẩu.';
    } else {
        /*
         * Tìm người dùng theo email.
         */
        $statement = $pdo->prepare(
            'SELECT
                id,
                full_name,
                email,
                password_hash,
                role,
                status
             FROM users
             WHERE email = :email
             LIMIT 1'
        );

        $statement->execute([
            'email' => $email,
        ]);

        $user = $statement->fetch();

        /*
         * Kiểm tra:
         * - Tài khoản tồn tại
         * - Có role admin
         * - Đang hoạt động
         * - Mật khẩu chính xác
         */
        if (
            !$user
            || (string) $user['role'] !== 'admin'
            || (int) $user['status'] !== 1
            || !password_verify(
                $password,
                (string) $user['password_hash']
            )
        ) {
            $error =
                'Email hoặc mật khẩu quản trị không chính xác.';
        } else {
            /*
             * Đăng nhập thành công.
             */
            session_regenerate_id(true);

            $_SESSION['admin_user'] = [
                'id' => (int) $user['id'],
                'full_name' =>
                    (string) $user['full_name'],
                'email' =>
                    (string) $user['email'],
                'role' =>
                    (string) $user['role'],
            ];

            admin_flash(
                'success',
                'Đăng nhập thành công. '
                . 'Chào mừng bạn quay lại!'
            );

            admin_redirect('dashboard.php');
        }
    }
}
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
        content="Đăng nhập khu vực quản trị Mộc Coffee"
    >

    <title>
        Đăng nhập quản trị - Mộc Coffee
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

<body class="admin-login-body">

<main class="admin-login-page">
    <div class="container-fluid">
        <div class="row min-vh-100">

            <!-- Phần giới thiệu bên trái -->
            <section
                class="col-12 col-lg-6 admin-login-cover d-none d-lg-flex"
            >
                <div class="admin-login-overlay"></div>

                <div class="admin-login-introduction">

                    <a
                        href="../index.php"
                        class="admin-login-logo"
                    >
                        <i class="bi bi-cup-hot-fill"></i>

                        <span>Mộc Coffee</span>
                    </a>

                    <div class="my-auto">
                        <p
                            class="text-uppercase fw-semibold mb-2"
                        >
                            Hệ thống quản lý quán cà phê
                        </p>

                        <h1 class="display-5 fw-bold">
                            Quản lý hoạt động của quán
                            tại một nơi
                        </h1>

                        <p class="lead mt-3 mb-4">
                            Theo dõi sản phẩm, đơn hàng,
                            đặt bàn, sơ đồ bàn và thanh toán
                            bằng dữ liệu MySQL.
                        </p>

                        <div class="login-feature-list">

                            <div class="login-feature-item">
                                <div class="login-feature-icon">
                                    <i class="bi bi-cup-straw"></i>
                                </div>

                                <div>
                                    <strong>
                                        Quản lý thực đơn
                                    </strong>

                                    <small>
                                        Thêm, sửa, ẩn và tìm kiếm món
                                    </small>
                                </div>
                            </div>

                            <div class="login-feature-item">
                                <div class="login-feature-icon">
                                    <i class="bi bi-receipt"></i>
                                </div>

                                <div>
                                    <strong>
                                        Quản lý đơn hàng
                                    </strong>

                                    <small>
                                        Cập nhật quy trình phục vụ khách
                                    </small>
                                </div>
                            </div>

                            <div class="login-feature-item">
                                <div class="login-feature-icon">
                                    <i class="bi bi-calendar-check"></i>
                                </div>

                                <div>
                                    <strong>
                                        Quản lý đặt bàn
                                    </strong>

                                    <small>
                                        Theo dõi lịch đặt và trạng thái bàn
                                    </small>
                                </div>
                            </div>

                        </div>
                    </div>

                    <p class="mb-0 text-white-50">
                        &copy;
                        <?= date('Y') ?>
                        Mộc Coffee.
                    </p>
                </div>
            </section>

            <!-- Form đăng nhập bên phải -->
            <section
                class="col-12 col-lg-6 d-flex align-items-center justify-content-center admin-login-form-section"
            >
                <div class="admin-login-form-wrapper">

                    <!-- Logo trên màn hình nhỏ -->
                    <div class="text-center d-lg-none mb-4">
                        <a
                            href="../index.php"
                            class="navbar-brand fs-3 fw-bold"
                        >
                            <i
                                class="bi bi-cup-hot-fill me-2"
                            ></i>

                            Mộc Coffee
                        </a>
                    </div>

                    <!-- Quay về website khách hàng -->
                    <div class="mb-4">
                        <a
                            href="../index.php"
                            class="text-secondary text-decoration-none"
                        >
                            <i
                                class="bi bi-arrow-left me-1"
                            ></i>

                            Quay về trang khách hàng
                        </a>
                    </div>

                    <!-- Tiêu đề -->
                    <div class="mb-4">
                        <p
                            class="text-uppercase text-secondary fw-semibold mb-2"
                        >
                            Khu vực quản trị
                        </p>

                        <h2 class="display-6 fw-bold mb-2">
                            Đăng nhập
                        </h2>

                        <p class="text-secondary mb-0">
                            Sử dụng tài khoản có vai trò
                            <code>admin</code>.
                        </p>
                    </div>

                    <!-- Thông báo lỗi -->
                    <?php if ($error !== ''): ?>
                        <div
                            class="alert alert-danger"
                            role="alert"
                        >
                            <i
                                class="bi bi-exclamation-circle-fill me-2"
                            ></i>

                            <?= admin_e($error) ?>
                        </div>
                    <?php endif; ?>

                    <!-- Form đăng nhập -->
                    <form
                        method="post"
                        action="login.php"
                    >
                        <input
                            type="hidden"
                            name="csrf_token"
                            value="<?= admin_e(admin_csrf_token()) ?>"
                        >

                        <div class="mb-3">
                            <label
                                for="login-email"
                                class="form-label fw-semibold"
                            >
                                Email quản trị
                            </label>

                            <div
                                class="input-group login-input-group"
                            >
                                <span
                                    class="input-group-text bg-white"
                                >
                                    <i class="bi bi-envelope"></i>
                                </span>

                                <input
                                    type="email"
                                    id="login-email"
                                    name="email"
                                    class="form-control"
                                    value="<?= admin_e($email) ?>"
                                    placeholder="admin@moccoffee.local"
                                    autocomplete="username"
                                    required
                                    autofocus
                                >
                            </div>
                        </div>

                        <div class="mb-4">
                            <label
                                for="login-password"
                                class="form-label fw-semibold"
                            >
                                Mật khẩu
                            </label>

                            <div
                                class="input-group login-input-group"
                            >
                                <span
                                    class="input-group-text bg-white"
                                >
                                    <i class="bi bi-lock"></i>
                                </span>

                                <input
                                    type="password"
                                    id="login-password"
                                    name="password"
                                    class="form-control"
                                    placeholder="Nhập mật khẩu"
                                    minlength="6"
                                    autocomplete="current-password"
                                    required
                                >

                                <button
                                    type="button"
                                    id="toggle-password"
                                    class="btn btn-outline-secondary"
                                    aria-label="Hiện mật khẩu"
                                >
                                    <i class="bi bi-eye"></i>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            class="btn btn-coffee btn-lg w-100"
                        >
                            <i
                                class="bi bi-box-arrow-in-right me-1"
                            ></i>

                            Đăng nhập
                        </button>
                    </form>
                </div>
            </section>

        </div>
    </div>
</main>

<script>
    const togglePassword =
        document.getElementById('toggle-password');

    togglePassword?.addEventListener(
        'click',
        function () {
            const input =
                document.getElementById('login-password');

            const icon =
                this.querySelector('i');

            const isPassword =
                input.type === 'password';

            input.type =
                isPassword ? 'text' : 'password';

            icon.className =
                isPassword
                    ? 'bi bi-eye-slash'
                    : 'bi bi-eye';
        }
    );
</script>

</body>
</html>