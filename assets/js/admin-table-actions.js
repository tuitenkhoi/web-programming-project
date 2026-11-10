/* Trang quản lý bàn: hiện sẵn các nút thao tác trên từng bàn
   (ví dụ bàn trống: [Nhận khách] [Bảo trì]) thay vì phải bấm vào dấu 3 chấm.
   Script đọc các mục trong menu 3 chấm của mỗi bàn rồi tạo nút tương ứng; bấm nút
   sẽ chạy đúng thao tác cũ, nên không cần sửa admin-tables.js.
   Nạp SAU admin-tables.js:  <script src="../assets/js/admin-table-actions.js"></script> */
(function () {
  'use strict';

  var grid = document.getElementById('table-grid');
  if (!grid) return;

  var style = document.createElement('style');
  style.textContent =
    '.table-management-card.has-quick-actions .table-card-header .dropdown{display:none}' +
    '.table-quick-actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 14px;justify-content:center}' +
    '.table-quick-actions .btn{flex:1 1 auto;min-width:104px;font-weight:600;white-space:nowrap}';
  document.head.appendChild(style);

  var ICONS = [
    [/nhận khách|sử dụng|có khách/i, 'bi-person-check'],
    [/bảo trì/i, 'bi-tools'],
    [/dọn/i, 'bi-stars'],
    [/trống|trả bàn|hoàn tất|xong|mở lại/i, 'bi-check2-circle'],
    [/đặt trước/i, 'bi-bookmark-check'],
  ];

  function iconFor(label) {
    for (var i = 0; i < ICONS.length; i++) {
      if (ICONS[i][0].test(label)) return ICONS[i][1];
    }
    return 'bi-arrow-repeat';
  }

  function classFor(label, index) {
    if (/bảo trì/i.test(label)) return 'btn-outline-secondary';
    if (/nhận khách|sử dụng/i.test(label)) return 'btn-coffee';
    if (/trống|trả bàn|hoàn tất|xong|mở lại/i.test(label)) return 'btn-outline-success';
    return index === 0 ? 'btn-coffee' : 'btn-outline-secondary';
  }

  function enhance(card) {
    var items = Array.prototype.filter.call(
      card.querySelectorAll('.dropdown-menu .dropdown-item'),
      function (el) { return el.textContent.trim() !== ''; }
    );
    if (!items.length) return;

    var signature = items.map(function (el) { return el.textContent.trim(); }).join('|');
    var existing = card.querySelector('.table-quick-actions');
    if (existing && existing.dataset.signature === signature) return;
    if (existing) existing.remove();

    var bar = document.createElement('div');
    bar.className = 'table-quick-actions';
    bar.dataset.signature = signature;

    items.forEach(function (item, index) {
      var label = item.textContent.trim();
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm ' + classFor(label, index);

      var icon = document.createElement('i');
      icon.className = 'bi ' + iconFor(label) + ' me-1';
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(label));

      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        btn.disabled = true;
        item.click(); // chạy thao tác gốc của mục trong menu
        setTimeout(function () { btn.disabled = false; }, 800);
      });

      bar.appendChild(btn);
    });

    var footer = card.querySelector('.table-card-footer');
    if (footer) footer.parentNode.insertBefore(bar, footer);
    else card.appendChild(bar);

    card.classList.add('has-quick-actions');
  }

  var scheduled = false;

  function run() {
    scheduled = false;
    grid.querySelectorAll('.table-management-card').forEach(enhance);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  new MutationObserver(schedule).observe(grid, { childList: true, subtree: true, characterData: true });
  run();
})();
