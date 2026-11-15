/* Trang admin/invoices.html: hóa đơn được tạo từ đơn hàng (không có bảng invoices riêng).
   Mỗi đơn = một hóa đơn; "xác nhận thanh toán" gọi PATCH /api/orders/:id/payment. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;

    var STATUS = {
        pending: { text: 'Chờ thanh toán', cls: 'warning' },
        paid: { text: 'Đã thanh toán', cls: 'success' },
        cancelled: { text: 'Đã hủy', cls: 'danger' },
        failed: { text: 'Thất bại', cls: 'danger' },
        refunded: { text: 'Đã hoàn tiền', cls: 'dark' }
    };

    var tbody = document.getElementById('invoice-table-body');
    var emptyBox = document.getElementById('empty-invoice-result');
    var search = A.fresh('invoice-search-input');
    var dateFrom = A.fresh('invoice-date-from');
    var dateTo = A.fresh('invoice-date-to');
    var methodFilter = A.fresh('payment-method-filter');
    var statusFilter = A.fresh('invoice-status-filter');
    var sortSelect = A.fresh('invoice-sort');
    var resetBtn = A.fresh('reset-invoice-filter');
    var PAGE_SIZE = 20;
    var page = 1;
    var loadSeq = 0; // chống kết quả cũ về sau ghi đè kết quả mới
    var searchTimer = null;
    var lastTotal = 0; // tổng số hóa đơn theo bộ lọc hiện tại (hiện trong hộp thoại xuất)

    // Xóa các hàng dữ liệu mẫu trong HTML để không hiện số liệu giả khi chưa tải được dữ liệu thật
    function showMessage(text, cls) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center ' + cls + ' py-4">' + text + '</td></tr>';
    }
    showMessage('Đang tải...', 'text-secondary');


    // ----- Dọn phần giao diện mẫu không còn phù hợp -----
    var createBtn = document.getElementById('open-create-invoice-button');
    if (createBtn) createBtn.remove(); // hóa đơn sinh tự động từ đơn hàng
    var footer = document.querySelector('.card-footer'); // khối phân trang, được AdminPager vẽ lại

    // ----- Hàm hỗ trợ -----
    function pad(n) { return String(n).padStart(2, '0'); }
    function money(v) { return new Intl.NumberFormat('vi-VN').format(Number(v) || 0) + ' ₫'; }
    function fmt(v) {
        var d = new Date(v);
        if (isNaN(d)) return { date: '—', time: '' };
        return {
            date: pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(),
            time: pad(d.getHours()) + ':' + pad(d.getMinutes())
        };
    }
    function ymd(v) {
        var d = new Date(v);
        return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function norm(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    function setText(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = v;
    }
    function resetStats() {
        ['today-revenue', 'today-invoice-count', 'pending-invoice-count', 'paid-invoice-count']
            .forEach(function (id) { setText(id, '—'); });
    }
    resetStats();
    function code(o) { return 'HD' + String(o.id).padStart(4, '0'); }
    // Trạng thái hóa đơn suy ra từ đơn: đơn hủy => "Đã hủy", còn lại theo payment_status
    function invStatus(o) {
        if (o.status === 'cancelled') return 'cancelled';
        if (o.payment_status === 'paid') return 'paid';
        if (o.payment_status === 'failed' || o.payment_status === 'refunded') return o.payment_status;
        return 'pending'; // pending, pending_verification
    }
    function badge(key) {
        var s = STATUS[key] || { text: key, cls: 'secondary' };
        return '<span class="badge text-bg-' + s.cls + '">' + A.esc(s.text) + '</span>';
    }

    // ----- Hiển thị danh sách -----
    function actions(o) {
        var id = A.esc(o.id);
        var btn = function (act, cls, label) {
            return '<button type="button" class="btn btn-sm btn-outline-' + cls + ' me-1 mb-1" data-act="' + act + '" data-id="' + id + '">' + label + '</button>';
        };
        var html = btn('view', 'secondary', 'Xem');
        if (invStatus(o) === 'pending') html += btn('pay', 'success', 'Xác nhận thanh toán');
        return html;
    }

    function row(o) {
        var t = fmt(o.created_at);
        return '<tr class="invoice-row">' +
            '<td class="ps-4"><strong>' + code(o) + '</strong></td>' +
            '<td>' + A.esc(o.order_code) + '</td>' +
            '<td><strong>' + A.esc(o.customer_name) + '</strong><small class="d-block text-secondary">' + A.esc(o.customer_phone) + '</small></td>' +
            '<td><strong>' + t.date + '</strong><small class="d-block text-secondary">' + t.time + '</small></td>' +
            '<td>' + A.esc(o.payment_method_text) + '</td>' +
            '<td><strong>' + money(o.total_amount) + '</strong></td>' +
            '<td>' + badge(invStatus(o)) + '</td>' +
            '<td class="text-center pe-4">' + actions(o) + '</td></tr>';
    }

    function buildQuery() {
        var q = new URLSearchParams();
        q.set('page', page);
        q.set('limit', PAGE_SIZE);
        var st = statusFilter && statusFilter.value;
        if (st && st !== 'all') q.set('invoice_status', st);
        var method = methodFilter && methodFilter.value;
        if (method && method !== 'all') q.set('payment_method', method.replace('-', '_'));
        if (dateFrom && dateFrom.value) q.set('date_from', dateFrom.value);
        if (dateTo && dateTo.value) q.set('date_to', dateTo.value);
        var keyword = search && search.value.trim();
        if (keyword) q.set('q', keyword);
        var sort = sortSelect && sortSelect.value;
        if (sort) q.set('sort', sort.replace('-', '_'));
        return q.toString();
    }

    function render(list, total) {
        lastTotal = total;
        tbody.innerHTML = list.map(row).join('');
        setText('visible-invoice-count', total);
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    // Số liệu thẻ thống kê lấy từ server (tính trên tất cả đơn)
    function stats(s) {
        setText('today-revenue', money(s.today_revenue));
        setText('today-invoice-count', s.today_invoices || 0);
        setText('pending-invoice-count', s.awaiting_payment || 0);
        setText('paid-invoice-count', s.paid_invoices || 0);
    }

    async function load() {
        var seq = ++loadSeq;
        try {
            var res = await A.api('/api/orders?' + buildQuery());
            if (seq !== loadSeq) return;
            stats(res.summary || {});
            render(res.data || [], res.total || 0);
            if (page > res.total_pages) { page = res.total_pages; return load(); }
            window.AdminPager.render(footer, {
                page: page, totalPages: res.total_pages || 1, total: res.total || 0,
                limit: PAGE_SIZE, noun: 'hóa đơn',
                onChange: function (p) { page = p; load(); }
            });
        } catch (err) {
            if (seq !== loadSeq) return;
            console.error('Lỗi tải danh sách hóa đơn:', err);
            resetStats();
            showMessage('Không tải được hóa đơn. Vui lòng thử lại.', 'text-danger');
            A.toast(err.message, 'error');
        }
    }


    // ===== Xuất dữ liệu: chọn kiểu file (Excel / CSV / PDF-in) =====
    // Xuất TẤT CẢ hóa đơn khớp bộ lọc đang chọn (không chỉ trang đang xem). Kiểu đã chọn được nhớ cho lần sau.
    var exportModal = document.getElementById('export-invoice-modal');
    var exportForm = document.getElementById('export-invoice-form');
    var exportSummary = document.getElementById('export-summary');
    var exportError = document.getElementById('export-error');
    var exportSubmit = document.getElementById('export-submit');
    var exportItems = document.getElementById('export-include-items');
    var exportItemsHint = document.getElementById('export-items-hint');
    var EXPORT_PREF_KEY = 'mocInvoiceExport';

    var ITEMS_HINT = {
        xlsx: 'Thêm một bảng tính "Chi tiết món" trong cùng file.',
        csv: 'Mỗi món là một dòng (thông tin hóa đơn lặp lại ở từng dòng).',
        pdf: 'Liệt kê món ngay dưới từng hóa đơn.'
    };

    function selectedFormat() {
        var checked = exportForm.querySelector('input[name="exportFormat"]:checked');
        return checked ? checked.value : 'xlsx';
    }

    function showExportError(message) {
        exportError.textContent = message || '';
        exportError.classList.toggle('d-none', !message);
    }

    function updateExportHint() {
        exportItemsHint.textContent = ITEMS_HINT[selectedFormat()] || '';
    }

    function loadExportPreference() {
        try {
            var saved = JSON.parse(localStorage.getItem(EXPORT_PREF_KEY) || '{}');
            var radio = exportForm.querySelector('input[name="exportFormat"][value="' + saved.format + '"]');
            if (radio) radio.checked = true;
            exportItems.checked = saved.includeItems === true;
        } catch (e) { /* không đọc được thì dùng mặc định */ }
        updateExportHint();
    }

    function saveExportPreference() {
        try {
            localStorage.setItem(EXPORT_PREF_KEY, JSON.stringify({ format: selectedFormat(), includeItems: exportItems.checked }));
        } catch (e) { /* trình duyệt chặn lưu thì bỏ qua */ }
    }

    // Giống bộ lọc đang hiển thị nhưng bỏ phân trang
    function exportQuery(format) {
        var q = new URLSearchParams(buildQuery());
        q.delete('page');
        q.delete('limit');
        q.set('format', format === 'pdf' ? 'json' : format);
        if (exportItems.checked && format !== 'pdf') q.set('include_items', '1');
        return q;
    }

    // Tải file về: dùng fetch kèm token (liên kết thường không gửi được token), rồi cho trình duyệt lưu
    async function downloadExport(query) {
        var token = A.getToken();
        var res = await fetch('/api/orders/export?' + query.toString(), {
            headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        if (!res.ok) {
            var data = null;
            try { data = await res.json(); } catch (e) { /* không có JSON */ }
            if (res.status === 401) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
            throw new Error((data && data.message) || 'Không xuất được file (' + res.status + ').');
        }
        var match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
        var fileName = match ? match[1] : 'hoa-don.' + query.get('format');
        var url = URL.createObjectURL(await res.blob());
        var link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        return fileName;
    }

    function exportSubtitle() {
        var parts = ['Xuất lúc ' + new Date().toLocaleString('vi-VN')];
        if (dateFrom && dateFrom.value) parts.push('từ ' + dateFrom.value);
        if (dateTo && dateTo.value) parts.push('đến ' + dateTo.value);
        if (statusFilter && statusFilter.value !== 'all') parts.push('trạng thái: ' + statusFilter.options[statusFilter.selectedIndex].text);
        if (search && search.value.trim()) parts.push('từ khóa: ' + search.value.trim());
        return parts.join(' · ');
    }

    if (exportModal && exportForm) {
        exportModal.addEventListener('show.bs.modal', function () {
            loadExportPreference();
            showExportError('');
            exportSummary.textContent = 'Sẽ xuất ' + lastTotal + ' hóa đơn theo bộ lọc hiện tại (tất cả các trang).';
        });

        exportForm.addEventListener('change', updateExportHint);

        exportForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            var format = selectedFormat();
            showExportError('');
            exportSubmit.disabled = true;

            try {
                if (format === 'pdf') {
                    var result = await A.api('/api/orders/export?' + exportQuery(format).toString());
                    window.MocPrint.printList({
                        title: 'Danh sách hóa đơn',
                        subtitle: exportSubtitle(),
                        orders: result.data || [],
                        showItems: exportItems.checked
                    });
                } else {
                    var name = await downloadExport(exportQuery(format));
                    A.toast('Đã xuất file ' + name, 'success');
                }

                saveExportPreference();
                var instance = window.bootstrap && window.bootstrap.Modal.getInstance(exportModal);
                if (instance) instance.hide();
            } catch (error) {
                showExportError(error.message);
            } finally {
                exportSubmit.disabled = false;
            }
        });
    }

    // Đổi bộ lọc thì về trang 1 và hỏi lại server
    function reload() { page = 1; load(); }

    // ----- Chi tiết hóa đơn -----
    async function openDetail(id) {
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id));
            var o = res.data;
            var t = fmt(o.created_at);
            setText('detail-invoice-id', code(o));
            setText('detail-order-id', o.order_code);
            setText('detail-invoice-customer', o.customer_name + ' · ' + o.customer_phone);
            setText('detail-invoice-table', o.order_type === 'at_table' ? (o.table_code || 'Chưa có bàn') : 'Mang đi');
            setText('detail-invoice-time', t.time + ' ' + t.date);
            setText('detail-payment-method', o.payment_method_text);
            setText('detail-invoice-subtotal', money(o.subtotal));
            setText('detail-invoice-service-fee', money(o.service_fee));
            setText('detail-invoice-discount', '-' + money(o.discount_amount));
            setText('detail-invoice-total', money(o.total_amount));

            var st = STATUS[invStatus(o)] || { text: '', cls: 'secondary' };
            var badgeEl = document.getElementById('detail-invoice-status');
            if (badgeEl) {
                badgeEl.className = 'badge text-bg-' + st.cls;
                badgeEl.textContent = st.text;
            }
            var body = document.getElementById('detail-invoice-items');
            if (body) {
                body.innerHTML = (o.items || []).map(function (it) {
                    return '<tr><td>' + A.esc(it.product_name) + '</td>' +
                        '<td class="text-center">' + A.esc(it.quantity) + '</td>' +
                        '<td class="text-end">' + money(it.unit_price) + '</td>' +
                        '<td class="text-end">' + money(it.line_total) + '</td></tr>';
                }).join('');
            }
            var modalEl = document.getElementById('invoice-detail-modal');
            if (modalEl && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } catch (err) {
            A.toast(err.message, 'error');
        }
    }

    async function confirmPayment(id, btn) {
        if (!confirm('Xác nhận khách đã thanh toán hóa đơn này?')) return;
        btn.disabled = true;
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id) + '/payment', { method: 'PATCH' });
            A.toast(res.message);
            await load();
        } catch (err) {
            A.toast(err.message, 'error');
            btn.disabled = false;
        }
    }

    // ----- Sự kiện -----
    tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        if (btn.dataset.act === 'view') return openDetail(btn.dataset.id);
        if (btn.dataset.act === 'pay') return confirmPayment(btn.dataset.id, btn);
    });

    [dateFrom, dateTo, methodFilter, statusFilter, sortSelect].forEach(function (el) {
        if (el) el.addEventListener('change', reload);
    });
    // Ô tìm kiếm: chờ người dùng ngừng gõ 300ms rồi mới gọi API
    if (search) search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(reload, 300);
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (methodFilter) methodFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'newest';
        reload();
    });

    load();
});
