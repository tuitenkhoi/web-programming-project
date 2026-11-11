// Nhãn (tag) sản phẩm: GET công khai, thêm/sửa/xóa cần admin.
const express = require('express');
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MAX_NAME_LENGTH = 50;

const createSlug = (value) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Trả { name, slug } hoặc { error }
const readName = (body) => {
    const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) return { error: 'Tên nhãn không được để trống.' };
    if (name.length > MAX_NAME_LENGTH) return { error: `Tên nhãn tối đa ${MAX_NAME_LENGTH} ký tự.` };
    const slug = createSlug(name);
    if (!slug) return { error: 'Tên nhãn phải có ít nhất một chữ cái hoặc chữ số.' };
    return { name, slug };
};

// GET /api/tags  -> kèm product_count (chỉ tính món đang bán)
router.get('/', async (_req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT t.id, t.name, t.slug, COUNT(p.id) AS product_count
               FROM tags AS t
               LEFT JOIN product_tags AS pt ON pt.tag_id = t.id
               LEFT JOIN products AS p ON p.id = pt.product_id AND p.status = 1
              GROUP BY t.id, t.name, t.slug
              ORDER BY t.name ASC`
        );
        return res.json({
            success: true,
            count: rows.length,
            data: rows.map((row) => ({ ...row, product_count: Number(row.product_count) })),
        });
    } catch (error) {
        console.error('Lỗi lấy nhãn:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải danh sách nhãn.' });
    }
});

// POST /api/tags { name }
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    const parsed = readName(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    try {
        const [existing] = await db.execute(
            'SELECT id FROM tags WHERE name = ? OR slug = ? LIMIT 1',
            [parsed.name, parsed.slug]
        );
        if (existing.length) {
            return res.status(409).json({ success: false, message: 'Nhãn này đã tồn tại.' });
        }

        const [result] = await db.execute('INSERT INTO tags (name, slug) VALUES (?, ?)', [parsed.name, parsed.slug]);
        return res.status(201).json({
            success: true,
            message: 'Đã thêm nhãn.',
            data: { id: result.insertId, name: parsed.name, slug: parsed.slug, product_count: 0 },
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Nhãn này đã tồn tại.' });
        }
        console.error('Lỗi thêm nhãn:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm nhãn.' });
    }
});

// PATCH /api/tags/:id { name }
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID nhãn không hợp lệ.' });

    const parsed = readName(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    try {
        const [found] = await db.execute('SELECT id FROM tags WHERE id = ? LIMIT 1', [id]);
        if (!found.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhãn.' });

        const [clash] = await db.execute(
            'SELECT id FROM tags WHERE (name = ? OR slug = ?) AND id <> ? LIMIT 1',
            [parsed.name, parsed.slug, id]
        );
        if (clash.length) {
            return res.status(409).json({ success: false, message: 'Nhãn này đã tồn tại.' });
        }

        await db.execute('UPDATE tags SET name = ?, slug = ? WHERE id = ?', [parsed.name, parsed.slug, id]);
        return res.json({ success: true, message: 'Đã đổi tên nhãn.', data: { id, name: parsed.name, slug: parsed.slug } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Nhãn này đã tồn tại.' });
        }
        console.error('Lỗi sửa nhãn:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi sửa nhãn.' });
    }
});

// DELETE /api/tags/:id  (liên kết trong product_tags xóa theo ON DELETE CASCADE)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID nhãn không hợp lệ.' });

    try {
        const [result] = await db.execute('DELETE FROM tags WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy nhãn.' });
        return res.json({ success: true, message: 'Đã xóa nhãn.' });
    } catch (error) {
        console.error('Lỗi xóa nhãn:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa nhãn.' });
    }
});

module.exports = router;
