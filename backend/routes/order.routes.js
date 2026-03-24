"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip);
const router = express.Router();
const orderCtrl = require("../controllers/order.controller");
const {
  requireAuth,
  requireBackofficeRole,
  requirePermission,
} = require("../middleware/auth.middleware");

function sessionOrIpKey(req) {
  if (req.session?.userId) return `user:${req.session.userId}`;
  return ipKeyGenerator(req.ip);
}

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === "development",
  keyGenerator: sessionOrIpKey,
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
  keyGenerator: sessionOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau",
  },
});

// User routes (auth required)
router.get("/voucher/available", readLimiter, orderCtrl.listApplicableVouchers);
router.post("/", requireAuth, writeLimiter, orderCtrl.createOrder);
router.post(
  "/voucher/validate",
  requireAuth,
  writeLimiter,
  orderCtrl.validateVoucherForCheckout,
);
router.get("/me", requireAuth, readLimiter, orderCtrl.getMyOrders);
router.get(
  "/:id/reviews/me",
  requireAuth,
  readLimiter,
  orderCtrl.getMyOrderReviews,
);
router.post(
  "/:id/reviews",
  requireAuth,
  writeLimiter,
  orderCtrl.submitOrderReviews,
);
router.get("/:id", requireAuth, readLimiter, orderCtrl.getOrderById);

// Cập nhật trạng thái thanh toán — CHỈ admin/staff (không cho browser owner gọi trực tiếp)
// Paid status được commit qua IPN callback trong payment.controller.js
router.patch(
  "/:id/paid",
  requireAuth,
  requireBackofficeRole("admin", "staff"),
  requirePermission("orders.write"),
  writeLimiter,
  orderCtrl.markOrderPaid,
);
router.patch("/:id/cancel", requireAuth, writeLimiter, orderCtrl.cancelOrder);
router.post(
  "/:id/return-request",
  requireAuth,
  writeLimiter,
  orderCtrl.requestReturn,
);

// Admin routes
router.put(
  "/:id/status",
  requireAuth,
  requireBackofficeRole("admin", "staff"),
  requirePermission("orders.write"),
  writeLimiter,
  orderCtrl.updateStatus,
);
router.put(
  "/:id/return-review",
  requireAuth,
  requireBackofficeRole("admin", "staff"),
  requirePermission("orders.write"),
  writeLimiter,
  orderCtrl.reviewReturnRequest,
);
router.patch(
  "/:id/refund",
  requireAuth,
  requireBackofficeRole("admin"),
  requirePermission("orders.write"),
  writeLimiter,
  orderCtrl.markOrderRefunded,
);

module.exports = router;
