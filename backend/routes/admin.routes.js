"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const orderCtrl = require("../controllers/order.controller");
const userCtrl = require("../controllers/user.controller");
const productCtrl = require("../controllers/product.controller");
const voucherCtrl = require("../controllers/voucher.controller");
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

// All routes here require backoffice account
router.use(requireAuth, requireBackofficeRole("admin", "staff", "audit"));

router.get(
  "/orders",
  adminLimiter,
  requirePermission("orders.read"),
  orderCtrl.getAllOrders,
);
router.patch(
  "/orders/bulk-status",
  adminLimiter,
  requirePermission("orders.write"),
  orderCtrl.bulkUpdateStatus,
);
router.get(
  "/orders/export",
  adminLimiter,
  requirePermission("orders.export"),
  orderCtrl.exportOrdersCsv,
);

router.get(
  "/products",
  adminLimiter,
  requirePermission("products.read"),
  productCtrl.getAdminProducts,
);
router.get(
  "/products/export",
  adminLimiter,
  requirePermission("products.export"),
  productCtrl.exportProductsCsv,
);

router.get(
  "/users/export",
  adminLimiter,
  requirePermission("users.read"),
  userCtrl.exportUsersCsv,
);

router.get(
  "/vouchers",
  adminLimiter,
  requirePermission("vouchers.read"),
  voucherCtrl.listVouchers,
);
router.post(
  "/vouchers",
  adminLimiter,
  requirePermission("vouchers.write"),
  voucherCtrl.createVoucher,
);
router.put(
  "/vouchers/:code",
  adminLimiter,
  requirePermission("vouchers.write"),
  voucherCtrl.updateVoucher,
);
router.delete(
  "/vouchers/:code",
  adminLimiter,
  requirePermission("vouchers.write"),
  voucherCtrl.deleteVoucher,
);

module.exports = router;
