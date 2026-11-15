/* staff/revenue.html: doanh thu + hóa đơn đã thanh toán (thu ngân và admin). Dữ liệu từ /api/dashboard/stats và /api/orders. */
(function () {
    'use strict';
    var S = window.Staff;
    var period = '7-days';
    var LABEL = { '7-days': 'Tổng 7 ngày', '30-days': 'Tổng 30 ngày', '12-months': 'Tổng 12 tháng' };
    var loading = false;
    var invoices = [];
    var $ = function (id) { return document.getElementById(id); };

    function compact(n) {
        n = Number(n) || 0;
        if (n >= 1e6) return (Math.round(n / 1e5) / 10) + 'tr';
        if (n >= 1e3) return Math.round(n / 1e3) + 'k';
        return n ? String(n) : '';
    }
    function pad(n) { return String(n).padStart(2, '0'); }

    // Dựng đủ các cột (kể cả ngày/tháng không có doanh thu) tính ngược từ hôm nay
    function slots(todayKey) {
        var out = [];
        var base = /^\d{4}-\d{2}-\d{2}/.test(todayKey || '') ? new Date(todayKey.slice(0, 10) + 'T00:00:00') : new Date();
        if (period === '12-months') {
            for (var m = 11; m >= 0; m--) {
                var d = new Date(base.getFullYear(), base.getMonth() - m, 1);
                out.push({ key: d.getFullYear() + '-' + pad(d.getMonth() + 1), label: pad(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) });
            }
        } else {
            var n = period === '30-days' ? 30 : 7;
            for (var i = n - 1; i >= 0; i--) {
                var day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
                out.push({ key: day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate()), label: pad(day.getDate()) + '/' + pad(day.getMonth() + 1) });
            }
        }
        return out;
    }

    function renderChart(data) {
        var amount = {};
        ((data.revenue && data.revenue.series) || []).forEach(function (r) { amount[r.key] = Number(r.amount || 0); });
        var list = slots(data.todayKey).map(function (s) { s.amount = amount[s.key] || 0; return s; });
        var max = Math.max(1, Math.max.apply(null, list.map(function (s) { return s.amount; })));
        $('rev-unit').textContent = period === '12-months' ? 'tháng' : 'ngày';
        $('rev-chart').innerHTML = list.map(function (s) {
            var h = s.amount > 0 ? Math.max(4, Math.round(s.amount / max * 100)) : 0;
            return '<div class="text-center flex-fill" style="min-width:' + (period === '30-days' ? 34 : 44) + 'px" title="' + S.esc(s.label + ': ' + S.money(s.amount)) + '">' +
                '<div class="small text-secondary" style="height:1.2rem;font-size:.7rem">' + S.esc(compact(s.amount)) + '</div>' +
                '<div style="height:150px;display:flex;align-items:flex-end"><div style="width:100%;height:' + h + '%;background:#8d6e63;border-radius:4px 4px 0 0"></div></div>' +
                '<div class="small" style="font-size:.7rem">' + S.esc(s.label) + '</div></div>';
        }).join('');
    }

    function renderInvoices() {
        var body = $('rev-invoices');
        if (!invoices.length) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Chưa có hóa đơn đã thanh toán.</td></tr>';
            return;
        }
        body.innerHTML = invoices.map(function (o) {
            return '<tr><td class="fw-semibold">' + S.esc(o.order_code) + '</td>' +
                '<td>' + S.esc(S.dateTimeText(o.created_at)) + '</td>' +
                '<td>' + S.esc(o.order_type === 'at_table' ? (o.table_code || 'Tại bàn') : 'Mang đi') + '</td>' +
                '<td>' + S.esc(o.payment_method_text || o.payment_method || '') + '</td>' +
                '<td class="text-end fw-semibold">' + S.money(o.total_amount) + '</td>' +
                '<td class="text-end"><button type="button" class="btn btn-sm btn-outline-secondary" data-print="' + S.esc(o.id) + '"><i class="bi bi-printer me-1"></i>In</button></td></tr>';
        }).join('');
    }

    async function load() {
        if (loading) return;
        loading = true;
        try {
            var res = await Promise.all([
                S.api('/api/dashboard/stats?period=' + period),
                S.api('/api/orders?payment_status=paid&limit=20')
            ]);
            var d = res[0];
            $('k-today').textContent = S.money(d.todayRevenue);
            $('k-yesterday').textContent = S.money(d.yesterdayRevenue);
            $('k-period').textContent = S.money(d.revenue && d.revenue.total);
            $('k-period-label').textContent = LABEL[period];
            $('k-paid').textContent = d.paidOrdersToday || 0;
            var y = Number(d.yesterdayRevenue || 0), t = Number(d.todayRevenue || 0);
            $('k-compare').innerHTML = y > 0
                ? '<span class="' + (t >= y ? 'text-success' : 'text-danger') + '">' + (t >= y ? '▲ ' : '▼ ') + Math.abs(Math.round((t - y) / y * 100)) + '% so với hôm qua</span>'
                : '<span class="text-secondary">Hôm qua chưa có doanh thu</span>';
            renderChart(d);
            invoices = res[1].data || [];
            var sum = res[1].summary || {};
            $('k-awaiting').textContent = sum.awaiting_payment ? sum.awaiting_payment + ' đơn chờ thanh toán' : '';
            renderInvoices();
        } catch (err) {
            S.toast(err.message, 'error');
            $('rev-invoices').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Không tải được dữ liệu.</td></tr>';
        } finally {
            loading = false;
        }
    }

    $('rev-period').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-period]');
        if (!btn) return;
        period = btn.dataset.period;
        document.querySelectorAll('#rev-period button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        load();
    });
    $('rev-refresh').addEventListener('click', load);
    $('rev-invoices').addEventListener('click', async function (event) {
        var btn = event.target.closest('button[data-print]');
        if (!btn) return;
        btn.disabled = true;
        try {
            var d = await S.api('/api/orders/' + encodeURIComponent(btn.dataset.print));
            S.printInvoice(d.data);
        } catch (err) {
            S.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    S.ready(function () {
        load();
        S.autoRefresh(load, 60);
    });
})();
