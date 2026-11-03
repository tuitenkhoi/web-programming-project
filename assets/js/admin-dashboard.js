/* Trang admin/dashboard.html: nạp số liệu thật từ /api/dashboard/stats. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;

    function setCard(valueId, label, value, note) {
        var v = document.getElementById(valueId);
        if (!v) return;
        v.textContent = value;
        var body = v.closest('.card-body');
        var p = body && body.querySelector('p.text-secondary');
        if (p && label) p.textContent = label;
        var small = body && body.querySelector('small');
        if (small && note !== undefined) { small.className = 'text-secondary'; small.textContent = note; }
    }

    function money(v) { return new Intl.NumberFormat('vi-VN').format(Number(v) || 0) + 'đ'; }

    // Các thẻ trong HTML là số liệu mẫu: đặt về "–" cho tới khi có dữ liệu thật
    function resetCards() {
        ['dashboard-revenue', 'dashboard-order-count', 'dashboard-booking-count', 'dashboard-table-count'].forEach(function (id) {
            var v = document.getElementById(id);
            if (!v) return;
            v.textContent = '–';
            var small = v.closest('.card-body') && v.closest('.card-body').querySelector('small');
            if (small) { small.className = 'text-secondary'; small.textContent = ''; }
        });
    }

    // Doanh thu hôm nay và so sánh với hôm qua
    function revenueCard(today, yesterday) {
        setCard('dashboard-revenue', 'Doanh thu hôm nay', money(today), '');
        var small = document.getElementById('dashboard-revenue').closest('.card-body').querySelector('small');
        if (!small) return;
        if (yesterday > 0) {
            var pct = Math.round((today - yesterday) * 1000 / yesterday) / 10;
            small.className = pct >= 0 ? 'text-success' : 'text-danger';
            small.textContent = (pct >= 0 ? '+' : '') + String(pct).replace('.', ',') + '% so với hôm qua';
        } else {
            small.textContent = 'Hôm qua chưa có doanh thu';
        }
    }

    async function load() {
        try {
            var s = await A.api('/api/dashboard/stats');
            revenueCard(s.todayRevenue, s.yesterdayRevenue);
            setCard('dashboard-order-count', 'Đơn hàng hoàn thành', s.completedOrders, '');
            setCard('dashboard-booking-count', 'Đặt bàn chờ xác nhận', s.pendingBookings, 'Cần xử lý sớm');
            var pct = s.totalTables ? Math.round(s.occupiedTables * 100 / s.totalTables) : 0;
            setCard('dashboard-table-count', 'Bàn đang sử dụng', s.occupiedTables + '/' + s.totalTables,
                'Công suất hiện tại: ' + pct + '% · ' + s.reservedTables + ' bàn đã đặt');
        } catch (err) {
            console.error('Lỗi tải dashboard:', err);
            resetCards();
            A.toast(err.message, 'error');
        }
    }

    var refresh = A.fresh('refresh-dashboard-button');
    if (refresh) refresh.addEventListener('click', load);
    resetCards();
    load();
});