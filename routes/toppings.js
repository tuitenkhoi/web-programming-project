// Topping của món: khách xem công khai (chỉ topping đang bán). Thêm / sửa / bật-tắt / chọn món áp dụng: admin và bếp
// (quyền toppings.manage). Xóa topping chỉ admin.
// Giá topping lấy từ bảng toppings, cả giỏ hàng lẫn server tính tiền đều dùng bảng này.
const express = require('express');
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { logActivity } = require('../services/audit');
const { dbErrorMessage } = require('../middleware/dbError');

const router = express.Router();

const MAX_NAME_LENGTH = 50;
const MAX_PRICE = 1000000;

const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const formatTopping = (row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    is_active: Number(row.is_active) === 1,
    sort_order: Number(row.sort_order),
});

// Đọc và kiểm tra dữ liệu gửi lên. partial = true (PATCH): trường nào không gửi thì bỏ qua.
// Trả { values } hoặc { error }
function readBody(body, partial) {
    const values = {};

    if (!partial || body?.name !== undefined) {
        const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
        if (!name) return { error: 'Tên topping không được để trống.' };
        if (name.length > MAX_NAME_LENGTH) return { error: `Tên topping tối đa ${MAX_NAME_LENGTH} ký tự.` };
        values.name = name;
    }

    if (!partial || body?.price !== undefined) {
        const price = typeof body?.price === 'string' && body.price.trim() === '' ? NaN : Number(body?.price);
        if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
            return { error: `Giá topping phải là số nguyên từ 0 đến ${MAX_PRICE.toLocaleString('vi-VN')} đồng.` };
        }
        values.price = price;
    }

    if (body?.is_active !== undefined) {
        const flag = body.is_active;
        if (![true, false, 1, 0, '1', '0'].includes(flag)) return { error: 'Trạng thái topping không hợp lệ.' };
        values.is_active = flag === true || flag === 1 || flag === '1' ? 1 : 0;
    }

    return { values };
}

// Gắn scope { categories, include, exclude } vào danh sách topping (chịu lỗi nếu chưa chạy migration 010)
async function withScopes(rows) {
    const list = rows.map(formatTopping);
    try {
        const [cats] = await db.execute('SELECT topping_id, category_id FROM topping_categories');
        const [prods] = await db.execute('SELECT topping_id, product_id, allowed FROM topping_products');
        list.forEach((t) => {
            t.scope = {
                categories: (cats || []).filter((r) => Number(r.topping_id) === t.id).map((r) => Number(r.category_id)),
                include: (prods || []).filter((r) => Number(r.topping_id) === t.id && Number(r.allowed) === 1).map((r) => Number(r.product_id)),
                exclude: (prods || []).filter((r) => Number(r.topping_id) === t.id && Number(r.allowed) !== 1).map((r) => Number(r.product_id)),
            };
        });
    } catch (_error) {
        list.forEach((t) => { t.scope = { categories: [], include: [], exclude: [] }; });
    }
    return list;
}

const ids = (value) => (Array.isArray(value) ? [...new Set(value.map(Number))].filter((n) => Number.isInteger(n) && n > 0) : []);

// GET /api/toppings : topping đang bán (cho trang khách)
router.get('/', async (_req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, name, price, is_active, sort_order FROM toppings WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
        );
        const data = await withScopes(rows);
        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('Lỗi lấy topping:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Không thể tải danh sách topping.') });
    }
});

// GET /api/toppings/admin : tất cả topping, kể cả đang tắt (cho trang quản lý)
router.get('/admin', verifyToken, requirePermission('toppings.manage'), async (_req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, name, price, is_active, sort_order FROM toppings ORDER BY sort_order ASC, id ASC'
        );
        const data = await withScopes(rows);
        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('Lỗi lấy topping (admin):', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Không thể tải danh sách topping.') });
    }
});

// POST /api/toppings { name, price, is_active? }
router.post('/', verifyToken, requirePermission('toppings.manage'), async (req, res) => {
    const parsed = readBody(req.body, false);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const { name, price } = parsed.values;
    const isActive = parsed.values.is_active === undefined ? 1 : parsed.values.is_active;

    try {
        const [existing] = await db.execute('SELECT id FROM toppings WHERE name = ? LIMIT 1', [name]);
        if (existing.length) {
            return res.status(409).json({ success: false, message: 'Topping này đã tồn tại.' });
        }

        // Topping mới nằm cuối danh sách
        const [[next]] = await db.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM toppings');
        const sortOrder = Number(next?.next_order) || 1;

        const [result] = await db.execute(
            'INSERT INTO toppings (name, price, is_active, sort_order) VALUES (?, ?, ?, ?)',
            [name, price, isActive, sortOrder]
        );
        await logActivity(req.user, 'topping.create', 'topping', result.insertId, name);
        return res.status(201).json({
            success: true,
            message: 'Đã thêm topping.',
            data: { id: result.insertId, name, price, is_active: isActive === 1, sort_order: sortOrder },
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Topping này đã tồn tại.' });
        }
        console.error('Lỗi thêm topping:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Lỗi máy chủ khi thêm topping.') });
    }
});

