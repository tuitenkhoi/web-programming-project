/* Tự chèn các file mới vào đúng trang HTML. Chạy từ thư mục gốc dự án:
     node scripts/inject-assets.js
   - mobile-fixes.css   -> mọi trang .html
   - admin-print.js     -> mọi trang trong admin/ (trừ login.html)
   - qrcode.js + payment-qr.js -> pages/payment.html
   - customer-greeting.js -> mọi trang khách hàng (ngoài admin/): lời chào tên khách
   Chạy nhiều lần cũng an toàn: chỗ nào có rồi thì bỏ qua. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'uploads']);

const need = [
  'assets/css/mobile-fixes.css',
  'assets/js/vendor/qrcode.js',
  'assets/js/payment-qr.js',
  'assets/js/admin-print.js',
  'assets/js/customer-greeting.js',
];
const missing = need.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) {
  console.error('Chưa chép đủ file. Còn thiếu:\n  ' + missing.join('\n  '));
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const relTo = (from, file) =>
  path.relative(path.dirname(from), path.join(ROOT, file)).split(path.sep).join('/');

function insertBeforeBodyEnd(html, tags) {
  return html.includes('</body>') ? html.replace('</body>', tags + '</body>') : html + tags;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  if (!html.includes('mobile-fixes.css') && html.includes('</head>')) {
    html = html.replace('</head>',
      `  <link rel="stylesheet" href="${relTo(file, 'assets/css/mobile-fixes.css')}" />\n</head>`);
  }

  if (/^admin\//i.test(rel) && !/login\.html$/i.test(rel) && !html.includes('admin-print.js')) {
    html = insertBeforeBodyEnd(html,
      `  <script src="${relTo(file, 'assets/js/admin-print.js')}"></script>\n`);
  }

  if (/(^|\/)payment\.html$/i.test(rel) && !html.includes('payment-qr.js')) {
    html = insertBeforeBodyEnd(html,
      `  <script src="${relTo(file, 'assets/js/vendor/qrcode.js')}"></script>\n` +
      `  <script src="${relTo(file, 'assets/js/payment-qr.js')}"></script>\n`);
  }

  if (!/^admin\//i.test(rel) && !html.includes('customer-greeting.js')) {
    html = insertBeforeBodyEnd(html,
      `  <script src="${relTo(file, 'assets/js/customer-greeting.js')}"></script>\n`);
  }

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('Đã cập nhật:', rel);
    changed++;
  }
}
console.log(changed ? `Xong, đã sửa ${changed} file.` : 'Không có file nào cần sửa (đã chèn đủ rồi).');
