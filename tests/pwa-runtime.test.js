// Chạy sw.js trong Node với caches/fetch/clients GIẢ để kiểm tra hành vi online/offline mà không cần trình duyệt.
// Không thay thế việc thử tay trên trình duyệt thật (xem hướng dẫn kiểm chứng), nhưng bắt được lỗi logic sớm.
const test = require('node:test');
const assert = require('node:assert/strict');

const ORIGIN = 'https://moc.test'; // host giả chỉ dùng trong test

// ----- Môi trường service worker giả -----
const handlers = {};
const posted = [];
const store = new Map(); // tên cache -> Map(url -> Response)

function makeCache(name) {
    const entries = store.get(name) || new Map();
    store.set(name, entries);
    const strip = (url) => { const u = new URL(url); return u.origin + u.pathname; };
    const urlOf = (key) => (typeof key === 'string' ? key : key.url);
    return {
        async match(key, options = {}) {
            const wanted = urlOf(key);
            for (const [url, response] of entries) {
                if (url === wanted || (options.ignoreSearch && strip(url) === strip(wanted))) return response.clone();
            }
            return undefined;
        },
        async put(key, response) { entries.set(urlOf(key), response); },
        async keys() { return Array.from(entries.keys()).map((url) => ({ url })); },
        async delete(key) { return entries.delete(urlOf(key)); },
    };
}

globalThis.caches = {
    async open(name) { return makeCache(name); },
    async keys() { return Array.from(store.keys()); },
    async delete(name) { return store.delete(name); },
};
globalThis.self = {
    location: { origin: ORIGIN },
    addEventListener(type, handler) { handlers[type] = handler; },
    clients: {
        async matchAll() { return [{ postMessage: (message) => posted.push(message) }]; },
        async claim() {},
    },
    skipWaiting() { this.skipped = true; },
};

let network; // (url, request) => Response | throw
globalThis.fetch = async (input) => network(typeof input === 'string' ? new URL(input, ORIGIN).href : input.url, input);

require('../sw.js');

const html = (text, status = 200) => new Response(text, { status, headers: { 'Content-Type': 'text/html' } });
const offline = () => { network = () => { throw new TypeError('Failed to fetch'); }; };

// Giả lập 1 sự kiện fetch; trả về { responded, response, settle }
async function dispatch(urlPath, { method = 'GET', mode = 'cors', referrer = '' } = {}) {
    const waits = [];
    const request = { url: ORIGIN + urlPath, method, mode, referrer, headers: { has: () => false } };
    let promise = null;
    handlers.fetch({ request, respondWith: (p) => { promise = Promise.resolve(p); }, waitUntil: (p) => waits.push(p) });
    const response = promise ? await promise : null;
    await Promise.all(waits);
    return { responded: promise !== null, response };
}

test.beforeEach(() => { store.clear(); posted.length = 0; });

test('Trang HTML: online thì lấy từ mạng và lưu cache; mất mạng thì trả bản cache + báo ngoại tuyến', async () => {
    network = () => html('<h1>Thực đơn</h1>');
    const first = await dispatch('/pages/menu.html?category=tea', { mode: 'navigate' });
    assert.equal(await first.response.text(), '<h1>Thực đơn</h1>');

    offline();
    const second = await dispatch('/pages/menu.html?category=tea', { mode: 'navigate' });
    assert.equal(second.response.status, 200);
    assert.equal(await second.response.text(), '<h1>Thực đơn</h1>');
    assert.deepEqual(posted, [{ type: 'moc-offline-fallback' }]);

    // Cùng trang nhưng tham số khác (đã từng xem trang này): vẫn mở được bản đã lưu
    const third = await dispatch('/pages/menu.html?category=coffee', { mode: 'navigate' });
    assert.equal(third.response.status, 200);
});

test('Trang chưa từng xem khi mất mạng: trả trang thông báo 503, không giả làm trang khác', async () => {
    offline();
    const { response } = await dispatch('/pages/booking.html', { mode: 'navigate' });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Đang ngoại tuyến/);
});

