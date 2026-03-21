"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  listAuditLogs,
  createAuditLogRoute,
  getDashboardStats,
  getDashboardAnalytics,
} = require("../controllers/user.controller");
const {
  requireAuth,
  requireBackofficeRole,
  requirePermission,
} = require("../middleware/auth.middleware");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau",
  },
});

// Dashboard stats
router.get(
  "/dashboard/stats",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin", "staff", "audit"),
  requirePermission("dashboard.read"),
  getDashboardStats,
);
router.get(
  "/dashboard/analytics",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin", "staff", "audit"),
  requirePermission("dashboard.read"),
  getDashboardAnalytics,
);

// Audit logs
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin", "audit"),
  requirePermission("audit.read"),
  listAuditLogs,
);
router.post(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin"),
  createAuditLogRoute,
);

// User management
router.get(
  "/users",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin", "audit"),
  requirePermission("users.read"),
  listUsers,
);
router.get(
  "/users/:id",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin", "audit"),
  requirePermission("users.read"),
  getUserById,
);
router.put(
  "/users/:id",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin"),
  updateUser,
);
router.delete(
  "/users/:id",
  adminLimiter,
  requireAuth,
  requireBackofficeRole("admin"),
  deleteUser,
);

module.exports = router;
