/* staff/orders.html: danh sách đơn, chi tiết, đổi trạng thái, xác nhận thanh toán, sửa đơn, in hóa đơn. */
(function () {
    'use strict';
    var S = window.Staff;
    var PAGE_SIZE = 20;
    var TABS = {
        open: '&status=pending,confirmed,preparing,ready',
        unpaid: '&awaiting_payment=1',
        completed: '&status=completed',
        cancelled: '&status=cancelled',
        all: ''
    };
    var NEXT = {
        pending: { to: 'confirmed', label: 'Xác nhận đơn', icon: 'bi-check2' },
        confirmed: { to: 'preparing', label: 'Bắt đầu chế biến', icon: 'bi-fire' },
        preparing: { to: 'ready', label: 'Món đã xong', icon: 'bi-bell' },
        ready: { to: 'completed', label: 'Hoàn thành đơn', icon: 'bi-check2-all' }
    };
    var EDITABLE = ['pending', 'confirmed', 'preparing'];

    var body = document.getElementById('order-body');
    var tab = 'open';
    var page = 1;
    var totalPages = 1;
    var seq = 0;
    var detail = null;
    var modal = null;

    function params() {
        var q = document.getElementById('order-search').value.trim();
        var date = document.getElementById('order-date').value;
        return 'page=' + page + '&limit=' + PAGE_SIZE + TABS[tab] +
            (q ? '&q=' + encodeURIComponent(q) : '') + (date ? '&date=' + encodeURIComponent(date) : '');
    }

    async function load() {
        var mine = ++seq;
        try {
            var res = await S.api('/api/orders?' + params());
            if (mine !== seq) return;
            totalPages = res.total_pages || 1;
            document.getElementById('order-count').textContent = res.total + ' đơn · trang ' + res.page + '/' + totalPages;
            document.getElementById('prev-page').disabled = page <= 1;
            document.getElementById('next-page').disabled = page >= totalPages;
            if (!res.data.length) {
                body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Không có đơn nào.</td></tr>';
                return;
            }
            body.innerHTML = res.data.map(function (o) {
                return '<tr class="order-row" data-id="' + o.id + '">' +
                    '<td class="fw-semibold">' + S.esc(o.order_code) + '</td>' +
                    '<td>' + (o.order_type === 'at_table' ? '<i class="bi bi-cup-straw me-1"></i>' + S.esc(o.table_code || '') : '<i class="bi bi-bag me-1"></i>Mang đi') + '</td>' +
                    '<td>' + S.esc(o.customer_name) + '</td>' +
                    '<td class="text-end">' + S.money(o.total_amount) + '</td>' +
                    '<td><span class="badge text-bg-' + (o.payment_status === 'paid' ? 'success' : 'secondary') + '">' + S.esc(S.PAY_TEXT[o.payment_status] || o.payment_status) + '</span></td>' +
                    '<td>' + S.statusBadge(o.status) + '</td>' +
                    '<td class="text-nowrap text-secondary">' + S.esc(S.timeText(o.created_at)) + '</td></tr>';
            }).join('');
        } catch (err) {
            if (mine !== seq) return;
            body.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + S.esc(err.message) + '</td></tr>';
        }
    }
    var reloadSoon = S.debounce(function () { page = 1; load(); }, 350);

    function itemText(it) {
        var parts = ['Size ' + it.size, 'Đường ' + it.sugar_level, 'Đá ' + it.ice_level];
        if (it.toppings && it.toppings.length) parts.push('+ ' + it.toppings.join(', '));
        return parts.join(' · ');
    }

    function renderDetail(o) {
        detail = o;
        document.getElementById('order-modal-title').textContent = 'Đơn ' + o.order_code;
        document.getElementById('order-modal-body').innerHTML =
            '<div class="row g-2 mb-3">' +
            '<div class="col-6 col-md-3"><small class="text-secondary d-block">Hình thức</small>' + (o.order_type === 'at_table' ? 'Tại bàn ' + S.esc(o.table_code) : 'Mang đi') + '</div>' +
            '<div class="col-6 col-md-3"><small class="text-secondary d-block">Khách</small>' + S.esc(o.customer_name) + (o.customer_phone ? '<br><small>' + S.esc(o.customer_phone) + '</small>' : '') + '</div>' +
            '<div class="col-6 col-md-3"><small class="text-secondary d-block">Trạng thái</small>' + S.statusBadge(o.status) + '</div>' +
            '<div class="col-6 col-md-3"><small class="text-secondary d-block">Thanh toán</small>' + S.esc(o.payment_method_text) + ' · ' + S.esc(o.payment_status_text) + '</div>' +
            '</div>' +
            (o.note ? '<div class="alert alert-warning py-2"><i class="bi bi-sticky me-1"></i>' + S.esc(o.note) + '</div>' : '') +
            '<table class="table table-sm align-middle"><thead><tr><th>Món</th><th class="text-center">SL</th><th class="text-end">Thành tiền</th></tr></thead><tbody>' +
            o.items.map(function (it) {
                return '<tr><td><strong>' + S.esc(it.product_name) + '</strong><small class="d-block text-secondary">' + S.esc(itemText(it)) + '</small>' +
                    (it.note ? '<small class="d-block text-danger">' + S.esc(it.note) + '</small>' : '') + '</td>' +
                    '<td class="text-center">' + it.quantity + '</td><td class="text-end">' + S.money(it.line_total) + '</td></tr>';
            }).join('') + '</tbody></table>' +
            '<div class="d-flex justify-content-between"><span>Tạm tính</span><span>' + S.money(o.subtotal) + '</span></div>' +
            (o.discount_amount ? '<div class="d-flex justify-content-between"><span>Giảm giá' + (o.coupon_code ? ' (' + S.esc(o.coupon_code) + ')' : '') + '</span><span>-' + S.money(o.discount_amount) + '</span></div>' : '') +
            (o.service_fee ? '<div class="d-flex justify-content-between"><span>Phí phục vụ</span><span>' + S.money(o.service_fee) + '</span></div>' : '') +
            '<div class="d-flex justify-content-between fw-bold fs-5"><span>Tổng cộng</span><span>' + S.money(o.total_amount) + '</span></div>';

        var buttons = '<button type="button" class="btn btn-outline-secondary me-auto" data-act="print"><i class="bi bi-printer me-1"></i>In hóa đơn</button>';
        var unpaid = o.payment_status === 'pending' || o.payment_status === 'pending_verification';
        if (o.status !== 'cancelled' && unpaid && S.can('orders.payment')) {
            buttons += '<button type="button" class="btn btn-success" data-act="pay"><i class="bi bi-cash-coin me-1"></i>Xác nhận đã thanh toán</button>';
        }
        if (S.can('orders.edit') && EDITABLE.indexOf(o.status) !== -1 && unpaid && !o.coupon_code) {
            buttons += '<a class="btn btn-outline-secondary" href="new-order.html?edit=' + o.id + '"><i class="bi bi-pencil me-1"></i>Sửa đơn</a>';
        }
        if (['pending', 'confirmed', 'preparing', 'ready'].indexOf(o.status) !== -1 && o.payment_status !== 'paid' && S.canSetStatus('cancelled')) {
            buttons += '<button type="button" class="btn btn-outline-danger" data-act="cancel"><i class="bi bi-x-circle me-1"></i>Hủy đơn</button>';
        }
        var next = NEXT[o.status];
        if (next && S.canSetStatus(next.to)) {
            buttons += '<button type="button" class="btn btn-coffee" data-act="next"><i class="bi ' + next.icon + ' me-1"></i>' + next.label + '</button>';
        }
        document.getElementById('order-modal-actions').innerHTML = buttons;
    }

    async function openDetail(id) {
        try {
            var res = await S.api('/api/orders/' + encodeURIComponent(id));
            renderDetail(res.data);
            modal.show();
        } catch (err) {
            S.toast(err.message, 'error');
        }
    }

    async function setStatus(status) {
        try {
            var res = await S.api('/api/orders/' + detail.id + '/status', { method: 'PATCH', body: JSON.stringify({ status: status }) });
            S.toast(res.message);
            await openDetail(detail.id);
            load();
        } catch (err) { S.toast(err.message, 'error'); }
    }

    function print(o) {
        var w = window.open('', '_blank', 'width=380,height=640');
        if (!w) { S.toast('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.', 'error'); return; }
        var rows = o.items.map(function (it) {
            return '<tr><td>' + S.esc(it.product_name) + '<br><small>' + S.esc(itemText(it)) + '</small></td><td style="text-align:center">' + it.quantity + '</td><td style="text-align:right">' + S.money(it.line_total) + '</td></tr>';
        }).join('');
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn ' + S.esc(o.order_code) + '</title>' +
            '<style>body{font-family:Arial,sans-serif;font-size:13px;margin:12px;width:300px}h1{font-size:18px;text-align:center;margin:0}p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{padding:3px 0;vertical-align:top;border-bottom:1px dashed #999}small{color:#555}.r{display:flex;justify-content:space-between}</style></head><body>' +
            '<h1>MỘC COFFEE</h1><p>Hóa đơn ' + S.esc(o.order_code) + '</p><p>' + S.esc(S.dateTimeText(o.created_at)) + '</p>' +
            '<p>' + (o.order_type === 'at_table' ? 'Bàn ' + S.esc(o.table_code) : 'Mang đi') + ' · ' + S.esc(o.customer_name) + '</p>' +
            '<table><thead><tr><th style="text-align:left">Món</th><th>SL</th><th style="text-align:right">Tiền</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<div class="r"><span>Tạm tính</span><span>' + S.money(o.subtotal) + '</span></div>' +
            (o.discount_amount ? '<div class="r"><span>Giảm giá</span><span>-' + S.money(o.discount_amount) + '</span></div>' : '') +
            (o.service_fee ? '<div class="r"><span>Phí phục vụ</span><span>' + S.money(o.service_fee) + '</span></div>' : '') +
            '<div class="r"><strong>Tổng cộng</strong><strong>' + S.money(o.total_amount) + '</strong></div>' +
            '<p style="margin-top:8px">' + S.esc(o.payment_status_text) + '</p><p>Cảm ơn quý khách!</p></body></html>');
        w.document.close();
        w.focus();
        setTimeout(function () { w.print(); }, 250);
    }

    document.getElementById('order-modal-actions').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-act]');
        if (!btn || !detail) return;
        var act = btn.dataset.act;
        if (act === 'print') return print(detail);
        if (act === 'next') return setStatus(NEXT[detail.status].to);
        if (act === 'cancel') {
            return window.MocConfirm.show({
                title: 'Hủy đơn ' + detail.order_code + '?',
                message: 'Đơn sẽ bị hủy và bàn được trả nếu không còn đơn khác. Việc này được ghi lại trong nhật ký.',
                danger: true,
                confirmText: 'Hủy đơn',
                onConfirm: function () { setStatus('cancelled'); }
            });
        }
        if (act === 'pay') {
            return window.MocConfirm.show({
                title: 'Xác nhận đã thu ' + S.money(detail.total_amount) + '?',
                message: 'Đơn ' + detail.order_code + ' sẽ được ghi nhận là đã thanh toán.',
                confirmText: 'Đã thu tiền',
                onConfirm: async function () {
                    try {
                        var res = await S.api('/api/orders/' + detail.id + '/payment', { method: 'PATCH' });
                        S.toast(res.message);
                        await openDetail(detail.id);
                        load();
                    } catch (err) { S.toast(err.message, 'error'); }
                }
            });
        }
    });

    body.addEventListener('click', function (event) {
        var row = event.target.closest('tr[data-id]');
        if (row) openDetail(row.dataset.id);
    });
    document.getElementById('order-tabs').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-tab]');
        if (!btn) return;
        tab = btn.dataset.tab;
        document.querySelectorAll('#order-tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        page = 1;
        load();
    });
    document.getElementById('order-search').addEventListener('input', reloadSoon);
    document.getElementById('order-date').addEventListener('change', reloadSoon);
    document.getElementById('prev-page').addEventListener('click', function () { if (page > 1) { page--; load(); } });
    document.getElementById('next-page').addEventListener('click', function () { if (page < totalPages) { page++; load(); } });

    S.ready(function () {
        modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('order-modal'));
        if (S.can('orders.create')) document.getElementById('btn-new-order').classList.remove('d-none');

        var q = new URLSearchParams(location.search).get('q');
        if (q) { document.getElementById('order-search').value = q; tab = 'all'; document.querySelectorAll('#order-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'all'); }); }

        load();
        S.autoRefresh(load, 30);
    });
})();
