"use strict";

const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");
const RecommendHistory = require("../models/RecommendHistory.model");
const UserEvent = require("../models/UserEvent.model");
const Product = require("../models/Product.model");

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upstream ${response.status}: ${text}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function toRecommendation(
  product,
  score = 0,
  reason = "Gợi ý dự phòng từ hệ thống",
) {
  return {
    product_id: String(product.externalId ?? product._id),
    score,
    name: product.name,
    price: product.price,
    image: product.imageUrl || "",
    category: `${product.category || "other"}/${product.subCategory || "all"}`,
    reason,
  };
}

async function getLocalFallbackRecommendations(n = 10) {
  const limit = Math.max(1, Math.min(20, Number(n) || 10));
  const products = await Product.find({ isActive: true })
    .sort({ stock: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return products.map((p, idx) =>
    toRecommendation(
      p,
      Math.max(1, 20 - idx),
      "ML tạm gián đoạn, hiển thị sản phẩm phổ biến",
    ),
  );
}

async function getLocalFallbackSimilarProducts(productKey, n = 8) {
  const limit = Math.max(1, Math.min(20, Number(n) || 8));
  const base =
    (await Product.findOne({ _id: productKey })
      .lean()
      .catch(() => null)) ||
    (await Product.findOne({ externalId: String(productKey) }).lean());

  if (!base) {
    return getLocalFallbackRecommendations(limit);
  }

  const query = {
    _id: { $ne: base._id },
    isActive: true,
    $or: [{ category: base.category }],
  };

  if (base.tags?.length) {
    query.$or.push({ tags: { $in: base.tags } });
  }

  const similar = await Product.find(query)
    .sort({ stock: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return similar.map((p, idx) =>
    toRecommendation(
      p,
      Math.max(1, 15 - idx),
      "Gợi ý tương tự từ dữ liệu danh mục",
    ),
  );
}

/**
 * POST /api/recommend
 * Proxy tới RECOMMENDER_API/api/recommend, lưu history nếu user đã login
 */
router.post("/", async (req, res, next) => {
  try {
    const recommenderApi =
      process.env.RECOMMENDER_API || "http://localhost:5001";

    let data;
    try {
      data = await fetchJsonWithTimeout(
        `${recommenderApi}/api/recommend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        },
        Number(process.env.RECOMMENDER_TIMEOUT_MS || 4000),
      );
    } catch (mlError) {
      console.error(
        "Recommender service unavailable, fallback local:",
        mlError.message,
      );
      const n = Math.max(1, Math.min(20, Number(req.body?.n) || 10));
      const recommendations = await getLocalFallbackRecommendations(n);
      data = {
        user_id: req.body?.user_id ?? null,
        recommendations,
        count: recommendations.length,
        method: "local_fallback",
      };
    }

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
 * GET /api/recommend/telemetry/sections
 * Tổng hợp hiệu quả từng section recommendation (admin only)
 */
router.get("/telemetry/sections", requireAdmin, async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sectionMetricsPipeline = [
      {
        $match: {
          createdAt: { $gte: since },
          eventType: { $in: ["view_product", "add_to_cart"] },
          "metadata.source": "recommended_page",
          "metadata.section": { $in: ["personal", "similar", "trending"] },
        },
      },
      {
        $project: {
          section: "$metadata.section",
          action: "$metadata.action",
          eventType: 1,
        },
      },
      {
        $group: {
          _id: "$section",
          impressions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "impression"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          clicks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "click"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          addToCart: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          section: "$_id",
          impressions: 1,
          clicks: 1,
          addToCart: 1,
          ctr: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
              0,
            ],
          },
          addToCartRate: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$addToCart", "$impressions"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { section: 1 } },
    ];

    const breakdownPipeline = [
      {
        $match: {
          createdAt: { $gte: since },
          eventType: { $in: ["view_product", "add_to_cart"] },
          "metadata.source": "recommended_page",
          "metadata.section": { $in: ["personal", "similar", "trending"] },
          "metadata.user_segment": { $in: ["new_account", "with_history"] },
        },
      },
      {
        $project: {
          section: "$metadata.section",
          segment: "$metadata.user_segment",
          action: "$metadata.action",
          eventType: 1,
        },
      },
      {
        $group: {
          _id: { segment: "$segment", section: "$section" },
          impressions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "impression"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          clicks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "click"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          addToCart: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          segment: "$_id.segment",
          section: "$_id.section",
          impressions: 1,
          clicks: 1,
          addToCart: 1,
          ctr: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
              0,
            ],
          },
          addToCartRate: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$addToCart", "$impressions"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { segment: 1, section: 1 } },
    ];

    const dailyPipeline = [
      {
        $match: {
          createdAt: { $gte: since },
          eventType: { $in: ["view_product", "add_to_cart"] },
          "metadata.source": "recommended_page",
          "metadata.section": { $in: ["personal", "similar", "trending"] },
        },
      },
      {
        $project: {
          section: "$metadata.section",
          action: "$metadata.action",
          eventType: 1,
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Ho_Chi_Minh",
            },
          },
        },
      },
      {
        $group: {
          _id: { day: "$day", section: "$section" },
          impressions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "impression"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          clicks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "view_product"] },
                    { $eq: ["$action", "click"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          addToCart: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          section: "$_id.section",
          impressions: 1,
          clicks: 1,
          addToCart: 1,
          ctr: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
              0,
            ],
          },
          addToCartRate: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$addToCart", "$impressions"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { day: 1, section: 1 } },
    ];

    const [rows, breakdown, daily] = await Promise.all([
      UserEvent.aggregate(sectionMetricsPipeline),
      UserEvent.aggregate(breakdownPipeline),
      UserEvent.aggregate(dailyPipeline),
    ]);

    const normalizeRates = (row) => ({
      ...row,
      ctr: Number(Number(row.ctr || 0).toFixed(2)),
      addToCartRate: Number(Number(row.addToCartRate || 0).toFixed(2)),
    });

    return res.json({
      success: true,
      data: rows.map(normalizeRates),
      breakdown: breakdown.map(normalizeRates),
      daily: daily.map(normalizeRates),
      meta: { days, since },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/recommend/similar-ml
 * Proxy tới RECOMMENDER_API/api/similar để lấy sản phẩm tương tự từ model ML
 */
router.post("/similar-ml", async (req, res, next) => {
  try {
    const recommenderApi =
      process.env.RECOMMENDER_API || "http://localhost:5001";

    let data;
    try {
      data = await fetchJsonWithTimeout(
        `${recommenderApi}/api/similar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        },
        Number(process.env.RECOMMENDER_TIMEOUT_MS || 4000),
      );
    } catch (mlError) {
      console.error(
        "Recommender similar unavailable, fallback local:",
        mlError.message,
      );
      const n = Math.max(1, Math.min(20, Number(req.body?.n) || 8));
      const similarItems = await getLocalFallbackSimilarProducts(
        req.body?.product_id,
        n,
      );
      data = {
        product_id: req.body?.product_id ?? null,
        similar_items: similarItems,
        count: similarItems.length,
        method: "local_fallback",
      };
    }

    return res.json({ success: true, data });
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
      return res
        .status(404)
        .json({ success: false, message: "Sản phẩm không tồn tại" });
    }

    const n = Math.min(20, Math.max(1, parseInt(req.query.n) || 8));

    const tagsFilter =
      product.tags?.length > 0
        ? {
            $or: [
              { category: product.category },
              { tags: { $in: product.tags } },
            ],
          }
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
