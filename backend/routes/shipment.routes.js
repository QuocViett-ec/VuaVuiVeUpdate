"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const shipmentCtrl = require("../controllers/shipment.controller");
const {
  requireAuth,
  requireBackofficeRole,
  requirePermission,
} = require("../middleware/auth.middleware");

const router = express.Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  },
});

router.get("/me", requireAuth, readLimiter, shipmentCtrl.listMyShipments);
router.get("/:id", requireAuth, readLimiter, shipmentCtrl.getShipmentById);

router.get(
  "/",
  requireAuth,
  requireBackofficeRole("admin", "staff", "audit"),
  requirePermission("orders.read"),
  readLimiter,
  shipmentCtrl.listShipmentsAdmin,
);
router.post(
  "/",
  requireAuth,
  requireBackofficeRole("admin", "staff"),
  requirePermission("orders.write"),
  writeLimiter,
  shipmentCtrl.createShipmentForOrder,
);
router.patch(
  "/:id",
  requireAuth,
  requireBackofficeRole("admin", "staff"),
  requirePermission("orders.write"),
  writeLimiter,
  shipmentCtrl.updateShipment,
);

module.exports = router;
