/* staff/menu.html: đánh dấu món hết trong ngày (hoặc bán lại). Dữ liệu từ /api/products (có cờ sold_out). */
(function () {
    'use strict';
    var S = window.Staff;
    var products = [];
    var activeCat = 'all';
    var DEFAULT_IMAGE = '../assets/images/products/default-product.jpg';
    var $ = function (id) { return document.getElementById(id); };

    function imageOf(p) {
        var image = p.image_url || p.image || '';
        if (!image) return DEFAULT_IMAGE;
        if (/^https?:\/\//i.test(image) || image.indexOf('/uploads/') === 0) return image;
        if (image.indexOf('assets/') === 0) return '../' + image;
        if (image.indexOf('../assets/') === 0) return image;
        return '../assets/images/products/' + image;
    }

    function renderCats() {
        var names = [];
        products.forEach(function (p) { if (names.indexOf(p.category_name) === -1) names.push(p.category_name); });
        $('sold-cats').innerHTML = ['all'].concat(names).map(function (n) {
            return '<button type="button" class="btn btn-sm ' + (activeCat === n ? 'btn-coffee' : 'btn-outline-secondary') + '" data-cat="' + S.esc(n) + '">' + (n === 'all' ? 'Tất cả' : S.esc(n)) + '</button>';
        }).join('');
    }

    function render() {
        var q = ($('sold-search').value || '').trim().toLowerCase();
        var list = products.filter(function (p) {
            return (activeCat === 'all' || p.category_name === activeCat) && (!q || String(p.name).toLowerCase().indexOf(q) !== -1);
        });
        var soldCount = products.filter(function (p) { return p.sold_out; }).length;
        $('sold-summary').textContent = soldCount ? soldCount + ' món đang hết hôm nay' : 'Hiện chưa có món nào hết.';
        $('sold-grid').innerHTML = list.length ? list.map(function (p) {
            return '<div class="product-tile" style="cursor:default;' + (p.sold_out ? 'border-color:#dc3545' : '') + '">' +
                '<img src="' + S.esc(imageOf(p)) + '" alt="" loading="lazy" style="' + (p.sold_out ? 'filter:grayscale(1);opacity:.55' : '') + '" onerror="this.onerror=null;this.src=\'' + DEFAULT_IMAGE + '\'" />' +
                '<div class="tile-body"><div class="tile-name">' + S.esc(p.name) + '</div>' +
                '<div class="text-secondary small mb-2 mt-1">' + S.money(p.price) + '</div>' +
                '<button type="button" class="btn btn-sm w-100 ' + (p.sold_out ? 'btn-success' : 'btn-outline-danger') + '" data-id="' + p.id + '" data-sold="' + (p.sold_out ? '0' : '1') + '">' +
                (p.sold_out ? 'Bán lại' : 'Hết món') + '</button></div></div>';
        }).join('') : '<div class="text-secondary py-4">Không có món nào phù hợp.</div>';
    }

    async function load() {
        try {
            var res = await S.api('/api/products');
            products = res.data || [];
            renderCats();
            render();
        } catch (err) {
            $('sold-grid').innerHTML = '<div class="alert alert-danger">Không tải được thực đơn: ' + S.esc(err.message) + '</div>';
        }
    }

    $('sold-grid').addEventListener('click', async function (event) {
        var btn = event.target.closest('button[data-id]');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        try {
            var res = await S.api('/api/staff/products/' + encodeURIComponent(btn.dataset.id) + '/sold-out', {
                method: 'PUT',
                body: JSON.stringify({ sold_out: btn.dataset.sold === '1' })
            });
            var p = products.filter(function (x) { return String(x.id) === btn.dataset.id; })[0];
            if (p) p.sold_out = res.data.sold_out;
            S.toast(res.message);
            render();
        } catch (err) {
            S.toast(err.message, 'error');
            btn.disabled = false;
        }
    });
    $('sold-cats').addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-cat]');
        if (!btn) return;
        activeCat = btn.dataset.cat;
        renderCats();
        render();
    });
    $('sold-search').addEventListener('input', S.debounce(render, 150));
    $('sold-refresh').addEventListener('click', load);

    S.ready(function () {
        load();
        window.addEventListener('mocCoffeeRealtime', function (e) { if (e.detail && e.detail.event === 'product:updated') load(); });
    });
})();
