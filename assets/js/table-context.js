/* Khách quét mã QR trên bàn -> /pages/menu.html?table=T01.
   Script này ghi nhớ bàn (6 giờ), hiện thanh "Bạn đang ngồi bàn ..." và để trang giỏ hàng tự chọn đúng bàn.
   Nạp ở các trang khách: window.MocTable.get() -> { code, name } hoặc null; window.MocTable.clear(). */
(function () {
    'use strict';
    var KEY = 'mocCoffeeTable';
    var TTL = 6 * 60 * 60 * 1000;

    function read() {
        try {
            var v = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (v && v.code && v.ts && Date.now() - v.ts < TTL) return v;
            localStorage.removeItem(KEY);
        } catch (e) { /* bỏ qua */ }
        return null;
    }
    function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
    function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ } }

    window.MocTable = {
        get: read,
        clear: clear,
        // Địa chỉ trang đặt món của một bàn (dùng khi in mã QR)
        urlFor: function (code) { return location.origin + '/pages/menu.html?table=' + encodeURIComponent(code); }
    };

    function banner() {
        var t = read();
        var old = document.getElementById('moc-table-banner');
        if (old) old.remove();
        if (!t) return;
        var el = document.createElement('div');
        el.id = 'moc-table-banner';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:sticky;top:0;z-index:1040;background:#3e2723;color:#fff;text-align:center;padding:.45rem .75rem;font-size:.9rem';
        el.innerHTML = '<i class="bi bi-cup-hot-fill me-1"></i>Bạn đang đặt món tại <strong></strong> ' +
            '<button type="button" style="background:none;border:0;color:#ffcc80;text-decoration:underline;margin-left:.5rem;font-size:.85rem">Không phải bàn này?</button>';
        el.querySelector('strong').textContent = t.name || ('Bàn ' + t.code);
        el.querySelector('button').addEventListener('click', function () { clear(); banner(); });
        document.body.insertBefore(el, document.body.firstChild);
    }

    async function init() {
        var code = (new URLSearchParams(location.search).get('table') || '').trim().toUpperCase();
        if (/^[A-Z0-9-]{1,20}$/.test(code)) {
            try {
                var res = await fetch('/api/tables');
                var tables = await res.json();
                var t = Array.isArray(tables) ? tables.filter(function (x) { return x.table_code === code; })[0] : null;
                if (t && t.status !== 'maintenance') {
                    write({ code: t.table_code, name: t.table_name || ('Bàn ' + t.table_code), ts: Date.now() });
                } else if (t) {
                    clear();
                    alert('Bàn này đang bảo trì. Vui lòng nhờ nhân viên hỗ trợ.');
                }
            } catch (e) { /* mất mạng: bỏ qua, vẫn dùng bình thường */ }
        }
        banner();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
