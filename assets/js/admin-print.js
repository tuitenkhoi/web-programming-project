/* In hóa đơn / chi tiết đơn hàng trong trang quản trị.
   - Hóa đơn (#invoice-detail-modal): in thành bill quán cà phê khổ 80mm (giấy in nhiệt).
   - Các cửa sổ chi tiết khác (đơn hàng...): in nội dung cửa sổ trong khung ẩn.
   In trong khung ẩn nên không phụ thuộc CSS @media print của trang admin.
   Nạp ở cuối mỗi trang admin:  <script src="../assets/js/admin-print.js"></script> */
(function () {
  'use strict';

  var SHOP = {
    name: 'Mộc Coffee',
    address: '19 Nguyễn Hữu Thọ, Quận 7, TP.HCM',
    phone: '0123 456 789',
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function textOf(id, fallback) {
    var el = document.getElementById(id);
    var value = el ? clean(el.textContent) : '';
    return value && value !== '—' ? value : (fallback || '');
  }

  /* ---------- Nhận diện nút "In" ---------- */
  var PRINT_LABEL = /^\s*in\s+(đơn|don|hóa|hoá|hoa|phiếu|phieu)/i;

  function isPrintButton(btn) {
    if (btn.hasAttribute('data-print')) return true;
    if (btn.id && /print/i.test(btn.id)) return true;
    if (btn.querySelector('.bi-printer, .bi-printer-fill')) return true;
    return PRINT_LABEL.test(clean(btn.textContent));
  }

  /* ---------- Bill quán cà phê ---------- */
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

  function readInvoice() {
    var items = [];
    document.querySelectorAll('#detail-invoice-items tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 4) return;
      items.push({
        name: clean(cells[0].textContent),
        qty: clean(cells[1].textContent),
        unit: clean(cells[2].textContent),
        total: clean(cells[3].textContent),
      });
    });

    return {
      id: textOf('detail-invoice-id', '—'),
      order: textOf('detail-order-id', ''),
      customer: textOf('detail-invoice-customer', 'Khách lẻ'),
      table: textOf('detail-invoice-table', ''),
      time: textOf('detail-invoice-time', ''),
      status: textOf('detail-invoice-status', ''),
      subtotal: textOf('detail-invoice-subtotal', '0đ'),
      service: textOf('detail-invoice-service-fee', '0đ'),
      discount: textOf('detail-invoice-discount', '-0đ'),
      total: textOf('detail-invoice-total', '0đ'),
      method: textOf('detail-payment-method', ''),
      items: items,
    };
  }

  function line(label, value) {
    if (!value) return '';
    return '<div class="row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }

  function buildReceipt(inv) {
    var printedAt = new Date().toLocaleString('vi-VN');
    var paid = /đã thanh toán/i.test(inv.status);

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
      (paid ? '<div class="c"><span class="stamp">Đã thanh toán</span></div>' : '') +
      '<hr class="dash">' +
      '<div class="c"><div class="thanks">Cảm ơn quý khách!</div>' +
      '<div class="sub">Hẹn gặp lại tại ' + esc(SHOP.name) + '</div>' +
      '<div class="tiny">In lúc ' + esc(printedAt) + '</div></div>' +
      '<div class="edge"></div>' +
      '</body></html>';
  }

  /* ---------- In bằng khung ẩn ---------- */
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
    var pending = doc.querySelectorAll('link[rel="stylesheet"]').length;

    function cleanup() {
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 500);
    }

    function go() {
      if (printed) return;
      printed = true;
      try {
        /* Hóa đơn: đặt khổ giấy đúng bằng nội dung (80mm x chiều cao thật) như giấy cuộn in nhiệt */
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

    function oneLoaded() {
      pending--;
      if (pending <= 0) setTimeout(go, 150);
    }

    if (pending === 0) {
      setTimeout(go, 150);
    } else {
      doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
        link.addEventListener('load', oneLoaded);
        link.addEventListener('error', oneLoaded);
      });
      setTimeout(go, 3000);
    }
  }

  /* ---------- In cửa sổ chi tiết bất kỳ (đơn hàng...) ---------- */
  var PRINT_CSS =
    '<style>' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'html,body{background:#fff!important;margin:0;padding:0;overflow:visible!important}' +
    'body{padding:16px;font-size:13px}' +
    '.modal-content{border:0!important;box-shadow:none!important;border-radius:0!important;display:block!important}' +
    '.modal-body{overflow:visible!important;max-height:none!important;padding:0!important}' +
    '.modal-header{padding:0 0 12px!important;border-bottom:1px solid #ddd}' +
    '.order-timeline{flex-wrap:wrap}' +
    '.card,.table,tr{break-inside:avoid}' +
    '@page{margin:12mm}' +
    '</style>';

  function pageStylesheets() {
    var out = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      if (link.href) out.push('<link rel="stylesheet" href="' + link.href + '">');
    });
    return out.join('\n');
  }

  function printModal(modal) {
    var content = modal.querySelector('.modal-content');
    if (!content) return;

    var clone = content.cloneNode(true);
    clone.querySelectorAll('.modal-footer, .btn-close, [data-bs-dismiss], script, button').forEach(function (el) {
      el.remove();
    });

    var match = /MC\d{6,}/.exec(content.textContent || '');
    var title = 'Hoa don ' + (match ? match[0] : 'don-hang');

    printHtml(
      '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + title + '</title>' + pageStylesheets() + PRINT_CSS +
      '</head><body>' + clone.outerHTML + '</body></html>'
    );
  }

  /* ---------- Giao diện hóa đơn trên màn hình: giống tờ bill ---------- */
  (function injectInvoiceScreenStyle() {
    if (!document.getElementById('invoice-detail-modal')) return;
    var style = document.createElement('style');
    style.textContent =
      '#invoice-detail-modal .modal-dialog{max-width:460px}' +
      '#invoice-detail-modal .modal-content{background:#fffdf8}' +
      '#invoice-detail-modal .modal-body{font-family:"Courier New",Consolas,monospace;font-size:14px;' +
      'background:#fffdf8;border-top:1px dashed #cdbfae;border-bottom:1px dashed #cdbfae;margin:0 16px}' +
      '#invoice-detail-modal .modal-header,#invoice-detail-modal .modal-footer{border:0}' +
      '#invoice-detail-modal .modal-body h2{letter-spacing:3px;text-transform:uppercase;color:#3e2723}' +
      '#invoice-detail-modal .modal-body h3{font-size:1rem;letter-spacing:1px;padding:8px 0;margin-top:12px;' +
      'border-top:3px double #6f4e37;border-bottom:1px dashed #6f4e37}' +
      '#invoice-detail-modal .table{--bs-table-bg:transparent;font-size:13px}' +
      '#invoice-detail-modal .table thead th{background:transparent;border-bottom:1px dashed #6f4e37;text-transform:uppercase;font-size:11px}' +
      '#invoice-detail-modal .table td{border-bottom:1px dotted #cdbfae}' +
      '#invoice-detail-modal .col-12.col-md-6{flex:0 0 100%;max-width:100%}' +
      '#invoice-detail-modal .modal-body .row > .col-6{flex:0 0 100%;max-width:100%;display:flex;' +
      'justify-content:space-between;align-items:baseline;gap:12px;text-align:left!important}' +
      '#invoice-detail-modal .modal-body .row > .col-6 > strong{text-align:right;word-break:break-word}' +
      '#invoice-detail-modal .modal-body .row.g-3{--bs-gutter-y:.35rem}' +
      '#invoice-detail-modal hr{border-top:1px dashed #6f4e37;opacity:1}';
    document.head.appendChild(style);
  })();

  /* ---------- Bắt cú nhấp nút In ---------- */
  document.addEventListener('click', function (event) {
    var btn = event.target.closest && event.target.closest('button, a, [role="button"]');
    if (!btn) return;

    var modal = btn.closest('.modal');
    if (!modal || !isPrintButton(btn)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (modal.id === 'invoice-detail-modal') {
      printHtml(buildReceipt(readInvoice()));
    } else if (btn.id === 'print-order-detail' || /order/i.test(modal.id)) {
      goToInvoice(modal);
    } else {
      printModal(modal);
    }
  }, true);

  /* ---------- Đơn hàng: "In đơn" => chuyển sang hóa đơn tương ứng ---------- */
  function goToInvoice(modal) {
    var el = modal.querySelector('#detail-order-id');
    var code = el ? clean(el.textContent) : '';
    if (!code || code === '—') {
      var match = /\b[A-Z]{2}\d{8,}\b/.exec(modal.textContent || '');
      code = match ? match[0] : '';
    }
    if (!code) {
      printModal(modal); // không tìm thấy mã đơn thì in như cũ
      return;
    }
    location.href = 'invoices.html?order=' + encodeURIComponent(code) + '&print=1';
  }

  /* ---------- Trang hóa đơn: tự mở hóa đơn của đơn được chuyển sang ---------- */
  function openInvoiceFromQuery() {
    var body = document.getElementById('invoice-table-body');
    if (!body) return;

    var params = new URLSearchParams(location.search);
    var code = params.get('order');
    if (!code) return;

    var search = document.getElementById('invoice-search-input');
    if (search) {
      search.value = code;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function notice(text) {
      var holder = document.querySelector('.admin-content');
      if (!holder) return;
      var box = document.createElement('div');
      box.className = 'alert alert-warning';
      box.textContent = text;
      holder.insertBefore(box, holder.firstChild);
    }

    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var row = Array.prototype.find.call(body.querySelectorAll('tr'), function (tr) {
        return tr.textContent.indexOf(code) !== -1 && tr.querySelector('button, a');
      });

      if (row) {
        clearInterval(timer);
        var view = row.querySelector('button[data-act="view"], [data-bs-target="#invoice-detail-modal"], .view-invoice-button') ||
          Array.prototype.find.call(row.querySelectorAll('button, a'), function (b) {
            return /^xem/i.test(clean(b.textContent));
          });
        if (!view) return;
        view.click();

        if (params.get('print') === '1') {
          var waits = 0;
          var wait = setInterval(function () {
            waits++;
            var ready = document.querySelector('#detail-invoice-items td:nth-child(4)');
            if (ready && textOf('detail-order-id') !== '') {
              clearInterval(wait);
              setTimeout(function () {
                var printBtn = document.getElementById('print-detail-invoice');
                if (printBtn) printBtn.click();
              }, 400);
            } else if (waits > 25) {
              clearInterval(wait);
            }
          }, 200);
        }
      } else if (tries > 30) {
        clearInterval(timer);
        notice('Không tìm thấy hóa đơn của đơn ' + code + '.');
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openInvoiceFromQuery);
  } else {
    openInvoiceFromQuery();
  }

  window.MocPrint = { buildReceipt: buildReceipt, readInvoice: readInvoice };
})();
