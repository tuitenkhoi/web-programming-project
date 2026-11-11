/* Hộp thoại xác nhận dùng chung (thay window.confirm).
   window.MocConfirm.show({ title, message, danger, onConfirm, confirmText, cancelText })
     - message được chèn bằng textContent nên an toàn với tên do người dùng nhập
     - focus vào nút Hủy khi mở, bấm Esc hoặc Hủy chỉ đóng hộp thoại, KHÔNG gọi onConfirm
     - onConfirm có thể là async; lỗi ném ra được ghi vào console (nơi gọi nên tự báo lỗi cho người dùng)
   Cần Bootstrap 5 JS đã được nạp trước. */
(function () {
  'use strict';

  var modalEl = null;
  var modal = null;
  var pending = null; // { onConfirm }
  var opener = null;  // phần tử đang giữ focus trước khi mở, để trả focus lại khi đóng

  function build() {
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'moc-confirm-modal';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('role', 'alertdialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'moc-confirm-title');
    modalEl.setAttribute('aria-describedby', 'moc-confirm-message');
    modalEl.innerHTML =
      '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content border-0">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title h5" id="moc-confirm-title"></h2>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>' +
          '</div>' +
          '<div class="modal-body"><p class="mb-0" id="moc-confirm-message"></p></div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-outline-secondary" data-moc-cancel data-bs-dismiss="modal">Hủy</button>' +
            '<button type="button" class="btn btn-danger" data-moc-ok>Xác nhận</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);
    modal = bootstrap.Modal.getOrCreateInstance(modalEl, { keyboard: true });

    // Mở xong thì đưa focus vào nút Hủy (hành động an toàn)
    modalEl.addEventListener('shown.bs.modal', function () {
      // Bootstrap tự đặt role="dialog" khi mở; đây là hộp cảnh báo nên giữ alertdialog
      modalEl.setAttribute('role', 'alertdialog');
      modalEl.setAttribute('aria-modal', 'true');
      // Mở chồng lên một modal khác (vd form sản phẩm): đưa hộp xác nhận và nền của nó lên trên
      modalEl.style.zIndex = '1065';
      var backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 1) backdrops[backdrops.length - 1].style.zIndex = '1060';
      var cancel = modalEl.querySelector('[data-moc-cancel]');
      if (cancel) cancel.focus();
    });

    modalEl.querySelector('[data-moc-ok]').addEventListener('click', function () {
      var job = pending;
      pending = null; // mỗi lần mở chỉ chạy tối đa một lần
      modal.hide();
      if (job && typeof job.onConfirm === 'function') {
        Promise.resolve()
          .then(job.onConfirm)
          .catch(function (error) { console.error('Lỗi khi thực hiện thao tác đã xác nhận:', error); });
      }
    });

    // Đóng bằng Hủy / Esc / nút X / bấm nền: bỏ việc đang chờ
    modalEl.addEventListener('hidden.bs.modal', function () {
      pending = null;
      // Trả focus về nơi đã mở (vd nút xóa trong form sản phẩm) để Esc/Tab của modal bên dưới vẫn hoạt động
      if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
      else {
        // Nơi mở đã bị xóa khỏi trang (vd vừa xóa dòng) -> đưa focus về modal còn mở bên dưới, nếu có
        var below = document.querySelector('.modal.show:not(#moc-confirm-modal)');
        if (below) below.focus();
      }
      opener = null;
    });
  }

  window.MocConfirm = {
    show: function (options) {
      options = options || {};
      if (typeof bootstrap === 'undefined' || !document.body) {
        // Không có Bootstrap thì dùng hộp xác nhận của trình duyệt để vẫn không xóa nhầm
        if (window.confirm(options.message || 'Bạn có chắc chắn?') && typeof options.onConfirm === 'function') {
          options.onConfirm();
        }
        return;
      }
      if (!modalEl) build();

      var danger = options.danger !== false;
      var ok = modalEl.querySelector('[data-moc-ok]');
      modalEl.querySelector('#moc-confirm-title').textContent = options.title || 'Xác nhận';
      modalEl.querySelector('#moc-confirm-message').textContent = options.message || 'Bạn có chắc chắn?';
      modalEl.querySelector('[data-moc-cancel]').textContent = options.cancelText || 'Hủy';
      ok.textContent = options.confirmText || (danger ? 'Xóa' : 'Xác nhận');
      ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-coffee');

      pending = { onConfirm: options.onConfirm };
      opener = document.activeElement;
      modal.show();
    },
  };
})();
