"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const productCtrl = require("../controllers/product.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");
const { uploadImage } = require("../middleware/upload.middleware");

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau" },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, vui l\u00f2ng th\u1eed l\u1ea1i sau" },
});

// Public routes
router.get("/categories", readLimiter, productCtrl.getCategories);
router.get("/", readLimiter, productCtrl.getAll);
router.get("/:id", readLimiter, productCtrl.getOne);
router.post("/:id/reviews", requireAuth, writeLimiter, productCtrl.createReview);

// Admin routes
router.post("/", requireAuth, requireAdmin, writeLimiter, uploadImage, productCtrl.create);
router.put("/:id", requireAuth, requireAdmin, writeLimiter, uploadImage, productCtrl.update);
router.delete("/:id", requireAuth, requireAdmin, writeLimiter, productCtrl.remove);

module.exports = router;
