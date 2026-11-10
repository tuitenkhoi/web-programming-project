/* Thêm mục "Quản lý voucher" vào sidebar mọi trang admin (chạy lại nhiều lần vẫn an toàn).
   Chạy:  node scripts/add-voucher-menu.js */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'admin');
const item = `
        <li>
          <a href="vouchers.html">
            <i class="bi bi-ticket-perforated"></i>
            <span>Quản lý voucher</span>
          </a>
        </li>`;
const re = /(<span>Quản lý hóa đơn<\/span>\s*<\/a>\s*<\/li>)/;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.html') || f === 'login.html' || f === 'vouchers.html') continue;
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes('vouchers.html') || !re.test(s)) { console.log('bỏ qua', f); continue; }
  fs.writeFileSync(p, s.replace(re, '$1' + item));
  console.log('đã thêm vào', f);
}
