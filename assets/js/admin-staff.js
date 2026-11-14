/* Trang admin/staff.html: tạo, sửa, khóa/mở khóa, đặt lại mật khẩu nhân viên và xem nhật ký thao tác. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;
    var API = '/api/admin/staff';
    var DOMAIN = '@moccoffee.local';
    var POSITION = { waiter: 'Phục vụ', cashier: 'Thu ngân', kitchen: 'Bếp' };
    var ACTION_TEXT = {
        'order.create': 'Tạo đơn', 'order.edit': 'Sửa đơn', 'order.status': 'Đổi trạng thái đơn',
        'order.payment': 'Xác nhận thanh toán', 'table.status': 'Đổi trạng thái bàn',
        'booking.status': 'Đổi trạng thái đặt bàn', 'staff.create': 'Tạo nhân viên',
        'staff.update': 'Sửa nhân viên', 'staff.lock': 'Khóa tài khoản', 'staff.unlock': 'Mở khóa tài khoản',
        'staff.reset_password': 'Đặt lại mật khẩu', 'account.password': 'Đổi mật khẩu'
    };

    var body = document.getElementById('staff-table-body');
    if (!body) return;

    var search = document.getElementById('staff-search');
    var positionFilter = document.getElementById('staff-position-filter');
    var statusFilter = document.getElementById('staff-status-filter');
    var formModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('staff-form-modal'));
    var resetModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('staff-reset-modal'));
    var logsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('staff-logs-modal'));
    var form = document.getElementById('staff-form');
    var formAlert = document.getElementById('staff-form-alert');
    var resetForm = document.getElementById('staff-reset-form');
    var resetAlert = document.getElementById('staff-reset-alert');
    var all = [];
    var editingId = null;
    var resettingId = null;

    function esc(v) { return A.esc(v); }
    function fmtTime(s) {
        var d = new Date(s);
        return isNaN(d) ? '' : d.toLocaleString('vi-VN');
    }
    function showAlert(el, text) {
        el.textContent = text;
        el.classList.toggle('d-none', !text);
    }
    function randomPassword() {
        // Bỏ các ký tự dễ nhầm (0/O, 1/l/I) để nhân viên gõ lại không sai
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        var bytes = new Uint32Array(10);
        crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (b) { return chars[b % chars.length]; }).join('');
    }

    function stats() {
        var active = all.filter(function (s) { return Number(s.status) === 1; }).length;
        document.getElementById('staff-total').textContent = all.length;
        document.getElementById('staff-active').textContent = active;
        document.getElementById('staff-locked').textContent = all.length - active;
    }

    function render() {
        var q = (search.value || '').trim().toLowerCase();
        var list = all.filter(function (s) {
            if (positionFilter.value !== 'all' && s.staff_position !== positionFilter.value) return false;
            if (statusFilter.value !== 'all' && String(s.status) !== statusFilter.value) return false;
            if (q && (s.full_name + ' ' + s.email + ' ' + (s.phone || '')).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
        if (!list.length) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Chưa có nhân viên nào phù hợp.</td></tr>';
            return;
        }
        body.innerHTML = list.map(function (s) {
            var active = Number(s.status) === 1;
            return '<tr>' +
                '<td class="fw-semibold">' + esc(s.full_name) + '</td>' +
                '<td>' + esc(s.email) + '</td>' +
                '<td>' + esc(s.phone || '—') + '</td>' +
                '<td><span class="badge text-bg-light border">' + esc(POSITION[s.staff_position] || '—') + '</span></td>' +
                '<td>' + (active
                    ? '<span class="badge text-bg-success">Hoạt động</span>'
                    : '<span class="badge text-bg-secondary">Đã khóa</span>') + '</td>' +
                '<td class="text-end text-nowrap">' +
                '<button type="button" class="btn btn-sm btn-outline-secondary me-1" data-act="edit" data-id="' + esc(s.id) + '" title="Sửa"><i class="bi bi-pencil"></i></button>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary me-1" data-act="reset" data-id="' + esc(s.id) + '" title="Đặt lại mật khẩu"><i class="bi bi-key"></i></button>' +
                '<button type="button" class="btn btn-sm ' + (active ? 'btn-outline-danger' : 'btn-outline-success') + '" data-act="toggle" data-id="' + esc(s.id) + '" title="' + (active ? 'Khóa' : 'Mở khóa') + '">' +
                '<i class="bi ' + (active ? 'bi-lock' : 'bi-unlock') + '"></i></button>' +
                '</td></tr>';
        }).join('');
    }

    async function load() {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Đang tải...</td></tr>';
        try {
            var res = await A.api(API);
            all = res.data || [];
            stats();
            render();
        } catch (err) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Không tải được danh sách nhân viên.</td></tr>';
            A.toast(err.message, 'error');
        }
    }

    function openForm(staff) {
        editingId = staff ? staff.id : null;
        form.reset();
        showAlert(formAlert, '');
        document.getElementById('staff-form-title').textContent = staff ? 'Sửa nhân viên' : 'Thêm nhân viên';
        // Email và mật khẩu chỉ nhập lúc tạo; sau đó dùng nút "đặt lại mật khẩu"
        document.getElementById('sf-email-group').classList.toggle('d-none', Boolean(staff));
        document.getElementById('sf-password-group').classList.toggle('d-none', Boolean(staff));
        document.getElementById('sf-username').required = !staff;
        document.getElementById('sf-password').required = !staff;
        if (staff) {
            document.getElementById('sf-name').value = staff.full_name || '';
            document.getElementById('sf-phone').value = staff.phone || '';
            document.getElementById('sf-position').value = staff.staff_position || 'waiter';
        } else {
            document.getElementById('sf-password').value = randomPassword();
        }
        formModal.show();
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        showAlert(formAlert, '');
        var submit = form.querySelector('[type="submit"]');
        var payload = {
            full_name: document.getElementById('sf-name').value.trim(),
            phone: document.getElementById('sf-phone').value.trim(),
            staff_position: document.getElementById('sf-position').value
        };
        if (!editingId) {
            var username = document.getElementById('sf-username').value.trim().toLowerCase();
            if (!/^[a-z0-9._-]{2,60}$/.test(username)) {
                return showAlert(formAlert, 'Tên đăng nhập chỉ gồm chữ thường (không dấu), số, dấu chấm, gạch ngang hoặc gạch dưới.');
            }
            payload.email = username + DOMAIN;
            payload.password = document.getElementById('sf-password').value;
        }
        submit.disabled = true;
        try {
            var res = await A.api(editingId ? API + '/' + encodeURIComponent(editingId) : API, {
                method: editingId ? 'PATCH' : 'POST',
                body: JSON.stringify(payload)
            });
            formModal.hide();
            A.toast(res.message);
            if (!editingId) {
                // Hiện lại thông tin đăng nhập một lần để admin gửi cho nhân viên
                window.alert('Tài khoản đã tạo.\n\nEmail đăng nhập: ' + payload.email + '\nMật khẩu tạm: ' + payload.password + '\n\nHãy gửi thông tin này cho nhân viên.');
            }
            await load();
        } catch (err) {
            showAlert(formAlert, err.message);
        } finally {
            submit.disabled = false;
        }
    });

    resetForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        showAlert(resetAlert, '');
        var password = document.getElementById('reset-password').value;
        try {
            var res = await A.api(API + '/' + encodeURIComponent(resettingId) + '/reset-password', {
                method: 'POST',
                body: JSON.stringify({ password: password })
            });
            resetModal.hide();
            A.toast(res.message);
            window.alert('Mật khẩu tạm mới: ' + password + '\n\nHãy gửi cho nhân viên.');
        } catch (err) {
            showAlert(resetAlert, err.message);
        }
    });

    body.addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-act]');
        if (!btn) return;
        var staff = all.filter(function (s) { return String(s.id) === btn.dataset.id; })[0];
        if (!staff) return;

        if (btn.dataset.act === 'edit') return openForm(staff);

        if (btn.dataset.act === 'reset') {
            resettingId = staff.id;
            showAlert(resetAlert, '');
            document.getElementById('reset-staff-name').textContent = staff.full_name + ' (' + staff.email + ')';
            document.getElementById('reset-password').value = randomPassword();
            return resetModal.show();
        }

        if (btn.dataset.act === 'toggle') {
            var lock = Number(staff.status) === 1;
            window.MocConfirm.show({
                title: lock ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
                message: lock
                    ? staff.full_name + ' sẽ bị đăng xuất và không đăng nhập được cho đến khi bạn mở khóa.'
                    : staff.full_name + ' sẽ đăng nhập lại được.',
                danger: lock,
                confirmText: lock ? 'Khóa' : 'Mở khóa',
                onConfirm: async function () {
                    try {
                        var res = await A.api(API + '/' + encodeURIComponent(staff.id) + '/status', {
                            method: 'PATCH',
                            body: JSON.stringify({ status: lock ? 0 : 1 })
                        });
                        A.toast(res.message);
                        await load();
                    } catch (err) {
                        A.toast(err.message, 'error');
                    }
                }
            });
        }
    });

    document.getElementById('open-add-staff').addEventListener('click', function () { openForm(null); });
    document.getElementById('sf-generate').addEventListener('click', function () {
        document.getElementById('sf-password').value = randomPassword();
    });
    document.getElementById('reset-generate').addEventListener('click', function () {
        document.getElementById('reset-password').value = randomPassword();
    });
    document.getElementById('refresh-staff').addEventListener('click', load);
    [search, positionFilter, statusFilter].forEach(function (el) {
        el.addEventListener('input', render);
        el.addEventListener('change', render);
    });

    document.getElementById('open-logs').addEventListener('click', async function () {
        var logBody = document.getElementById('staff-logs-body');
        logBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Đang tải...</td></tr>';
        logsModal.show();
        try {
            var res = await A.api(API + '/logs?limit=100');
            var rows = res.data || [];
            logBody.innerHTML = rows.length ? rows.map(function (r) {
                return '<tr><td class="text-nowrap">' + esc(fmtTime(r.created_at)) + '</td>' +
                    '<td>' + esc(r.user_name || ('#' + r.user_id)) + '</td>' +
                    '<td>' + esc(ACTION_TEXT[r.action] || r.action) + '</td>' +
                    '<td class="text-secondary">' + esc(r.detail || '') + '</td></tr>';
            }).join('') : '<tr><td colspan="4" class="text-center text-secondary py-4">Chưa có thao tác nào được ghi.</td></tr>';
        } catch (err) {
            logBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Không tải được nhật ký.</td></tr>';
        }
    });

    load();
});
