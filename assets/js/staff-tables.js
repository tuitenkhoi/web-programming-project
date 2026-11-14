/* staff/index.html: sơ đồ bàn theo khu vực. Bàn có khách hiện đơn đang mở; đổi trạng thái bàn nếu có quyền. */
(function () {
    'use strict';
    var S = window.Staff;
    var STATUS = { available: 'Trống', occupied: 'Có khách', maintenance: 'Bảo trì' };
    var tables = [];
    var ordersByTable = {};
    var bookingByTable = {};
    var filter = 'all';
    var loading = false;

    var box = document.getElementById('table-areas');

    function tile(t) {
        var orders = ordersByTable[t.table_code] || [];
        var total = orders.reduce(function (sum, o) { return sum + Number(o.total_amount || 0); }, 0);
        var meta = S.esc(t.capacity) + ' chỗ';
        var info = '';
        if (orders.length) {
            info += '<div class="tile-meta"><i class="bi bi-receipt me-1"></i>' + orders.length + ' đơn · ' + S.money(total) + '</div>';
        }
        var booking = bookingByTable[t.table_code];
        if (booking) {
            info += '<span class="booking-chip"><i class="bi bi-calendar2-check me-1"></i>Đặt ' + S.esc(String(booking.booking_time).slice(0, 5)) + ' · ' + S.esc(booking.customer_name) + '</span>';
        }

        var actions = '';
        if (t.status !== 'maintenance' && S.can('orders.create')) {
            actions += '<a class="btn btn-sm btn-coffee" href="new-order.html?table=' + encodeURIComponent(t.table_code) + '"><i class="bi bi-plus-lg me-1"></i>Gọi món</a>';
        }
        if (orders.length && S.can('orders.view')) {
            actions += '<a class="btn btn-sm btn-outline-secondary" href="orders.html?q=' + encodeURIComponent(t.table_code) + '"><i class="bi bi-receipt me-1"></i>Xem đơn</a>';
        }
        if (S.can('tables.update')) {
            if (t.status === 'available') {
                actions += '<button type="button" class="btn btn-sm btn-outline-secondary" data-act="occupied" data-id="' + t.id + '">Nhận khách</button>';
                actions += '<button type="button" class="btn btn-sm btn-outline-secondary" data-act="maintenance" data-id="' + t.id + '"><i class="bi bi-tools"></i></button>';
            } else if (t.status === 'occupied') {
                actions += '<button type="button" class="btn btn-sm btn-outline-success" data-act="available" data-id="' + t.id + '">Trả bàn</button>';
            } else {
                actions += '<button type="button" class="btn btn-sm btn-outline-success" data-act="available" data-id="' + t.id + '">Hết bảo trì</button>';
            }
        }

        return '<div class="col-6 col-md-4 col-xl-3 col-xxl-2"><article class="table-tile ' + S.esc(t.status) + '">' +
            '<div class="tile-head"><span class="tile-name">' + S.esc(t.table_name || t.table_code) + '</span>' +
            '<span class="status-pill ' + S.esc(t.status) + '">' + S.esc(STATUS[t.status] || t.status) + '</span></div>' +
            '<div class="tile-meta">' + meta + '</div>' + info +
            '<div class="tile-actions">' + actions + '</div></article></div>';
    }

    function render() {
        ['available', 'occupied', 'maintenance'].forEach(function (s) {
            document.getElementById('cnt-' + s).textContent = tables.filter(function (t) { return t.status === s; }).length;
        });
        document.getElementById('cnt-all').textContent = tables.length;

        var list = tables.filter(function (t) { return filter === 'all' || t.status === filter; });
        if (!list.length) {
            box.innerHTML = '<div class="text-center text-secondary py-5">Không có bàn nào phù hợp.</div>';
            return;
        }
        var areas = {};
        list.forEach(function (t) { (areas[t.area || 'Khu vực khác'] = areas[t.area || 'Khu vực khác'] || []).push(t); });
        box.innerHTML = Object.keys(areas).map(function (area) {
            return '<h2 class="h6 area-title"><i class="bi bi-geo-alt"></i>' + S.esc(area) + '</h2><div class="row g-3">' + areas[area].map(tile).join('') + '</div>';
        }).join('');
    }

    async function load() {
        if (loading) return;
        loading = true;
        try {
            var jobs = [S.api('/api/tables')];
            jobs.push(S.can('orders.view')
                ? S.api('/api/orders?status=pending,confirmed,preparing,ready&limit=200').catch(function () { return null; })
                : Promise.resolve(null));
            jobs.push(S.can('bookings.view')
                ? S.api('/api/bookings?status=confirmed').catch(function () { return null; })
                : Promise.resolve(null));
            var results = await Promise.all(jobs);

            tables = results[0] || [];

            ordersByTable = {};
            ((results[1] && results[1].data) || []).forEach(function (o) {
                if (o.order_type === 'at_table' && o.table_code) (ordersByTable[o.table_code] = ordersByTable[o.table_code] || []).push(o);
            });

            // Booking đã duyệt của hôm nay, lấy lượt sớm nhất còn phía trước
            bookingByTable = {};
            var today = S.todayLocal();
            var now = new Date();
            var nowText = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            (Array.isArray(results[2]) ? results[2] : []).filter(function (b) {
                return b.booking_date === today && String(b.booking_time).slice(0, 5) >= nowText;
            }).sort(function (a, b) { return String(b.booking_time).localeCompare(String(a.booking_time)); })
                .forEach(function (b) { bookingByTable[b.table_code] = b; });

            render();
        } catch (err) {
            box.innerHTML = '<div class="alert alert-danger">Không tải được sơ đồ bàn: ' + S.esc(err.message) + '</div>';
        } finally {
            loading = false;
        }
    }

    box.addEventListener('click', async function (event) {
        var btn = event.target.closest('button[data-act]');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        try {
            var res = await S.api('/api/tables/' + encodeURIComponent(btn.dataset.id) + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: btn.dataset.act })
            });
            S.toast(res.message);
            await load();
        } catch (err) {
            S.toast(err.message, 'error');
            btn.disabled = false;
        }
    });

    document.getElementById('table-filter').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-filter]');
        if (!btn) return;
        filter = btn.dataset.filter;
        document.querySelectorAll('#table-filter button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        render();
    });
    document.getElementById('refresh').addEventListener('click', load);

    S.ready(function () {
        load();
        S.autoRefresh(load, 30);
    });
})();
