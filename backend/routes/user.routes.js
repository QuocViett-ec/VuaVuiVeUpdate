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
const { requireAdmin } = require("../middleware/auth.middleware");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau" },
});

// Dashboard stats
router.get("/dashboard/stats", adminLimiter, requireAdmin, getDashboardStats);
router.get("/dashboard/analytics", adminLimiter, requireAdmin, getDashboardAnalytics);

// Audit logs
router.get("/audit-logs", adminLimiter, requireAdmin, listAuditLogs);
router.post("/audit-logs", adminLimiter, requireAdmin, createAuditLogRoute);

// User management
router.get("/users", adminLimiter, requireAdmin, listUsers);
router.get("/users/:id", adminLimiter, requireAdmin, getUserById);
router.put("/users/:id", adminLimiter, requireAdmin, updateUser);
router.delete("/users/:id", adminLimiter, requireAdmin, deleteUser);

module.exports = router;
