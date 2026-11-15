/* admin/tables.html: in mã QR cho bàn. Khách quét -> /pages/menu.html?table=MÃ_BÀN (đặt món đúng bàn đó).
   Mã tạo ngay trên trình duyệt (assets/js/vendor/qrcode.js), in bằng khung ẩn như hóa đơn. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;
    var btn = document.getElementById('print-table-qr-button');
    if (!btn) return;

    function esc(v) { return A.esc(v); }

    function svg(url) {
        var qr = qrcode(0, 'M');
        qr.addData(url, 'Byte');
        qr.make();
        var n = qr.getModuleCount(), q = 2, path = '';
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) path += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + q * 2) + ' ' + (n + q * 2) + '" shape-rendering="crispEdges">' +
            '<rect width="100%" height="100%" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
    }

    function sheet(tables) {
        var origin = location.origin;
        var cards = tables.map(function (t) {
            var url = origin + '/pages/menu.html?table=' + encodeURIComponent(t.table_code);
            return '<div class="card"><div class="brand">Mộc Coffee</div>' +
                '<div class="name">' + esc(t.table_name || ('Bàn ' + t.table_code)) + '</div>' +
                '<div class="qr">' + svg(url) + '</div>' +
                '<div class="hint">Quét mã để gọi món tại bàn</div>' +
                '<div class="url">' + esc(url) + '</div></div>';
        }).join('');
        return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR các bàn</title><style>' +
            '*{box-sizing:border-box}@page{size:A4;margin:10mm}body{margin:0;font-family:Arial,sans-serif;color:#000}' +
            '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8mm}' +
            '.card{border:2px solid #3e2723;border-radius:6mm;padding:6mm;text-align:center;break-inside:avoid;page-break-inside:avoid}' +
            '.brand{font-size:14pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3e2723}' +
            '.name{font-size:22pt;font-weight:700;margin:2mm 0}.qr{width:60mm;margin:0 auto}.qr svg{display:block;width:100%;height:auto}' +
            '.hint{font-size:11pt;margin-top:3mm;font-weight:600}.url{font-size:7pt;color:#555;margin-top:2mm;word-break:break-all}' +
            '</style></head><body><div class="grid">' + cards + '</div></body></html>';
    }

    function printHtml(html) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden';
        document.body.appendChild(iframe);
        var doc = iframe.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
        setTimeout(function () {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error(e); }
            setTimeout(function () { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 60000);
        }, 200);
    }

    btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
            if (typeof qrcode !== 'function') throw new Error('Không tải được thư viện tạo mã QR.');
            var res = await fetch('/api/tables');
            var tables = await res.json();
            if (!Array.isArray(tables) || !tables.length) throw new Error('Chưa có bàn nào để in mã QR.');
            printHtml(sheet(tables));
        } catch (err) {
            A.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });
});
