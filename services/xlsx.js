// Tạo file Excel (.xlsx) mà không cần thư viện ngoài.
//
// File .xlsx thực chất là một file ZIP chứa vài file XML:
//   [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels,
//   xl/styles.xml và mỗi bảng tính là một file xl/worksheets/sheetN.xml.
// Vì vậy ta chỉ cần: (1) viết các file XML, (2) ghép chúng thành ZIP.
//
// Cách dùng:
//   const buffer = buildXlsx([{
//       name: 'Hóa đơn',
//       columns: [{ header: 'Mã', width: 12 }, { header: 'Tổng tiền', width: 16, type: 'money' }],
//       rows: [['HD0001', 150000]],
//       totalRow: ['Tổng cộng', 150000]      // (không bắt buộc) dòng tổng, in đậm
//   }]);
const zlib = require('zlib');

// ===== 1. ZIP =====
// CRC32: mã kiểm tra mà định dạng ZIP bắt buộc phải có cho từng file
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

// Ghép danh sách { name, data } thành một file ZIP (mỗi file nén bằng deflate)
function zip(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
        const name = Buffer.from(file.name, 'utf8');
        const raw = Buffer.from(file.data, 'utf8');
        const packed = zlib.deflateRawSync(raw);
        const crc = crc32(raw);

        // Tiêu đề của từng file trong ZIP
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); // chữ ký "local file header"
        local.writeUInt16LE(20, 4);          // phiên bản cần để giải nén
        local.writeUInt16LE(0x0800, 6);      // cờ: tên file là UTF-8
        local.writeUInt16LE(8, 8);           // 8 = deflate
        local.writeUInt16LE(dosTime, 10);
        local.writeUInt16LE(dosDate, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);          // không có trường mở rộng
        localParts.push(local, name, packed);

        // Mục tương ứng trong "central directory" (mục lục ở cuối file ZIP)
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(dosTime, 12);
        central.writeUInt16LE(dosDate, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(packed.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);   // vị trí tiêu đề của file này trong ZIP
        centralParts.push(central, name);

        offset += local.length + name.length + packed.length;
    });

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, ...centralParts, end]);
}

// ===== 2. XML =====
// Bỏ ký tự điều khiển (XML không cho phép) rồi đổi ký tự đặc biệt thành thực thể
function xmlText(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Số thứ tự cột -> chữ cái của Excel: 0 -> A, 25 -> Z, 26 -> AA
function columnLetter(index) {
    let letter = '';
    let n = index + 1;
    while (n > 0) {
        const rest = (n - 1) % 26;
        letter = String.fromCharCode(65 + rest) + letter;
        n = Math.floor((n - 1) / 26);
    }
    return letter;
}

// Kiểu ô (chỉ số trong cellXfs của styles.xml bên dưới)
const STYLE = { normal: 0, header: 1, money: 2, totalMoney: 3, totalText: 4 };

// Một ô. Chữ ghi dạng inlineStr (luôn là chữ, Excel không bao giờ coi là công thức)
function cellXml(ref, value, style) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    }
    if (value === null || value === undefined || value === '') {
        return style ? `<c r="${ref}" s="${style}"/>` : '';
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

function sheetXml(sheet) {
    const columns = sheet.columns;
    const rows = [];

    // Dòng 1: tiêu đề cột
    rows.push(
        `<row r="1" ht="22" customHeight="1">${columns
            .map((column, c) => cellXml(`${columnLetter(c)}1`, column.header, STYLE.header))
            .join('')}</row>`
    );

    // Các dòng dữ liệu: cột kiểu 'money' hiện dạng 150,000 nhưng vẫn là số để Excel cộng được
    sheet.rows.forEach((row, r) => {
        const rowNumber = r + 2;
        rows.push(
            `<row r="${rowNumber}">${columns
                .map((column, c) =>
                    cellXml(`${columnLetter(c)}${rowNumber}`, row[c], column.type === 'money' ? STYLE.money : STYLE.normal)
                )
                .join('')}</row>`
        );
    });

    // Dòng tổng (không bắt buộc)
    if (sheet.totalRow) {
        const rowNumber = sheet.rows.length + 2;
        rows.push(
            `<row r="${rowNumber}">${columns
                .map((column, c) => {
                    const value = sheet.totalRow[c];
                    const style = typeof value === 'number' ? STYLE.totalMoney : STYLE.totalText;
                    return cellXml(`${columnLetter(c)}${rowNumber}`, value, style);
                })
                .join('')}</row>`
        );
    }

    const lastColumn = columnLetter(columns.length - 1);
    const lastDataRow = sheet.rows.length + 1;

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        // Cố định dòng tiêu đề khi cuộn
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        `<cols>${columns
            .map((column, c) => `<col min="${c + 1}" max="${c + 1}" width="${column.width || 14}" customWidth="1"/>`)
            .join('')}</cols>` +
        `<sheetData>${rows.join('')}</sheetData>` +
        // Nút lọc ở dòng tiêu đề (không gồm dòng tổng)
        `<autoFilter ref="A1:${lastColumn}${Math.max(lastDataRow, 1)}"/>` +
        '</worksheet>'
    );
}

// Kiểu chữ / màu nền / định dạng số dùng chung cho cả file
const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEADBC8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

// Tên bảng tính: tối đa 31 ký tự, không chứa \ / ? * [ ] :
function safeSheetName(name, index) {
    const cleaned = String(name || '').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
    return cleaned || `Sheet${index + 1}`;
}

// ===== 3. Ghép thành file .xlsx =====
function buildXlsx(sheets) {
    const names = sheets.map((sheet, index) => safeSheetName(sheet.name, index));

    const files = [
        {
            name: '[Content_Types].xml',
            data:
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
                sheets
                    .map(
                        (_sheet, i) =>
                            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
                    )
                    .join('') +
                '</Types>',
        },
        {
            name: '_rels/.rels',
            data:
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                '</Relationships>',
        },
        {
            name: 'xl/workbook.xml',
            data:
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                `<sheets>${names.map((name, i) => `<sheet name="${xmlText(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
                '</workbook>',
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            data:
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                sheets
                    .map(
                        (_sheet, i) =>
                            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
                    )
                    .join('') +
                `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
                '</Relationships>',
        },
        { name: 'xl/styles.xml', data: STYLES_XML },
        ...sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sheet) })),
    ];

    return zip(files);
}

module.exports = { buildXlsx, crc32, columnLetter };
