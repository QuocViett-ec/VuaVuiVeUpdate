"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const orderCtrl = require("../controllers/order.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau" },
});

// All routes here require admin
router.use(requireAuth, requireAdmin);

router.get("/orders", adminLimiter, orderCtrl.getAllOrders);

module.exports = router;
