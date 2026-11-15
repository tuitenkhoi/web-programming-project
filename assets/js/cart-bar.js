/* Thanh giỏ hàng cố định ở đáy màn hình điện thoại: chọn món xong bấm "Xem giỏ & thanh toán" là tới thẳng giỏ hàng,
   không cần mở menu 3 gạch ở trên. Hiện khi giỏ có món; ẩn trên máy tính (đã có nút Giỏ hàng ở thanh trên). */
(function () {
    'use strict';
    var KEY = 'mocCoffeeCart';
    var bar = null;

    function readCart() {
        try {
            var cart = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(cart) ? cart : [];
        } catch (e) { return []; }
    }
    function money(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

    function build() {
        bar = document.createElement('a');
        bar.id = 'moc-cart-bar';
        bar.href = (/\/pages\//.test(location.pathname) ? '' : 'pages/') + 'cart.html';
        bar.setAttribute('aria-label', 'Xem giỏ hàng và thanh toán');
        bar.innerHTML =
            '<span class="mcb-info"><i class="bi bi-cart3"></i><span class="mcb-count" id="mcb-count">0</span>' +
            '<span class="mcb-total" id="mcb-total">0đ</span></span>' +
            '<span class="mcb-go">Xem giỏ &amp; thanh toán <i class="bi bi-arrow-right"></i></span>';
        document.body.appendChild(bar);

        var style = document.createElement('style');
        style.textContent =
            '#moc-cart-bar{display:none;position:fixed;left:0;right:0;bottom:0;z-index:1030;align-items:center;justify-content:space-between;gap:.75rem;' +
            'padding:.7rem 1rem calc(.7rem + env(safe-area-inset-bottom));background:#3e2723;color:#fff;text-decoration:none;box-shadow:0 -4px 16px rgba(0,0,0,.25)}' +
            '#moc-cart-bar.show{display:flex}' +
            '#moc-cart-bar .mcb-info{display:flex;align-items:center;gap:.6rem;font-weight:700}' +
            '#moc-cart-bar .mcb-info .bi{font-size:1.3rem}' +
            '#moc-cart-bar .mcb-count{background:#ff7043;border-radius:999px;min-width:1.6rem;height:1.6rem;display:inline-flex;align-items:center;justify-content:center;font-size:.85rem;padding:0 .4rem}' +
            '#moc-cart-bar .mcb-go{background:#ffb74d;color:#3e2723;border-radius:.6rem;padding:.55rem .9rem;font-weight:700;white-space:nowrap}' +
            '@media (min-width:992px){#moc-cart-bar{display:none!important}}' +
            '@media (max-width:991.98px){body.has-cart-bar{padding-bottom:4.8rem}}';
        document.head.appendChild(style);
    }

    function update() {
        var cart = readCart();
        var qty = 0, total = 0;
        cart.forEach(function (item) {
            var q = Math.max(1, Number(item.quantity || 1));
            qty += q;
            total += q * Number(item.price || item.unitPrice || 0);
        });
        if (!bar) build();
        document.getElementById('mcb-count').textContent = qty;
        document.getElementById('mcb-total').textContent = money(total);
        bar.classList.toggle('show', qty > 0);
        document.body.classList.toggle('has-cart-bar', qty > 0);
    }

    document.addEventListener('DOMContentLoaded', function () {
        update();
        window.addEventListener('mocCoffeeCartUpdated', update);
        window.addEventListener('storage', function (e) { if (e.key === KEY) update(); });
    });
})();
