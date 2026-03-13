"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const orderCtrl = require("../controllers/order.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const readLimiter = rateLimit({
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

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau",
  },
});

// User routes (auth required)
router.post("/", requireAuth, writeLimiter, orderCtrl.createOrder);
router.get("/me", requireAuth, readLimiter, orderCtrl.getMyOrders);
router.get("/:id", requireAuth, readLimiter, orderCtrl.getOrderById);

// Cập nhật trạng thái thanh toán (owner hoặc admin) — gọi sau VNPay/MoMo callback
router.patch("/:id/paid", requireAuth, writeLimiter, orderCtrl.markOrderPaid);

// Admin routes
router.put(
  "/:id/status",
  requireAuth,
  requireAdmin,
  writeLimiter,
  orderCtrl.updateStatus,
);

module.exports = router;
