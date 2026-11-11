// Kiểm tra API sản phẩm (tìm kiếm, ghim, đính kèm, nhãn, PATCH). KHÔNG cần MySQL:
// file này tự thay kết nối DB bằng bản giả và chỉ gắn router sản phẩm vào một app Express nhỏ.
// Chạy: npm test
process.env.JWT_SECRET = process.env.JWT_SECRET || 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

// ----- DB giả: ghi lại câu SQL, trả dữ liệu mẫu -----
const calls = [];
let rowsFor = () => [[]];
const answer = (sql, params) => {
    if (/FROM users/.test(sql)) return [[{ id: 1, full_name: 'Admin', email: 'a@a.vn', role: 'admin', status: 1 }]];
    return rowsFor(sql, params);
};
const record = (kind) => async (sql, params) => {
    calls.push({ kind, sql: String(sql).replace(/\s+/g, ' '), params });
    return answer(String(sql), params);
};
const connection = {
    beginTransaction: async () => calls.push({ kind: 'begin' }),
    commit: async () => calls.push({ kind: 'commit' }),
    rollback: async () => calls.push({ kind: 'rollback' }),
    release() {},
    execute: record('conn.execute'),
    query: record('conn.query'),
};
const fakeDb = { execute: record('execute'), query: record('query'), getConnection: async () => connection, end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = express();
app.use(express.json());
app.use('/api/products', require('../backend/src/routes/product.routes'));
app.use('/api/attachments', require('../backend/src/routes/attachment.routes'));
app.use('/api/tags', require('../routes/tags'));
const attachmentDir = require('../backend/src/controllers/attachment.controller').attachmentDirectory;
app.use('/uploads/attachments', ...require('../backend/src/middleware/attachment-static').attachmentStatic(attachmentDir));

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + token };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let server;
let base;
test.before(() => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => server.close());

const call = async (url, options) => {
    const res = await fetch(base + url, options);
    return { status: res.status, body: await res.json().catch(() => null) };
};
const lastList = () => calls.filter((c) => /FROM products AS p/.test(c.sql)).pop();

// ===== S22: tìm kiếm =====
test('Tìm kiếm: LIKE phủ tên + mô tả, khớp tên được xếp trước, escape % và _', async () => {
    calls.length = 0;
    rowsFor = () => [[]];
    const res = await call('/api/products?search=' + encodeURIComponent('50%_a'));
    assert.equal(res.status, 200);
    const q = lastList();
    assert.match(q.sql, /p\.name LIKE \? OR p\.description LIKE \?/);
    assert.match(q.sql, /ORDER BY CASE WHEN p\.name LIKE \? THEN 0 ELSE 1 END, p\.is_pinned DESC/);
    // 2 tham số của WHERE + 1 tham số của ORDER BY, đều đã escape ký tự đại diện
    assert.deepEqual(q.params, ['%50\\%\\_a%', '%50\\%\\_a%', '%50\\%\\_a%']);
});

test('Tìm kiếm: vẫn tôn trọng bộ lọc danh mục và không có từ khóa thì không thêm CASE', async () => {
    calls.length = 0;
    await call('/api/products?search=ca&category_id=2');
    const withSearch = lastList();
    assert.match(withSearch.sql, /p\.category_id = \?/);
    assert.deepEqual(withSearch.params, ['%ca%', '%ca%', 2, '%ca%']);

    calls.length = 0;
    await call('/api/products');
    assert.doesNotMatch(lastList().sql, /CASE WHEN p\.name LIKE/);
});


// ===== S20: ghim + sắp xếp mặc định =====
test('Sắp xếp mặc định: ghim lên đầu; ?sort= được kiểm tra', async () => {
    calls.length = 0;
    await call('/api/products');
    assert.match(lastList().sql, /ORDER BY p\.is_pinned DESC, COALESCE\(p\.pinned_at, p\.updated_at\) DESC, p\.id DESC/);

    calls.length = 0;
    await call('/api/products/admin', { headers: AUTH });
    assert.match(lastList().sql, /ORDER BY p\.is_pinned DESC, COALESCE\(p\.pinned_at, p\.updated_at\) DESC, p\.id DESC/);

    calls.length = 0;
    await call('/api/products?sort=price_asc');
    assert.match(lastList().sql, /ORDER BY p\.price ASC, p\.id DESC/);

    assert.equal((await call('/api/products?sort=drop-table')).status, 400);
});