test('API công khai: lưu theo URL đã chuẩn hóa, mất mạng thì trả dữ liệu cũ', async () => {
    network = () => new Response(JSON.stringify({ success: true, data: [{ id: 1 }] }), { status: 200 });
    await dispatch('/api/products?search=a&category_id=2', { referrer: ORIGIN + '/pages/menu.html' });

    offline();
    const { response } = await dispatch('/api/products?category_id=2&search=a', { referrer: ORIGIN + '/pages/menu.html' });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, [{ id: 1 }]);
});

test('API chưa có trong cache khi mất mạng: JSON 503 có thông báo tiếng Việt (client-api hiển thị được)', async () => {
    offline();
    const { response } = await dispatch('/api/tags');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /ngoại tuyến/);
});

test('API gọi từ trang admin: không ghi vào cache của khách', async () => {
    network = () => new Response(JSON.stringify({ data: ['du-lieu-admin'] }), { status: 200 });
    await dispatch('/api/categories', { referrer: ORIGIN + '/admin/products.html' });

    offline();
    const { response } = await dispatch('/api/categories', { referrer: ORIGIN + '/pages/menu.html' });
    assert.equal(response.status, 503); // không có bản cache nào
});

test('Lỗi máy chủ (500/404) không bao giờ bị lưu thành bản cache', async () => {
    network = () => new Response('{}', { status: 500 });
    await dispatch('/api/products');
    offline();
    const { response } = await dispatch('/api/products');
    assert.equal(response.status, 503);
});

test('/uploads: cache-first, lần sau không gọi mạng', async () => {
    let calls = 0;
    network = () => { calls += 1; return new Response('anh', { status: 200 }); };
    await dispatch('/uploads/products/a.jpg');
    await dispatch('/uploads/products/a.jpg');
    assert.equal(calls, 1);
});

test('POST/PUT/PATCH/DELETE và API riêng tư: service worker không can thiệp (respondWith không được gọi)', async () => {
    network = () => { throw new Error('không được tới đây'); };
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        assert.equal((await dispatch('/api/orders', { method })).responded, false, method);
        assert.equal((await dispatch('/api/products', { method })).responded, false, method);
    }
    for (const p of ['/api/orders', '/api/bookings', '/api/auth/me', '/api/dashboard/stats', '/admin/orders.html']) {
        assert.equal((await dispatch(p, { mode: 'navigate' })).responded, false, p);
    }
});

test('Cài đặt: thiếu file hoặc CDN lỗi vẫn cài được; chỉ lưu phản hồi 200', async () => {
    network = (url) => {
        if (url.includes('/pages/menu.html')) return html('<p>menu</p>');
        if (url.startsWith('https://cdn.jsdelivr.net') || url.startsWith('https://fonts.googleapis.com')) throw new TypeError('offline');
        return html('missing', 404);
    };
    const waits = [];
    handlers.install({ waitUntil: (p) => waits.push(p) });
    await assert.doesNotReject(Promise.all(waits));

    const pages = await caches.open('moc-pages-v1');
    assert.ok(await pages.match(ORIGIN + '/pages/menu.html'), 'trang 200 phải được precache');
    assert.equal(await pages.match(ORIGIN + '/pages/cart.html'), undefined, 'trang 404 không được lưu');
});

test('Kích hoạt: xóa cache phiên bản cũ, giữ cache hiện tại và cache của ứng dụng khác', async () => {
    await caches.open('moc-pages-v0');
    await caches.open('moc-pages-v1');
    await caches.open('app-khac');
    const waits = [];
    handlers.activate({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    const names = await caches.keys();
    assert.ok(!names.includes('moc-pages-v0'));
    assert.ok(names.includes('moc-pages-v1'));
    assert.ok(names.includes('app-khac'));
});

test('Bản mới chờ người dùng: không tự skipWaiting, chỉ skip khi nhận tin SKIP_WAITING', async () => {
    const waits = [];
    network = () => html('x');
    handlers.install({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    assert.notEqual(globalThis.self.skipped, true);

    handlers.message({ data: { type: 'SKIP_WAITING' } });
    assert.equal(globalThis.self.skipped, true);
});
