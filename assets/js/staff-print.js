/* In hóa đơn cho nhân viên: GIỐNG HỆT hóa đơn ở trang admin (assets/js/admin-print.js):
   bill quán cà phê khổ 80mm, in bằng khung ẩn nên không phụ thuộc CSS của trang.
   Dùng:  Staff.printInvoice(order)   (order = dữ liệu từ GET /api/orders/:id, có mảng items) */
(function () {
    'use strict';

    var SHOP = {
        name: 'Mộc Coffee',
        address: '19 Nguyễn Hữu Thọ, Quận 7, TP.HCM',
        phone: '0123 456 789'
    };

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function money(v) { return new Intl.NumberFormat('vi-VN').format(Number(v) || 0) + ' ₫'; }
    function code(o) { return 'HD' + String(o.id).padStart(4, '0'); }
    function timeText(value) {
        var d = new Date(value);
        return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    var CUP_SVG =
        '<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">' +
        '<path d="M16 6c-2 3 2 4 0 8M24 4c-2 3 2 5 0 9M32 6c-2 3 2 4 0 8" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M8 20h28v10a12 12 0 0 1-12 12h-4A12 12 0 0 1 8 30z" fill="#000"/>' +
        '<path d="M36 23h3a5 5 0 0 1 0 10h-4" fill="none" stroke="#000" stroke-width="3"/>' +
        '<rect x="10" y="44" width="26" height="2.5" rx="1.2" fill="#000"/></svg>';

    var BILL_CSS =
        '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '@page{size:80mm auto;margin:0}' +
        'html,body{margin:0;padding:0;background:#fff;color:#000}' +
        'html{height:auto}' +
        'body{box-sizing:border-box;width:80mm;margin:0 auto;padding:6mm 5mm 8mm;page-break-inside:avoid;break-inside:avoid;font-family:"Courier New",Consolas,"Liberation Mono",monospace;font-size:12px;line-height:1.45}' +
        '.c{text-align:center}' +
        '.logo{display:block;margin:0 auto 2px}' +
        '.shop{font-size:20px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:2px 0}' +
        '.sub{font-size:11px}' +
        '.dash{border:0;border-top:1px dashed #000;margin:8px 0}' +
        '.dbl{border:0;border-top:3px double #000;margin:8px 0}' +
        '.title{font-size:15px;font-weight:700;letter-spacing:1px;margin:2px 0}' +
        '.code{font-size:13px;font-weight:700}' +
        '.row{display:flex;justify-content:space-between;gap:8px}' +
        '.row>span:first-child{flex:0 0 auto}' +
        '.row>b,.row>span:last-child{text-align:right;word-break:break-word}' +
        '.head{display:flex;justify-content:space-between;font-weight:700;text-transform:uppercase;font-size:11px}' +
        '.item{margin:5px 0}' +
        '.item .nm{font-weight:700;word-break:break-word}' +
        '.total{display:flex;justify-content:space-between;align-items:center;border:2px solid #000;padding:5px 7px;margin:8px 0 6px;font-size:15px;font-weight:700}' +
        '.stamp{display:inline-block;border:2px solid #000;padding:2px 10px;margin-top:6px;font-weight:700;letter-spacing:1px;transform:rotate(-3deg);text-transform:uppercase}' +
        '.thanks{margin-top:10px;font-weight:700;font-size:13px}' +
        '.tiny{font-size:10px;margin-top:4px}' +
        '.edge{height:8px;margin:10px -5mm -8mm;background:radial-gradient(circle at 5px 0,transparent 4px,#000 4.5px,#000 5px,transparent 5.5px) 0 0/10px 8px repeat-x}';

    function line(label, value) {
        if (!value) return '';
        return '<div class="row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
    }

    // Chuyển đơn từ API sang đúng các trường mà hóa đơn admin hiển thị
    function toInvoice(o) {
        return {
            id: code(o),
            order: o.order_code,
            customer: o.customer_name + (o.customer_phone ? ' · ' + o.customer_phone : ''),
            table: o.order_type === 'at_table' ? (o.table_code || 'Chưa có bàn') : 'Mang đi',
            time: timeText(o.created_at),
            paid: o.payment_status === 'paid',
            subtotal: money(o.subtotal),
            service: money(o.service_fee),
            discount: '-' + money(o.discount_amount),
            total: money(o.total_amount),
            method: o.payment_method_text || '',
            items: (o.items || []).map(function (it) {
                return { name: it.product_name, qty: it.quantity, unit: money(it.unit_price), total: money(it.line_total) };
            })
        };
    }

    function buildReceipt(inv) {
        var printedAt = new Date().toLocaleString('vi-VN');
        var itemsHtml = inv.items.length
            ? inv.items.map(function (it) {
                return '<div class="item"><div class="nm">' + esc(it.name) + '</div>' +
                    '<div class="row"><span>' + esc(it.qty) + ' x ' + esc(it.unit) + '</span><span>' + esc(it.total) + '</span></div></div>';
            }).join('')
            : '<div class="c">(Không có món)</div>';

        return '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
            '<title>Hoa don ' + esc(inv.id) + '</title><style>' + BILL_CSS + '</style></head><body>' +
            '<div class="c">' + CUP_SVG +
            '<div class="shop">' + esc(SHOP.name) + '</div>' +
            '<div class="sub">' + esc(SHOP.address) + '</div>' +
            '<div class="sub">ĐT: ' + esc(SHOP.phone) + '</div></div>' +
            '<hr class="dbl">' +
            '<div class="c"><div class="title">HÓA ĐƠN THANH TOÁN</div><div class="code">' + esc(inv.id) + '</div></div>' +
            '<hr class="dash">' +
            line('Mã đơn:', inv.order) +
            line('Khách hàng:', inv.customer) +
            line('Bàn:', inv.table) +
            line('Thời gian:', inv.time) +
            '<hr class="dash">' +
            '<div class="head"><span>Món</span><span>Thành tiền</span></div>' +
            '<hr class="dash" style="margin:4px 0">' +
            itemsHtml +
            '<hr class="dash">' +
            line('Tạm tính', inv.subtotal) +
            line('Phí phục vụ', inv.service) +
            line('Giảm giá', inv.discount) +
            '<div class="total"><span>TỔNG CỘNG</span><span>' + esc(inv.total) + '</span></div>' +
            line('Thanh toán:', inv.method) +
            (inv.paid ? '<div class="c"><span class="stamp">Đã thanh toán</span></div>' : '') +
            '<hr class="dash">' +
            '<div class="c"><div class="thanks">Cảm ơn quý khách!</div>' +
            '<div class="sub">Hẹn gặp lại tại ' + esc(SHOP.name) + '</div>' +
            '<div class="tiny">In lúc ' + esc(printedAt) + '</div></div>' +
            '<div class="edge"></div>' +
            '</body></html>';
    }

    // In bằng khung ẩn (giống admin-print.js)
    function printHtml(html) {
        var iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:80mm;height:1200px;border:0;visibility:hidden;pointer-events:none';
        document.body.appendChild(iframe);

        var doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        var printed = false;
        function cleanup() {
            setTimeout(function () { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 500);
        }
        function go() {
            if (printed) return;
            printed = true;
            try {
                // Khổ giấy đúng bằng nội dung (80mm x chiều cao thật) như giấy cuộn in nhiệt
                if (doc.querySelector('.edge') && doc.body) {
                    var mm = Math.ceil(doc.body.scrollHeight * 25.4 / 96) + 6;
                    var st = doc.createElement('style');
                    st.textContent = '@page{size:80mm ' + mm + 'mm;margin:0}';
                    doc.head.appendChild(st);
                }
                iframe.contentWindow.focus();
                iframe.contentWindow.addEventListener('afterprint', cleanup);
                iframe.contentWindow.print();
            } catch (error) {
                console.error('Không mở được hộp thoại in:', error);
            }
            setTimeout(cleanup, 60000);
        }
        setTimeout(go, 150);
    }

    window.StaffPrint = {
        printInvoice: function (order) { printHtml(buildReceipt(toInvoice(order))); },
        buildReceipt: function (order) { return buildReceipt(toInvoice(order)); }
    };
    if (window.Staff) window.Staff.printInvoice = window.StaffPrint.printInvoice;
    else document.addEventListener('DOMContentLoaded', function () {
        if (window.Staff) window.Staff.printInvoice = window.StaffPrint.printInvoice;
    });
})();
