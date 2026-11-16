/* Phần dùng chung của các trang nhân viên (/staff): thanh menu theo quyền, đổi mật khẩu, đăng xuất, tiện ích.
   Mỗi trang: <body class="staff-body" data-page="orders.html"> ... <main id="staff-content">
   Trang gọi:  Staff.ready(function (me) { ... })   (me = thông tin + quyền của người đăng nhập)  */
(function () {
    'use strict';
    var A = window.AdminAuth;
    if (!A) return;

    var NAV = [
        { href: 'index.html', icon: 'bi-grid-3x3-gap', text: 'Sơ đồ bàn', perm: 'tables.view', group: 'Phục vụ' },
        { href: 'new-order.html', icon: 'bi-plus-circle', text: 'Tạo đơn', perm: 'orders.create', group: 'Phục vụ' },
        { href: 'orders.html', icon: 'bi-receipt', text: 'Đơn hàng', perm: 'orders.view', group: 'Phục vụ' },
        { href: 'kitchen.html', icon: 'bi-fire', text: 'Màn hình bếp', perm: 'kitchen.view', group: 'Phục vụ' },
        { href: 'bookings.html', icon: 'bi-calendar2-check', text: 'Đặt bàn', perm: 'bookings.view', group: 'Phục vụ' },
        { href: 'menu.html', icon: 'bi-slash-circle', text: 'Hết món', perm: 'products.soldout', group: 'Quản lý' },
        { href: 'revenue.html', icon: 'bi-graph-up-arrow', text: 'Doanh thu', perm: 'revenue.view', group: 'Quản lý' }
    ];
    var NAV_EXTRA = [
        { href: '../index.html', icon: 'bi-globe', text: 'Xem trang khách hàng' }
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

    // ----- Âm báo + thông báo "món sẵn sàng" (bếp bấm "Xong món" -> phục vụ nhận ngay) -----
    var audioCtx = null;
    function soundOn() {
        try { return localStorage.getItem('mocStaffSound') !== '0'; } catch (e) { return true; }
    }
    function beep(freq, times) {
        if (!soundOn()) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            for (var i = 0; i < (times || 1); i++) {
                var osc = audioCtx.createOscillator();
                var gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq || 880;
                gain.gain.value = 0.15;
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                var t = audioCtx.currentTime + i * 0.32;
                osc.start(t);
                osc.stop(t + 0.22);
            }
        } catch (e) { /* trình duyệt chặn âm thanh khi chưa tương tác: bỏ qua */ }
    }
    function listenReady() {
        window.addEventListener('mocCoffeeRealtime', function (event) {
            var d = event.detail || {};
            if (d.event !== 'order:ready') return;
            var info = d.data || {};
            var where = info.order_type === 'at_table' && info.table_code ? 'Bàn ' + info.table_code : 'Đơn mang đi';
            A.toast('Món đã xong: ' + where + ' - mang ra phục vụ.');
            beep(1040, 2);
        });
    }

    function initials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'NV';
        return (parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : parts[0].charAt(0)).toUpperCase();
    }

    function menuItems(items, active) {
        return items.map(function (item) {
            return '<li><a href="' + item.href + '"' + (item.href === active ? ' class="active" aria-current="page"' : '') + '>' +
                '<i class="bi ' + item.icon + '"></i><span>' + esc(item.text) + '</span></a></li>';
        }).join('');
    }

    // Trên điện thoại bảng danh sách chuyển thành dạng thẻ: gắn nhãn cột vào từng ô để CSS hiển thị.
    function labelTableCells(table) {
        var labels = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
            return th.textContent.trim();
        });
        var body = table.tBodies[0];
        if (!labels.length || !body) return;
        table.classList.add('staff-table-cards');
        function paint() {
            Array.prototype.forEach.call(body.rows, function (tr) {
                Array.prototype.forEach.call(tr.cells, function (td, i) {
                    td.setAttribute('data-label', labels[i] || '');
                });
            });
        }
        paint();
        new MutationObserver(paint).observe(body, { childList: true });
    }

    function buildShell(pageTitle) {
        var active = document.body.getAttribute('data-page') || '';
        var allowed = NAV.filter(function (item) { return can(item.perm); });
        var groups = [];
        allowed.forEach(function (item) {
            var group = groups.filter(function (g) { return g.name === item.group; })[0];
            if (!group) groups.push({ name: item.group, items: [item] });
            else group.items.push(item);
        });
        var nav = groups.map(function (g) {
            return '<p class="staff-nav-title">' + esc(g.name) + '</p><ul>' + menuItems(g.items, active) + '</ul>';
        }).join('') + '<p class="staff-nav-title">Khác</p><ul>' + menuItems(NAV_EXTRA, active) +
            '<li><button type="button" class="staff-nav-btn text-danger" id="staff-logout"><i class="bi bi-box-arrow-right"></i><span>Đăng xuất</span></button></li></ul>';

        var wrap = document.getElementById('staff-shell');
        wrap.innerHTML =
            '<div class="staff-sidebar-overlay" id="staff-sidebar-overlay"></div>' +
            '<aside class="staff-sidebar" id="staff-sidebar" aria-label="Menu nhân viên">' +
            '<div class="staff-sidebar-header"><a href="index.html" class="staff-logo"><i class="bi bi-cup-hot-fill"></i><span>Mộc Coffee</span></a>' +
            '<button type="button" id="staff-close-sidebar" class="btn text-white d-lg-none" aria-label="Đóng menu"><i class="bi bi-x-lg"></i></button></div>' +
            '<div class="staff-user-box"><div class="staff-avatar">' + esc(initials(me.full_name)) + '</div>' +
            '<div><strong>' + esc(me.full_name) + '</strong><small>' + esc(me.position_text) + '</small></div></div>' +
            '<nav class="staff-nav">' + nav + '</nav></aside>' +
            '<header class="staff-topbar">' +
            '<div class="d-flex align-items-center gap-2 min-w-0">' +
            '<button type="button" id="staff-open-sidebar" class="btn btn-light d-lg-none" aria-label="Mở menu"><i class="bi bi-list fs-4"></i></button>' +
            '<div class="staff-topbar-title"><h1 id="staff-page-title">' + esc(pageTitle) + '</h1></div>' +
            '</div>' +
            '<div class="dropdown">' +
            '<button class="btn btn-light dropdown-toggle d-flex align-items-center gap-1" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
            '<span class="staff-avatar staff-avatar-sm">' + esc(initials(me.full_name)) + '</span>' +
            '<span class="d-none d-md-inline staff-account-name">' + esc(me.full_name) + '</span></button>' +
            '<ul class="dropdown-menu dropdown-menu-end">' +
            '<li><h6 class="dropdown-header">' + esc(me.full_name) + ' · ' + esc(me.position_text) + '</h6></li>' +
            (me.role === 'admin' ? '<li><a class="dropdown-item" href="../admin/dashboard.html"><i class="bi bi-speedometer2 me-2"></i>Trang quản trị</a></li>' : '') +
            '<li><button type="button" class="dropdown-item" id="staff-sound"><i class="bi me-2"></i><span></span></button></li>' +
            '<li><button type="button" class="dropdown-item" id="staff-change-password"><i class="bi bi-key me-2"></i>Đổi mật khẩu</button></li>' +
            '<li><hr class="dropdown-divider" /></li>' +
            '<li><button type="button" class="dropdown-item text-danger" id="staff-logout-menu"><i class="bi bi-box-arrow-right me-2"></i>Đăng xuất</button></li>' +
            '</ul></div></header>';

        // Nội dung trang: tiêu đề đã lên topbar nên bỏ phần mô tả lớn ở đầu trang
        var content = document.getElementById('staff-content');
        var lead = content.querySelector(':scope > .d-flex.flex-wrap.justify-content-between.align-items-center, :scope > .d-flex.flex-column.flex-md-row');
        if (lead) {
            lead.classList.add('staff-lead');
            var heading = lead.querySelector('h1, h2');
            if (heading) {
                heading.classList.add('d-none');
                // Tiêu đề trang đổi theo thao tác (VD: "Gọi món · Bàn 5") -> hiện lên topbar
                new MutationObserver(function () {
                    document.getElementById('staff-page-title').textContent = heading.textContent.trim();
                }).observe(heading, { childList: true, characterData: true, subtree: true });
            }
            var paragraph = lead.querySelector('p');
            if (paragraph) paragraph.classList.add('staff-page-note');
        }

        content.querySelectorAll('table.staff-table-list').forEach(labelTableCells);

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

        // ----- Menu trên điện thoại: mở/đóng sidebar -----
        var sidebar = document.getElementById('staff-sidebar');
        var overlay = document.getElementById('staff-sidebar-overlay');
        function openSidebar() {
            sidebar.classList.add('show');
            overlay.classList.add('show');
            document.body.classList.add('staff-sidebar-open');
        }
        function closeSidebar() {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            document.body.classList.remove('staff-sidebar-open');
        }
        document.getElementById('staff-open-sidebar').addEventListener('click', openSidebar);
        document.getElementById('staff-close-sidebar').addEventListener('click', closeSidebar);
        overlay.addEventListener('click', closeSidebar);
        sidebar.addEventListener('click', function (event) {
            if (event.target.closest('a')) closeSidebar();
        });
        window.addEventListener('resize', function () { if (window.innerWidth >= 992) closeSidebar(); });

        function paintSound() {
            var on = soundOn();
            document.querySelector('#staff-sound i').className = 'bi me-2 ' + (on ? 'bi-bell' : 'bi-bell-slash');
            document.querySelector('#staff-sound span').textContent = 'Âm báo: ' + (on ? 'bật' : 'tắt');
        }
        paintSound();
        document.getElementById('staff-sound').addEventListener('click', function (event) {
            event.stopPropagation();
            try { localStorage.setItem('mocStaffSound', soundOn() ? '0' : '1'); } catch (e) { /* bỏ qua */ }
            paintSound();
        });
        var logout = function () {
            A.logout();
            location.href = '/pages/account.html#login';
        };
        document.getElementById('staff-logout').addEventListener('click', logout);
        document.getElementById('staff-logout-menu').addEventListener('click', logout);
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

    function pageTitle() {
        var custom = document.body.getAttribute('data-title');
        if (custom) return custom;
        var page = document.body.getAttribute('data-page') || '';
        var item = NAV.filter(function (n) { return n.href === page; })[0];
        if (item) return item.text;
        return String(document.title || '').replace(/\s*-\s*Mộc Coffee$/, '');
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
        buildShell(pageTitle());

        var needs = document.body.getAttribute('data-perm');
        if (needs && !can(needs)) {
            showFatal('Vị trí của bạn không có quyền vào trang này.');
            return;
        }
        listenReady();
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
        beep: beep,
        autoRefresh: autoRefresh,
        STATUS_TEXT: STATUS_TEXT,
        PAY_TEXT: PAY_TEXT,
        statusBadge: function (status) {
            return '<span class="badge badge-status ' + esc(status) + '">' + esc(STATUS_TEXT[status] || status) + '</span>';
        }
    };

    document.addEventListener('DOMContentLoaded', boot);
})();
