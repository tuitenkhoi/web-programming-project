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
        if (orders.length && S.can('tables.update')) {
            info += '<div class="tile-meta"><i class="bi bi-receipt me-1"></i>' + orders.length + ' đơn · ' + S.money(total) + '</div>';
        }
        var booking = bookingByTable[t.table_code];
        if (booking) {
            info += '<span class="booking-chip"><i class="bi bi-calendar2-check me-1"></i>Đặt ' + S.esc(String(booking.booking_time).slice(0, 5)) + ' · ' + S.esc(booking.customer_name) + '</span>';
        }

        var actions = '';
        var canManage = S.can('tables.update');
        var btn = function (act, cls, label, extra) {
            return '<button type="button" class="btn btn-sm ' + cls + '" data-act="' + act + '" data-id="' + t.id + '"' + (extra || '') + '>' + label + '</button>';
        };
        if (t.status === 'available') {
            if (S.canTable('available', 'occupied')) actions += btn('occupied', 'btn-coffee', '<i class="bi bi-person-check me-1"></i>Nhận khách', ' data-code="' + S.esc(t.table_code) + '"');
            if (S.canTable('available', 'maintenance')) actions += btn('maintenance', 'btn-outline-secondary', '<i class="bi bi-tools me-1"></i>Bảo trì');
        } else if (t.status === 'maintenance') {
            if (S.canTable('maintenance', 'available')) actions += btn('available', 'btn-outline-success', 'Hết bảo trì');
        } else if (t.status === 'occupied') {
            // Phục vụ: gọi thêm món cho bàn đang có khách
            if (S.can('tables.order')) {
                actions += '<a class="btn btn-sm btn-coffee" href="new-order.html?table=' + encodeURIComponent(t.table_code) + '"><i class="bi bi-plus-lg me-1"></i>Gọi món</a>';
            }
            // Admin: được trả bàn thủ công
            if (S.canTable('occupied', 'available')) actions += btn('available', 'btn-outline-success', 'Trả bàn');
            // Thu ngân: xác nhận đơn + xuất hóa đơn từng đơn của bàn
            if (S.can('tables.bill')) {
                orders.forEach(function (o) {
                    actions += '<div class="w-100 d-flex flex-wrap align-items-center gap-1 border-top pt-1 mt-1">' +
                        '<span class="small fw-semibold me-auto">' + S.esc(o.order_code) + ' · ' + S.money(o.total_amount) + '</span>' +
                        (o.status === 'pending' && S.canSetStatus('confirmed')
                            ? '<button type="button" class="btn btn-sm btn-outline-success" data-order-act="confirm" data-oid="' + o.id + '">Xác nhận đơn</button>' : '') +
                        '<button type="button" class="btn btn-sm btn-coffee" data-order-act="invoice" data-oid="' + o.id + '"><i class="bi bi-printer me-1"></i>Xuất hóa đơn</button></div>';
                });
            }
        }
        if (!canManage && !actions) actions = '';

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
        var ob = event.target.closest('button[data-order-act]');
        if (ob) {
            if (ob.disabled) return;
            ob.disabled = true;
            try {
                if (ob.dataset.orderAct === 'confirm') {
                    var r = await S.api('/api/orders/' + encodeURIComponent(ob.dataset.oid) + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
                    S.toast(r.message || 'Đã xác nhận đơn.');
                    await load();
                } else {
                    var d = await S.api('/api/orders/' + encodeURIComponent(ob.dataset.oid));
                    S.printInvoice(d.data);
                }
            } catch (err) {
                S.toast(err.message, 'error');
            } finally {
                ob.disabled = false;
            }
            return;
        }
        var btn = event.target.closest('button[data-act]');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        try {
            var res = await S.api('/api/tables/' + encodeURIComponent(btn.dataset.id) + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: btn.dataset.act })
            });
            // Nhận khách xong -> sang trang tạo đơn, bàn đã chọn sẵn
            if (btn.dataset.act === 'occupied' && S.can('tables.order')) {
                location.href = 'new-order.html?table=' + encodeURIComponent(btn.dataset.code);
                return;
            }
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
