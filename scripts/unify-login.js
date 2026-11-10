/* Gộp 2 trang đăng nhập thành một. Chạy ở thư mục gốc dự án:
     node scripts/unify-login.js
   - admin/login.html  -> tự chuyển sang pages/account.html (giữ ?expired / ?required)
   - Các trang HTML khác trỏ tới admin/login.html (menu "Quản trị"...) -> trỏ thẳng pages/account.html
   - pages/account.html -> nạp thêm assets/js/account-ui.js nếu chưa có
   Chạy nhiều lần cũng an toàn. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'uploads']);
const MARK = 'data-unified-login';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const rel = (from, to) => {
  const r = path.relative(path.dirname(from), path.join(ROOT, to)).split(path.sep).join('/');
  return r.startsWith('.') ? r : './' + r;
};

const adminLogin = path.join(ROOT, 'admin', 'login.html');
const account = path.join(ROOT, 'pages', 'account.html');
const accountUi = path.join(ROOT, 'assets', 'js', 'account-ui.js');
const adminAuth = path.join(ROOT, 'assets', 'js', 'admin-auth.js');

for (const f of [adminLogin, account, accountUi, adminAuth]) {
  if (!fs.existsSync(f)) {
    console.error('Thiếu file: ' + path.relative(ROOT, f));
    process.exit(1);
  }
}

let changed = 0;
function save(file, html, before) {
  if (html === before) return;
  fs.writeFileSync(file, html, 'utf8');
  console.log('Đã cập nhật:', path.relative(ROOT, file).split(path.sep).join('/'));
  changed++;
}

// 1) admin/login.html chuyển hướng sang trang tài khoản
{
  let html = fs.readFileSync(adminLogin, 'utf8');
  const before = html;
  if (!html.includes(MARK)) {
    const redirect =
      `  <script ${MARK}>location.replace('../pages/account.html' + location.search + '#login');</script>\n`;
    html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + redirect);
  }
  save(adminLogin, html, before);
}

// 2) Các link tới admin/login.html (trừ chính nó và phần đăng xuất trong admin/) -> trang tài khoản
for (const file of walk(ROOT)) {
  if (file === adminLogin) continue;
  const inAdmin = path.relative(ROOT, file).split(path.sep)[0] === 'admin';
  if (inAdmin) continue; // trong admin/, "login.html" là link đăng xuất; đã tự chuyển hướng ở bước 1
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/href="((?:\.\.\/|\.\/)?admin\/login\.html)"/g, () => `href="${rel(file, 'pages/account.html')}"`);
  save(file, html, before);
}

// 3) account.html nạp account-ui.js
{
  let html = fs.readFileSync(account, 'utf8');
  const before = html;
  if (!html.includes('account-ui.js')) {
    const tag = `  <script src="${rel(account, 'assets/js/account-ui.js')}"></script>\n`;
    html = html.includes('</body>') ? html.replace('</body>', tag + '</body>') : html + tag;
  }
  save(account, html, before);
}

console.log(changed ? `Xong, đã sửa ${changed} file.` : 'Không có gì cần sửa (đã gộp rồi).');
