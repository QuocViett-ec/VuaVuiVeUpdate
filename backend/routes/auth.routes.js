"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

// Rate limiter for sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau" },
});

// General rate limiter for read endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau" },
});

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/logout", authController.logout);
router.get("/me", generalLimiter, requireAuth, authController.me);
router.put("/profile", requireAuth, authLimiter, authController.updateProfile);
router.put("/password", requireAuth, authLimiter, authController.changePassword);
router.post("/forgot-password", authLimiter, authController.forgotPassword);

module.exports = router;
