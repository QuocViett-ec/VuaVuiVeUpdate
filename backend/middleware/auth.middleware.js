"use strict";

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
  if (req.session.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Bạn không có quyền truy cập" });
  }
  next();
};
