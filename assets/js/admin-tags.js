/* Nhãn sản phẩm ở trang admin:
   - Hộp "Quản lý nhãn": thêm / đổi tên / xóa (xóa có xác nhận)
   - Ô chọn nhiều nhãn trong form sản phẩm
   const tags = window.MocTags.create({ managerRoot, optionsRoot, request, notify, onChange });
     tags.load()                tải danh sách nhãn rồi vẽ lại cả hai nơi
     tags.setSelected(ids)      đặt các nhãn đang chọn trong form
     tags.getSelected()         mảng id đang chọn (đã sắp xếp)
     tags.saveFor(productId)    PUT /products/:id/tags
   Tên nhãn luôn đi qua textContent. */
(function () {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function create(options) {
    var managerRoot = options.managerRoot;
    var optionsRoot = options.optionsRoot;
    var list = managerRoot && managerRoot.querySelector('[data-tag-list]');
    var addForm = managerRoot && managerRoot.querySelector('[data-tag-add-form]');
    var addInput = managerRoot && managerRoot.querySelector('[data-tag-name]');
    var errorBox = managerRoot && managerRoot.querySelector('[data-tag-error]');

    var all = [];                // [{ id, name, slug, product_count }]
    var selected = new Set();
    var editingId = null;

    function notify(message, type) {
      if (typeof options.notify === 'function') options.notify(message, type);
    }

    function showError(message) {
      if (!errorBox) return;
      errorBox.textContent = message || '';
      errorBox.classList.toggle('d-none', !message);
    }

    function renderOptions() {
      if (!optionsRoot) return;
      optionsRoot.textContent = '';

      if (!all.length) {
        optionsRoot.appendChild(el('span', 'text-secondary small', 'Chưa có nhãn nào. Bấm "Quản lý nhãn" để tạo.'));
        return;
      }

      all.forEach(function (tag) {
        var id = 'admin-tag-option-' + tag.id;
        var wrap = el('div', 'form-check form-check-inline tag-option');
        var input = el('input', 'form-check-input');
        input.type = 'checkbox';
        input.id = id;
        input.value = String(tag.id);
        input.checked = selected.has(tag.id);
        input.addEventListener('change', function () {
          if (input.checked) selected.add(tag.id); else selected.delete(tag.id);
        });
        var label = el('label', 'form-check-label', tag.name);
        label.htmlFor = id;
        wrap.appendChild(input);
        wrap.appendChild(label);
        optionsRoot.appendChild(wrap);
      });
    }

    function renderList() {
      if (!list) return;
      list.textContent = '';

      if (!all.length) {
        list.appendChild(el('li', 'text-secondary small', 'Chưa có nhãn nào.'));
        return;
      }

      all.forEach(function (tag) {
        var li = el('li', 'd-flex align-items-center gap-2 py-2 border-bottom');

        if (editingId === tag.id) {
          var form = el('form', 'd-flex flex-grow-1 gap-2');
          var input = el('input', 'form-control form-control-sm');
          input.type = 'text';
          input.value = tag.name;
          input.maxLength = 50;
          input.required = true;
          input.setAttribute('aria-label', 'Tên mới của nhãn ' + tag.name);
          var save = el('button', 'btn btn-sm btn-coffee', 'Lưu');
          save.type = 'submit';
          var cancel = el('button', 'btn btn-sm btn-outline-secondary', 'Hủy');
          cancel.type = 'button';
          cancel.addEventListener('click', function () { editingId = null; renderList(); });
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            rename(tag, input.value);
          });
          form.appendChild(input);
          form.appendChild(save);
          form.appendChild(cancel);
          li.appendChild(form);
          list.appendChild(li);
          setTimeout(function () { input.focus(); input.select(); }, 0);
          return;
        }

        li.appendChild(el('span', 'flex-grow-1 fw-semibold', tag.name));
        li.appendChild(el('small', 'text-secondary', tag.product_count + ' món'));

        var edit = el('button', 'btn btn-sm btn-outline-secondary');
        edit.type = 'button';
        edit.setAttribute('aria-label', 'Đổi tên nhãn ' + tag.name);
        edit.appendChild(el('i', 'bi bi-pencil'));
        edit.addEventListener('click', function () { editingId = tag.id; renderList(); });

        var del = el('button', 'btn btn-sm btn-outline-danger');
        del.type = 'button';
        del.setAttribute('aria-label', 'Xóa nhãn ' + tag.name);
        del.appendChild(el('i', 'bi bi-trash'));
        del.addEventListener('click', function () { confirmDelete(tag); });

        li.appendChild(edit);
        li.appendChild(del);
        list.appendChild(li);
      });
    }

    function renderAll() {
      renderList();
      renderOptions();
    }

    function load() {
      return options.request('/tags', { authentication: false }).then(function (result) {
        all = (result.data || []).map(function (tag) {
          return { id: Number(tag.id), name: tag.name, slug: tag.slug, product_count: Number(tag.product_count) || 0 };
        });
        // bỏ chọn những nhãn đã bị xóa
        selected = new Set(Array.from(selected).filter(function (id) {
          return all.some(function (tag) { return tag.id === id; });
        }));
        renderAll();
      }).catch(function (error) { notify(error.message, 'danger'); });
    }

    function changed() {
      if (typeof options.onChange === 'function') options.onChange();
    }

    function rename(tag, value) {
      showError('');
      return options.request('/tags/' + tag.id, { method: 'PATCH', body: { name: value } }).then(function () {
        editingId = null;
        notify('Đã đổi tên nhãn.', 'success');
        return load().then(changed);
      }).catch(function (error) { showError(error.message); });
    }

    function confirmDelete(tag) {
      var run = function () {
        return options.request('/tags/' + tag.id, { method: 'DELETE' }).then(function () {
          notify('Đã xóa nhãn.', 'success');
          return load().then(changed);
        }).catch(function (error) { notify(error.message, 'danger'); });
      };
      var message = 'Xóa nhãn "' + tag.name + '"?' +
        (tag.product_count ? ' Nhãn sẽ bị gỡ khỏi ' + tag.product_count + ' món.' : '') + ' Thao tác này không thể hoàn tác.';
      if (window.MocConfirm) {
        window.MocConfirm.show({ title: 'Xóa nhãn', message: message, danger: true, onConfirm: run });
      } else if (window.confirm(message)) {
        run();
      }
    }

    if (addForm) {
      addForm.addEventListener('submit', function (event) {
        event.preventDefault();
        showError('');
        var name = addInput.value.trim();
        if (!name) { showError('Vui lòng nhập tên nhãn.'); addInput.focus(); return; }
        options.request('/tags', { method: 'POST', body: { name: name } }).then(function () {
          addInput.value = '';
          notify('Đã thêm nhãn.', 'success');
          return load().then(changed);
        }).catch(function (error) { showError(error.message); });
      });
    }

    return {
      load: load,
      setSelected: function (ids) {
        selected = new Set((ids || []).map(Number));
        renderOptions();
      },
      getSelected: function () {
        return Array.from(selected).sort(function (a, b) { return a - b; });
      },
      saveFor: function (productId) {
        return options.request('/products/' + productId + '/tags', {
          method: 'PUT',
          body: { tag_ids: Array.from(selected) },
        });
      },
    };
  }

  window.MocTags = { create: create };
})();
