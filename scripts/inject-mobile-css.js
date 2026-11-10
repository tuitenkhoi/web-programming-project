/* Chèn <link> tới assets/css/mobile-fixes.css vào MỌI file .html của dự án.
   Chạy từ thư mục gốc dự án:  node scripts/inject-mobile-css.js
   Chạy nhiều lần cũng an toàn (file nào có rồi thì bỏ qua). */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'assets', 'css', 'mobile-fixes.css');
const SKIP = new Set(['node_modules', '.git', 'uploads']);

if (!fs.existsSync(CSS)) {
  console.error('Chưa có assets/css/mobile-fixes.css. Hãy chép file đó vào trước.');
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

let changed = 0;
for (const file of walk(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('mobile-fixes.css') || !html.includes('</head>')) continue;

  const rel = path.relative(path.dirname(file), CSS).split(path.sep).join('/');
  const tag = `  <link rel="stylesheet" href="${rel}" />\n`;
  fs.writeFileSync(file, html.replace('</head>', tag + '</head>'), 'utf8');
  console.log('Đã thêm vào:', path.relative(ROOT, file));
  changed++;
}
console.log(changed ? `Xong, đã sửa ${changed} file.` : 'Không có file nào cần sửa.');
