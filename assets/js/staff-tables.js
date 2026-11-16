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
            if (S.can('tables.move')) {
                actions += '<button type="button" class="btn btn-sm btn-outline-secondary" data-move="' + S.esc(t.table_code) + '"><i class="bi bi-arrows-move me-1"></i>Chuyển / tách bàn</button>';
            }
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

        return '<div class="col-6 col-md-4 col-xl-3 col-xxl-2"><article class="table-tile ' + S.esc(t.status) + (t.status === 'occupied' ? ' is-clickable' : '') + '" data-table="' + S.esc(t.table_code) + '"' + (t.status === 'occupied' ? ' role="button" tabindex="0" title="Xem đơn hàng của bàn"' : '') + '>' +
            '<div class="tile-head"><span class="tile-name">' + S.esc(t.table_name || t.table_code) + '</span>' +
            '<span class="status-pill ' + S.esc(t.status) + '">' + S.esc(STATUS[t.status] || t.status) + '</span></div>' +
            '<div class="tile-meta">' + meta + '</div>' + info +
            (t.status === 'occupied' && S.can('orders.view') ? '<div class="tile-hint"><i class="bi bi-hand-index me-1"></i>Chạm để xem đơn</div>' : '') +
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

    // ----- Chuyển / gộp / tách bàn -----
    var moveModal = null;
    var moveFrom = null;

    function ensureMoveModal() {
        if (moveModal) return;
        var el = document.createElement('div');
        el.innerHTML =
            '<div class="modal fade" id="move-modal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0">' +
            '<div class="modal-header"><h2 class="modal-title h5" id="move-title">Chuyển / gộp / tách bàn</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>' +
            '<div class="modal-body"><div id="move-alert" class="alert alert-danger d-none py-2"></div>' +
            '<div id="move-orders" class="mb-3"></div>' +
            '<label class="form-label fw-semibold" for="move-target">Sang bàn</label><select id="move-target" class="form-select"></select>' +
            '<div id="move-hint" class="form-text mt-2"></div></div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Hủy</button><button type="button" id="move-submit" class="btn btn-coffee">Xác nhận</button></div>' +
            '</div></div></div>';
        document.body.appendChild(el.firstChild);
        moveModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('move-modal'));
        document.getElementById('move-orders').addEventListener('change', updateMoveHint);
        document.getElementById('move-target').addEventListener('change', updateMoveHint);
        document.getElementById('move-submit').addEventListener('click', submitMove);
    }

    function chosenOrderIds() {
        return Array.prototype.map.call(document.querySelectorAll('#move-orders input[type=checkbox]:checked'), function (c) { return Number(c.value); });
    }

    function updateMoveHint() {
        var orders = ordersByTable[moveFrom] || [];
        var target = tables.filter(function (t) { return t.table_code === document.getElementById('move-target').value; })[0];
        var chosen = chosenOrderIds();
        var hint = '';
        var ok = Boolean(target);
        if (orders.length && !chosen.length) {
            hint = 'Hãy chọn ít nhất một đơn.';
            ok = false;
        } else if (target) {
            var whole = !orders.length || chosen.length === orders.length;
            if (!whole) hint = 'Tách ' + chosen.length + ' đơn sang bàn ' + target.table_code + '. Các đơn còn lại ở lại bàn ' + moveFrom + '.';
            else if (target.status === 'occupied') hint = 'Gộp toàn bộ bàn ' + moveFrom + ' vào bàn ' + target.table_code + ' (đang có khách). Bàn ' + moveFrom + ' sẽ trống.';
            else hint = 'Chuyển khách và đơn sang bàn ' + target.table_code + '. Bàn ' + moveFrom + ' sẽ trống.';
        }
        document.getElementById('move-hint').textContent = hint;
        document.getElementById('move-submit').disabled = !ok;
    }

    function openMove(code) {
        ensureMoveModal();
        moveFrom = code;
        document.getElementById('move-alert').classList.add('d-none');
        document.getElementById('move-title').textContent = 'Chuyển / gộp / tách bàn ' + code;
        var orders = ordersByTable[code] || [];
        document.getElementById('move-orders').innerHTML = orders.length
            ? '<div class="fw-semibold mb-1">Đơn của bàn</div>' + orders.map(function (o) {
                return '<div class="form-check"><input class="form-check-input" type="checkbox" id="mv-' + o.id + '" value="' + o.id + '" checked />' +
                    '<label class="form-check-label" for="mv-' + o.id + '">' + S.esc(o.order_code) + ' · ' + S.money(o.total_amount) + ' · ' + S.esc(S.STATUS_TEXT[o.status] || o.status) + '</label></div>';
            }).join('') + '<div class="form-text">Bỏ chọn bớt đơn để chỉ tách các đơn đã chọn sang bàn khác.</div>'
            : '<div class="text-secondary">Bàn chưa có đơn nào, chỉ chuyển khách sang bàn khác.</div>';
        var STATUS_LABEL = { available: 'Trống · chuyển', occupied: 'Có khách · gộp' };
        document.getElementById('move-target').innerHTML = '<option value="">-- Chọn bàn --</option>' + tables.filter(function (t) {
            return t.table_code !== code && t.status !== 'maintenance';
        }).map(function (t) {
            return '<option value="' + S.esc(t.table_code) + '">' + S.esc(t.table_name || t.table_code) + ' · ' + S.esc(t.area || '') + ' (' + STATUS_LABEL[t.status] + ')</option>';
        }).join('');
        updateMoveHint();
        moveModal.show();
    }

    async function submitMove() {
        var orders = ordersByTable[moveFrom] || [];
        var chosen = chosenOrderIds();
        var payload = { from: moveFrom, to: document.getElementById('move-target').value };
        if (orders.length && chosen.length !== orders.length) payload.order_ids = chosen; // chọn hết = chuyển cả bàn
        var btn = document.getElementById('move-submit');
        btn.disabled = true;
        try {
            var res = await S.api('/api/staff/tables/move', { method: 'POST', body: JSON.stringify(payload) });
            moveModal.hide();
            S.toast(res.message);
            await load();
        } catch (err) {
            var box2 = document.getElementById('move-alert');
            box2.textContent = err.message;
            box2.classList.remove('d-none');
        } finally {
            btn.disabled = false;
            updateMoveHint();
        }
    }

    // ----- Xem đơn hàng của bàn đang có khách -----
    var detailModal = null;
    var detailCode = null;
    function ensureDetailModal() {
        if (detailModal) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = '<div class="modal fade" id="table-orders-modal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"><div class="modal-content border-0">' +
            '<div class="modal-header"><h2 class="modal-title h5" id="table-orders-title">Đơn của bàn</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>' +
            '<div class="modal-body" id="table-orders-body"></div>' +
            '<div class="modal-footer flex-wrap" id="table-orders-actions"></div></div></div></div>';
        document.body.appendChild(wrap.firstChild);
        detailModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('table-orders-modal'));
        document.getElementById('table-orders-actions').addEventListener('click', function (event) {
            var b = event.target.closest('button[data-detail-act]');
            if (!b) return;
            if (b.dataset.detailAct === 'invoice') {
                S.api('/api/orders/' + encodeURIComponent(b.dataset.oid)).then(function (d) { S.printInvoice(d.data); })
                    .catch(function (err) { S.toast(err.message, 'error'); });
            }
        });
    }
    function lineText(it) {
        var parts = ['Size ' + it.size, 'Đường ' + it.sugar_level, 'Đá ' + it.ice_level];
        if (it.toppings && it.toppings.length) parts.push('+ ' + it.toppings.join(', '));
        return parts.join(' · ');
    }
    async function openTableOrders(code) {
        if (!S.can('orders.view')) return;
        ensureDetailModal();
        detailCode = code;
        var t = tables.filter(function (x) { return x.table_code === code; })[0] || {};
        document.getElementById('table-orders-title').textContent = 'Đơn của ' + (t.table_name || code);
        var body = document.getElementById('table-orders-body');
        var actions = document.getElementById('table-orders-actions');
        body.innerHTML = '<div class="text-center text-secondary py-4">Đang tải đơn hàng...</div>';
        actions.innerHTML = '';
        detailModal.show();
        var list = ordersByTable[code] || [];
        if (!list.length) {
            body.innerHTML = '<div class="text-center text-secondary py-4">Bàn đang có khách nhưng chưa có đơn nào.</div>';
        } else {
            try {
                var details = await Promise.all(list.map(function (o) { return S.api('/api/orders/' + encodeURIComponent(o.id)).then(function (r) { return r.data; }); }));
                var grand = 0;
                body.innerHTML = details.map(function (o) {
                    grand += Number(o.total_amount || 0);
                    return '<section class="border rounded-3 p-2 p-md-3 mb-3">' +
                        '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">' +
                        '<strong>' + S.esc(o.order_code) + '</strong><span>' + S.statusBadge(o.status) + ' <span class="badge text-bg-' + (o.payment_status === 'paid' ? 'success' : 'secondary') + '">' + S.esc(S.PAY_TEXT[o.payment_status] || o.payment_status) + '</span></span>' +
                        '<small class="text-secondary w-100">' + S.esc(S.timeText(o.created_at)) + (o.customer_name ? ' · ' + S.esc(o.customer_name) : '') + '</small></div>' +
                        o.items.map(function (it) {
                            return '<div class="d-flex justify-content-between gap-2 py-1 border-top"><div><strong>' + it.quantity + '× ' + S.esc(it.product_name) + '</strong>' +
                                '<small class="d-block text-secondary">' + S.esc(lineText(it)) + '</small>' +
                                (it.note ? '<small class="d-block text-danger">' + S.esc(it.note) + '</small>' : '') + '</div>' +
                                '<span class="text-nowrap">' + S.money(it.line_total) + '</span></div>';
                        }).join('') +
                        (o.note ? '<div class="alert alert-warning py-1 px-2 mt-2 mb-0 small"><i class="bi bi-sticky me-1"></i>' + S.esc(o.note) + '</div>' : '') +
                        '<div class="d-flex justify-content-between fw-semibold border-top pt-2 mt-2"><span>Tổng đơn</span><span>' + S.money(o.total_amount) + '</span></div>' +
                        (S.can('tables.bill') ? '<div class="text-end mt-2"><button type="button" class="btn btn-sm btn-coffee" data-detail-act="invoice" data-oid="' + o.id + '"><i class="bi bi-printer me-1"></i>Xuất hóa đơn</button></div>' : '') +
                        '</section>';
                }).join('') + '<div class="d-flex justify-content-between fw-bold fs-5"><span>Cả bàn</span><span>' + S.money(grand) + '</span></div>';
            } catch (err) {
                body.innerHTML = '<div class="alert alert-danger mb-0">' + S.esc(err.message) + '</div>';
            }
        }
        var foot = '';
        if (S.can('tables.order')) foot += '<a class="btn btn-coffee" href="new-order.html?table=' + encodeURIComponent(code) + '"><i class="bi bi-plus-lg me-1"></i>Gọi thêm món</a>';
        foot += '<a class="btn btn-outline-secondary" href="orders.html?q=' + encodeURIComponent(code) + '">Mở trong Đơn hàng</a>';
        actions.innerHTML = foot;
    }

    box.addEventListener('click', function (event) {
        if (event.target.closest('button, a')) return;
        var tileEl = event.target.closest('.table-tile.is-clickable');
        if (tileEl) openTableOrders(tileEl.dataset.table);
    });
    box.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var tileEl = event.target.closest('.table-tile.is-clickable');
        if (tileEl && event.target === tileEl) { event.preventDefault(); openTableOrders(tileEl.dataset.table); }
    });

    box.addEventListener('click', async function (event) {
        var mv = event.target.closest('button[data-move]');
        if (mv) return openMove(mv.dataset.move);
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
