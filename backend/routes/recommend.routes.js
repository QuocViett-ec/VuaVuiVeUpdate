"use strict";

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const RecommendHistory = require("../models/RecommendHistory.model");
const UserEvent = require("../models/UserEvent.model");
const Product = require("../models/Product.model");

/**
 * POST /api/recommend
 * Proxy tới RECOMMENDER_API/api/recommend, lưu history nếu user đã login
 */
router.post("/", async (req, res, next) => {
  try {
    const recommenderApi =
      process.env.RECOMMENDER_API || "http://localhost:5000";

    const response = await fetch(`${recommenderApi}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Recommender service error:", text);
      return res.status(response.status).json({
        success: false,
        message: "Recommender service unavailable",
      });
    }

    const data = await response.json();

    // Lưu history nếu user đã login
    if (req.session && req.session.userId && data.recommendations) {
      const items = data.recommendations.map((r) => ({
        // ML service may return product_id (snake_case) or productId (camelCase)
        productId: String(r.product_id ?? r.productId ?? ""),
        score: r.score ?? 0,
        reason: r.reason ?? "",
      }));
      await RecommendHistory.create({
        userId: req.session.userId,
        recommendations: items,
      });
    }

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/recommend/history
 * Lịch sử gợi ý của user hiện tại (auth required)
 */
router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      RecommendHistory.find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecommendHistory.countDocuments({ userId: req.session.userId }),
    ]);

    return res.json({
      success: true,
      data: records,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/recommend/event
 * Lưu sự kiện hành vi: view_product, add_to_cart, purchase, view_recipe
 * Không yêu cầu đăng nhập - lưu cả khách (sessionId)
 */
router.post("/event", async (req, res, next) => {
  try {
    const { eventType, productId, metadata } = req.body;
    if (!UserEvent.VALID_EVENTS.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: `eventType phải là một trong: ${UserEvent.VALID_EVENTS.join(", ")}`,
      });
    }
    await UserEvent.create({
      userId: req.session?.userId ?? null,
      sessionId: req.sessionID || "anonymous",
      eventType,
      productId: productId ?? null,
      metadata: metadata ?? {},
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/recommend/similar/:productId
 * Gợi ý sản phẩm tương tự dựa trên category + tags (content-based)
 */
router.get("/similar/:productId", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Sản phẩm không tồn tại" });
    }

    const n = Math.min(20, Math.max(1, parseInt(req.query.n) || 8));

    const tagsFilter =
      product.tags?.length > 0
        ? { $or: [{ category: product.category }, { tags: { $in: product.tags } }] }
        : { category: product.category };

    const similar = await Product.find({
      _id: { $ne: product._id },
      isActive: true,
      ...tagsFilter,
    })
      .limit(n)
      .select("name price originalPrice imageUrl category slug unit stock")
      .lean();

    return res.json({
      success: true,
      data: similar,
      meta: { source: "content-based", baseCategory: product.category },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
