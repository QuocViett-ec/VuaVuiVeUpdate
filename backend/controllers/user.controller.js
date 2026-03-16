"use strict";

const User = require("../models/User.model");
const Order = require("../models/Order.model");
const AuditLog = require("../models/AuditLog.model");
const Product = require("../models/Product.model");

function formatDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fillDailySeries(rawMap, days) {
  const today = startOfDay(new Date());
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = formatDayKey(date);
    const found = rawMap.get(key) || { revenue: 0, orders: 0 };
    data.push({
      day: key,
      revenue: found.revenue,
      orders: found.orders,
    });
  }

  return data;
}

function fillMonthlySeries(rawMap, months) {
  const now = new Date();
  const data = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = formatMonthKey(date);
    const found = rawMap.get(key) || { revenue: 0, orders: 0 };
    data.push({
      month: key,
      revenue: found.revenue,
      orders: found.orders,
    });
  }

  return data;
}

async function buildAdminAnalytics() {
  const today = startOfDay(new Date());
  const last30Date = new Date(today);
  last30Date.setDate(today.getDate() - 29);
  const last12MonthDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const paidOrderMatch = {
    status: { $ne: "cancelled" },
    "payment.status": "paid",
  };

  const [
    totalUsers,
    totalProducts,
    totalOrders,
    pendingOrders,
    paidRevenueAgg,
    averageOrderAgg,
    ordersByStatusAgg,
    last30DaysAgg,
    last12MonthsAgg,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Order.aggregate([
      { $match: paidOrderMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          paidOrders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: last30Date } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "cancelled"] },
                    { $eq: ["$payment.status", "paid"] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: last12MonthDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "cancelled"] },
                    { $eq: ["$payment.status", "paid"] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("userId", "name phone email")
      .lean(),
  ]);

  const revenueSummary = paidRevenueAgg[0] || { totalRevenue: 0, paidOrders: 0 };
  const averageOrderValue = Math.round(averageOrderAgg[0]?.averageOrderValue || 0);

  const last30Map = new Map(
    last30DaysAgg.map((item) => [
      item._id,
      { revenue: item.revenue || 0, orders: item.orders || 0 },
    ]),
  );
  const last12Map = new Map(
    last12MonthsAgg.map((item) => [
      item._id,
      { revenue: item.revenue || 0, orders: item.orders || 0 },
    ]),
  );

  const revenueLast30Days = fillDailySeries(last30Map, 30);
  const revenueLast7Days = revenueLast30Days.slice(-7);
  const revenueByMonth = fillMonthlySeries(last12Map, 12);

  return {
    overview: {
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue: revenueSummary.totalRevenue || 0,
      paidOrders: revenueSummary.paidOrders || 0,
      averageOrderValue,
    },
    revenueLast7Days,
    revenueLast30Days,
    revenueByMonth,
    ordersByStatus: ordersByStatusAgg.map((item) => ({
      status: item._id || "unknown",
      count: item.count,
    })),
    recentOrders,
  };
}

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
    const analytics = await buildAdminAnalytics();

    return res.json({
      success: true,
      data: analytics.overview,
    });
  } catch (err) {
    next(err);
  }
};

exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const analytics = await buildAdminAnalytics();
    return res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};
