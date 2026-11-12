// Kiểm tra phần offline/PWA kiểm tra được bằng Node: manifest, icon, logic chọn chiến lược cache của sw.js,
// danh sách precache và việc các trang khách đã được chèn manifest + pwa.js.
// KHÔNG cần MySQL, KHÔNG cần trình duyệt. Hành vi thật của service worker cần thử tay (xem README / hướng dẫn kiểm chứng).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const sw = require('../sw.js');

const ORIGIN = 'https://moc.test'; // host giả chỉ dùng trong test; code thật không hardcode host/port
const plan = (urlPath, extra = {}) => sw.classifyRequest({ url: ORIGIN + urlPath, method: 'GET', ...extra }, ORIGIN);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function pngSize(file) {
    const buffer = fs.readFileSync(path.join(ROOT, file));
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', file + ' không phải PNG');
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('manifest.webmanifest hợp lệ: tên, start_url, standalone, màu, ngôn ngữ', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    assert.equal(manifest.name, 'Mộc Coffee');
    assert.equal(manifest.short_name, 'Mộc Coffee');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.lang, 'vi');
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
    assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
});

test('manifest có icon 192 và 512 đường dẫn tương đối, file tồn tại đúng kích thước', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    for (const size of [192, 512]) {
        const icon = manifest.icons.find((item) => item.sizes === `${size}x${size}`);
        assert.ok(icon, `thiếu icon ${size}x${size}`);
        assert.equal(icon.type, 'image/png');
        assert.doesNotMatch(icon.src, /^(https?:)?\/\//, 'icon phải là đường dẫn tương đối');
        assert.deepEqual(pngSize(icon.src), { width: size, height: size });
    }
});

test('normalizeUrl: bỏ #hash, sắp xếp tham số, bỏ "/" cuối, giữ gốc', () => {
    assert.equal(
        sw.normalizeUrl('/api/products?search=a&category_id=2#top', ORIGIN),
        sw.normalizeUrl('/api/products/?category_id=2&search=a', ORIGIN)
    );
    assert.equal(sw.normalizeUrl('/api/products?b=2&a=1', ORIGIN), `${ORIGIN}/api/products?a=1&b=2`);
    assert.equal(sw.normalizeUrl('/', ORIGIN), `${ORIGIN}/`);
    assert.notEqual(sw.normalizeUrl('/api/products?category_id=1', ORIGIN), sw.normalizeUrl('/api/products?category_id=2', ORIGIN));
});

test('Trang HTML (điều hướng) dùng network-first, lưu vào cache pages', () => {
    for (const p of ['/', '/index.html', '/pages/menu.html?category=tea', '/pages/product-detail.html?id=3']) {
        const result = plan(p, { mode: 'navigate' });
        assert.equal(result.strategy, 'network-first', p);
        assert.equal(result.cache, 'pages', p);
        assert.equal(result.store, true, p);
        assert.equal(result.ignoreSearch, true, p);
    }
});

test('API công khai (products, tags, categories, reviews, tables) dùng network-first + cache api', () => {
    for (const p of ['/api/products', '/api/products?search=cafe', '/api/products/12', '/api/tags', '/api/categories',
        '/api/reviews/product/3', '/api/tables']) {
        const result = plan(p);
        assert.equal(result.strategy, 'network-first', p);
        assert.equal(result.cache, 'api', p);
        assert.equal(result.store, true, p);
    }
});

test('API riêng tư hoặc có thao tác ghi KHÔNG bao giờ bị cache', () => {
    for (const p of ['/api/bookings', '/api/orders', '/api/orders/1', '/api/auth/me', '/api/auth/logout',
        '/api/customer/orders', '/api/dashboard/stats', '/api/admin/me', '/api/products/admin', '/api/vouchers',
        '/api/attachments/1', '/api/health']) {
        assert.equal(plan(p), null, p);
    }
});

test('POST/PUT/PATCH/DELETE đi thẳng mạng (không có kế hoạch cache)', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        for (const p of ['/api/products', '/api/orders', '/api/bookings', '/api/reviews', '/pages/menu.html', '/uploads/products/a.jpg']) {
            assert.equal(plan(p, { method, mode: 'navigate' }), null, `${method} ${p}`);
        }
    }
});

test('Trang quản trị, socket.io, sw.js và manifest không bị service worker đụng vào', () => {
    for (const p of ['/admin/orders.html', '/admin/dashboard.html', '/admin', '/socket.io/?EIO=4&transport=polling', '/sw.js', '/manifest.webmanifest']) {
        assert.equal(plan(p, { mode: 'navigate' }), null, p);
    }
});

