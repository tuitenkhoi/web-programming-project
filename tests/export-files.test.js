// Kiểm tra bộ tạo file Excel (services/xlsx.js) và CSV (services/csv.js). Không cần DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { buildXlsx, crc32, columnLetter } = require('../services/xlsx');
const { buildCsv, csvCell } = require('../services/csv');

// Giải nén ZIP bằng "central directory" (kiểm tra cả CRC và kích thước mà ZIP yêu cầu)
function unzip(buffer) {
    const files = {};
    const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let pos = buffer.readUInt32LE(end + 16);
    for (let i = 0; i < buffer.readUInt16LE(end + 10); i += 1) {
        const crc = buffer.readUInt32LE(pos + 16);
        const size = buffer.readUInt32LE(pos + 24);
        const nameLength = buffer.readUInt16LE(pos + 28);
        const localOffset = buffer.readUInt32LE(pos + 42);
        const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
        const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const data = zlib.inflateRawSync(buffer.subarray(start, start + buffer.readUInt32LE(pos + 20)));
        assert.equal(data.length, size, 'kích thước giải nén của ' + name);
        assert.equal(crc32(data), crc, 'CRC32 của ' + name);
        files[name] = data.toString('utf8');
        pos += 46 + nameLength + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
    }
    return files;
}

test('crc32 đúng giá trị chuẩn', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
    assert.equal(crc32(Buffer.alloc(0)), 0);
});

test('columnLetter: 0->A, 25->Z, 26->AA, 701->ZZ, 702->AAA', () => {
    assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnLetter), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('buildXlsx: cấu trúc file, số và chữ, định dạng tiền, dòng tổng', () => {
    const files = unzip(buildXlsx([{
        name: 'Hóa đơn',
        columns: [{ header: 'Mã', width: 12 }, { header: 'Tiền', width: 16, type: 'money' }],
        rows: [['HD1', 150000], ['HD2', -5000], [null, '']],
        totalRow: ['Tổng', 145000],
    }]));
    assert.ok(files['[Content_Types].xml'].includes('/xl/worksheets/sheet1.xml'));
    assert.ok(files['xl/_rels/workbook.xml.rels'].includes('worksheets/sheet1.xml'));
    const sheet = files['xl/worksheets/sheet1.xml'];
    assert.ok(sheet.includes('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Mã</t></is></c>'), 'ô tiêu đề');
    assert.ok(sheet.includes('<c r="B2" s="2"><v>150000</v></c>'), 'tiền là số, kiểu có dấu phẩy ngăn cách');
    assert.ok(sheet.includes('<c r="B3" s="2"><v>-5000</v></c>'), 'số âm giữ nguyên');
    assert.ok(sheet.includes('<c r="B5" s="3"><v>145000</v></c>'), 'dòng tổng nằm sau dữ liệu, in đậm');
    assert.ok(sheet.includes('<autoFilter ref="A1:B4"/>'), 'nút lọc chỉ gồm tiêu đề + dữ liệu, không gồm dòng tổng');
    assert.ok(sheet.includes('<col min="1" max="1" width="12" customWidth="1"/>'));
    assert.ok(sheet.includes('state="frozen"'), 'cố định dòng tiêu đề');
    assert.ok(files['xl/styles.xml'].includes('numFmtId="3"'));
});

test('buildXlsx: ký tự đặc biệt được mã hóa, công thức chỉ là chữ, ký tự điều khiển bị bỏ', () => {
    const sheet = unzip(buildXlsx([{
        name: 'Sheet',
        columns: [{ header: 'Ghi chú' }],
        rows: [['<b>&"x"</b>'], ['=SUM(1,2)'], ['a\u0001b\u0008c']],
    }]))['xl/worksheets/sheet1.xml'];
    assert.ok(sheet.includes('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;'));
    assert.ok(sheet.includes('t="inlineStr"><is><t xml:space="preserve">=SUM(1,2)</t>'), 'không có thẻ <f> (công thức)');
    assert.ok(!sheet.includes('<f>'));
    assert.ok(sheet.includes('>abc<'));
});

test('buildXlsx: tên bảng tính được làm sạch (tối đa 31 ký tự, bỏ \\ / ? * [ ] :)', () => {
    const workbook = unzip(buildXlsx([
        { name: 'A/B:C*D?[E]', columns: [{ header: 'x' }], rows: [] },
        { name: 'x'.repeat(40), columns: [{ header: 'x' }], rows: [] },
        { name: '   ', columns: [{ header: 'x' }], rows: [] },
    ]))['xl/workbook.xml'];
    assert.ok(workbook.includes('name="A B C D  E"'), 'mỗi ký tự cấm được đổi thành khoảng trắng, khoảng trắng cuối bị cắt');
    assert.ok(workbook.includes('name="' + 'x'.repeat(31) + '"'));
    assert.ok(workbook.includes('name="Sheet3"'));
});

test('buildXlsx: không có dòng dữ liệu vẫn hợp lệ', () => {
    const sheet = unzip(buildXlsx([{ name: 'S', columns: [{ header: 'A' }, { header: 'B' }], rows: [] }]))['xl/worksheets/sheet1.xml'];
    assert.ok(sheet.includes('<autoFilter ref="A1:B1"/>'));
});

test('csvCell: dấu phẩy, nháy kép, xuống dòng được bọc nháy', () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('có "nháy"'), '"có ""nháy"""');
    assert.equal(csvCell('hai\ndòng'), '"hai\ndòng"');
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(undefined), '');
    assert.equal(csvCell(0), '0');
});

test('csvCell: chống CSV injection, nhưng số âm vẫn là số', () => {
    for (const text of ['=1+1', '+84901234567', '-cmd', '@SUM(A1)', '\tTAB', '\rCR']) {
        assert.ok(csvCell(text).includes("'" + text.replace(/"/g, '""')), text);
    }
    assert.equal(csvCell(-5000), '-5000');
    assert.equal(csvCell('bình thường'), 'bình thường');
});

test('buildCsv: BOM đầu file, dòng kết thúc \\r\\n', () => {
    const csv = buildCsv([['Mã', 'Tiền'], ['HD1', 1000]]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.slice(1), 'Mã,Tiền\r\nHD1,1000\r\n');
});
