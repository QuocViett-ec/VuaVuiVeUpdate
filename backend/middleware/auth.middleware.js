"use strict";

const ROLE_PERMISSIONS = {
  admin: ["*"],
  staff: [
    "orders.read",
    "orders.write",
    "orders.export",
    "products.read",
    "products.write",
    "products.export",
    "vouchers.read",
    "vouchers.write",
    "dashboard.read",
    "reports.read",
  ],
  audit: ["dashboard.read", "reports.read", "audit.read", "users.read"],
};

function hasPermission(role, permission) {
  const normalizedRole = String(role || "").toLowerCase();
  const list = ROLE_PERMISSIONS[normalizedRole] || [];
  return list.includes("*") || list.includes(permission);
}

exports.requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "Bạn chưa đăng nhập" });
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "Bạn chưa đăng nhập" });
  }
  if (String(req.session.role || "").toLowerCase() !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Bạn không có quyền truy cập" });
  }
  next();
};

exports.requireBackofficeRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res
        .status(401)
        .json({ success: false, message: "Bạn chưa đăng nhập" });
    }

    const currentRole = String(req.session.role || "").toLowerCase();
    const allowed = roles.map((r) => String(r || "").toLowerCase());
    if (!allowed.includes(currentRole)) {
      return res
        .status(403)
        .json({ success: false, message: "Bạn không có quyền truy cập" });
    }

    next();
  };

exports.requirePermission = (permission) => (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "Bạn chưa đăng nhập" });
  }

  const role = String(req.session.role || "").toLowerCase();
  if (!hasPermission(role, permission)) {
    return res.status(403).json({
      success: false,
      message: `Bạn không có quyền ${permission}`,
    });
  }

  next();
};

exports.hasPermission = hasPermission;
