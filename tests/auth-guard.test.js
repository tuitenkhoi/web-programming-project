// Kiểm tra MocAuthGuard (assets/js/client-api.js) bằng cách chạy file trong một "trình duyệt giả" tối giản.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; },
    };
}

// Nạp client-api.js với trạng thái trình duyệt giả; trả về các thứ cần kiểm tra
function loadClient({ token = null, pathname = '/pages/cart.html', search = '?a=1', saved = null } = {}) {
    const local = makeStorage(token ? { mocCoffeeCustomerToken: token } : {});
    const session = makeStorage(saved ? { mocAfterLogin: saved } : {});
    const toasts = [];
    const location = { origin: 'http://localhost:5000', pathname, search, href: '' };
    const timers = [];
    const sandbox = {
        window: null,
        localStorage: local,
        sessionStorage: session,
        document: {
            createElement: () => ({ style: {}, setAttribute() {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }),
            body: { appendChild: (el) => toasts.push(el) },
        },
        setTimeout: (fn) => { timers.push(fn); return 1; },
        fetch: async () => ({}),
        URLSearchParams,
        FormData: class {},
        console,
    };
    sandbox.window = { location, ...sandbox };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/client-api.js'), 'utf8'), sandbox);
    return { guard: sandbox.window.MocAuthGuard, location, session, toasts, timers };
}

test('Guard: đã đăng nhập thì cho qua, không chuyển trang', () => {
    const { guard, location, timers } = loadClient({ token: 'abc' });
    assert.equal(guard.requireLogin(), true);
    assert.equal(timers.length, 0);
    assert.equal(location.href, '');
});

test('Guard: chưa đăng nhập -> lưu mocAfterLogin, báo toast, chuyển tới account.html?login=1&next=', () => {
    const { guard, location, session, toasts, timers } = loadClient();
    assert.equal(guard.requireLogin(), false);
    assert.equal(session.getItem('mocAfterLogin'), '/pages/cart.html?a=1');
    assert.equal(toasts[0].textContent, 'Bạn cần đăng nhập để tiếp tục');
    timers.forEach((fn) => fn());
    assert.equal(location.href, '/pages/account.html?login=1&next=' + encodeURIComponent('/pages/cart.html?a=1'));
});

test('Guard: sau đăng nhập quay lại đúng trang đã lưu và chỉ dùng 1 lần', () => {
    const { guard, session } = loadClient({ saved: '/pages/payment.html' });
    assert.equal(guard.afterLoginUrl('../index.html'), '/pages/payment.html');
    assert.equal(session.getItem('mocAfterLogin'), null);
    assert.equal(guard.afterLoginUrl('../index.html'), '../index.html');
});

test('Guard: chặn open redirect (//evil.com, http://, javascript:)', () => {
    for (const bad of ['//evil.com', 'https://evil.com/x', 'javascript:alert(1)', '/\\evil.com']) {
        const { guard } = loadClient({ saved: bad });
        assert.equal(guard.afterLoginUrl('../index.html'), '../index.html', bad);
    }
});
