"use strict";

const Product = require("../models/Product.model");
<<<<<<< Updated upstream
=======
const Order = require("../models/Order.model");
const { publishToCustomers } = require("../services/realtime-bus");
const { createAuditLog } = require("./user.controller");
>>>>>>> Stashed changes

const REVIEW_SNIPPETS = [
  {
    author: "Minh Anh",
    rating: 5,
    comment: "Sản phẩm tươi, giao nhanh, đóng gói gọn gàng.",
  },
  {
    author: "Hoàng Phúc",
    rating: 4,
    comment: "Chất lượng ổn định, mình đặt lại nhiều lần rồi.",
  },
  {
    author: "Lan Chi",
    rating: 5,
    comment: "Giá hợp lý, dùng cho bữa cơm gia đình rất tiện.",
  },
  {
    author: "Quốc Việt",
    rating: 4,
    comment: "Sản phẩm đúng mô tả, chế biến lên khá ngon.",
  },
  {
    author: "Thu Thảo",
    rating: 5,
    comment: "Mình hài lòng, nguyên liệu sạch và dễ chọn mua.",
  },
];

function computeReviewSeed(product) {
  const rawId = String(product._id || product.id || product.slug || product.name || "");
  return rawId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildSyntheticReviews(product, soldCount) {
  const seed = computeReviewSeed(product);
  const reviewCount = Math.max(1, Math.min(12, Math.floor(soldCount / 8) || ((seed % 5) + 2)));
  const averageRating = Number((4 + ((seed % 9) / 10)).toFixed(1));
  const reviews = Array.from({ length: Math.min(3, reviewCount) }, (_, index) => {
    const base = REVIEW_SNIPPETS[(seed + index) % REVIEW_SNIPPETS.length];
    return {
      id: `${String(product._id || product.id || product.slug || "product")}-review-${index + 1}`,
      author: base.author,
      rating: Math.max(4, Math.min(5, base.rating - ((seed + index) % 2))),
      comment: base.comment,
      createdAt: new Date(Date.now() - (index + 2) * 86400000).toISOString(),
    };
  });

  return {
    rating: averageRating,
    reviewCount,
    reviews,
  };
}

function summarizeStoredReviews(product) {
  const rawReviews = Array.isArray(product.reviews) ? product.reviews : [];
  const reviews = rawReviews
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    )
    .map((review) => ({
      id: String(review._id || `${product._id}-review`),
      userId: String(review.userId || ""),
      author: review.author,
      rating: Number(review.rating || 0),
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

  if (!reviews.length) return null;

  const averageRating =
    reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;

  return {
    rating: Number(averageRating.toFixed(1)),
    reviewCount: reviews.length,
    reviews,
  };
}

async function buildSoldCountMap(productIds) {
  if (!productIds.length) return new Map();

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $ne: "cancelled" },
        "items.productId": { $in: productIds },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: "$items.productId",
        soldCount: { $sum: "$items.quantity" },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.soldCount || 0)]));
}

async function enrichProducts(products) {
  const list = Array.isArray(products) ? products : [products].filter(Boolean);
  if (!list.length) return Array.isArray(products) ? [] : null;

  const productIds = list
    .map((product) => product?._id)
    .filter(Boolean);
  const soldCountMap = await buildSoldCountMap(productIds);

  const enriched = list.map((product) => {
    const soldCount = soldCountMap.get(String(product._id)) || 0;
    const reviewMeta =
      summarizeStoredReviews(product) || buildSyntheticReviews(product, soldCount);
    return {
      ...product,
      soldCount,
      rating: reviewMeta.rating,
      reviewCount: reviewMeta.reviewCount,
      reviews: reviewMeta.reviews,
    };
  });

  return Array.isArray(products) ? enriched : enriched[0];
}

