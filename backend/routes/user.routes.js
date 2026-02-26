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
} = require("../controllers/user.controller");
const { requireAdmin } = require("../middleware/auth.middleware");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau" },
});

// Dashboard stats
router.get("/dashboard/stats", adminLimiter, requireAdmin, getDashboardStats);

// Audit logs
router.get("/audit-logs", adminLimiter, requireAdmin, listAuditLogs);
router.post("/audit-logs", adminLimiter, requireAdmin, createAuditLogRoute);

// User management
router.get("/users", adminLimiter, requireAdmin, listUsers);
router.get("/users/:id", adminLimiter, requireAdmin, getUserById);
router.put("/users/:id", adminLimiter, requireAdmin, updateUser);
router.delete("/users/:id", adminLimiter, requireAdmin, deleteUser);

module.exports = router;
