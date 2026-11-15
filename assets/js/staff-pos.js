/* staff/new-order.html: tạo đơn tại quầy (và sửa đơn khi có ?edit=ID). Giá cuối cùng do server tính lại. */
(function () {
    'use strict';
    var S = window.Staff;
    var params = new URLSearchParams(location.search);
    var editId = /^[1-9]\d*$/.test(params.get('edit') || '') ? Number(params.get('edit')) : null;

    var options = { sizes: [], toppings: [], levels: [] };
    var products = [];
    var categories = [];
    var tables = [];
    var cart = [];        // { productId, name, image, base, size, sugar, ice, toppings[], note, qty }
    var activeCat = 'all';
    var editingLine = null; // dòng đang sửa trong hộp thoại tùy chọn (null = thêm mới)
    var pendingProduct = null;
    var submitting = false;

    var $ = function (id) { return document.getElementById(id); };
    var optionModal = null;

    function sizePrice(code) {
        var s = options.sizes.filter(function (x) { return x.code === code; })[0];
        return s ? s.price : 0;
    }
    function toppingPrice(name) {
        var t = options.toppings.filter(function (x) { return x.name === name; })[0];
        return t ? t.price : 0;
    }
    function unitPrice(line) {
        var top = line.toppings.reduce(function (sum, n) { return sum + toppingPrice(n); }, 0);
        return Math.max(0, line.base + sizePrice(line.size) + top);
    }
    // Cùng quy tắc với trang khách (client-api.js): ảnh có thể là URL, /uploads/..., assets/... hoặc chỉ là tên file
    var DEFAULT_IMAGE = '../assets/images/products/default-product.jpg';
    function imageOf(p) {
        var image = p.image_url || p.image || '';
        if (!image) return DEFAULT_IMAGE;
        if (/^https?:\/\//i.test(image) || image.indexOf('/uploads/') === 0) return image;
        if (image.indexOf('assets/') === 0) return '../' + image;
        if (image.indexOf('../assets/') === 0) return image;
        return '../assets/images/products/' + image;
    }
    function orderType() { return document.querySelector('input[name="order-type"]:checked').value; }

    function showAlert(text) {
        var el = $('pos-alert');
        el.textContent = text || '';
        el.classList.toggle('d-none', !text);
        if (text) el.scrollIntoView({ block: 'nearest' });
    }

    // ----- Thực đơn -----
    function renderCats() {
        var html = '<button type="button" class="btn btn-sm ' + (activeCat === 'all' ? 'btn-coffee' : 'btn-outline-secondary') + '" data-cat="all">Tất cả</button>';
        categories.forEach(function (c) {
            html += '<button type="button" class="btn btn-sm ' + (String(activeCat) === String(c.id) ? 'btn-coffee' : 'btn-outline-secondary') + '" data-cat="' + S.esc(c.id) + '">' + S.esc(c.name) + '</button>';
        });
        $('cat-tabs').innerHTML = html;
    }
    function renderMenu() {
        var q = $('menu-search').value.trim().toLowerCase();
        var list = products.filter(function (p) {
            if (activeCat !== 'all' && String(p.category_id) !== String(activeCat)) return false;
            return !q || String(p.name).toLowerCase().indexOf(q) !== -1;
        });
        $('menu-grid').innerHTML = list.length ? list.map(function (p) {
            var img = imageOf(p);
            return '<button type="button" class="product-tile" data-id="' + p.id + '">' +
                '<img src="' + S.esc(img) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + DEFAULT_IMAGE + '\'" />' +
                '<div class="tile-body"><div class="p-name">' + S.esc(p.name) + '</div><div class="p-price">' + S.money(p.price) + '</div></div></button>';
        }).join('') : '<div class="text-secondary py-4">Không có món nào.</div>';
    }

    // ----- Giỏ hàng -----
    function renderCart() {
        var count = cart.reduce(function (n, l) { return n + l.qty; }, 0);
        $('cart-count').textContent = count;
        $('cart-lines').innerHTML = cart.length ? cart.map(function (l, i) {
            var detailParts = ['Size ' + l.size, 'Đường ' + l.sugar, 'Đá ' + l.ice];
            if (l.toppings.length) detailParts.push('+ ' + l.toppings.join(', '));
            return '<div class="cart-line"><div class="d-flex justify-content-between gap-2">' +
                '<div><strong>' + S.esc(l.name) + '</strong><small class="d-block text-secondary">' + S.esc(detailParts.join(' · ')) + '</small>' +
                (l.note ? '<small class="d-block text-danger">' + S.esc(l.note) + '</small>' : '') + '</div>' +
                '<div class="text-end text-nowrap fw-semibold">' + S.money(unitPrice(l) * l.qty) + '</div></div>' +
                '<div class="d-flex justify-content-between align-items-center mt-1">' +
                '<div class="qty-box"><button type="button" class="btn btn-sm btn-outline-secondary" data-act="dec" data-i="' + i + '">−</button><span>' + l.qty + '</span><button type="button" class="btn btn-sm btn-outline-secondary" data-act="inc" data-i="' + i + '">+</button></div>' +
                '<div><button type="button" class="btn btn-sm btn-link" data-act="edit" data-i="' + i + '">Tùy chọn</button>' +
                '<button type="button" class="btn btn-sm btn-link text-danger" data-act="del" data-i="' + i + '"><i class="bi bi-trash"></i></button></div></div></div>';
        }).join('') : '<div class="text-secondary text-center py-3">Chưa có món nào.</div>';

        var subtotal = cart.reduce(function (sum, l) { return sum + unitPrice(l) * l.qty; }, 0);
        var fee = orderType() === 'at_table' ? Math.round((subtotal * 0.05) / 1000) * 1000 : 0;
        $('sum-subtotal').textContent = S.money(subtotal);
        $('sum-fee').textContent = S.money(fee);
        $('sum-total').textContent = S.money(subtotal + fee);
        if (cart.length) qrFixed = null;
        renderQr(subtotal + fee);
    }

    // ----- QR chuyển khoản: có sẵn số tiền + nội dung (dùng chung bộ tạo VietQR với trang thanh toán của khách) -----
    var qrFixed = null; // sau khi tạo đơn: giữ mã của đơn vừa tạo (số tiền + mã đơn) để khách quét
    function renderQr(total) {
        var box = $('pos-qr');
        var show = $('pos-payment').value === 'bank_transfer' && !editId;
        var amount = qrFixed ? qrFixed.amount : total;
        var content = qrFixed ? qrFixed.content : 'MOC ' + (orderType() === 'at_table' && lockedTable() ? lockedTable() : 'MANG DI');
        if (!show || amount <= 0 || typeof qrcode !== 'function' || !window.MocPaymentQr) {
            box.classList.add('d-none');
            box.innerHTML = '';
            return;
        }
        try {
            var qr = qrcode(0, 'M');
            qr.addData(window.MocPaymentQr.buildPayload(amount, content), 'Byte');
            qr.make();
            var n = qr.getModuleCount(), q = 2, path = '';
            for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) path += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
            box.innerHTML = '<div class="d-inline-block border rounded p-2 bg-white" style="width:210px">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + q * 2) + ' ' + (n + q * 2) + '" shape-rendering="crispEdges" role="img" aria-label="Mã QR chuyển khoản" style="display:block;width:100%;height:auto">' +
                '<rect width="100%" height="100%" fill="#fff"/><path d="' + path + '" fill="#000"/></svg></div>' +
                '<div class="small fw-semibold text-success mt-1">Mã đã kèm sẵn ' + S.money(amount) + '</div>' +
                '<div class="small text-secondary">Nội dung: ' + S.esc(window.MocPaymentQr.cleanContent(content)) + '</div>';
            box.classList.remove('d-none');
        } catch (error) {
            console.error('Không tạo được mã QR:', error);
            box.classList.add('d-none');
        }
    }

    // ----- Hộp thoại tùy chọn món -----
    function optionLine() {
        var size = (document.querySelector('input[name="opt-size"]:checked') || {}).value || 'M';
        return {
            size: size,
            sugar: $('opt-sugar').value,
            ice: $('opt-ice').value,
            toppings: Array.prototype.map.call(document.querySelectorAll('#opt-toppings input:checked'), function (i) { return i.value; }),
            note: $('opt-note').value.trim(),
            qty: Math.min(99, Math.max(1, parseInt($('opt-qty').value, 10) || 1))
        };
    }
    function updateOptionPrice() {
        var o = optionLine();
        var base = editingLine !== null ? cart[editingLine].base : pendingProduct.base;
        $('opt-price').textContent = S.money(unitPrice({ base: base, size: o.size, toppings: o.toppings }) * o.qty);
    }
    function openOptions(source, index) {
        editingLine = index === undefined ? null : index;
        var line = editingLine !== null ? cart[editingLine] : { size: 'M', sugar: '70%', ice: '70%', toppings: [], note: '', qty: 1 };
        pendingProduct = editingLine === null ? source : null;
        $('option-title').textContent = editingLine !== null ? line.name : source.name;
        $('opt-size').innerHTML = options.sizes.map(function (s) {
            return '<input type="radio" class="btn-check" name="opt-size" id="size-' + s.code + '" value="' + s.code + '"' + (s.code === line.size ? ' checked' : '') + ' />' +
                '<label class="btn btn-outline-secondary" for="size-' + s.code + '">' + s.code + (s.price ? ' (' + (s.price > 0 ? '+' : '') + Number(s.price).toLocaleString('vi-VN') + ')' : '') + '</label>';
        }).join('');
        var levelHtml = function (selected) {
            return options.levels.map(function (l) { return '<option value="' + l + '"' + (l === selected ? ' selected' : '') + '>' + l + '</option>'; }).join('');
        };
        $('opt-sugar').innerHTML = levelHtml(line.sugar);
        $('opt-ice').innerHTML = levelHtml(line.ice);
        $('opt-toppings').innerHTML = options.toppings.map(function (t, i) {
            return '<div class="form-check"><input class="form-check-input" type="checkbox" id="top-' + i + '" value="' + S.esc(t.name) + '"' + (line.toppings.indexOf(t.name) !== -1 ? ' checked' : '') + ' />' +
                '<label class="form-check-label" for="top-' + i + '">' + S.esc(t.name) + ' <span class="text-secondary">(+' + Number(t.price).toLocaleString('vi-VN') + 'đ)</span></label></div>';
        }).join('');
        $('opt-note').value = line.note || '';
        $('opt-qty').value = line.qty;
        $('opt-save').textContent = editingLine !== null ? 'Lưu thay đổi' : 'Thêm vào giỏ';
        updateOptionPrice();
        optionModal.show();
    }
    function saveOptions() {
        var o = optionLine();
        if (editingLine !== null) {
            Object.assign(cart[editingLine], o);
        } else {
            cart.push({ productId: pendingProduct.id, name: pendingProduct.name, image: pendingProduct.image, base: pendingProduct.base,
                size: o.size, sugar: o.sugar, ice: o.ice, toppings: o.toppings, note: o.note, qty: o.qty });
        }
        optionModal.hide();
        renderCart();
    }

    // Bấm nhanh vào món: thêm 1 ly mặc định (gộp với dòng giống hệt); "Tùy chọn" để chỉnh sau
    function quickAdd(product) {
        var same = cart.filter(function (l) {
            return l.productId === product.id && l.size === 'M' && l.sugar === '70%' && l.ice === '70%' && !l.toppings.length && !l.note;
        })[0];
        if (same) same.qty = Math.min(99, same.qty + 1);
        else cart.push({ productId: product.id, name: product.name, image: product.image, base: Number(product.price), size: 'M', sugar: '70%', ice: '70%', toppings: [], note: '', qty: 1 });
        renderCart();
    }

    // ----- Bàn -----
    function renderTables(selected) {
        var STATUS = { available: 'trống', occupied: 'có khách', maintenance: 'bảo trì' };
        $('pos-table').innerHTML = '<option value="">-- Chọn bàn --</option>' + tables.map(function (t) {
            return '<option value="' + S.esc(t.table_code) + '"' + (t.status === 'maintenance' ? ' disabled' : '') + (t.table_code === selected ? ' selected' : '') + '>' +
                S.esc(t.table_name || t.table_code) + ' · ' + S.esc(t.area || '') + ' (' + STATUS[t.status] + ')</option>';
        }).join('');
    }
    // Phục vụ (không có quyền "orders.any_table"): ?table=MÃ -> bàn khóa sẵn (đã nhận khách); không có -> chỉ khách mang đi.
    // Thu ngân/admin: chọn tự do.
    function restricted() { return !editId && !S.can('orders.any_table'); }
    function lockedTable() { return (params.get('table') || '').toUpperCase(); }
    function applyType() {
        if (restricted()) {
            var code = lockedTable();
            document.getElementById(code ? 'type-table' : 'type-takeaway').checked = true;
            $('pos-type-group').classList.add('d-none');
            if (code) {
                var t = tables.filter(function (x) { return x.table_code === code; })[0];
                $('pos-table').value = code;
                $('pos-table').disabled = true;
                $('pos-title').textContent = 'Gọi món · ' + (t ? (t.table_name || t.table_code) : code);
                $('pos-subtitle').textContent = 'Đơn sẽ gắn với bàn này.';
                if (!t || t.status !== 'occupied') {
                    showAlert('Bàn này chưa nhận khách. Hãy quay lại sơ đồ bàn và bấm "Nhận khách" trước.');
                    $('btn-submit').disabled = true;
                }
            } else {
                $('pos-title').textContent = 'Tạo đơn mang đi';
                $('pos-subtitle').textContent = 'Dành cho khách mua mang đi. Khách ăn tại bàn: nhận khách ở sơ đồ bàn trước.';
            }
        }
        var atTable = orderType() === 'at_table';
        $('pos-table').classList.toggle('d-none', !atTable);
        renderCart();
    }

    // ----- Gửi đơn -----
    async function submit() {
        if (submitting) return;
        showAlert('');
        if (!cart.length) return showAlert('Vui lòng chọn ít nhất một món.');
        if (!editId && orderType() === 'at_table' && !$('pos-table').value) return showAlert('Vui lòng chọn bàn.');

        var items = cart.map(function (l) {
            return { product_id: l.productId, quantity: l.qty, size: l.size, sugar_level: l.sugar, ice_level: l.ice, toppings: l.toppings, note: l.note };
        });
        submitting = true;
        $('btn-submit').disabled = true;
        try {
            var res;
            if (editId) {
                res = await S.api('/api/staff/orders/' + editId, { method: 'PUT', body: JSON.stringify({ items: items, note: $('pos-note').value.trim() }) });
                S.toast(res.message);
                setTimeout(function () { location.href = 'orders.html'; }, 600);
                return;
            }
            res = await S.api('/api/staff/orders', {
                method: 'POST',
                body: JSON.stringify({
                    order_type: orderType(),
                    table_code: $('pos-table').value,
                    customer_name: $('pos-name').value.trim(),
                    customer_phone: $('pos-phone').value.trim(),
                    payment_method: $('pos-payment').value,
                    note: $('pos-note').value.trim(),
                    items: items
                })
            });
            cart = [];
            $('pos-note').value = '';
            $('pos-name').value = '';
            $('pos-phone').value = '';
            renderCart();
            if ($('pos-payment').value === 'bank_transfer') { qrFixed = { amount: Number(res.data.total_amount), content: res.data.order_code }; renderQr(0); }
            var ok = $('pos-success');
            ok.innerHTML = 'Đã tạo đơn <strong>' + S.esc(res.data.order_code) + '</strong> · ' + S.money(res.data.total_amount) + '. <a href="orders.html">Xem đơn</a>';
            ok.classList.remove('d-none');
            setTimeout(function () { ok.classList.add('d-none'); }, 8000);
            // Bàn vừa chuyển sang "có khách": tải lại danh sách bàn để hiển thị đúng
            tables = await S.api('/api/tables');
            renderTables(restricted() ? lockedTable() : '');
            if (restricted() && lockedTable()) $('pos-table').disabled = true;
        } catch (err) {
            showAlert(err.message);
        } finally {
            submitting = false;
            $('btn-submit').disabled = false;
        }
    }

    // ----- Khởi tạo -----
    async function loadEditOrder() {
        var res = await S.api('/api/orders/' + editId);
        var o = res.data;
        if (['pending', 'confirmed', 'preparing'].indexOf(o.status) === -1 || o.payment_status === 'paid' || o.coupon_code) {
            throw new Error('Đơn này không thể sửa (đã sẵn sàng/hoàn thành/đã thanh toán hoặc có voucher).');
        }
        $('pos-title').textContent = 'Sửa đơn ' + o.order_code;
        $('pos-subtitle').textContent = 'Thay đổi món rồi bấm "Lưu thay đổi". Hình thức và bàn không đổi được.';
        $('btn-submit-text').textContent = 'Lưu thay đổi';
        $('pos-form-top').classList.add('d-none');
        $('pos-payment-group').classList.add('d-none');
        document.getElementById(o.order_type === 'at_table' ? 'type-table' : 'type-takeaway').checked = true;
        $('pos-note').value = o.note || '';
        cart = o.items.map(function (it) {
            var extra = (it.toppings || []).reduce(function (sum, n) { return sum + toppingPrice(n); }, 0);
            return { productId: it.product_id, name: it.product_name, image: it.image, base: Math.max(0, Number(it.unit_price) - sizePrice(it.size) - extra),
                size: it.size, sugar: it.sugar_level, ice: it.ice_level, toppings: it.toppings || [], note: it.note || '', qty: it.quantity };
        });
    }

    S.ready(async function () {
        optionModal = bootstrap.Modal.getOrCreateInstance($('option-modal'));
        try {
            var jobs = await Promise.all([
                S.api('/api/staff/order-options'),
                S.api('/api/products'),
                S.api('/api/categories'),
                S.api('/api/tables')
            ]);
            options = jobs[0].data;
            products = (jobs[1].data || []).map(function (p) { return Object.assign({}, p, { base: Number(p.price) }); });
            categories = jobs[2].data || [];
            tables = jobs[3] || [];
        } catch (err) {
            $('menu-grid').innerHTML = '<div class="alert alert-danger">Không tải được thực đơn: ' + S.esc(err.message) + '</div>';
            return;
        }

        renderCats();
        renderMenu();
        renderTables(params.get('table') ? params.get('table').toUpperCase() : '');
        if (editId) {
            try { await loadEditOrder(); } catch (err) { showAlert(err.message); $('btn-submit').disabled = true; }
        }
        applyType();
        renderCart();
    });

    $('cat-tabs').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-cat]');
        if (!btn) return;
        activeCat = btn.dataset.cat;
        renderCats();
        renderMenu();
    });
    $('menu-search').addEventListener('input', renderMenu);
    $('menu-grid').addEventListener('click', function (event) {
        var tile = event.target.closest('.product-tile');
        if (!tile) return;
        var product = products.filter(function (p) { return String(p.id) === tile.dataset.id; })[0];
        if (product) quickAdd(product);
    });
    $('cart-lines').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-act]');
        if (!btn) return;
        var i = Number(btn.dataset.i);
        if (btn.dataset.act === 'inc') cart[i].qty = Math.min(99, cart[i].qty + 1);
        else if (btn.dataset.act === 'dec') { cart[i].qty -= 1; if (cart[i].qty < 1) cart.splice(i, 1); }
        else if (btn.dataset.act === 'del') cart.splice(i, 1);
        else if (btn.dataset.act === 'edit') return openOptions(null, i);
        renderCart();
    });
    ['opt-size', 'opt-toppings'].forEach(function (id) { $(id).addEventListener('change', updateOptionPrice); });
    $('opt-qty').addEventListener('input', updateOptionPrice);
    $('opt-save').addEventListener('click', saveOptions);
    document.querySelectorAll('input[name="order-type"]').forEach(function (r) { r.addEventListener('change', applyType); });
    $('btn-submit').addEventListener('click', submit);
    $('pos-payment').addEventListener('change', function () { qrFixed = null; renderCart(); });
    $('btn-clear').addEventListener('click', function () { cart = []; renderCart(); });
})();
