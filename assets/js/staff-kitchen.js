/* staff/kitchen.html: màn hình bếp. Ba cột: chờ làm, đang làm, đã xong. Có âm báo khi có đơn mới. */
(function () {
    'use strict';
    var S = window.Staff;
    var LATE_MINUTES = 10;
    var NEXT = {
        pending: { to: 'confirmed', label: 'Xác nhận', cls: 'btn-outline-secondary' },
        confirmed: { to: 'preparing', label: 'Bắt đầu làm', cls: 'btn-coffee' },
        preparing: { to: 'ready', label: 'Xong món', cls: 'btn-success' },
        ready: { to: 'completed', label: 'Đã phục vụ', cls: 'btn-outline-success' }
    };
    var orders = [];
    var knownIds = null; // null = lần tải đầu tiên (chưa phát âm báo)
    var loading = false;
    var audioCtx = null;

    function beep() {
        if (!document.getElementById('sound-toggle').checked) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
        } catch (e) { /* trình duyệt chặn âm thanh khi chưa tương tác: bỏ qua */ }
    }

    function minutesSince(value) {
        var t = new Date(value).getTime();
        return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 60000));
    }

    function card(o) {
        var mins = minutesSince(o.created_at);
        var late = (o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing') && mins >= LATE_MINUTES;
        var next = NEXT[o.status];
        var allowed = next && S.canSetStatus(next.to);
        var items = o.items.map(function (it) {
            var parts = ['Size ' + it.size, 'Đường ' + it.sugar_level, 'Đá ' + it.ice_level];
            if (it.toppings && it.toppings.length) parts.push('+ ' + it.toppings.join(', '));
            return '<div class="k-item"><span class="k-qty">' + it.quantity + '×</span><strong>' + S.esc(it.product_name) + '</strong>' +
                '<small>' + S.esc(parts.join(' · ')) + '</small>' + (it.note ? '<small class="text-danger fw-semibold">' + S.esc(it.note) + '</small>' : '') + '</div>';
        }).join('');
        return '<article class="kitchen-card ' + S.esc(o.status) + (late ? ' late' : '') + '">' +
            '<div class="k-head"><span class="k-where">' + (o.order_type === 'at_table' ? 'Bàn ' + S.esc(o.table_code || '') : 'Mang đi') + '</span>' +
            '<span class="k-time"><i class="bi bi-clock me-1"></i>' + mins + ' phút · ' + S.esc(S.timeText(o.created_at)) + '</span></div>' +
            '<small class="text-secondary">' + S.esc(o.order_code) + (o.status === 'pending' ? ' · <span class="text-danger fw-semibold">Chờ xác nhận</span>' : '') + '</small>' +
            items + (o.note ? '<div class="k-note"><i class="bi bi-sticky me-1"></i>' + S.esc(o.note) + '</div>' : '') +
            (allowed ? '<button type="button" class="btn ' + next.cls + ' w-100 mt-2" data-id="' + o.id + '" data-to="' + next.to + '">' + next.label + '</button>' : '') +
            '</article>';
    }

    function render() {
        var groups = { 'col-new': ['pending', 'confirmed'], 'col-preparing': ['preparing'], 'col-ready': ['ready'] };
        var counters = { 'col-new': 'cnt-new', 'col-preparing': 'cnt-preparing', 'col-ready': 'cnt-ready' };
        Object.keys(groups).forEach(function (col) {
            var list = orders.filter(function (o) { return groups[col].indexOf(o.status) !== -1; });
            document.getElementById(counters[col]).textContent = list.length;
            document.getElementById(col).innerHTML = list.length ? list.map(card).join('') : '<div class="kitchen-empty">Không có đơn</div>';
        });
    }

    async function load() {
        if (loading) return;
        loading = true;
        try {
            var res = await S.api('/api/staff/kitchen');
            orders = res.data || [];
            var ids = orders.map(function (o) { return o.id; });
            if (knownIds !== null && ids.some(function (id) { return knownIds.indexOf(id) === -1; })) beep();
            knownIds = ids;
            render();
        } catch (err) {
            document.getElementById('col-new').innerHTML = '<div class="alert alert-danger">' + S.esc(err.message) + '</div>';
        } finally {
            loading = false;
        }
    }

    document.querySelector('.kitchen-board').addEventListener('click', async function (event) {
        var btn = event.target.closest('button[data-id]');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        try {
            await S.api('/api/orders/' + encodeURIComponent(btn.dataset.id) + '/status', { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.to }) });
            await load();
        } catch (err) {
            S.toast(err.message, 'error');
            btn.disabled = false;
        }
    });
    document.getElementById('refresh').addEventListener('click', load);

    S.ready(function () {
        load();
        S.autoRefresh(load, 20);
        setInterval(function () { if (!document.hidden) render(); }, 30000); // cập nhật số phút chờ
    });
})();