test('Tìm kiếm + ghim: khớp tên trước, rồi mới tới thứ tự ghim', async () => {
    calls.length = 0;
    await call('/api/products?search=ca');
    assert.match(lastList().sql, /ORDER BY CASE WHEN p\.name LIKE \? THEN 0 ELSE 1 END, p\.is_pinned DESC/);
});

test('PUT /api/products/:id/pin: cần đăng nhập, bật -> pinned_at = NOW(), tắt -> NULL', async () => {
    assert.equal((await call('/api/products/1/pin', { method: 'PUT', headers: JSON_HEADERS, body: '{"pinned":true}' })).status, 401);

    rowsFor = (sql) => (/SELECT id, is_pinned/.test(sql) ? [[{ id: 1, is_pinned: 0 }]] : /SELECT id, is_pinned, pinned_at/.test(sql) ? [[{ id: 1, is_pinned: 1, pinned_at: '2026-11-10T10:00:00.000Z' }]] : [[]]);
    calls.length = 0;
    const on = await call('/api/products/1/pin', { method: 'PUT', headers: { ...AUTH, ...JSON_HEADERS }, body: '{"pinned":true}' });
    assert.equal(on.status, 200);
    assert.equal(on.body.success, true);
    assert.equal(on.body.data.is_pinned, 1);
    assert.ok(calls.some((c) => /UPDATE products SET is_pinned = 1, pinned_at = NOW\(\)/.test(c.sql) && c.params[0] === 1));

    calls.length = 0;
    const off = await call('/api/products/1/pin', { method: 'PUT', headers: { ...AUTH, ...JSON_HEADERS }, body: '{"pinned":false}' });
    assert.equal(off.status, 200);
    assert.equal(off.body.data.is_pinned, 0);
    assert.ok(calls.some((c) => /UPDATE products SET is_pinned = 0, pinned_at = NULL/.test(c.sql)));
});

test('PUT /api/products/:id/pin: dữ liệu sai hoặc không tồn tại', async () => {
    const put = (url, body) => call(url, { method: 'PUT', headers: { ...AUTH, ...JSON_HEADERS }, body: JSON.stringify(body) });
    assert.equal((await put('/api/products/abc/pin', { pinned: true })).status, 400);
    assert.equal((await put('/api/products/1/pin', {})).status, 400);
    assert.equal((await put('/api/products/1/pin', { pinned: 'có' })).status, 400);

    rowsFor = () => [[]]; // không tìm thấy món
    const missing = await put('/api/products/99/pin', { pinned: true });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Không tìm thấy sản phẩm');
});

// ===== S21: badge trạng thái =====
test('Danh sách món: rating + đính kèm lấy bằng LEFT JOIN (1 câu), voucher tính 1 lần', async () => {
    calls.length = 0;
    rowsFor = (sql) => {
        if (/FROM vouchers/.test(sql)) return [[{ n: 2 }]];
        if (/FROM products AS p/.test(sql)) {
            return [[
                { id: 1, name: 'A', price: '1000', image: null, is_pinned: 1, rating_avg: '4.6667', rating_count: '3', video_count: '1', file_count: '0', attachment_count: '1' },
                { id: 2, name: 'B', price: '2000', image: null, is_pinned: 0, rating_avg: '0', rating_count: '0', video_count: '0', file_count: '2', attachment_count: '2' },
            ]];
        }
        return [[]];
    };
    const res = await call('/api/products');
    assert.equal(res.status, 200);

    const q = lastList();
    assert.match(q.sql, /LEFT JOIN \( SELECT product_id, AVG\(rating\) AS avg_rating, COUNT\(\*\) AS review_count FROM product_reviews WHERE status = 1 GROUP BY product_id \) AS rv/);
    assert.match(q.sql, /LEFT JOIN \( SELECT product_id, SUM\(kind = 'video'\) AS video_count, SUM\(kind = 'file'\) AS file_count, COUNT\(\*\) AS attachment_count FROM product_attachments GROUP BY product_id \) AS att/);
    // chống N+1: đúng 1 câu truy vấn món và đúng 1 câu đếm voucher cho cả danh sách
    assert.equal(calls.filter((c) => /FROM products AS p/.test(c.sql)).length, 1);
    assert.equal(calls.filter((c) => /FROM vouchers/.test(c.sql)).length, 1);

    const [a, b] = res.body.data;
    assert.equal(a.rating_avg, 4.7);
    assert.equal(a.rating_count, 3);
    assert.equal(a.video_count, 1);
    assert.equal(a.has_voucher, 1);
    assert.equal(a.is_pinned, 1);
    assert.equal(b.file_count, 2);
    assert.equal(b.has_voucher, 1);
});

