"use strict";

const User = require("../models/User.model");
const Order = require("../models/Order.model");
const AuditLog = require("../models/AuditLog.model");

/**
 * GET /api/admin/users?search=&role=&page=&limit=
 */
exports.listUsers = async (req, res, next) => {
  try {
    const { search = "", role, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: users,
      message: "Lấy danh sách người dùng thành công",
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:id
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }
    const ordersCount = await Order.countDocuments({ userId: user._id });
    return res.json({
      success: true,
      data: { ...user.toObject(), ordersCount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/users/:id
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;
    const update = {};
    if (role !== undefined) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    await exports.createAuditLog({
      adminId: req.session.userId,
      action: "UPDATE_USER",
      target: `User:${user._id}`,
      details: update,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: "Cập nhật người dùng thành công",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/users/:id — soft delete
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    await exports.createAuditLog({
      adminId: req.session.userId,
      action: "DELETE_USER",
      target: `User:${user._id}`,
      details: { name: user.name },
      ip: req.ip,
    });

    return res.json({ success: true, message: "Đã vô hiệu hóa người dùng" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs?page=&limit=
 */
exports.listAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("adminId", "name email phone"),
      AuditLog.countDocuments(),
    ]);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/audit-logs — internal use
 * Also exported as a helper function for use in other controllers.
 */
exports.createAuditLog = async (data) => {
  try {
    await AuditLog.create(data);
  } catch (err) {
    // Non-critical — do not propagate, but log for monitoring
    console.error("[AuditLog] Failed to create audit log:", err.message);
  }
};

exports.createAuditLogRoute = async (req, res, next) => {
  try {
    const { adminId, action, target, details } = req.body;
    if (!adminId || !action || !target) {
      return res
        .status(400)
        .json({ success: false, message: "adminId, action, target là bắt buộc" });
    }
    const log = await AuditLog.create({
      adminId,
      action,
      target,
      details: details || {},
      ip: req.ip,
    });
    return res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalOrders,
      revenueAgg,
      pendingOrders,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: { $in: ["delivered"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.countDocuments({ status: "pending" }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "name phone"),
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalOrders,
        totalRevenue,
        pendingOrders,
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
};
