// config/schemaCheck.js phải phát hiện database chưa chạy migration 004 (nguyên nhân khiến đăng ký/đăng nhập báo lỗi chung chung)
// và phải liệt kê ĐỦ các cột, để `npm run check-db -- --fix` không báo OK khi vẫn còn cột thiếu.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EXPECTED, inspectSchema } = require('../config/schemaCheck');

const COLUMNS_004 = [
    'avatar', 'theme', 'font_size', 'email_verified_at', 'verification_token', 'verification_expires_at',
    'reset_otp', 'reset_otp_expires_at', 'reset_attempts', 'reset_ticket', 'reset_ticket_expires_at',
];

// DB giả: có đủ mọi bảng/cột trong EXPECTED, trừ các cột users bị loại (mô phỏng DB chưa nâng cấp)
function fakeDb(without = []) {
    const rows = [];
    for (const [table, columns] of Object.entries(EXPECTED)) {
        for (const [column, definition] of Object.entries(columns)) {
            if (table === 'users' && without.includes(column)) continue;
            const type = definition && /^ENUM/i.test(definition) ? definition.match(/ENUM\(.*?\)/i)[0].toLowerCase() : 'varchar(255)';
            rows.push({ t: table, c: column, type, nullable: 'YES', def: null, extra: '' });
        }
    }
    return { query: async (sql) => (/DATABASE\(\)/.test(sql) ? [[{ dbName: 'moc_coffee' }]] : [rows]) };
}

test('schemaCheck: users có đủ 11 cột của migration 004', () => {
    for (const column of COLUMNS_004) assert.ok(EXPECTED.users[column], 'thiếu ' + column);
});

test('schemaCheck: DB đã chạy migration 004 thì không báo vấn đề', async () => {
    assert.deepEqual((await inspectSchema(fakeDb())).issues, []);
});

test('schemaCheck: DB chưa chạy migration 004 bị báo đủ 11 cột thiếu kèm câu SQL sửa', async () => {
    const { issues } = await inspectSchema(fakeDb(COLUMNS_004));
    assert.equal(issues.length, COLUMNS_004.length);
    const otp = issues.find((i) => i.column === 'reset_otp');
    assert.equal(otp.text, 'Bảng "users" thiếu cột "reset_otp"');
    assert.match(otp.fix, /^ALTER TABLE `users` ADD COLUMN `reset_otp` CHAR\(6\) NULL$/);
});

test('schemaCheck: chỉ thiếu 1 cột của 004 (vd. reset_ticket) vẫn bị phát hiện', async () => {
    const { issues } = await inspectSchema(fakeDb(['reset_ticket']));
    assert.deepEqual(issues.map((i) => i.column), ['reset_ticket']);
});
