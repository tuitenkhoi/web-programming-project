/* QR chuyển khoản VietQR (chuẩn NAPAS 247) có sẵn SỐ TIỀN + NỘI DUNG.
   - Tạo mã NGAY TRÊN TRÌNH DUYỆT bằng assets/js/vendor/qrcode.js, không gọi website ngoài,
     nên không bị chặn bởi mạng/CSP và không còn rơi về ảnh QR cũ.
   - Đọc số tiền / nội dung mà payment.js đang hiển thị, nên không phải sửa payment.js.
   Nạp SAU payment.js:
     <script src="../assets/js/vendor/qrcode.js"></script>
     <script src="../assets/js/payment-qr.js"></script> */
(function () {
  'use strict';

  var BANK_BIN = '970423';          // TPBank (TienPhongBank)
  var ACCOUNT_NO = '00003885223';   // số tài khoản, viết liền
  var ACCOUNT_NAME_FALLBACK = 'PHUNG NGUYEN HOANG KHOI';

  function tlv(id, value) {
    var len = String(value.length);
    if (len.length < 2) len = '0' + len;
    return id + len + value;
  }

  function crc16(text) {
    var crc = 0xFFFF;
    for (var i = 0; i < text.length; i++) {
      crc ^= text.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    var hex = crc.toString(16).toUpperCase();
    while (hex.length < 4) hex = '0' + hex;
    return hex;
  }

  // Bỏ dấu, chỉ giữ chữ-số-gạch để ngân hàng nhận đúng nội dung.
  function cleanContent(text) {
    return String(text || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 _-]/g, '')
      .trim()
      .slice(0, 25);
  }

  function buildPayload(amount, content) {
    var merchant = tlv('00', 'A000000727') +
      tlv('01', tlv('00', BANK_BIN) + tlv('01', ACCOUNT_NO)) +
      tlv('02', 'QRIBFTTA');

    var body =
      tlv('00', '01') +
      tlv('01', '12') +                       // 12 = mã động (có số tiền)
      tlv('38', merchant) +
      tlv('53', '704') +                      // VND
      tlv('54', String(amount)) +
      tlv('58', 'VN') +
      tlv('62', tlv('08', cleanContent(content))) +
      '6304';
    return body + crc16(body);
  }

  // Xuất để kiểm thử bằng Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPayload: buildPayload, crc16: crc16, cleanContent: cleanContent };
    return;
  }

  var wrapper = document.querySelector('#bank-payment-content .qr-code-wrapper');
  var amountEl = document.getElementById('bank-transfer-amount');
  var contentEl = document.getElementById('transfer-content');
  if (!wrapper || !amountEl || !contentEl) return;

  var originalHtml = wrapper.innerHTML; // ảnh QR tĩnh cũ, chỉ dùng khi không tạo được mã
  var lastKey = '';

  function digits(text) {
    return String(text || '').replace(/\D/g, '');
  }

  function toSvg(qr) {
    var n = qr.getModuleCount();
    var quiet = 2;
    var size = n + quiet * 2;
    var path = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
      '" shape-rendering="crispEdges" role="img" aria-label="Mã QR thanh toán Mộc Coffee"' +
      ' style="display:block;width:100%;height:auto">' +
      '<rect width="100%" height="100%" fill="#fff"/>' +
      '<path d="' + path + '" fill="#000"/></svg>';
  }

  function showNote(amount, content) {
    var note = document.getElementById('qr-amount-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'qr-amount-note';
      note.style.cssText = 'margin-top:8px;font-size:12px;font-weight:600;color:#198754;text-align:center';
      wrapper.parentNode.insertBefore(note, wrapper.nextSibling);
    }
    note.textContent = '✓ Mã đã kèm sẵn ' + amount.toLocaleString('vi-VN') + 'đ · ' + content;
  }

  function update() {
    var amount = parseInt(digits(amountEl.textContent), 10) || 0;
    var content = (contentEl.textContent || '').trim();
    var key = amount + '|' + content;
    if (key === lastKey) return;
    lastKey = key;

    if (amount <= 0 || !content || typeof qrcode !== 'function') {
      wrapper.innerHTML = originalHtml;
      return;
    }

    try {
      var qr = qrcode(0, 'M');
      var payload = buildPayload(amount, content);
      qr.addData(payload, 'Byte');
      qr.make();
      wrapper.innerHTML = toSvg(qr);
      wrapper.setAttribute('data-qr-amount', String(amount));
      wrapper.setAttribute('data-qr-content', cleanContent(content));
      wrapper.setAttribute('data-qr-payload', payload);
      showNote(amount, cleanContent(content));
      if (window.console) console.info('[Mộc Coffee] VietQR payload:', payload);
    } catch (error) {
      console.error('Không tạo được mã QR:', error);
      wrapper.innerHTML = originalHtml;
    }
  }

  var observer = new MutationObserver(update);
  [amountEl, contentEl].forEach(function (el) {
    observer.observe(el, { childList: true, characterData: true, subtree: true });
  });
  document.querySelectorAll('.payment-method-radio').forEach(function (radio) {
    radio.addEventListener('change', update);
  });

  update();
})();
