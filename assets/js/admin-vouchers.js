/* Trang admin/vouchers.html: xem, tạo, sửa, bật/tắt, xóa voucher. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var A = window.AdminAuth;
  var API = '/api/admin/vouchers';
  var body = document.getElementById('voucher-table-body');
  if (!body) return;

  var modalEl = document.getElementById('voucher-form-modal');
  var modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
  var form = document.getElementById('voucher-form');
  var formAlert = document.getElementById('voucher-form-alert');
  var search = document.getElementById('voucher-search');
  var filter = document.getElementById('voucher-filter');
  var all = [];
  var editingId = null;

  function esc(v) { return A && A.esc ? A.esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
  function fmtDate(s) { return s ? s.replace('T', ' ').split(' ').map(function (p, i) { return i === 0 ? p.split('-').reverse().join('/') : p; }).join(' ') : ''; }

  function toast(message, type) {
    var el = document.getElementById('admin-toast');
    if (!el) return;
    var msg = document.getElementById('admin-toast-message');
    var icon = document.getElementById('admin-toast-icon');
    if (msg) msg.textContent = message;
    if (icon) icon.className = 'bi me-2 ' + (type === 'danger' ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success');
    bootstrap.Toast.getOrCreateInstance(el).show();
  }

  async function call(path, method, payload) {
    var res = await fetch(API + (path || ''), {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: 'Bearer ' + (A && A.getToken ? A.getToken() : '')
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      if (A && A.clearToken) A.clearToken();
      location.href = '../pages/account.html?expired=1';
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    if (!res.ok || data.success === false) throw new Error(data.message || 'Có lỗi xảy ra.');
    return data;
  }

  function state(v) {
    if (!Number(v.status)) return { key: 'off', text: 'Đã tắt', cls: 'secondary' };
    if (Number(v.expired)) return { key: 'expired', text: 'Hết hạn', cls: 'dark' };
    if (v.usage_limit !== null && Number(v.used_count) >= Number(v.usage_limit)) return { key: 'full', text: 'Hết lượt', cls: 'warning text-dark' };
    if (!Number(v.in_period)) return { key: 'soon', text: 'Sắp diễn ra', cls: 'info text-dark' };
    return { key: 'active', text: 'Đang chạy', cls: 'success' };
  }

  function render() {
    var q = (search.value || '').trim().toLowerCase();
    var f = filter.value;
    var rows = all.filter(function (v) {
      if (f !== 'all' && state(v).key !== f) return false;
      return !q || (v.code + ' ' + v.name).toLowerCase().indexOf(q) !== -1;
    });

    document.getElementById('voucher-total').textContent = all.length;
    document.getElementById('voucher-active').textContent = all.filter(function (v) { return state(v).key === 'active'; }).length;
    document.getElementById('voucher-used').textContent = all.reduce(function (s, v) { return s + Number(v.used_count || 0); }, 0);

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Chưa có voucher phù hợp.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (v) {
      var st = state(v);
      var val = v.discount_type === 'percent' ? Number(v.value) + '%' : money(v.value);
      var cap = v.discount_type === 'percent' && v.max_discount !== null ? '<br><small class="text-secondary">Tối đa ' + money(v.max_discount) + '</small>' : '';
      var limit = v.usage_limit === null ? 'Không giới hạn' : v.used_count + '/' + v.usage_limit;
      return '<tr>' +
        '<td><strong>' + esc(v.code) + '</strong><br><small class="text-secondary">' + esc(v.name) + '</small></td>' +
        '<td>' + val + cap + '</td>' +
        '<td>' + (Number(v.min_order) ? money(v.min_order) : 'Không') + '</td>' +
        '<td><small>' + fmtDate(v.starts_at) + '<br>→ ' + fmtDate(v.ends_at) + '</small></td>' +
        '<td>' + limit + '<br><small class="text-secondary">' + v.per_user_limit + ' lượt/khách</small></td>' +
        '<td><span class="badge bg-' + st.cls + '">' + st.text + '</span></td>' +
        '<td class="text-end text-nowrap">' +
        '<button type="button" class="btn btn-sm btn-outline-secondary me-1" data-act="edit" data-id="' + v.id + '" title="Sửa"><i class="bi bi-pencil"></i></button>' +
        '<button type="button" class="btn btn-sm btn-outline-' + (Number(v.status) ? 'warning' : 'success') + ' me-1" data-act="toggle" data-id="' + v.id + '" title="' + (Number(v.status) ? 'Tắt' : 'Bật') + '"><i class="bi bi-' + (Number(v.status) ? 'pause-circle' : 'play-circle') + '"></i></button>' +
        '<button type="button" class="btn btn-sm btn-outline-danger" data-act="delete" data-id="' + v.id + '" title="Xóa"><i class="bi bi-trash3"></i></button>' +
        '</td></tr>';
    }).join('');
  }

  async function load() {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Đang tải voucher...</td></tr>';
    try {
      all = (await call()).data || [];
      render();
    } catch (e) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
    }
  }

  function field(id) { return document.getElementById(id); }

  function openForm(v) {
    editingId = v ? v.id : null;
    formAlert.classList.add('d-none');
    document.getElementById('voucher-form-title').textContent = v ? 'Sửa voucher' : 'Tạo voucher mới';
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var end = new Date(now.getTime() + 30 * 86400000);
    var endDay = end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate());
    field('vf-code').value = v ? v.code : '';
    field('vf-name').value = v ? v.name : '';
    field('vf-description').value = v ? (v.description || '') : '';
    field('vf-type').value = v ? v.discount_type : 'percent';
    field('vf-value').value = v ? Number(v.value) : '';
    field('vf-min').value = v ? Number(v.min_order) : 0;
    field('vf-max').value = v && v.max_discount !== null ? Number(v.max_discount) : '';
    field('vf-starts').value = v ? v.starts_at : today + 'T00:00';
    field('vf-ends').value = v ? v.ends_at : endDay + 'T23:59';
    field('vf-limit').value = v && v.usage_limit !== null ? v.usage_limit : '';
    field('vf-peruser').value = v ? v.per_user_limit : 1;
    field('vf-status').checked = v ? Boolean(Number(v.status)) : true;
    syncType();
    modal.show();
  }

  function syncType() {
    var percent = field('vf-type').value === 'percent';
    field('vf-max-group').classList.toggle('d-none', !percent);
    field('vf-value-unit').textContent = percent ? '%' : 'đ';
  }

  field('vf-type').addEventListener('change', syncType);
  document.getElementById('open-add-voucher').addEventListener('click', function () { openForm(null); });
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  document.getElementById('refresh-vouchers').addEventListener('click', load);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var button = form.querySelector('[type="submit"]');
    button.disabled = true;
    formAlert.classList.add('d-none');
    var payload = {
      code: field('vf-code').value.trim().toUpperCase(),
      name: field('vf-name').value.trim(),
      description: field('vf-description').value.trim(),
      discount_type: field('vf-type').value,
      value: field('vf-value').value,
      min_order: field('vf-min').value || 0,
      max_discount: field('vf-type').value === 'percent' ? field('vf-max').value : '',
      starts_at: field('vf-starts').value,
      ends_at: field('vf-ends').value,
      usage_limit: field('vf-limit').value,
      per_user_limit: field('vf-peruser').value || 1,
      status: field('vf-status').checked ? 1 : 0
    };
    try {
      await call(editingId ? '/' + editingId : '', editingId ? 'PUT' : 'POST', payload);
      modal.hide();
      toast(editingId ? 'Đã cập nhật voucher.' : 'Đã tạo voucher.');
      await load();
    } catch (e) {
      formAlert.textContent = e.message;
      formAlert.classList.remove('d-none');
    } finally {
      button.disabled = false;
    }
  });

  body.addEventListener('click', async function (event) {
    var btn = event.target.closest('button[data-act]');
    if (!btn) return;
    var id = Number(btn.dataset.id);
    var v = all.filter(function (x) { return Number(x.id) === id; })[0];
    if (!v) return;
    try {
      if (btn.dataset.act === 'edit') return openForm(v);
      if (btn.dataset.act === 'toggle') {
        btn.disabled = true;
        await call('/' + id + '/status', 'PATCH', { status: Number(v.status) ? 0 : 1 });
        toast(Number(v.status) ? 'Đã tắt voucher.' : 'Đã bật voucher.');
        return load();
      }
      if (btn.dataset.act === 'delete') {
        if (!confirm('Xóa voucher ' + v.code + '?')) return;
        btn.disabled = true;
        await call('/' + id, 'DELETE');
        toast('Đã xóa voucher.');
        return load();
      }
    } catch (e) {
      toast(e.message, 'danger');
      btn.disabled = false;
    }
  });

  load();
});
