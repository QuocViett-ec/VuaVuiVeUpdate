"use strict";

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const RecommendHistory = require("../models/RecommendHistory.model");

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
      return res.status(response.status).json({
        success: false,
        message: "Recommender service error",
        error: text,
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

module.exports = router;
