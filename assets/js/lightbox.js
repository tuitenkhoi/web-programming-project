/* Lightbox đơn giản: window.MocLightbox.open(images, startIndex)
   images: mảng { url, alt }. Đóng bằng nút ×, Esc hoặc bấm nền; ← → để chuyển ảnh.
   Có role="dialog" aria-modal, trả focus về phần tử đã mở khi đóng. */
(function () {
  'use strict';

  var root = null;
  var img = null;
  var counter = null;
  var prev = null;
  var next = null;
  var images = [];
  var index = 0;
  var opener = null;

  function build() {
    root = document.createElement('div');
    root.className = 'moc-lightbox';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Xem ảnh phóng to');

    img = document.createElement('img');
    img.alt = '';

    function button(className, label, text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = className;
      b.setAttribute('aria-label', label);
      b.textContent = text;
      return b;
    }
    var close = button('moc-lightbox-close', 'Đóng', '×');
    prev = button('moc-lightbox-prev', 'Ảnh trước', '‹');
    next = button('moc-lightbox-next', 'Ảnh sau', '›');

    counter = document.createElement('span');
    counter.className = 'visually-hidden';
    counter.setAttribute('aria-live', 'polite');

    root.appendChild(img);
    root.appendChild(close);
    root.appendChild(prev);
    root.appendChild(next);
    root.appendChild(counter);
    document.body.appendChild(root);

    close.addEventListener('click', hide);
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    root.addEventListener('click', function (event) { if (event.target === root) hide(); });
    document.addEventListener('keydown', function (event) {
      if (root.hidden) return;
      if (event.key === 'Escape') hide();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'Tab') {
        // giữ focus trong lightbox
        var focusable = Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return !b.hidden; });
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  function show() {
    var item = images[index];
    img.src = item.url;
    img.alt = item.alt || '';
    prev.hidden = next.hidden = images.length < 2;
    counter.textContent = 'Ảnh ' + (index + 1) + ' / ' + images.length;
  }

  function go(step) {
    if (images.length < 2) return;
    index = (index + step + images.length) % images.length;
    show();
  }

  function hide() {
    root.hidden = true;
    document.body.style.overflow = '';
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  window.MocLightbox = {
    open: function (list, start) {
      if (!list || !list.length) return;
      if (!root) build();
      images = list;
      index = Math.min(Math.max(Number(start) || 0, 0), list.length - 1);
      opener = document.activeElement;
      show();
      root.hidden = false;
      document.body.style.overflow = 'hidden';
      root.querySelector('.moc-lightbox-close').focus();
    },
    close: function () { if (root && !root.hidden) hide(); },
  };
})();