test('Không có voucher đang hiệu lực thì has_voucher = 0', async () => {
    rowsFor = (sql) => (/FROM vouchers/.test(sql) ? [[{ n: 0 }]] : /FROM products AS p/.test(sql) ? [[{ id: 1, name: 'A', price: '1', image: null, is_pinned: 0, rating_avg: 0, rating_count: 0, video_count: 0, file_count: 0, attachment_count: 0 }]] : [[]]);
    const res = await call('/api/products');
    assert.equal(res.body.data[0].has_voucher, 0);
});

test('renderBadges: chỉ hiện chip áp dụng, đã escape, có title + aria-label', () => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/product-badges.js'), 'utf8'), sandbox);
    const render = sandbox.window.MocBadges.render;

    assert.equal(render({}), '');
    assert.equal(render({ is_pinned: 0, rating_count: 0, has_voucher: 0, video_count: 0, file_count: 0, status: 1 }), '');

    const all = render({ is_pinned: 1, rating_avg: 4.5, rating_count: 12, has_voucher: 1, video_count: 1, file_count: 1, status: 0 });
    for (const kind of ['pin', 'rating', 'sale', 'video', 'file', 'draft']) {
        assert.match(all, new RegExp('moc-badge-' + kind));
    }
    assert.match(all, /aria-label="Đánh giá trung bình 4\.5\/5 \(12 lượt\)"/);
    assert.match(all, /title="Đang có voucher giảm giá/);

    assert.equal(render({ is_pinned: 1, rating_count: 5, rating_avg: 4 }, { only: ['pin'] }).includes('rating'), false);
    assert.match(render({ raw: { is_pinned: 1 } }), /moc-badge-pin/);
});


// ===== S19: tệp đính kèm =====
const fs = require('node:fs');
const path = require('node:path');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const PDF = Buffer.from('%PDF-1.4\n%fake\n');
const form = (parts) => {
    const fd = new FormData();
    parts.forEach(([buf, name, type]) => fd.append('files', new Blob([buf], { type }), name));
    return fd;
};
const filesOnDisk = () => (fs.existsSync(attachmentDir) ? fs.readdirSync(attachmentDir) : []);
const upload = (parts, headers = AUTH) => call('/api/products/7/attachments', { method: 'POST', headers, body: form(parts) });

test('Đính kèm: thiếu token thì 401, không lưu file nào', async () => {
    const before = filesOnDisk().length;
    const res = await upload([[PNG, 'a.png', 'image/png']], {});
    assert.equal(res.status, 401);
    assert.equal(filesOnDisk().length, before);
});

test('Đính kèm: tải ảnh + video + pdf cùng lúc, phân loại kind theo nội dung thật', async () => {
    calls.length = 0;
    rowsFor = (sql) => {
        if (/SELECT id FROM products/.test(sql)) return [[{ id: 7 }]];
        if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total: 2, max_order: 2 }]];
        if (/INSERT INTO product_attachments/.test(sql)) return [{ insertId: 50 }];
        return [[]];
    };
    const res = await upload([[PNG, 'Ảnh đẹp.png', 'image/png'], [MP4, 'v.mp4', 'video/mp4'], [PDF, 'menu.pdf', 'application/pdf']]);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.map((a) => a.kind), ['image', 'video', 'file']);
    const inserts = calls.filter((c) => /INSERT INTO product_attachments/.test(c.sql));
    assert.equal(inserts.length, 3);
    assert.deepEqual(inserts.map((c) => c.params[1]), ['image', 'video', 'file']);
    assert.deepEqual(inserts.map((c) => c.params[6]), [3, 4, 5]); // nối tiếp sort_order hiện có
    assert.equal(inserts[0].params[3], 'Ảnh đẹp.png'); // giữ dấu tiếng Việt
    assert.match(inserts[0].params[2], /^\/uploads\/attachments\/[\w.-]+\.png$/);
    // đã ghi file thật; dọn lại
    res.body.data.forEach((a) => {
        const f = path.join(attachmentDir, path.basename(a.url));
        assert.ok(fs.existsSync(f));
        fs.unlinkSync(f);
    });
});

