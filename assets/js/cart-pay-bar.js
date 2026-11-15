/* Trang giỏ hàng trên điện thoại: nút "Thanh toán" luôn dính ở đáy màn hình (kèm tổng tiền),
   bấm là chạy đúng nút "Tiến hành thanh toán" của trang, không phải cuộn xuống cuối. */
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        var total = document.getElementById('cart-total');
        var checkout = document.getElementById('checkout-button');
        if (!total || !checkout) return;

        var bar = document.createElement('div');
        bar.id = 'moc-pay-bar';
        bar.innerHTML = '<div><small>Tổng cộng</small><strong id="mpb-total">0đ</strong></div>' +
            '<button type="button" class="btn btn-coffee btn-lg">Thanh toán <i class="bi bi-arrow-right ms-1"></i></button>';
        document.body.appendChild(bar);

        var style = document.createElement('style');
        style.textContent =
            '#moc-pay-bar{display:none;position:fixed;left:0;right:0;bottom:0;z-index:1030;align-items:center;justify-content:space-between;gap:1rem;' +
            'padding:.7rem 1rem calc(.7rem + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.18)}' +
            '#moc-pay-bar small{display:block;color:#6c757d;line-height:1}#moc-pay-bar strong{font-size:1.2rem;color:#dc3545}' +
            '#moc-pay-bar.show{display:flex}' +
            '@media (min-width:992px){#moc-pay-bar{display:none!important}}' +
            '@media (max-width:991.98px){body.has-pay-bar{padding-bottom:5rem}}';
        document.head.appendChild(style);

        function sync() {
            var text = (total.textContent || '').trim();
            var amount = parseInt(text.replace(/\D/g, ''), 10) || 0;
            document.getElementById('mpb-total').textContent = text || '0đ';
            var show = amount > 0 && !checkout.disabled;
            bar.classList.toggle('show', show);
            document.body.classList.toggle('has-pay-bar', show);
        }
        bar.querySelector('button').addEventListener('click', function () { checkout.click(); });
        new MutationObserver(sync).observe(total, { childList: true, characterData: true, subtree: true });
        new MutationObserver(sync).observe(checkout, { attributes: true, attributeFilter: ['disabled'] });
        sync();
    });
})();
