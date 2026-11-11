/* Chip trạng thái của sản phẩm (📌 ghim, ⭐ đánh giá, 🏷️ khuyến mãi, 🎞️ video, 📎 tệp, 🔒 nháp).
   window.MocBadges.render(product, { only: ['pin', ...] }) trả về chuỗi HTML đã escape.
   - product: object từ API (hoặc object có thuộc tính .raw là object từ API)
   - Chỉ chip nào áp dụng mới được trả về; không áp dụng thì không có gì (chuỗi rỗng).
   Chỉ dùng class .moc-badge-* trong assets/css/style.css, màu lấy từ biến :root. */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function chip(kind, icon, text, title) {
    return (
      '<span class="moc-badge moc-badge-' + kind + '" role="img" title="' + esc(title) +
      '" aria-label="' + esc(title) + '">' + icon + (text ? ' ' + esc(text) : '') + '</span>'
    );
  }

  function render(product, options) {
    var p = product && product.raw ? product.raw : product || {};
    var only = options && options.only;
    var chips = [];

    function want(kind) { return !only || only.indexOf(kind) !== -1; }

    if (want('pin') && Number(p.is_pinned) === 1) {
      chips.push(chip('pin', '📌', '', 'Món được ghim'));
    }

    var ratingCount = Number(p.rating_count || 0);
    var ratingAvg = Number(p.rating_avg || 0);
    if (want('rating') && ratingCount > 0 && ratingAvg > 0) {
      chips.push(chip('rating', '⭐', ratingAvg.toFixed(1),
        'Đánh giá trung bình ' + ratingAvg.toFixed(1) + '/5 (' + ratingCount + ' lượt)'));
    }

    // Voucher áp dụng cho đơn hàng: có voucher đang hiệu lực thì hiện ở mọi món
    if (want('sale') && Number(p.has_voucher) === 1) {
      chips.push(chip('sale', '🏷️', 'Giảm giá', 'Đang có voucher giảm giá áp dụng cho đơn hàng'));
    }

    if (want('video') && Number(p.video_count || 0) > 0) {
      chips.push(chip('video', '🎞️', '', 'Có video giới thiệu'));
    }

    if (want('file') && Number(p.file_count || 0) > 0) {
      chips.push(chip('file', '📎', '', 'Có tài liệu đính kèm'));
    }

    // status = 0: nháp / ngừng bán (chỉ thấy ở trang quản trị vì API công khai đã lọc)
    if (want('draft') && p.status !== undefined && Number(p.status) === 0) {
      chips.push(chip('draft', '🔒', 'Nháp', 'Bản nháp, chưa hiển thị cho khách'));
    }

    return chips.join('');
  }

  window.MocBadges = { render: render };
})();
