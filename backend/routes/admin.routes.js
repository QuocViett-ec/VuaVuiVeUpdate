"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const orderCtrl = require("../controllers/order.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau" },
});

// All routes here require admin
router.use(requireAuth, requireAdmin);

router.get("/orders", adminLimiter, orderCtrl.getAllOrders);

module.exports = router;