test('Đính kèm: nội dung không khớp định dạng khai báo / file giả đều bị từ chối và xóa file', async () => {
    const before = filesOnDisk().length;
    rowsFor = () => [[]];
    let res = await upload([[PNG, 'fake.mp4', 'video/mp4']]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /không khớp/);

    res = await upload([[Buffer.from('<script>alert(1)</script>'), 'x.png', 'image/png']]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /không đúng định dạng/);

    res = await upload([[PNG, 'a.gif', 'image/gif']]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Chỉ chấp nhận file/);
    assert.equal(filesOnDisk().length, before);
});

test('Đính kèm: tối đa 5 file mỗi lần, 10 MB mỗi file, tối đa 20 file mỗi sản phẩm', async () => {
    const before = filesOnDisk().length;
    rowsFor = () => [[]];
    const six = Array.from({ length: 6 }, (_, i) => [PNG, `a${i}.png`, 'image/png']);
    let res = await upload(six);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /tối đa 5 file/);

    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 + 1)]);
    res = await upload([[big, 'big.png', 'image/png']]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /10 MB/);

    rowsFor = (sql) => {
        if (/SELECT id FROM products/.test(sql)) return [[{ id: 7 }]];
        if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total: 19, max_order: 19 }]];
        return [[]];
    };
    res = await upload([[PNG, 'a.png', 'image/png'], [PNG, 'b.png', 'image/png']]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /tối đa 20/);
    assert.equal(filesOnDisk().length, before);
});

test('Đính kèm: sản phẩm không tồn tại thì 404 và file bị xóa', async () => {
    const before = filesOnDisk().length;
    rowsFor = () => [[]];
    const res = await upload([[PNG, 'a.png', 'image/png']]);
    assert.equal(res.status, 404);
    assert.equal(filesOnDisk().length, before);
});

test('Đính kèm: GET danh sách + chi tiết sản phẩm nhúng attachments', async () => {
    const row = { id: 3, product_id: 7, kind: 'image', url: '/uploads/attachments/x.png', original_name: 'x.png', mime: 'image/png', size: '10', sort_order: 1, created_at: 'now' };
    rowsFor = (sql) => {
        if (/FROM product_attachments/.test(sql)) return [[row]];
        if (/FROM products AS p/.test(sql)) return [[{ id: 7, category_id: 1, category_name: 'Cà phê', name: 'A', slug: 'a', description: '', price: '1000', image: null, status: 1, is_pinned: 0, pinned_at: null }]];
        if (/FROM products WHERE id = \?/.test(sql)) return [[{ id: 7, status: 1 }]];
        return [[]];
    };
    let res = await call('/api/products/7/attachments');
    assert.equal(res.status, 200);
    assert.match(res.body.data[0].url, /^http:\/\/127\.0\.0\.1:\d+\/uploads\/attachments\/x\.png$/);
    assert.equal(res.body.data[0].size, 10);

    res = await call('/api/products/7');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.attachments.length, 1);
    assert.equal(res.body.data.attachments[0].kind, 'image');
});

