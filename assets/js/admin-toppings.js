/* Quản lý topping ở trang admin (Quản lý món > nút "Quản lý topping"):
   thêm / sửa tên và giá / bật-tắt bán / xóa (xóa có xác nhận).
   Cách dùng (xem admin-api.js):
     const toppings = window.MocToppings.create({ managerRoot, request, notify, canDelete });
     toppings.load()   tải danh sách (kể cả topping đang tắt) rồi vẽ lại
   canDelete = false (trang của bếp): ẩn nút xóa, chỉ thêm / sửa / bật-tắt / chọn món áp dụng.
   Mỗi topping có "phạm vi áp dụng": theo danh mục món + ngoại lệ từng món (thêm món riêng / loại trừ món).
   Không chọn gì = áp dụng mọi món.
   Tên topping luôn đi qua textContent nên an toàn với ký tự lạ.
   Khách chỉ thấy topping đang bán; giá ở đây là giá khách trả và giá server tính tiền. */
(function () {
  'use strict';

  var money = new Intl.NumberFormat('vi-VN');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function create(options) {
    var root = options.managerRoot;
    var list = root && root.querySelector('[data-topping-list]');
    var addForm = root && root.querySelector('[data-topping-add-form]');
    var addName = root && root.querySelector('[data-topping-name]');
    var addPrice = root && root.querySelector('[data-topping-price]');
    var errorBox = root && root.querySelector('[data-topping-error]');

    var canDelete = options.canDelete !== false;
    var all = [];          // [{ id, name, price, is_active, scope }]
    var editingId = null;
    var scopeId = null;    // topping đang mở bảng "Áp dụng cho"
    var catalog = null;    // { categories: [{id,name}], products: [{id,name,category_id}] }
    var query = '';
    var filterCategory = ''; // '' = tất cả topping

    function notify(message, type) {
      if (typeof options.notify === 'function') options.notify(message, type);
    }

    function showError(message) {
      if (!errorBox) return;
      errorBox.textContent = message || '';
      errorBox.classList.toggle('d-none', !message);
    }

    // Giá nhập vào ô: "12000" hoặc "12.000" đều được; không hợp lệ thì trả NaN
    function readPrice(value) {
      var digits = String(value).trim().replace(/[.\s]/g, '');
      return /^\d+$/.test(digits) ? Number(digits) : NaN;
    }

    function load() {
      return options.request('/toppings/admin').then(function (result) {
        all = (result.data || []).map(function (item) {
          var scope = item.scope || {};
          return {
            id: Number(item.id), name: item.name, price: Number(item.price), is_active: !!item.is_active,
            scope: { categories: scope.categories || [], include: scope.include || [], exclude: scope.exclude || [] }
          };
        });
        return loadCatalog().then(function () { buildToolbar(); render(); });
      }).catch(function (error) { notify(error.message, 'danger'); });
    }


    // Danh mục + món để chọn phạm vi áp dụng (lấy từ thực đơn công khai)
    function loadCatalog() {
      if (catalog) return Promise.resolve(catalog);
      return options.request('/products').then(function (result) {
        var rows = Array.isArray(result) ? result : (result.data || []);
        var cats = new Map();
        var products = rows.map(function (p) {
          var cid = Number(p.category_id);
          if (!cats.has(cid)) cats.set(cid, { id: cid, name: p.category_name || ('Danh mục ' + cid) });
          return { id: Number(p.id), name: p.name, category_id: cid };
        });
        catalog = { categories: Array.from(cats.values()), products: products };
        return catalog;
      }).catch(function () {
        catalog = { categories: [], products: [] };
        return catalog;
      });
    }

    function categoryName(id) {
      var c = ((catalog && catalog.categories) || []).filter(function (x) { return x.id === id; })[0];
      return c ? c.name : ('#' + id);
    }
    function productName(id) {
      var p = ((catalog && catalog.products) || []).filter(function (x) { return x.id === id; })[0];
      return p ? p.name : ('#' + id);
    }

    // Mô tả ngắn phạm vi: "Tất cả món" / "Cà phê, Đá xay · +1 món · −2 món"
    function scopeText(scope) {
      var parts = [];
      if (!scope.categories.length && !scope.include.length) parts.push('Tất cả món');
      else {
        if (scope.categories.length) parts.push(scope.categories.map(categoryName).join(', '));
        if (scope.include.length) parts.push('+' + scope.include.length + ' món riêng');
      }
      if (scope.exclude.length) parts.push('trừ ' + scope.exclude.length + ' món');
      return parts.join(' · ');
    }

    // Có hiện ở danh mục này không (dùng cho bộ lọc "xem theo danh mục")
    function showsInCategory(scope, categoryId) {
      if (!scope.categories.length && !scope.include.length) return true;
      if (scope.categories.indexOf(categoryId) !== -1) return true;
      return scope.include.some(function (pid) {
        var p = ((catalog && catalog.products) || []).filter(function (x) { return x.id === pid; })[0];
        return p && p.category_id === categoryId;
      });
    }

    // Thanh tìm kiếm + lọc "topping dùng cho danh mục nào" (dựng một lần, phía trên danh sách)
    function buildToolbar() {
      if (!list || root.querySelector('[data-topping-toolbar]')) return;
      var bar = el('div', 'd-flex flex-wrap gap-2 mb-2');
      bar.setAttribute('data-topping-toolbar', '');
      var search = el('input', 'form-control form-control-sm flex-grow-1');
      search.type = 'search';
      search.placeholder = 'Tìm topping...';
      search.setAttribute('aria-label', 'Tìm topping');
      search.addEventListener('input', function () { query = search.value.trim().toLowerCase(); render(); });
      var select = el('select', 'form-select form-select-sm');
      select.style.maxWidth = '13rem';
      select.setAttribute('aria-label', 'Xem topping theo danh mục');
      select.appendChild(new Option('Mọi danh mục', ''));
      catalog.categories.forEach(function (c) { select.appendChild(new Option('Dùng cho: ' + c.name, String(c.id))); });
      select.addEventListener('change', function () { filterCategory = select.value; render(); });
      bar.append(search, select);
      list.parentNode.insertBefore(bar, list);
    }

    // Bảng chọn "Áp dụng cho": danh mục + món riêng + loại trừ
    function renderScopeEditor(li, topping) {
      var draft = {
        categories: topping.scope.categories.slice(),
        include: topping.scope.include.slice(),
        exclude: topping.scope.exclude.slice()
      };
      var box = el('div', 'w-100 border rounded-3 p-2 mt-2 bg-light');
      box.appendChild(el('div', 'small fw-semibold mb-1', 'Áp dụng cho danh mục'));
      var catRow = el('div', 'd-flex flex-wrap gap-2 mb-2');
      catalog.categories.forEach(function (c) {
        var id = 'scope-' + topping.id + '-c' + c.id;
        var wrap = el('div', 'form-check form-check-inline m-0');
        var input = el('input', 'form-check-input'); input.type = 'checkbox'; input.id = id; input.checked = draft.categories.indexOf(c.id) !== -1;
        input.addEventListener('change', function () {
          draft.categories = draft.categories.filter(function (x) { return x !== c.id; });
          if (input.checked) draft.categories.push(c.id);
          refreshHint();
        });
        var label = el('label', 'form-check-label small', c.name); label.htmlFor = id;
        wrap.append(input, label); catRow.appendChild(wrap);
      });
      box.appendChild(catRow);
      var hint = el('div', 'small text-secondary mb-2');
      box.appendChild(hint);

      function chipList(key, title, placeholder) {
        var section = el('div', 'mb-2');
        section.appendChild(el('div', 'small fw-semibold mb-1', title));
        var chips = el('div', 'd-flex flex-wrap gap-1 mb-1');
        var pick = el('select', 'form-select form-select-sm');
        pick.setAttribute('aria-label', title);
        function paint() {
          chips.textContent = '';
          draft[key].forEach(function (pid) {
            var chip = el('span', 'badge text-bg-secondary d-inline-flex align-items-center gap-1', productName(pid));
            var x = el('button', 'btn-close btn-close-white'); x.type = 'button'; x.style.fontSize = '.55rem';
            x.setAttribute('aria-label', 'Bỏ ' + productName(pid));
            x.addEventListener('click', function () { draft[key] = draft[key].filter(function (v) { return v !== pid; }); paint(); refreshHint(); });
            chip.appendChild(x); chips.appendChild(chip);
          });
          if (!draft[key].length) chips.appendChild(el('span', 'small text-secondary', 'Chưa có'));
          pick.textContent = '';
          pick.appendChild(new Option(placeholder, ''));
          catalog.categories.forEach(function (c) {
            var group = document.createElement('optgroup'); group.label = c.name;
            catalog.products.filter(function (p) { return p.category_id === c.id && draft.include.indexOf(p.id) === -1 && draft.exclude.indexOf(p.id) === -1; })
              .forEach(function (p) { group.appendChild(new Option(p.name, String(p.id))); });
            if (group.children.length) pick.appendChild(group);
          });
        }
        pick.addEventListener('change', function () {
          var id = Number(pick.value);
          if (id) { draft[key].push(id); paint(); if (key === 'include') repaintOther(); else repaintOther(); refreshHint(); }
        });
        section.append(chips, pick);
        return { section: section, paint: paint };
      }
      var inc = chipList('include', 'Thêm món riêng (ngoài danh mục)', '+ Chọn món...');
      var exc = chipList('exclude', 'Loại trừ món (không áp dụng)', '− Chọn món...');
      function repaintOther() { inc.paint(); exc.paint(); }
      repaintOther();
      box.append(inc.section, exc.section);

      function refreshHint() {
        hint.textContent = (!draft.categories.length && !draft.include.length)
          ? 'Chưa chọn danh mục hay món riêng: topping áp dụng cho tất cả món.'
          : 'Chỉ hiện ở: ' + scopeText({ categories: draft.categories, include: draft.include, exclude: [] }).replace(/ · $/, '') + '.';
      }
      refreshHint();

      var actions = el('div', 'd-flex gap-2');
      var save = el('button', 'btn btn-sm btn-coffee', 'Lưu phạm vi'); save.type = 'button';
      var cancel = el('button', 'btn btn-sm btn-outline-secondary', 'Đóng'); cancel.type = 'button';
      cancel.addEventListener('click', function () { scopeId = null; render(); });
      save.addEventListener('click', function () {
        save.disabled = true;
        showError('');
        options.request('/toppings/' + topping.id + '/scope', { method: 'PUT', body: draft }).then(function () {
          scopeId = null;
          notify('Đã lưu phạm vi áp dụng của topping.', 'success');
          return load();
        }).catch(function (error) { showError(error.message); save.disabled = false; });
      });
      actions.append(save, cancel);
      box.appendChild(actions);
      li.appendChild(box);
    }

    function patch(topping, body, successMessage) {
      showError('');
      return options.request('/toppings/' + topping.id, { method: 'PATCH', body: body }).then(function () {
        editingId = null;
        if (successMessage) notify(successMessage, 'success');
        return load();
      }).catch(function (error) {
        showError(error.message);
        return load(); // trả công tắc bật/tắt về đúng trạng thái trên server
      });
    }

    function confirmDelete(topping) {
      var run = function () {
        return options.request('/toppings/' + topping.id, { method: 'DELETE' }).then(function () {
          notify('Đã xóa topping.', 'success');
          return load();
        }).catch(function (error) { notify(error.message, 'danger'); });
      };
      var message = 'Xóa topping "' + topping.name + '"? Đơn cũ vẫn giữ tên topping đã chọn. ' +
        'Nếu chỉ muốn tạm ngưng bán, hãy tắt công tắc "Đang bán" thay vì xóa.';
      if (window.MocConfirm) {
        window.MocConfirm.show({ title: 'Xóa topping', message: message, danger: true, onConfirm: run });
      } else if (window.confirm(message)) {
        run();
      }
    }

    function renderEditRow(li, topping) {
      var form = el('form', 'd-flex flex-wrap flex-grow-1 gap-2');

      var name = el('input', 'form-control form-control-sm flex-grow-1');
      name.type = 'text';
      name.value = topping.name;
      name.maxLength = 50;
      name.required = true;
      name.setAttribute('aria-label', 'Tên topping');

      var price = el('input', 'form-control form-control-sm');
      price.type = 'text';
      price.inputMode = 'numeric';
      price.value = String(topping.price);
      price.style.maxWidth = '8rem';
      price.setAttribute('aria-label', 'Giá topping (đồng)');

      var save = el('button', 'btn btn-sm btn-coffee', 'Lưu');
      save.type = 'submit';
      var cancel = el('button', 'btn btn-sm btn-outline-secondary', 'Hủy');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { editingId = null; showError(''); render(); });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var value = readPrice(price.value);
        if (isNaN(value)) { showError('Giá topping phải là số nguyên (đồng), ví dụ 10000.'); price.focus(); return; }
        patch(topping, { name: name.value, price: value }, 'Đã cập nhật topping.');
      });

      form.append(name, price, save, cancel);
      li.appendChild(form);
      setTimeout(function () { name.focus(); name.select(); }, 0);
    }

    function render() {
      if (!list) return;
      list.textContent = '';

      if (!all.length) {
        list.appendChild(el('li', 'text-secondary small', 'Chưa có topping nào.'));
        return;
      }

      var shown = all.filter(function (topping) {
        if (query && topping.name.toLowerCase().indexOf(query) === -1) return false;
        if (filterCategory && !showsInCategory(topping.scope, Number(filterCategory))) return false;
        return true;
      });
      if (!shown.length) {
        list.appendChild(el('li', 'text-secondary small py-2', 'Không có topping phù hợp.'));
        return;
      }

      shown.forEach(function (topping) {
        var li = el('li', 'd-flex flex-wrap align-items-center gap-2 py-2 border-bottom');

        if (editingId === topping.id) {
          renderEditRow(li, topping);
          list.appendChild(li);
          return;
        }

        var nameBox = el('div', 'flex-grow-1');
        nameBox.appendChild(el('span', topping.is_active ? 'fw-semibold' : 'fw-semibold text-secondary', topping.name));
        nameBox.appendChild(el('small', 'd-block text-secondary', '+' + money.format(topping.price) + ' ₫'));
        nameBox.appendChild(el('small', 'd-block text-secondary', 'Áp dụng: ' + scopeText(topping.scope)));

        // Công tắc bật/tắt bán
        var sw = el('div', 'form-check form-switch mb-0');
        var input = el('input', 'form-check-input');
        input.type = 'checkbox';
        input.id = 'topping-active-' + topping.id;
        input.checked = topping.is_active;
        input.setAttribute('role', 'switch');
        input.addEventListener('change', function () {
          patch(topping, { is_active: input.checked }, input.checked ? 'Đã bật bán topping.' : 'Đã tạm ngưng bán topping.');
        });
        var label = el('label', 'form-check-label small', 'Đang bán');
        label.htmlFor = input.id;
        sw.append(input, label);

        var edit = el('button', 'btn btn-sm btn-outline-secondary');
        edit.type = 'button';
        edit.setAttribute('aria-label', 'Sửa topping ' + topping.name);
        edit.appendChild(el('i', 'bi bi-pencil'));
        edit.addEventListener('click', function () { editingId = topping.id; showError(''); render(); });

        var scopeBtn = el('button', 'btn btn-sm btn-outline-secondary');
        scopeBtn.type = 'button';
        scopeBtn.title = 'Chọn danh mục / món áp dụng';
        scopeBtn.setAttribute('aria-label', 'Chọn món áp dụng cho topping ' + topping.name);
        scopeBtn.appendChild(el('i', 'bi bi-diagram-3'));
        scopeBtn.addEventListener('click', function () { scopeId = scopeId === topping.id ? null : topping.id; showError(''); render(); });

        li.append(nameBox, sw, scopeBtn, edit);
        if (canDelete) {
          var del = el('button', 'btn btn-sm btn-outline-danger');
          del.type = 'button';
          del.setAttribute('aria-label', 'Xóa topping ' + topping.name);
          del.appendChild(el('i', 'bi bi-trash'));
          del.addEventListener('click', function () { confirmDelete(topping); });
          li.appendChild(del);
        }
        if (scopeId === topping.id) renderScopeEditor(li, topping);
        list.appendChild(li);
      });
    }

    if (addForm) {
      addForm.addEventListener('submit', function (event) {
        event.preventDefault();
        showError('');
        var name = addName.value.trim();
        var price = readPrice(addPrice.value);
        if (!name) { showError('Vui lòng nhập tên topping.'); addName.focus(); return; }
        if (isNaN(price)) { showError('Giá topping phải là số nguyên (đồng), ví dụ 10000.'); addPrice.focus(); return; }

        options.request('/toppings', { method: 'POST', body: { name: name, price: price } }).then(function () {
          addName.value = '';
          addPrice.value = '';
          notify('Đã thêm topping.', 'success');
          addName.focus();
          return load();
        }).catch(function (error) { showError(error.message); });
      });
    }

    return { load: load };
  }

  window.MocToppings = { create: create };
})();
