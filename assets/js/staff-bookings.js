/* staff/bookings.html: danh sách đặt bàn. Phục vụ được duyệt/xếp khách/hoàn tất; thu ngân chỉ xem. */
(function () {
    'use strict';
    var S = window.Staff;
    var TEXT = { pending: 'Chờ duyệt', confirmed: 'Đã duyệt', seated: 'Đang phục vụ', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
    var CLS = { pending: 'danger', confirmed: 'primary', seated: 'warning', completed: 'success', cancelled: 'secondary' };
    var TABS = {
        active: ['pending', 'confirmed', 'seated'],
        pending: ['pending'], confirmed: ['confirmed'], seated: ['seated'],
        done: ['completed', 'cancelled']
    };
    var ACTIONS = {
        pending: [['confirmed', 'Duyệt', 'btn-coffee'], ['cancelled', 'Hủy', 'btn-outline-danger']],
        confirmed: [['seated', 'Xếp khách', 'btn-success'], ['cancelled', 'Hủy', 'btn-outline-danger']],
        seated: [['completed', 'Hoàn tất', 'btn-outline-success']]
    };
    var all = [];
    var tab = 'active';
    var body = document.getElementById('booking-body');

    function fmtDate(value) { return String(value || '').split('-').reverse().join('/'); }

    function render() {
        var q = document.getElementById('booking-search').value.trim().toLowerCase();
        var date = document.getElementById('booking-date').value;
        var canManage = S.can('bookings.manage');
        var list = all.filter(function (b) {
            if (TABS[tab].indexOf(b.status) === -1) return false;
            if (date && b.booking_date !== date) return false;
            if (q && [b.booking_code, b.customer_name, b.customer_phone, b.table_code, b.table_name].join(' ').toLowerCase().indexOf(q) === -1) return false;
            return true;
        }).sort(function (a, b) {
            return (a.booking_date + a.booking_time).localeCompare(b.booking_date + b.booking_time);
        });
        if (tab === 'done') list.reverse();

        if (!list.length) {
            body.innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-4">Không có lượt đặt bàn nào.</td></tr>';
            return;
        }
        body.innerHTML = list.map(function (b) {
            var buttons = canManage ? (ACTIONS[b.status] || []).map(function (a) {
                return '<button type="button" class="btn btn-sm ' + a[2] + ' ms-1" data-id="' + b.id + '" data-to="' + a[0] + '">' + a[1] + '</button>';
            }).join('') : '';
            return '<tr><td class="small text-secondary">' + S.esc(String(b.booking_code).slice(0, 12)) + '</td>' +
                '<td><strong>' + S.esc(b.customer_name) + '</strong><small class="d-block text-secondary">' + S.esc(b.customer_phone) + '</small></td>' +
                '<td>' + S.esc(b.table_name || b.table_code) + '<small class="d-block text-secondary">' + S.esc(b.area || '') + '</small></td>' +
                '<td class="text-nowrap">' + S.esc(fmtDate(b.booking_date)) + '<br>' + S.esc(String(b.booking_time).slice(0, 5)) + '</td>' +
                '<td>' + S.esc(b.guest_count) + '</td>' +
                '<td class="small">' + S.esc(b.note || '') + '</td>' +
                '<td><span class="badge text-bg-' + (CLS[b.status] || 'secondary') + '">' + S.esc(TEXT[b.status] || b.status) + '</span></td>' +
                '<td class="text-end text-nowrap">' + buttons + '</td></tr>';
        }).join('');
    }

    async function load() {
        try {
            all = await S.api('/api/bookings?limit=500');
            render();
        } catch (err) {
            body.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">' + S.esc(err.message) + '</td></tr>';
        }
    }

    body.addEventListener('click', async function (event) {
        var btn = event.target.closest('button[data-id]');
        if (!btn || btn.disabled) return;
        var to = btn.dataset.to;
        var run = async function () {
            btn.disabled = true;
            try {
                var res = await S.api('/api/bookings/' + encodeURIComponent(btn.dataset.id) + '/status', { method: 'PATCH', body: JSON.stringify({ status: to }) });
                S.toast(res.message);
                await load();
            } catch (err) {
                S.toast(err.message, 'error');
                btn.disabled = false;
            }
        };
        if (to === 'cancelled') {
            window.MocConfirm.show({ title: 'Hủy lượt đặt bàn?', message: 'Khách sẽ không còn giữ bàn này.', danger: true, confirmText: 'Hủy đặt bàn', onConfirm: run });
        } else {
            run();
        }
    });
    document.getElementById('booking-tabs').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-tab]');
        if (!btn) return;
        tab = btn.dataset.tab;
        document.querySelectorAll('#booking-tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        render();
    });
    document.getElementById('booking-search').addEventListener('input', render);
    document.getElementById('booking-date').addEventListener('change', render);
    document.getElementById('refresh').addEventListener('click', load);

    S.ready(function () {
        if (!S.can('bookings.manage')) document.getElementById('booking-hint').textContent = 'Bạn chỉ có quyền xem danh sách đặt bàn.';
        load();
        S.autoRefresh(load, 30);
    });
})();
