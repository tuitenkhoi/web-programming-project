/* Đồng bộ ảnh trong assets/images/products với bảng products (menu).
   Mỗi ảnh có sẵn trong thư mục sẽ có một món tương ứng trong thực đơn.
   Chạy ở thư mục gốc dự án:   node scripts/sync-products.js
   Xem trước, không ghi:        node scripts/sync-products.js --dry
   - Món đã có (trùng ảnh / slug / tên) thì giữ nguyên; chỉ gắn ảnh nếu món đang để ảnh mặc định.
   - Món chưa có thì thêm mới (tên, danh mục, giá mặc định bên dưới; sửa lại trong trang quản trị).
   Chạy nhiều lần cũng an toàn. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const DIR = path.resolve(__dirname, '..', 'assets', 'images', 'products');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const DRY = process.argv.includes('--dry');

// slug ảnh -> thông tin món (giá là giá mặc định, hãy chỉnh trong trang quản trị)
const CATALOG = {
  'bac-xiu': { name: 'Bạc xỉu', cat: 'ca-phe', price: 32000, desc: 'Bạc xỉu thơm béo' },
  'ca-phe-sua-da': { name: 'Cà phê sữa đá', cat: 'ca-phe', price: 29000, desc: 'Cà phê sữa đá truyền thống' },
  'ca-phe-den-da': { name: 'Cà phê đen đá', cat: 'ca-phe', price: 25000, desc: 'Cà phê đen đá đậm vị', aliases: ['Cà phê đá', 'Cà phê đen đá'] },
  'tra-dao-cam-sa': { name: 'Trà đào cam sả', cat: 'tra-trai-cay', price: 45000, desc: 'Trà đào cam sả thanh mát' },
  'tra-dau': { name: 'Trà dâu', cat: 'tra-trai-cay', price: 45000, desc: 'Trà dâu tươi mát lạnh' },
  'tra-vai': { name: 'Trà vải', cat: 'tra-trai-cay', price: 45000, desc: 'Trà vải thơm ngọt dịu' },
  'matcha-da-xay': { name: 'Matcha đá xay', cat: 'da-xay', price: 49000, desc: 'Matcha đá xay thơm béo' },
  'chocolate-da-xay': { name: 'Chocolate đá xay', cat: 'da-xay', price: 49000, desc: 'Chocolate đá xay đậm vị' },
  'cookies-da-xay': { name: 'Cookies đá xay', cat: 'da-xay', price: 52000, desc: 'Cookies đá xay giòn béo' },
  'banh-tiramisu': { name: 'Bánh Tiramisu', cat: 'banh-ngot', price: 45000, desc: 'Bánh Tiramisu mềm mịn' },
  'banh-croissant': { name: 'Bánh Croissant', cat: 'banh-ngot', price: 35000, desc: 'Bánh sừng bò bơ giòn thơm' },
  'banh-mousse-chocolate': { name: 'Bánh Mousse Chocolate', cat: 'banh-ngot', price: 42000, desc: 'Bánh Mousse Chocolate mịn tan' },
};

const CATEGORY_NAMES = {
  'ca-phe': 'Cà phê',
  'tra-trai-cay': 'Trà trái cây',
  'da-xay': 'Đá xay',
  'banh-ngot': 'Bánh ngọt',
};

function guessCategory(slug) {
  if (slug.startsWith('banh')) return 'banh-ngot';
  if (slug.startsWith('tra')) return 'tra-trai-cay';
  if (slug.includes('da-xay')) return 'da-xay';
  return 'ca-phe';
}

function prettify(slug) {
  const s = slug.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isDefaultImage = (img) => !img || /^default-product/i.test(String(img).split('/').pop());

async function categoryId(slug) {
  let [rows] = await db.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  if (rows[0]) return rows[0].id;
  if (DRY) return 0;
  await db.query('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)', [CATEGORY_NAMES[slug] || prettify(slug), slug, '']);
  [rows] = await db.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  return rows[0].id;
}

(async () => {
  try {
    if (!fs.existsSync(DIR)) throw new Error('Không thấy thư mục ' + DIR);

    const files = fs.readdirSync(DIR)
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .filter((f) => !/^default-product/i.test(f))
      .sort();

    let added = 0, linked = 0, kept = 0;

    for (const file of files) {
      const slug = path.basename(file, path.extname(file)).toLowerCase();
      const info = CATALOG[slug] || {
        name: prettify(slug), cat: guessCategory(slug), price: 35000, desc: prettify(slug), guessed: true,
      };

      // 1) đã có món dùng đúng ảnh này
      let [rows] = await db.query('SELECT id, name, image FROM products WHERE image = ? OR image LIKE ? LIMIT 1', [file, '%/' + file]);
      if (rows[0]) { kept++; continue; }

      // 2) món cùng slug / cùng tên (kể cả tên cũ) nhưng chưa có ảnh riêng
      const names = [info.name].concat(info.aliases || []);
      [rows] = await db.query(
        `SELECT id, name, image FROM products WHERE slug = ? OR name IN (${names.map(() => '?').join(',')}) ORDER BY (slug = ?) DESC LIMIT 1`,
        [slug].concat(names, [slug])
      );
      if (rows[0]) {
        if (isDefaultImage(rows[0].image)) {
          console.log(`Gắn ảnh ${file} cho món "${rows[0].name}"`);
          if (!DRY) await db.query('UPDATE products SET image = ? WHERE id = ?', [file, rows[0].id]);
          linked++;
        } else {
          kept++;
        }
        continue;
      }

      // 3) chưa có món => thêm mới
      console.log(`Thêm món "${info.name}" (${file})` + (info.guessed ? '  [tên/giá đoán từ tên file, hãy chỉnh lại]' : ''));
      if (!DRY) {
        const catId = await categoryId(info.cat);
        await db.query(
          'INSERT INTO products (category_id, name, slug, description, price, image, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [catId, info.name, slug, info.desc, info.price, file]
        );
      }
      added++;
    }

    console.log(`${DRY ? '[Chạy thử] ' : ''}Xong: thêm ${added} món, gắn ảnh ${linked} món, giữ nguyên ${kept} món (${files.length} ảnh).`);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi:', err.message);
    process.exit(1);
  }
})();
