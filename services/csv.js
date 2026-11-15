// Tạo file CSV mở được bằng Excel (tiếng Việt không lỗi font).
//  - Thêm BOM ở đầu file để Excel nhận ra UTF-8.
//  - Mỗi dòng kết thúc bằng \r\n, ô có dấu phẩy / nháy kép / xuống dòng được bọc trong nháy kép.
//  - Chống "CSV injection": ô bắt đầu bằng = + - @ (hoặc tab) bị Excel hiểu là công thức,
//    mà tên khách / ghi chú do người lạ nhập, nên ta thêm dấu nháy đơn ở đầu để nó chỉ là chữ.
const BOM = '\ufeff';

function csvCell(value) {
    let text = value === null || value === undefined ? '' : String(value);

    if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
    }

    if (/[",\r\n]/.test(text)) {
        text = `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

// rows: mảng các dòng, mỗi dòng là mảng ô (dòng đầu thường là tiêu đề)
function buildCsv(rows) {
    return BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { buildCsv, csvCell };