test('Đính kèm: DELETE cần token, 404 khi không có, xóa bản ghi và file (url lạ không xóa ngoài thư mục)', async () => {
    let res = await call('/api/attachments/3', { method: 'DELETE' });
    assert.equal(res.status, 401);

    rowsFor = () => [[]];
    res = await call('/api/attachments/3', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 404);
    res = await call('/api/attachments/abc', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 400);

    fs.mkdirSync(attachmentDir, { recursive: true });
    const name = 'test-delete-' + Date.now() + '.png';
    fs.writeFileSync(path.join(attachmentDir, name), PNG);
    const outside = path.join(attachmentDir, '..', 'products', 'outside-' + Date.now() + '.txt');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'giu lai');

    calls.length = 0;
    rowsFor = (sql) => (/SELECT id, url FROM product_attachments/.test(sql) ? [[{ id: 3, url: '/uploads/attachments/' + name }]] : [{ affectedRows: 1 }]);
    res = await call('/api/attachments/3', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 200);
    assert.ok(calls.some((c) => /DELETE FROM product_attachments WHERE id = \?/.test(c.sql)));
    assert.equal(fs.existsSync(path.join(attachmentDir, name)), false);

    rowsFor = (sql) => (/SELECT id, url FROM product_attachments/.test(sql) ? [[{ id: 4, url: '/uploads/attachments/../products/' + path.basename(outside) }]] : [{ affectedRows: 1 }]);
    res = await call('/api/attachments/4', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 200);
    assert.ok(fs.existsSync(outside), 'file ngoài thư mục attachments phải còn nguyên');
    fs.unlinkSync(outside);
});

test('Đính kèm: /uploads/attachments chặn path traversal, đuôi lạ, file ẩn; trả nosniff', async () => {
    fs.mkdirSync(attachmentDir, { recursive: true });
    const name = 'test-static-' + Date.now() + '.pdf';
    fs.writeFileSync(path.join(attachmentDir, name), PDF);
    fs.writeFileSync(path.join(attachmentDir, 'note.txt'), 'x');
    fs.writeFileSync(path.join(attachmentDir, '.hidden.png'), PNG);

    const get = (p) => fetch(base + p);
    const ok = await get('/uploads/attachments/' + name);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    for (const bad of [
        '/uploads/attachments/note.txt',
        '/uploads/attachments/.hidden.png',
        '/uploads/attachments/%2e%2e/products/a.png',
        '/uploads/attachments/..%2f..%2fserver.js',
        '/uploads/attachments/sub/' + name,
        '/uploads/attachments/a%5cb.png',
        '/uploads/attachments/a%00.png',
    ]) {
        const r = await get(bad);
        assert.ok([400, 404].includes(r.status), bad + ' -> ' + r.status);
    }
    fs.unlinkSync(path.join(attachmentDir, name));
    fs.unlinkSync(path.join(attachmentDir, 'note.txt'));
    fs.unlinkSync(path.join(attachmentDir, '.hidden.png'));
});


// ===== S23: nhãn (tags) =====
const JSON_AUTH = { ...AUTH, ...JSON_HEADERS };
const put = (url, body, headers = JSON_AUTH) => call(url, { method: 'PUT', headers, body: JSON.stringify(body) });

test('Lọc theo nhãn: ?tags=1,2,3 dùng GROUP BY + HAVING COUNT(DISTINCT) = n, cộng dồn với danh mục và tìm kiếm', async () => {
    rowsFor = () => [[]];
    calls.length = 0;
    let res = await call('/api/products?tags=1,2,3');
    assert.equal(res.status, 200);
    let q = lastList();
    assert.match(q.sql, /p\.id IN \( SELECT pt\.product_id FROM product_tags AS pt WHERE pt\.tag_id IN \(\?, \?, \?\) GROUP BY pt\.product_id HAVING COUNT\(DISTINCT pt\.tag_id\) = \? \)/);
    assert.deepEqual(q.params, [1, 2, 3, 3]);

    calls.length = 0;
    await call('/api/products?search=ca&category_id=2&tags=4,5,4');
    q = lastList();
    assert.deepEqual(q.params, ['%ca%', '%ca%', 2, 4, 5, 2, '%ca%']); // nhãn trùng được gộp, n = 2
    assert.match(q.sql, /p\.category_id = \?/);

    calls.length = 0;
    await call('/api/products');
    assert.doesNotMatch(lastList().sql, /product_tags AS pt WHERE/);
});

