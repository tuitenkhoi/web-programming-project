/* Chèn khai báo PWA vào các trang khách. Chạy từ thư mục gốc dự án:
     node scripts/inject-pwa.js
   - index.html và pages/*.html: <link rel="manifest">, <meta name="theme-color">, <link rel="apple-touch-icon">, assets/js/pwa.js
   - KHÔNG đụng vào admin/ (trang quản trị luôn đi thẳng mạng, không qua cache).
   Chạy nhiều lần cũng an toàn: chỗ nào có rồi thì bỏ qua. Đường dẫn đều tương đối theo vị trí từng trang. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'uploads', 'admin']);

const need = [
  'manifest.webmanifest',
  'sw.js',
  'assets/js/pwa.js',
  'assets/images/icons/icon-192.png',
  'assets/images/icons/icon-512.png',
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

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (!(rel === 'index.html' || /^pages\/[^/]+\.html$/i.test(rel))) continue;

  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  if (!/rel=["']manifest["']/i.test(html) && html.includes('</head>')) {
    html = html.replace('</head>',
      `  <link rel="manifest" href="${relTo(file, 'manifest.webmanifest')}" />${eol}` +
      `  <meta name="theme-color" content="#3e2723" />${eol}` +
      `  <link rel="apple-touch-icon" href="${relTo(file, 'assets/images/icons/icon-192.png')}" />${eol}</head>`);
  }

  if (!html.includes('pwa.js')) {
    const tag = `  <script src="${relTo(file, 'assets/js/pwa.js')}"></script>${eol}`;
    html = html.includes('</body>') ? html.replace('</body>', tag + '</body>') : html + tag;
  }

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('Đã cập nhật:', rel);
    changed++;
  }
}
console.log(changed ? `Xong, đã sửa ${changed} file.` : 'Không có file nào cần sửa (đã chèn đủ rồi).');
