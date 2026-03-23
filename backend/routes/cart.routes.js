"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const cartCtrl = require("../controllers/cart.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const cartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  skip: () => process.env.NODE_ENV === "development",
  keyGenerator: (req) => req.session?.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/me", requireAuth, cartLimiter, cartCtrl.getMyCart);
router.put("/me", requireAuth, cartLimiter, cartCtrl.syncMyCart);
router.post("/me/merge", requireAuth, cartLimiter, cartCtrl.mergeMyCart);
router.delete("/me", requireAuth, cartLimiter, cartCtrl.clearMyCart);

module.exports = router;