test('Lọc theo nhãn: giá trị sai thì 400', async () => {
    for (const bad of ['abc', '0', '1,,x', '-2', '1,2,3,4,5,6,7,8,9,10,11']) {
        const res = await call('/api/products?tags=' + encodeURIComponent(bad));
        assert.equal(res.status, 400, bad);
        assert.match(res.body.message, /nhãn/);
    }
});

test('Danh sách và chi tiết có tags[] (một truy vấn nhãn cho cả danh sách)', async () => {
    rowsFor = (sql) => {
        if (/FROM product_tags AS pt\s+INNER JOIN tags/.test(sql.replace(/\s+/g, ' ').replace('FROM product_tags AS pt INNER', 'FROM product_tags AS pt  INNER'))) {
            return [[{ product_id: 1, id: 9, name: 'Ít ngọt', slug: 'it-ngot' }, { product_id: 1, id: 10, name: 'Mới', slug: 'moi' }]];
        }
        if (/FROM products AS p/.test(sql)) {
            return [[{ id: 1, name: 'A', price: '1', image: null, is_pinned: 0 }, { id: 2, name: 'B', price: '1', image: null, is_pinned: 0 }]];
        }
        return [[]];
    };
    calls.length = 0;
    const res = await call('/api/products');
    assert.deepEqual(res.body.data[0].tags.map((t) => t.name), ['Ít ngọt', 'Mới']);
    assert.deepEqual(res.body.data[1].tags, []);
    assert.equal(calls.filter((c) => /FROM product_tags AS pt INNER JOIN tags/.test(c.sql)).length, 1);
});

test('PUT /api/products/:id/tags: kiểm tra đầu vào, 401/404', async () => {
    let res = await put('/api/products/7/tags', { tag_ids: [1] }, JSON_HEADERS);
    assert.equal(res.status, 401);
    for (const bad of [{}, { tag_ids: 'x' }, { tag_ids: [1, 'a'] }, { tag_ids: [0] }, { tag_ids: Array.from({ length: 21 }, (_, i) => i + 1) }]) {
        res = await put('/api/products/7/tags', bad);
        assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 40));
    }
    rowsFor = () => [[]];
    calls.length = 0;
    res = await put('/api/products/7/tags', { tag_ids: [1] });
    assert.equal(res.status, 404);
    assert.ok(calls.some((c) => c.kind === 'rollback'));
});

test('PUT /api/products/:id/tags: thay toàn bộ nhãn trong một transaction', async () => {
    rowsFor = (sql) => {
        if (/FROM products WHERE id/.test(sql)) return [[{ id: 7 }]];
        if (/FROM tags WHERE id IN/.test(sql)) return [[{ id: 1, name: 'A', slug: 'a' }, { id: 2, name: 'B', slug: 'b' }]];
        return [{ affectedRows: 1 }];
    };
    calls.length = 0;
    let res = await put('/api/products/7/tags', { tag_ids: [2, 1, 2] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.tags.map((t) => t.id), [1, 2]);
    const kinds = calls.filter((c) => !/FROM users/.test(c.sql)).map((c) => (c.kind === 'conn.execute' ? (/^DELETE/.test(c.sql) ? 'delete' : /^INSERT/.test(c.sql) ? 'insert' : 'select') : c.kind));    const ins = calls.find((c) => /^INSERT INTO product_tags/.test(c.sql));
    assert.match(ins.sql, /VALUES \(\?, \?\), \(\?, \?\)$/);
    assert.deepEqual(ins.params, [7, 2, 7, 1]);

    // mảng rỗng = gỡ hết nhãn
    calls.length = 0;
    res = await put('/api/products/7/tags', { tag_ids: [] });
    assert.equal(res.status, 200);
    assert.ok(calls.some((c) => /^DELETE FROM product_tags/.test(c.sql)));
    assert.ok(!calls.some((c) => /^INSERT INTO product_tags/.test(c.sql)));
});

test('PUT /api/products/:id/tags: nhãn không tồn tại thì rollback, không xóa gì', async () => {
    rowsFor = (sql) => (/FROM products WHERE id/.test(sql) ? [[{ id: 7 }]] : /FROM tags WHERE id IN/.test(sql) ? [[{ id: 1, name: 'A', slug: 'a' }]] : [{ affectedRows: 1 }]);
    calls.length = 0;
    const res = await put('/api/products/7/tags', { tag_ids: [1, 99] });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /không tồn tại/);
    assert.ok(calls.some((c) => c.kind === 'rollback'));
    assert.ok(!calls.some((c) => /^DELETE FROM product_tags/.test(c.sql)));
});

