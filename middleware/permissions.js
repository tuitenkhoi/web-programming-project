// Phân quyền cho nhân viên theo vị trí (staff_position). Admin luôn có mọi quyền.
//
//   waiter  = phục vụ      cashier = thu ngân      kitchen = bếp
//
// Muốn đổi quyền của một vị trí, chỉ cần sửa bảng PERMISSIONS và ORDER_STATUS_BY_POSITION dưới đây.

const PERMISSIONS = {
    // Sơ đồ bàn. Bếp chỉ thấy bàn trống hay không (không có nút nào).
    'tables.view': ['waiter', 'cashier', 'kitchen'],
    'tables.update': ['waiter', 'cashier'],   // chi tiết từng thao tác xem TABLE_TRANSITIONS_BY_POSITION
    'tables.order': ['waiter'],               // nút "Gọi món" trên bàn đang có khách
    'tables.bill': ['cashier'],               // trên bàn đang có khách: xác nhận đơn + xuất hóa đơn
    'bookings.view': ['waiter', 'cashier'],
    'bookings.manage': ['waiter'],
    'orders.view': ['waiter', 'cashier', 'kitchen'],
    'orders.create': ['waiter', 'cashier'],   // bếp không tạo đơn
    'orders.edit': ['waiter', 'cashier'],     // bếp không sửa đơn
    'orders.any_table': ['cashier'],          // được chọn bàn/hình thức tùy ý; phục vụ chỉ tạo đơn mang đi hoặc cho bàn vừa nhận khách
    'orders.payment': ['cashier'],
    'kitchen.view': ['waiter', 'cashier', 'kitchen'],
};

// Trạng thái bàn mà mỗi vị trí được chuyển TỪ -> TỚI (admin không bị giới hạn)
//   Phục vụ: nhận khách (trống -> có khách), bảo trì và kết thúc bảo trì
//   Thu ngân: chỉ bảo trì và kết thúc bảo trì
const TABLE_TRANSITIONS_BY_POSITION = {
    waiter: { available: ['occupied', 'maintenance'], maintenance: ['available'] },
    cashier: { available: ['maintenance'], maintenance: ['available'] },
    kitchen: {},
};

// Trạng thái đơn mà mỗi vị trí được phép chuyển TỚI (server vẫn kiểm tra thứ tự chuyển hợp lệ ở order.admin.controller)
const ORDER_STATUS_BY_POSITION = {
    waiter: ['confirmed', 'completed'],
    cashier: ['confirmed', 'completed', 'cancelled'],
    kitchen: ['confirmed', 'preparing', 'ready'],
};

const POSITIONS = ['waiter', 'cashier', 'kitchen'];
const POSITION_TEXT = { waiter: 'Phục vụ', cashier: 'Thu ngân', kitchen: 'Bếp' };

const isAdmin = (user) => Boolean(user) && user.role === 'admin';
const isStaff = (user) => Boolean(user) && user.role === 'staff';

function can(user, permission) {
    if (isAdmin(user)) return true;
    if (!isStaff(user)) return false;
    return (PERMISSIONS[permission] || []).includes(user.staff_position);
}

function canSetOrderStatus(user, status) {
    if (isAdmin(user)) return true;
    if (!isStaff(user)) return false;
    return (ORDER_STATUS_BY_POSITION[user.staff_position] || []).includes(status);
}

const ALL_TABLE_STATUSES = ['available', 'occupied', 'maintenance'];

// Nhân viên có được chuyển bàn từ trạng thái `from` sang `to` không (admin: luôn được, API bàn vẫn kiểm tra thêm)
function canTableTransition(user, from, to) {
    if (isAdmin(user)) return true;
    if (!isStaff(user)) return false;
    const rules = TABLE_TRANSITIONS_BY_POSITION[user.staff_position] || {};
    return (rules[from] || []).includes(to);
}

// Bảng chuyển trạng thái bàn của người dùng, trả cho giao diện để ẩn/hiện nút
function tableTransitionsOf(user) {
    if (isAdmin(user)) {
        return {
            available: ['occupied', 'maintenance'],
            occupied: ['available'],
            maintenance: ['available'],
        };
    }
    if (!isStaff(user)) return {};
    return TABLE_TRANSITIONS_BY_POSITION[user.staff_position] || {};
}

// Phục vụ chỉ gọi món cho bàn đã bấm "Nhận khách" (bàn đang có khách)
function mustReceiveGuestsFirst(user) {
    return isStaff(user) && !can(user, 'orders.any_table');
}

const ALL_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

// Các trạng thái đơn mà người dùng được chuyển tới (giao diện dùng để ẩn/hiện nút)
function allowedOrderStatuses(user) {
    if (isAdmin(user)) return ALL_ORDER_STATUSES;
    if (!isStaff(user)) return [];
    return ORDER_STATUS_BY_POSITION[user.staff_position] || [];
}

// Danh sách quyền của một người dùng, trả cho giao diện để ẩn/hiện nút
function permissionsOf(user) {
    return Object.keys(PERMISSIONS).filter((permission) => can(user, permission));
}

const deny = (res, status, message, code) =>
    res.status(status).json({ success: false, message, code });

// Chỉ admin hoặc nhân viên (khách hàng bị chặn)
function requireStaff(req, res, next) {
    if (!req.user) return deny(res, 401, 'Bạn chưa đăng nhập.', 'NO_USER');
    if (!isAdmin(req.user) && !isStaff(req.user)) {
        return deny(res, 403, 'Chức năng này chỉ dành cho nhân viên.', 'FORBIDDEN');
    }
    return next();
}

// Yêu cầu một quyền cụ thể (ví dụ 'orders.payment')
function requirePermission(permission) {
    return function (req, res, next) {
        if (!req.user) return deny(res, 401, 'Bạn chưa đăng nhập.', 'NO_USER');
        if (!can(req.user, permission)) {
            return deny(res, 403, 'Vị trí của bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN');
        }
        return next();
    };
}

// Kiểm tra quyền đổi trạng thái đơn theo vị trí (đọc req.body.status)
function requireOrderStatusPermission(req, res, next) {
    if (!req.user) return deny(res, 401, 'Bạn chưa đăng nhập.', 'NO_USER');
    const status = req.body && req.body.status;
    if (typeof status === 'string' && !canSetOrderStatus(req.user, status)) {
        return deny(res, 403, 'Vị trí của bạn không được chuyển đơn sang trạng thái này.', 'FORBIDDEN');
    }
    // Trạng thái sai/thiếu để controller trả lỗi 400 như cũ
    return next();
}

module.exports = {
    PERMISSIONS,
    ORDER_STATUS_BY_POSITION,
    POSITIONS,
    POSITION_TEXT,
    can,
    canSetOrderStatus,
    canTableTransition,
    tableTransitionsOf,
    mustReceiveGuestsFirst,
    allowedOrderStatuses,
    permissionsOf,
    requireStaff,
    requirePermission,
    requireOrderStatusPermission,
};
