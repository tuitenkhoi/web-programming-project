// Kiểm tra server phục vụ sw.js + manifest ở gốc ("/") mà KHÔNG mở rộng ra file nhạy cảm.
// KHÔNG cần MySQL: thay kết nối DB bằng bản giả (giống tests/smoke.test.js).
process.env.JWT_SECRET = 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');

const empty = async () => [[]];
const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    execute: empty, query: empty,
};
const fakeDb = { execute: empty, query: empty, getConnection: async () => connection, end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');

let server;
let base;
test.before(() => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => server.close());

test('GET /sw.js trả JavaScript, luôn kiểm tra lại (no-cache) để cập nhật được bản mới', async () => {
    const res = await fetch(base + '/sw.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.match(res.headers.get('cache-control'), /no-cache/);
    assert.match(await res.text(), /CACHE_VERSION/);
});

test('GET /manifest.webmanifest trả JSON manifest đúng Content-Type', async () => {
    const res = await fetch(base + '/manifest.webmanifest');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /manifest\+json/);
    assert.equal((await res.json()).name, 'Mộc Coffee');
});

test('Thêm sw.js/manifest không làm lộ file nhạy cảm ở gốc dự án', async () => {
    for (const url of ['/.env', '/server.js', '/package.json', '/config/db.js', '/sw.js/../server.js',
        '/%2e%2e/server.js', '/sw.js.map', '/manifest.webmanifest/.env', '/tests/pwa.test.js']) {
        const res = await fetch(base + url);
        assert.ok([400, 403, 404].includes(res.status), url + ' => ' + res.status);
    }
    const post = await fetch(base + '/sw.js', { method: 'POST' });
    assert.equal(post.status, 404);
});
