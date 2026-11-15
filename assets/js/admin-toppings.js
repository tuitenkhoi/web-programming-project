/* Quản lý topping ở trang admin (Quản lý món > nút "Quản lý topping"):
   thêm / sửa tên và giá / bật-tắt bán / xóa (xóa có xác nhận).
   Cách dùng (xem admin-api.js):
     const toppings = window.MocToppings.create({ managerRoot, request, notify });
     toppings.load()   tải danh sách (kể cả topping đang tắt) rồi vẽ lại
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

    var all = [];          // [{ id, name, price, is_active }]
    var editingId = null;

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
          return { id: Number(item.id), name: item.name, price: Number(item.price), is_active: !!item.is_active };
        });
        render();
      }).catch(function (error) { notify(error.message, 'danger'); });
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

      all.forEach(function (topping) {
        var li = el('li', 'd-flex align-items-center gap-2 py-2 border-bottom');

        if (editingId === topping.id) {
          renderEditRow(li, topping);
          list.appendChild(li);
          return;
        }

        var nameBox = el('div', 'flex-grow-1');
        nameBox.appendChild(el('span', topping.is_active ? 'fw-semibold' : 'fw-semibold text-secondary', topping.name));
        nameBox.appendChild(el('small', 'd-block text-secondary', '+' + money.format(topping.price) + ' ₫'));

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

        var del = el('button', 'btn btn-sm btn-outline-danger');
        del.type = 'button';
        del.setAttribute('aria-label', 'Xóa topping ' + topping.name);
        del.appendChild(el('i', 'bi bi-trash'));
        del.addEventListener('click', function () { confirmDelete(topping); });

        li.append(nameBox, sw, edit, del);
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
