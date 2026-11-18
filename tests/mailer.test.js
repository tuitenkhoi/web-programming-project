const test = require('node:test');
const assert = require('node:assert/strict');
const { sendMail, parseSender } = require('../services/mailer');

test('parseSender hiểu cả dạng "Tên <email>" lẫn dạng sai dấu nháy/thiếu <>', () => {
    assert.deepEqual(parseSender('Mộc Coffee <a@b.vn>'), { name: 'Mộc Coffee', email: 'a@b.vn' });
    assert.deepEqual(parseSender('"Mộc Coffee a@b.vn"'), { name: 'Mộc Coffee', email: 'a@b.vn' });
    assert.deepEqual(parseSender('a@b.vn'), { name: undefined, email: 'a@b.vn' });
    assert.equal(parseSender('không có email'), null);
});

test('có BREVO_API_KEY thì gửi qua API HTTPS, không đụng SMTP', async () => {
    const realFetch = global.fetch;
    const calls = [];
    process.env.BREVO_API_KEY = 'xkeysib-test';
    process.env.MAIL_FROM = 'Mộc Coffee <no@moc.vn>';
    global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
    try {
        const ok = await sendMail({ to: 'khach@moc.vn', subject: 'Mã', text: 'Mã của bạn: 123456' });
        assert.equal(ok, true);
        assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(calls[0].init.headers['api-key'], 'xkeysib-test');
        const body = JSON.parse(calls[0].init.body);
        assert.deepEqual(body.sender, { name: 'Mộc Coffee', email: 'no@moc.vn' });
        assert.deepEqual(body.to, [{ email: 'khach@moc.vn' }]);

        global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
        const origError = console.error; console.error = () => {};
        assert.equal(await sendMail({ to: 'khach@moc.vn', subject: 'x', text: 'x' }), false);
        console.error = origError;
    } finally {
        global.fetch = realFetch;
        delete process.env.BREVO_API_KEY;
        delete process.env.MAIL_FROM;
    }
});
