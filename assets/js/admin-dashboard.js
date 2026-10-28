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

    async function load() {
        try {
            var s = await A.api('/api/dashboard/stats');
            setCard('dashboard-order-count', 'Đơn hàng hoàn thành', s.completedOrders, '');
            setCard('dashboard-booking-count', 'Đặt bàn chờ xác nhận', s.pendingBookings, 'Cần xử lý sớm');
            var pct = s.totalTables ? Math.round(s.occupiedTables * 100 / s.totalTables) : 0;
            setCard('dashboard-table-count', 'Bàn đang sử dụng', s.occupiedTables + '/' + s.totalTables,
                'Công suất hiện tại: ' + pct + '% · ' + s.reservedTables + ' bàn đã đặt');
        } catch (err) {
            console.error('Lỗi tải dashboard:', err);
            A.toast(err.message, 'error');
        }
    }

    var refresh = A.fresh('refresh-dashboard-button');
    if (refresh) refresh.addEventListener('click', load);
    load();
});