test('API /api/tags: GET công khai có product_count; POST/PATCH/DELETE cần admin và kiểm tra dữ liệu', async () => {
    rowsFor = (sql) => (/FROM tags AS t/.test(sql) ? [[{ id: 1, name: 'Mới', slug: 'moi', product_count: '3' }]] : [[]]);
    let res = await call('/api/tags');
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].product_count, 3);

    res = await call('/api/tags', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'x' }) });
    assert.equal(res.status, 401);
    for (const name of ['', '   ', 'a'.repeat(51), '!!!', 5]) {
        res = await call('/api/tags', { method: 'POST', headers: JSON_AUTH, body: JSON.stringify({ name }) });
        assert.equal(res.status, 400, String(name));
    }

    rowsFor = (sql) => (/SELECT id FROM tags WHERE name/.test(sql) ? [[{ id: 1 }]] : [[]]);
    res = await call('/api/tags', { method: 'POST', headers: JSON_AUTH, body: JSON.stringify({ name: 'Mới' }) });
    assert.equal(res.status, 409);

    calls.length = 0;
    rowsFor = (sql) => (/INSERT INTO tags/.test(sql) ? [{ insertId: 12 }] : [[]]);
    res = await call('/api/tags', { method: 'POST', headers: JSON_AUTH, body: JSON.stringify({ name: '  Ít   ngọt ' }) });
    assert.equal(res.status, 201);
    assert.deepEqual(calls.find((c) => /INSERT INTO tags/.test(c.sql)).params, ['Ít ngọt', 'it-ngot']);

    rowsFor = () => [[]];
    res = await call('/api/tags/3', { method: 'PATCH', headers: JSON_AUTH, body: JSON.stringify({ name: 'Mới' }) });
    assert.equal(res.status, 404);
    rowsFor = (sql) => (/SELECT id FROM tags WHERE id = \?/.test(sql) ? [[{ id: 3 }]] : /<> \?/.test(sql) ? [[{ id: 4 }]] : [[]]);
    res = await call('/api/tags/3', { method: 'PATCH', headers: JSON_AUTH, body: JSON.stringify({ name: 'Mới' }) });
    assert.equal(res.status, 409);
    rowsFor = (sql) => (/SELECT id FROM tags WHERE id = \?/.test(sql) ? [[{ id: 3 }]] : /UPDATE tags/.test(sql) ? [{ affectedRows: 1 }] : [[]]);
    res = await call('/api/tags/3', { method: 'PATCH', headers: JSON_AUTH, body: JSON.stringify({ name: 'Bán chạy' }) });
    assert.equal(res.status, 200);

    res = await call('/api/tags/3', { method: 'DELETE' });
    assert.equal(res.status, 401);
    rowsFor = () => [{ affectedRows: 0 }];
    res = await call('/api/tags/3', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 404);
    rowsFor = () => [{ affectedRows: 1 }];
    res = await call('/api/tags/3', { method: 'DELETE', headers: AUTH });
    assert.equal(res.status, 200);
});


