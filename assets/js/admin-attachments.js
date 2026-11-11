/* Quản lý tệp đính kèm sản phẩm trong form admin (ảnh phụ, video, PDF).
   const manager = window.MocAttachments.create({ root, apiBase, getToken, request, notify });
     manager.setProduct(id)       sửa sản phẩm: tải danh sách và tải file lên NGAY khi chọn
     manager.reset()              thêm sản phẩm mới: file được xếp hàng, gửi sau khi sản phẩm được tạo
     manager.flushQueue(id)       gửi các file đang xếp hàng cho sản phẩm vừa tạo (trả về Promise)
   Mọi nội dung động (tên file...) đều đưa vào bằng textContent, không dùng innerHTML. */
(function () {
  'use strict';

  var MAX_FILES_PER_REQUEST = 5;
  var MAX_SIZE = 10 * 1024 * 1024;
  var ALLOWED = {
    'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
    'video/mp4': 'video', 'video/webm': 'video', 'application/pdf': 'file',
  };

  function formatSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function create(options) {
    var root = options.root;
    if (!root) return null;

    var dropzone = root.querySelector('[data-attachment-dropzone]');
    var input = root.querySelector('[data-attachment-input]');
    var list = root.querySelector('[data-attachment-list]');
    var progressWrap = root.querySelector('[data-attachment-progress]');
    var progressBar = root.querySelector('[data-attachment-progress-bar]');
    var progressLabel = root.querySelector('[data-attachment-progress-label]');
    var hint = root.querySelector('[data-attachment-hint]');

    var productId = null;
    var items = [];          // đã lưu trên server
    var queue = [];          // { file, url } chờ gửi (chế độ thêm mới)
    var busy = false;

    function notify(message, type) {
      if (typeof options.notify === 'function') options.notify(message, type);
    }

    function revokeQueue() {
      queue.forEach(function (entry) { if (entry.url) URL.revokeObjectURL(entry.url); });
      queue = [];
    }

    function setProgress(percent, label) {
      if (!progressWrap) return;
      progressWrap.classList.toggle('d-none', percent === null);
      if (percent === null) return;
      progressBar.style.width = percent + '%';
      progressBar.parentElement.setAttribute('aria-valuenow', String(percent));
      if (progressLabel) progressLabel.textContent = label || (percent + '%');
    }

    function preview(kind, url, name) {
      var box = el('div', 'attachment-thumb');
      if (kind === 'image') {
        var img = el('img');
        img.src = url;
        img.alt = name;
        img.loading = 'lazy';
        box.appendChild(img);
      } else if (kind === 'video') {
        var video = el('video');
        video.src = url;
        video.preload = 'metadata';
        video.muted = true;
        video.setAttribute('aria-label', 'Xem trước video ' + name);
        box.appendChild(video);
        box.appendChild(el('i', 'bi bi-play-circle-fill attachment-thumb-icon'));
      } else {
        box.appendChild(el('i', 'bi bi-file-earmark-pdf attachment-thumb-pdf'));
      }
      return box;
    }

    function row(kind, url, name, size, onRemove, removeLabel, link) {
      var li = el('li', 'attachment-item');
      li.appendChild(preview(kind, url, name));

      var info = el('div', 'attachment-info');
      var title;
      if (link) {
        title = el('a', 'attachment-name', name);
        title.href = url;
        title.target = '_blank';
        title.rel = 'noopener noreferrer';
      } else {
        title = el('span', 'attachment-name', name);
      }
      info.appendChild(title);
      info.appendChild(el('small', 'text-secondary', (kind === 'image' ? 'Ảnh' : kind === 'video' ? 'Video' : 'PDF') + ' · ' + formatSize(size)));
      li.appendChild(info);

      var remove = el('button', 'btn btn-sm btn-outline-danger');
      remove.type = 'button';
      remove.setAttribute('aria-label', removeLabel + ' ' + name);
      remove.appendChild(el('i', 'bi bi-trash'));
      remove.addEventListener('click', onRemove);
      li.appendChild(remove);
      return li;
    }

    function render() {
      list.textContent = '';

      items.forEach(function (item) {
        list.appendChild(row(item.kind, item.url, item.original_name, item.size, function () {
          confirmDelete(item);
        }, 'Xóa tệp', true));
      });

      queue.forEach(function (entry, index) {
        var li = row(ALLOWED[entry.file.type], entry.url, entry.file.name, entry.file.size, function () {
          if (entry.url) URL.revokeObjectURL(entry.url);
          queue.splice(index, 1);
          render();
        }, 'Bỏ khỏi danh sách', false);
        li.insertBefore(el('span', 'badge text-bg-warning', 'Chờ tải lên'), li.querySelector('button')); // đứng trước nút xóa
        list.appendChild(li);
      });

      if (!items.length && !queue.length) {
        list.appendChild(el('li', 'text-secondary small', 'Chưa có tệp đính kèm.'));
      }
      if (hint) {
        hint.textContent = productId
          ? 'Tệp được tải lên ngay khi bạn chọn.'
          : 'Tệp sẽ được tải lên sau khi bấm "Thêm món".';
      }
    }

    function confirmDelete(item) {
      var run = function () {
        return options.request('/attachments/' + item.id, { method: 'DELETE' }).then(function () {
          items = items.filter(function (it) { return it.id !== item.id; });
          render();
          notify('Đã xóa tệp đính kèm.', 'success');
        }).catch(function (error) { notify(error.message, 'danger'); });
      };
      if (window.MocConfirm) {
        window.MocConfirm.show({
          title: 'Xóa tệp đính kèm',
          message: 'Bạn có chắc muốn xóa tệp "' + item.original_name + '"? Thao tác này không thể hoàn tác.',
          danger: true,
          onConfirm: run,
        });
      } else if (window.confirm('Xóa tệp "' + item.original_name + '"?')) {
        run();
      }
    }

    // Kiểm tra phía trình duyệt cho nhanh; server vẫn kiểm tra lại nội dung thật
    function validate(files) {
      var valid = [];
      Array.prototype.forEach.call(files, function (file) {
        if (!ALLOWED[file.type]) {
          notify('"' + file.name + '": chỉ nhận JPG, PNG, WEBP, MP4, WEBM hoặc PDF.', 'warning');
        } else if (file.size > MAX_SIZE) {
          notify('"' + file.name + '" vượt quá 10MB.', 'warning');
        } else {
          valid.push(file);
        }
      });
      return valid;
    }

    // Gửi một lượt (tối đa 5 file) bằng XHR để có tiến trình
    function sendBatch(id, files, onProgress) {
      return new Promise(function (resolve, reject) {
        var form = new FormData();
        files.forEach(function (file) { form.append('files', file); });

        var xhr = new XMLHttpRequest();
        xhr.open('POST', options.apiBase + '/products/' + id + '/attachments');
        xhr.setRequestHeader('Accept', 'application/json');
        var token = options.getToken && options.getToken();
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

        xhr.upload.onprogress = function (event) {
          if (event.lengthComputable) onProgress(event.loaded / event.total);
        };
        xhr.onerror = function () { reject(new Error('Không thể kết nối backend.')); };
        xhr.onload = function () {
          var body = {};
          try { body = JSON.parse(xhr.responseText); } catch (e) { body = {}; }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body.data || []);
          else reject(new Error(body.message || 'Lỗi HTTP ' + xhr.status));
        };
        xhr.send(form);
      });
    }

    function upload(id, files) {
      var batches = [];
      for (var i = 0; i < files.length; i += MAX_FILES_PER_REQUEST) {
        batches.push(files.slice(i, i + MAX_FILES_PER_REQUEST));
      }
      var done = 0;
      var failed = 0;
      var chain = Promise.resolve();
      busy = true;

      batches.forEach(function (batch, index) {
        chain = chain.then(function () {
          setProgress(Math.round((index / batches.length) * 100), 'Đang tải ' + (index + 1) + '/' + batches.length + '...');
          return sendBatch(id, batch, function (ratio) {
            setProgress(Math.round(((index + ratio) / batches.length) * 100));
          }).then(function (saved) {
            done += saved.length;
            if (Number(id) === Number(productId)) { items = items.concat(saved); render(); }
          }).catch(function (error) {
            failed += batch.length;
            notify(error.message, 'danger');
          });
        });
      });

      return chain.then(function () {
        busy = false;
        setProgress(100, 'Hoàn tất');
        setTimeout(function () { setProgress(null); }, 600);
        if (done) notify('Đã tải lên ' + done + ' tệp.' + (failed ? ' ' + failed + ' tệp lỗi.' : ''), failed ? 'warning' : 'success');
        return { done: done, failed: failed };
      });
    }

    function handleFiles(fileList) {
      if (busy) { notify('Đang tải lên, vui lòng đợi.', 'warning'); return; }
      var files = validate(fileList);
      if (!files.length) return;

      if (productId) {
        upload(productId, files);
      } else {
        files.forEach(function (file) {
          queue.push({ file: file, url: ALLOWED[file.type] === 'file' ? null : URL.createObjectURL(file) });
        });
        render();
      }
    }

    // ----- sự kiện -----
    dropzone.addEventListener('click', function () { input.click(); });
    dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (event) {
      if (event.dataTransfer && event.dataTransfer.files) handleFiles(event.dataTransfer.files);
    });
    input.addEventListener('change', function () {
      handleFiles(input.files);
      input.value = '';
    });

    render();

    return {
      reset: function () {
        revokeQueue();
        productId = null;
        items = [];
        setProgress(null);
        render();
      },
      setProduct: function (id) {
        revokeQueue();
        productId = id;
        items = [];
        render();
        options.request('/products/' + id + '/attachments', { authentication: false })
          .then(function (result) {
            if (Number(productId) !== Number(id)) return; // đã chuyển sang sản phẩm khác
            items = result.data || [];
            render();
          })
          .catch(function (error) { notify(error.message, 'danger'); });
      },
      flushQueue: function (id) {
        var files = queue.map(function (entry) { return entry.file; });
        if (!files.length) return Promise.resolve({ done: 0, failed: 0 });
        revokeQueue();
        render();
        return upload(id, files);
      },
      hasQueue: function () { return queue.length > 0; },
    };
  }

  window.MocAttachments = { create: create };
})();
