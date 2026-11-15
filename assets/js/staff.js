/* Phần dùng chung của các trang nhân viên (/staff): thanh menu theo quyền, đổi mật khẩu, đăng xuất, tiện ích.
   Mỗi trang: <body class="staff-body" data-page="orders.html"> ... <main id="staff-content">
   Trang gọi:  Staff.ready(function (me) { ... })   (me = thông tin + quyền của người đăng nhập)  */
(function () {
    'use strict';
    var A = window.AdminAuth;
    if (!A) return;

    var NAV = [
        { href: 'index.html', icon: 'bi-grid-3x3-gap', text: 'Sơ đồ bàn', perm: 'tables.view' },
        { href: 'new-order.html', icon: 'bi-plus-circle', text: 'Tạo đơn', perm: 'orders.create' },
        { href: 'orders.html', icon: 'bi-receipt', text: 'Đơn hàng', perm: 'orders.view' },
        { href: 'kitchen.html', icon: 'bi-fire', text: 'Màn hình bếp', perm: 'kitchen.view' },
        { href: 'bookings.html', icon: 'bi-calendar2-check', text: 'Đặt bàn', perm: 'bookings.view' }
    ];
    var STATUS_TEXT = {
        pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chế biến',
        ready: 'Sẵn sàng phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy'
    };
    var PAY_TEXT = {
        pending: 'Chưa thanh toán', pending_verification: 'Chờ xác nhận CK', paid: 'Đã thanh toán',
        failed: 'Thất bại', refunded: 'Đã hoàn tiền'
    };

    var me = null;
    var readyCallbacks = [];

    var esc = A.esc;
    function money(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
    function timeText(value) {
        var d = new Date(value);
        return isNaN(d) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    function dateTimeText(value) {
        var d = new Date(value);
        return isNaN(d) ? '' : d.toLocaleString('vi-VN');
    }
    function todayLocal() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function can(permission) { return Boolean(me && me.permissions.indexOf(permission) !== -1); }
    // Được chuyển bàn từ trạng thái `from` sang `to` không (server vẫn kiểm tra lại)
    function canTable(from, to) {
        var rules = (me && me.table_transitions) || {};
        return (rules[from] || []).indexOf(to) !== -1;
    }
    function canSetStatus(status) { return Boolean(me && me.order_statuses.indexOf(status) !== -1); }
    function debounce(fn, ms) {
        var timer = null;
        return function () {
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(null, args); }, ms);
        };
    }
    // Tải lại khi server báo có thay đổi (Socket.IO) + dự phòng theo chu kỳ (giây)
    function autoRefresh(reload, seconds) {
        var run = debounce(reload, 400);
        window.addEventListener('mocCoffeeRealtime', function () { run(); });
        setInterval(function () { if (!document.hidden) reload(); }, (seconds || 30) * 1000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) reload(); });
    }

    function buildShell() {
        var active = document.body.getAttribute('data-page') || '';
        var links = NAV.filter(function (item) { return can(item.perm); }).map(function (item) {
            return '<li class="nav-item"><a class="nav-link' + (item.href === active ? ' active' : '') + '" href="' + item.href + '">' +
                '<i class="bi ' + item.icon + ' me-1"></i>' + item.text + '</a></li>';
        }).join('');

        var header = document.getElementById('staff-header');
        header.className = 'staff-header';
        header.innerHTML =
            '<nav class="navbar navbar-expand-lg navbar-dark">' +
            '<div class="container-fluid">' +
            '<a class="navbar-brand" href="index.html"><i class="bi bi-cup-hot-fill me-2"></i>Mộc Coffee</a>' +
            '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#staff-nav" aria-label="Mở menu"><span class="navbar-toggler-icon"></span></button>' +
            '<div class="collapse navbar-collapse" id="staff-nav">' +
            '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' + links + '</ul>' +
            '<div class="d-flex align-items-center gap-2">' +
            '<div class="staff-user">' + esc(me.full_name) + '<small>' + esc(me.position_text) + '</small></div>' +
            '<div class="dropdown"><button class="btn btn-sm btn-outline-light dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Tài khoản"><i class="bi bi-person-circle"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end">' +
            (me.role === 'admin' ? '<li><a class="dropdown-item" href="../admin/dashboard.html"><i class="bi bi-speedometer2 me-2"></i>Trang quản trị</a></li>' : '') +
            '<li><button type="button" class="dropdown-item" id="staff-change-password"><i class="bi bi-key me-2"></i>Đổi mật khẩu</button></li>' +
            '<li><hr class="dropdown-divider" /></li>' +
            '<li><button type="button" class="dropdown-item text-danger" id="staff-logout"><i class="bi bi-box-arrow-right me-2"></i>Đăng xuất</button></li>' +
            '</ul></div></div></div></div></nav>';

        // Toast (cùng id với trang admin để AdminAuth.toast dùng chung) + hộp thoại đổi mật khẩu
        var extra = document.createElement('div');
        extra.innerHTML =
            '<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index:2000">' +
            '<div id="admin-toast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">' +
            '<div class="toast-header"><i id="admin-toast-icon" class="bi bi-check-circle-fill text-success me-2"></i><strong class="me-auto">Mộc Coffee</strong>' +
            '<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Đóng"></button></div>' +
            '<div id="admin-toast-message" class="toast-body"></div></div></div>' +
            '<div class="modal fade" id="staff-password-modal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered">' +
            '<form id="staff-password-form" class="modal-content border-0" novalidate>' +
            '<div class="modal-header"><h2 class="modal-title h5">Đổi mật khẩu</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>' +
            '<div class="modal-body"><div id="staff-password-alert" class="alert alert-danger d-none"></div>' +
            '<p class="text-secondary small">Không bắt buộc. Sau khi đổi, bạn cần đăng nhập lại.</p>' +
            '<div class="mb-3"><label class="form-label" for="pw-current">Mật khẩu hiện tại</label><input id="pw-current" type="password" class="form-control" autocomplete="current-password" required /></div>' +
            '<div class="mb-3"><label class="form-label" for="pw-new">Mật khẩu mới (8 - 72 ký tự)</label><input id="pw-new" type="password" class="form-control" autocomplete="new-password" minlength="8" maxlength="72" required /></div>' +
            '<div class="mb-0"><label class="form-label" for="pw-confirm">Nhập lại mật khẩu mới</label><input id="pw-confirm" type="password" class="form-control" autocomplete="new-password" required /></div></div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Hủy</button><button type="submit" class="btn btn-coffee">Đổi mật khẩu</button></div>' +
            '</form></div></div>';
        document.body.appendChild(extra);

        document.getElementById('staff-logout').addEventListener('click', function () {
            A.logout();
            location.href = '/pages/account.html#login';
        });
        document.getElementById('staff-change-password').addEventListener('click', function () {
            document.getElementById('staff-password-form').reset();
            document.getElementById('staff-password-alert').classList.add('d-none');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('staff-password-modal')).show();
        });
        document.getElementById('staff-password-form').addEventListener('submit', async function (event) {
            event.preventDefault();
            var alertBox = document.getElementById('staff-password-alert');
            alertBox.classList.add('d-none');
            try {
                await A.api('/api/staff/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        current_password: document.getElementById('pw-current').value,
                        new_password: document.getElementById('pw-new').value,
                        confirm_password: document.getElementById('pw-confirm').value
                    })
                });
                A.clearToken();
                location.href = '/pages/account.html#login';
            } catch (err) {
                alertBox.textContent = err.message;
                alertBox.classList.remove('d-none');
            }
        });
    }

    function showFatal(text) {
        var main = document.getElementById('staff-content');
        if (main) main.innerHTML = '<div class="alert alert-danger">' + esc(text) + '</div>';
    }

    // Mở trang: lấy thông tin + quyền, dựng menu, kiểm tra trang này có được phép không
    async function boot() {
        try {
            var res = await A.api('/api/staff/me');
            me = res.data;
        } catch (err) {
            // 401 đã được AdminAuth chuyển về trang đăng nhập; còn lại (403 = khách hàng) báo lỗi rõ ràng
            showFatal(err.message || 'Không tải được thông tin tài khoản.');
            return;
        }
        buildShell();

        var needs = document.body.getAttribute('data-perm');
        if (needs && !can(needs)) {
            showFatal('Vị trí của bạn không có quyền vào trang này.');
            return;
        }
        readyCallbacks.forEach(function (fn) { fn(me); });
        readyCallbacks = [];
    }

    window.Staff = {
        ready: function (fn) { if (me) fn(me); else readyCallbacks.push(fn); },
        me: function () { return me; },
        can: can,
        canSetStatus: canSetStatus,
        canTable: canTable,
        api: A.api,
        toast: A.toast,
        esc: esc,
        money: money,
        timeText: timeText,
        dateTimeText: dateTimeText,
        todayLocal: todayLocal,
        debounce: debounce,
        autoRefresh: autoRefresh,
        STATUS_TEXT: STATUS_TEXT,
        PAY_TEXT: PAY_TEXT,
        statusBadge: function (status) {
            return '<span class="badge badge-status ' + esc(status) + '">' + esc(STATUS_TEXT[status] || status) + '</span>';
        }
    };

    document.addEventListener('DOMContentLoaded', boot);
})();