// ===== S18: PATCH sửa một phần =====
const patch = (url, body, headers = JSON_AUTH) => call(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
const existing = { id: 7, category_id: 1, name: 'Cà phê sữa', slug: 'ca-phe-sua', description: 'cũ', price: '25000.00', image: '/uploads/products/a.jpg', status: 1 };
const patchRows = (sql) => {
    if (/^SELECT \*\s+FROM products/.test(sql.trim())) return [[existing]];
    if (/FROM categories/.test(sql)) return [[{ id: 1 }, { id: 2 }].slice(0, 1)];
    if (/slug = \?/.test(sql)) return [[]];
    return [{ affectedRows: 1 }];
};

test('PATCH: cần token, ít nhất một trường, không nhận ảnh', async () => {
    let res = await patch('/api/products/7', { name: 'A' }, JSON_HEADERS);
    assert.equal(res.status, 401);
    res = await patch('/api/products/7', {});
    assert.equal(res.status, 400);
    assert.match(res.body.message, /ít nhất một trường/);
    res = await patch('/api/products/7', { foo: 1 });
    assert.equal(res.status, 400);
    res = await patch('/api/products/7', { image: 'x.png' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /ảnh/);
    res = await patch('/api/products/abc', { name: 'A' });
    assert.equal(res.status, 400);
});

test('PATCH: chỉ đổi trường được gửi, các trường còn lại và ảnh giữ nguyên', async () => {
    rowsFor = patchRows;
    calls.length = 0;
    const res = await patch('/api/products/7', { price: 30000 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.price, 30000);
    assert.equal(res.body.data.name, 'Cà phê sữa');
    const update = calls.find((c) => /^UPDATE products/.test(c.sql));
    assert.deepEqual(update.params, [1, 'Cà phê sữa', 'ca-phe-sua', 'cũ', 30000, '/uploads/products/a.jpg', 1, 7]);
    assert.doesNotMatch(update.sql, /is_pinned|pinned_at/);
});

test('PATCH: kiểm tra giá trị như POST (giá, tên, trạng thái, danh mục) và 404', async () => {
    rowsFor = patchRows;
    for (const bad of [{ price: -1 }, { price: 'abc' }, { price: '' }, { name: '   ' }, { name: 'a'.repeat(151) }, { status: 5 }, { category_id: 'x' }]) {
        const res = await patch('/api/products/7', bad);
        assert.equal(res.status, 400, JSON.stringify(bad));
    }
    rowsFor = (sql) => (/^SELECT \*\s+FROM products/.test(sql.trim()) ? [[]] : [[]]);
    const res = await patch('/api/products/7', { name: 'A' });
    assert.equal(res.status, 404);

    rowsFor = (sql) => (/slug = \?/.test(sql) ? [[{ id: 99 }]] : patchRows(sql));
    const dup = await patch('/api/products/7', { name: 'Trùng tên' });
    assert.equal(dup.status, 409);
});

test('MocAutoSave: debounce, không gửi khi không đổi, báo lỗi rồi thử lại', async () => {
    const vm = require('node:vm');
    const fsm = require('node:fs');
    const sandbox = { window: {}, setTimeout, clearTimeout, Promise, JSON, Date, String };
    vm.runInNewContext(fsm.readFileSync(require.resolve('../assets/js/admin-autosave.js'), 'utf8'), sandbox);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const statusEl = { textContent: '', classList: { toggle() {} } };
    let form = { price: 1 };
    const sent = [];
    let failNext = 0;
    const auto = sandbox.window.MocAutoSave.create({
        delay: 20, retryDelay: 20, statusEl,
        getSnapshot: () => ({ ...form }),
        save: async (current, previous) => {
            if (failNext > 0) { failNext--; throw new Error('x'); }
            sent.push({ current, previous });
        },
    });

    auto.reset({ price: 1 });
    form = { price: 1 };
    auto.schedule();
    await wait(60);
    assert.equal(sent.length, 0, 'không đổi thì không gửi');

    form = { price: 2 }; auto.schedule();
    form = { price: 3 }; auto.schedule();
    await wait(80);
    assert.equal(sent.length, 1, 'gõ liên tục chỉ gửi một lần');
    assert.deepEqual(sent[0].current, { price: 3 });
    assert.deepEqual(sent[0].previous, { price: 1 });
    assert.match(statusEl.textContent, /^Đã tự lưu lúc \d{2}:\d{2}$/);

    failNext = 1; form = { price: 4 }; auto.schedule();
    await wait(30);
    assert.equal(statusEl.textContent, 'Chưa lưu được — đang thử lại');
    await wait(80);
    assert.equal(sent.length, 2, 'tự thử lại sau lỗi');
    assert.match(statusEl.textContent, /^Đã tự lưu lúc/);

    // snapshot null (form chưa hợp lệ) thì bỏ qua
    const none = sandbox.window.MocAutoSave.create({ delay: 10, statusEl, getSnapshot: () => null, save: async () => sent.push('x') });
    none.reset(null); none.schedule(); await wait(40);
    assert.equal(sent.length, 2);
});