test('Gọi API từ trang quản trị thì không ghi vào cache của khách', () => {
    const fromAdmin = plan('/api/products', { referrer: ORIGIN + '/admin/products.html' });
    assert.equal(fromAdmin.strategy, 'network-first');
    assert.equal(fromAdmin.store, false);

    const fromCustomer = plan('/api/products', { referrer: ORIGIN + '/pages/menu.html' });
    assert.equal(fromCustomer.store, true);
});

test('/uploads/** cache-first; css/js network-first; ảnh/font cache-first', () => {
    assert.deepEqual(
        [plan('/uploads/products/a.jpg').strategy, plan('/uploads/products/a.jpg').cache],
        ['cache-first', 'uploads']
    );
    assert.equal(plan('/assets/css/style.css').strategy, 'network-first');
    assert.equal(plan('/assets/js/main.js').strategy, 'network-first');
    assert.equal(plan('/assets/images/banner/banner-1.jpg').strategy, 'cache-first');
    assert.equal(plan('/assets/fonts/x.woff2').strategy, 'cache-first');
    assert.equal(plan('/assets/data/secret.json'), null);
});

test('CDN của dự án cache-first; host lạ và request Range không bị cache', () => {
    for (const host of ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
        const result = sw.classifyRequest({ url: `https://${host}/x`, method: 'GET' }, ORIGIN);
        assert.equal(result.strategy, 'cache-first', host);
    }
    assert.equal(sw.classifyRequest({ url: 'https://evil.example.com/x.js', method: 'GET' }, ORIGIN), null);
    assert.equal(plan('/uploads/attachments/v.mp4', { hasRange: true }), null);
});

test('isCacheable: chỉ lưu 200 (và opaque của CDN); không lưu 206, lỗi, hoặc trang bị chuyển hướng', () => {
    assert.equal(sw.isCacheable({ status: 200, type: 'basic' }), true);
    assert.equal(sw.isCacheable({ status: 0, type: 'opaque' }), true);
    assert.equal(sw.isCacheable({ status: 206, type: 'basic' }), false);
    assert.equal(sw.isCacheable({ status: 404, type: 'basic' }), false);
    assert.equal(sw.isCacheable({ status: 500, type: 'basic' }), false);
    assert.equal(sw.isCacheable({ status: 200, type: 'basic', redirected: true }, { page: true }), false);
    assert.equal(sw.isCacheable(null), false);
});

test('Danh sách precache trỏ tới file có thật; CDN dùng HTTPS', () => {
    const local = [...sw.PRECACHE_PAGES, ...sw.PRECACHE_STATIC];
    const missing = local.filter((entry) => {
        assert.ok(entry.startsWith('/'), entry + ' phải là đường dẫn gốc site, không có host/port');
        const file = entry === '/' ? 'index.html' : entry.slice(1);
        return !fs.existsSync(path.join(ROOT, file));
    });
    assert.deepEqual(missing, [], 'precache chứa file không tồn tại: ' + missing.join(', '));
    for (const url of sw.PRECACHE_CDN) assert.match(url, /^https:\/\//);
});

test('sw.js và pwa.js không hardcode host/port; pwa.js đăng ký /sw.js với scope "/"', () => {
    for (const file of ['sw.js', 'assets/js/pwa.js']) {
        assert.doesNotMatch(read(file), /localhost|127\.0\.0\.1|:\d{4}\b/, file);
    }
    assert.match(read('assets/js/pwa.js'), /register\(\s*["']\/sw\.js["']\s*,\s*\{\s*scope:\s*["']\/["']/);
});

test('Các trang khách (index.html, pages/*.html) đã chèn manifest và pwa.js; trang admin thì không', () => {
    const pagesDir = path.join(ROOT, 'pages');
    const pages = ['index.html', ...fs.readdirSync(pagesDir).filter((n) => n.endsWith('.html')).map((n) => 'pages/' + n)];
    const bad = pages.filter((file) => {
        const html = read(file);
        return !/<link rel="manifest" href="(\.\.\/)?manifest\.webmanifest"/.test(html) || !/(\.\.\/)?assets\/js\/pwa\.js/.test(html);
    });
    assert.deepEqual(bad, [], 'chạy "node scripts/inject-pwa.js" cho: ' + bad.join(', '));

    const adminDir = path.join(ROOT, 'admin');
    if (fs.existsSync(adminDir)) {
        for (const name of fs.readdirSync(adminDir).filter((n) => n.endsWith('.html'))) {
            assert.doesNotMatch(read('admin/' + name), /pwa\.js/, 'admin/' + name + ' không được nạp pwa.js');
        }
    }
});