// PATCH /api/toppings/:id { name?, price?, is_active? }
router.patch('/:id', verifyToken, requirePermission('toppings.manage'), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID topping không hợp lệ.' });

    const parsed = readBody(req.body, true);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    const fields = Object.keys(parsed.values);
    if (!fields.length) return res.status(400).json({ success: false, message: 'Không có thông tin nào để cập nhật.' });

    try {
        const [found] = await db.execute('SELECT id FROM toppings WHERE id = ? LIMIT 1', [id]);
        if (!found.length) return res.status(404).json({ success: false, message: 'Không tìm thấy topping.' });

        if (parsed.values.name !== undefined) {
            const [clash] = await db.execute('SELECT id FROM toppings WHERE name = ? AND id <> ? LIMIT 1', [parsed.values.name, id]);
            if (clash.length) return res.status(409).json({ success: false, message: 'Topping này đã tồn tại.' });
        }

        // Tên cột lấy từ danh sách cố định (readBody) chứ không lấy từ dữ liệu người dùng gửi
        const setClause = fields.map((field) => `${field} = ?`).join(', ');
        await db.execute(`UPDATE toppings SET ${setClause} WHERE id = ?`, [...fields.map((field) => parsed.values[field]), id]);

        await logActivity(req.user, 'topping.update', 'topping', id, fields.map((f) => `${f}=${parsed.values[f]}`).join(', '));
        return res.json({ success: true, message: 'Đã cập nhật topping.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Topping này đã tồn tại.' });
        }
        console.error('Lỗi sửa topping:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Lỗi máy chủ khi sửa topping.') });
    }
});

// PUT /api/toppings/:id/scope { categories: [id], include: [productId], exclude: [productId] }
// Thay toàn bộ phạm vi áp dụng. Rỗng hết = áp dụng mọi món.
router.put('/:id/scope', verifyToken, requirePermission('toppings.manage'), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID topping không hợp lệ.' });
    const categories = ids(req.body?.categories);
    const include = ids(req.body?.include);
    const exclude = ids(req.body?.exclude).filter((n) => !include.includes(n));

    try {
        const [found] = await db.execute('SELECT id, name FROM toppings WHERE id = ? LIMIT 1', [id]);
        if (!found.length) return res.status(404).json({ success: false, message: 'Không tìm thấy topping.' });

        await db.execute('DELETE FROM topping_categories WHERE topping_id = ?', [id]);
        await db.execute('DELETE FROM topping_products WHERE topping_id = ?', [id]);
        for (const categoryId of categories) {
            await db.execute('INSERT INTO topping_categories (topping_id, category_id) VALUES (?, ?)', [id, categoryId]);
        }
        for (const productId of include) {
            await db.execute('INSERT INTO topping_products (topping_id, product_id, allowed) VALUES (?, ?, 1)', [id, productId]);
        }
        for (const productId of exclude) {
            await db.execute('INSERT INTO topping_products (topping_id, product_id, allowed) VALUES (?, ?, 0)', [id, productId]);
        }
        await logActivity(req.user, 'topping.scope', 'topping', id, `${found[0].name}: ${categories.length} danh mục, +${include.length}, -${exclude.length} món`);
        return res.json({ success: true, message: 'Đã lưu phạm vi áp dụng của topping.', data: { categories, include, exclude } });
    } catch (error) {
        console.error('Lỗi lưu phạm vi topping:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Chưa lưu được phạm vi topping. Đã chạy migration 010 chưa?') });
    }
});

// DELETE /api/toppings/:id  (đơn cũ vẫn giữ tên topping đã lưu trong từng món)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID topping không hợp lệ.' });

    try {
        const [result] = await db.execute('DELETE FROM toppings WHERE id = ?', [id]);
        try {
            await db.execute('DELETE FROM topping_categories WHERE topping_id = ?', [id]);
            await db.execute('DELETE FROM topping_products WHERE topping_id = ?', [id]);
        } catch (_e) { /* chưa có bảng phạm vi: bỏ qua */ }
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy topping.' });
        return res.json({ success: true, message: 'Đã xóa topping.' });
    } catch (error) {
        console.error('Lỗi xóa topping:', error);
        return res.status(500).json({ success: false, message: dbErrorMessage(error, 'Lỗi máy chủ khi xóa topping.') });
    }
});

module.exports = router;
