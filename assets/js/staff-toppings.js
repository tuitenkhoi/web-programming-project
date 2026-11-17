/* staff/toppings.html: bếp quản lý topping (thêm, sửa, bật/tắt bán, chọn món áp dụng). KHÔNG xóa được.
   Dùng chung bộ quản lý topping của admin (admin-toppings.js) nhưng ẩn nút xóa. */
(function () {
    'use strict';
    var S = window.Staff;

    // admin-toppings.js gọi request('/toppings...', { method, body: object }); S.api cần chuỗi JSON và tiền tố /api
    function request(path, opts) {
        var o = opts || {};
        var init = { method: o.method || 'GET' };
        if (o.body !== undefined) init.body = JSON.stringify(o.body);
        return S.api('/api' + path, init);
    }

    S.ready(function () {
        var manager = window.MocToppings.create({
            managerRoot: document.querySelector('[data-topping-manager]'),
            request: request,
            notify: function (message, type) { S.toast(message, type === 'danger' ? 'error' : 'success'); },
            canDelete: false
        });
        manager.load();
    });
})();