async function buildReviewEligibility(productId, userId) {
  if (!userId || !productId) {
    return {
      canReview: false,
      hasPurchased: false,
      alreadyReviewed: false,
    };
  }

  const [hasDeliveredOrder, product] = await Promise.all([
    Order.exists({
      userId,
      status: "delivered",
      "items.productId": productId,
    }),
    Product.findById(productId).select("reviews.userId").lean(),
  ]);

  const alreadyReviewed = Boolean(
    product?.reviews?.some((review) => String(review.userId) === String(userId)),
  );

  return {
    canReview: Boolean(hasDeliveredOrder) && !alreadyReviewed,
    hasPurchased: Boolean(hasDeliveredOrder),
    alreadyReviewed,
  };
}

async function findDeliveredOrderForReview({ productId, userId, orderId }) {
  if (!userId || !productId || !orderId) return null;
  if (!/^[a-f\d]{24}$/i.test(String(orderId))) return null;

  return Order.findOne({
    _id: orderId,
    userId,
    status: "delivered",
    "items.productId": productId,
  })
    .select("_id")
    .lean();
}

/**
 * GET /api/products
 * Query: ?category=&search=&page=&limit=&sort=
 */
exports.getAll = async (req, res, next) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 12,
      sort = "-createdAt",
    } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);
    const enrichedProducts = await enrichProducts(products);

    return res.json({
      success: true,
      data: enrichedProducts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
<<<<<<< Updated upstream
=======
 * GET /api/admin/products
 * Query: ?search=&category=&status=active|inactive|all&lowStock=1&minStock=&maxStock=&page=&limit=
 */
exports.getAdminProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      status = "all",
      lowStock,
      minStock,
      maxStock,
      page = 1,
      limit = 50,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (category && category !== "all") filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    if (lowStock === "1" || lowStock === "true") {
      filter.stock = { ...(filter.stock || {}), $lt: 10 };
    }

    if (minStock !== undefined && minStock !== "") {
      filter.stock = {
        ...(filter.stock || {}),
        $gte: Math.max(0, Number(minStock)),
      };
    }
    if (maxStock !== undefined && maxStock !== "") {
      filter.stock = {
        ...(filter.stock || {}),
        $lte: Math.max(0, Number(maxStock)),
      };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);
    const enrichedProducts = await enrichProducts(products);

    return res.json({
      success: true,
      data: enrichedProducts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/products/export
 */
exports.exportProductsCsv = async (req, res, next) => {
  try {
    const { search = "", category = "all", status = "all" } = req.query;
    const filter = {};
    if (category !== "all") filter.category = category;
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const rows = await Product.find(filter).sort({ createdAt: -1 }).lean();
    const header = [
      "name",
      "category",
      "subCategory",
      "price",
      "stock",
      "isActive",
      "updatedAt",
    ];

    const csv = [
      header.join(","),
      ...rows.map((p) =>
        [
          p.name || "",
          p.category || "",
          p.subCategory || "",
          p.price || 0,
          p.stock || 0,
          p.isActive !== false ? "active" : "inactive",
          p.updatedAt ? new Date(p.updatedAt).toISOString() : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-${Date.now()}.csv"`,
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (err) {
    next(err);
  }
};

/**
>>>>>>> Stashed changes
 * GET /api/products/categories
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    return res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Accepts MongoDB ObjectId or slug
 */
exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const product = isObjectId
      ? await Product.findOne({ _id: id, isActive: true }).lean()
      : await Product.findOne({ slug: id, isActive: true }).lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    const [enrichedProduct, reviewPermission] = await Promise.all([
      enrichProducts(product),
      buildReviewEligibility(product._id, req.session?.userId),
    ]);
    enrichedProduct.viewerReviewPermission = reviewPermission;
    return res.json({ success: true, data: enrichedProduct });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/:id/reviews
 */
exports.createReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orderId = String(req.body?.orderId || "").trim();
    const rating = Number(req.body?.rating || 0);
    const comment = String(req.body?.comment || "").trim();
    const userId = req.session?.userId;
    const author = String(req.session?.name || "Khach hang").trim();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập" });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Số sao phải từ 1 đến 5" });
    }
    if (comment.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Nhận xét cần ít nhất 10 ký tự",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Vui lÃ²ng Ä‘Ã¡nh giÃ¡ tá»« trang Ä‘Æ¡n hÃ ng Ä‘Ã£ giao",
      });
    }

    const product = await Product.findById(id);
    if (!product || product.isActive === false) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    const [permission, deliveredOrder] = await Promise.all([
      buildReviewEligibility(product._id, userId),
      findDeliveredOrderForReview({
        productId: product._id,
        userId,
        orderId,
      }),
    ]);
    if (!permission.hasPurchased) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng",
      });
    }
    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: "Vui lÃ²ng Ä‘Ã¡nh giÃ¡ tá»« Ä‘Ãºng Ä‘Æ¡n hÃ ng Ä‘Ã£ giao cá»§a sáº£n pháº©m nÃ y",
      });
    }
    if (permission.alreadyReviewed) {
      return res.status(409).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi",
      });
    }

    product.reviews.push({
      userId,
      author,
      rating,
      comment,
    });
    await product.save();

    const enrichedProduct = await enrichProducts(product.toObject());
    enrichedProduct.viewerReviewPermission = {
      canReview: false,
      hasPurchased: true,
      alreadyReviewed: true,
    };

    publishToCustomers("product.changed", {
      action: "reviewed",
      productId: String(product._id),
      isActive: product.isActive,
      category: product.category,
      updatedAt: product.updatedAt,
      source: "customer",
    });

    return res.status(201).json({
      success: true,
      message: "Gửi nhận xét thành công",
      data: enrichedProduct,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products  (admin)
 * Multer single('image') runs before this handler via route middleware
 */
exports.create = async (req, res, next) => {
  try {
    const {
      name,
      price,
      originalPrice,
      category,
      subCategory,
      description,
      imageUrl: imageUrlFromBody,
      stock,
      unit,
      tags,
      isActive,
    } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Tên, giá và danh mục là bắt buộc",
      });
    }

    const imageUrl = req.file
      ? `/uploads/products/${req.file.filename}`
      : (imageUrlFromBody || "");

    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(tags)
          ? tags
          : [];

    const product = await Product.create({
      name,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      category,
      subCategory,
      description,
      imageUrl,
      stock: stock !== undefined ? Number(stock) : 0,
      unit,
      tags: tagsArray,
      isActive: isActive !== undefined ? isActive === true || isActive === "true" : true,
    });

    return res
      .status(201)
      .json({ success: true, message: "Tạo sản phẩm thành công", data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/products/:id  (admin)
 */
exports.update = async (req, res, next) => {
  try {
    const {
      name,
      price,
      originalPrice,
      category,
      subCategory,
      description,
      imageUrl: imageUrlFromBody,
      stock,
      unit,
      tags,
      isActive,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) updates.price = Number(price);
    if (originalPrice !== undefined)
      updates.originalPrice = Number(originalPrice);
    if (category !== undefined) updates.category = category;
    if (subCategory !== undefined) updates.subCategory = subCategory;
    if (description !== undefined) updates.description = description;
    if (stock !== undefined) updates.stock = Number(stock);
    if (unit !== undefined) updates.unit = unit;
    if (isActive !== undefined) updates.isActive = isActive === true || isActive === "true";
    if (imageUrlFromBody !== undefined) updates.imageUrl = imageUrlFromBody;

    if (tags !== undefined) {
      updates.tags =
        typeof tags === "string"
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : Array.isArray(tags)
            ? tags
            : [];
    }

    if (req.file) {
      updates.imageUrl = `/uploads/products/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    return res.json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id  (admin) — soft delete
 */
exports.remove = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    return res.json({ success: true, message: "Đã ẩn sản phẩm thành công" });
  } catch (err) {
    next(err);
  }
};
