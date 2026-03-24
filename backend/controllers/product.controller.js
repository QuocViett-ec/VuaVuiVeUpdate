"use strict";

const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Review = require("../models/Review.model");
const Order = require("../models/Order.model");
const { publishToCustomers } = require("../services/realtime-bus");
const { createAuditLog } = require("./user.controller");

function fallbackRatingFromId(productId) {
  const raw = String(productId || "");
  if (!raw) return 4.5;

  let sum = 0;
  for (let i = 0; i < raw.length; i += 1) {
    sum += raw.charCodeAt(i);
  }

  const min = 42;
  const max = 49;
  const score = min + (sum % (max - min + 1));
  return Number((score / 10).toFixed(1));
}

function fallbackSoldCountFromId(productId) {
  const raw = String(productId || "");
  if (!raw) return 120;
  let sum = 0;
  for (let i = 0; i < raw.length; i += 1) {
    sum += raw.charCodeAt(i) * (i + 3);
  }
  return 60 + (sum % 420);
}

function fallbackReviewCountFromId(productId) {
  const raw = String(productId || "");
  if (!raw) return 4;
  let sum = 0;
  for (let i = 0; i < raw.length; i += 1) {
    sum += raw.charCodeAt(i);
  }
  return 4 + (sum % 2);
}

function buildMockReviews(product, existingCount = 0) {
  const productId = String(product?._id || "");
  const target = fallbackReviewCountFromId(productId);
  const missing = Math.max(0, target - Number(existingCount || 0));
  if (!missing) return [];

  const comments = [
    "Dong goi gon gang, san pham dung mo ta.",
    "Chat luong on dinh, se tiep tuc ung ho.",
    "Gia hop ly, nhan hang nhanh va de su dung.",
    "Mui vi ok, gia dinh minh danh gia tot.",
    "San pham dung nhu ky vong, nen mua thu.",
  ];

  const names = [
    "Khach hang than thiet",
    "Nguoi mua da xac minh",
    "Thanh vien Vua Vui Ve",
    "Khach hang moi",
    "Khach hang quen",
  ];

  const rows = [];
  for (let i = 0; i < missing; i += 1) {
    const seed = (productId + String(i))
      .split("")
      .reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const rating = 4 + (seed % 2);
    rows.push({
      id: `mock-${productId}-${i}`,
      userName: names[seed % names.length],
      rating,
      comment: `${comments[seed % comments.length]} (${String(product?.name || "San pham")})`,
      createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    });
  }

  return rows;
}

function attachRatingFallback(product) {
  const id = String(product?._id || product?.id || "");
  return {
    ...product,
    rating: fallbackRatingFromId(id),
    reviewCount: fallbackReviewCountFromId(id),
    soldCount: fallbackSoldCountFromId(id),
  };
}

async function attachRatings(products) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return [];

  const ids = list
    .map((p) => String(p?._id || ""))
    .filter(Boolean)
    .map((id) => id);

  if (!ids.length) return list.map((p) => attachRatingFallback(p));

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) {
    return list.map((p) => attachRatingFallback(p));
  }

  let stats = [];
  let sales = [];
  try {
    [stats, sales] = await Promise.all([
      Review.aggregate([
        {
          $match: {
            productId: {
              $in: objectIds,
            },
          },
        },
        {
          $group: {
            _id: "$productId",
            avgRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $in: ["confirmed", "shipping", "delivered"] },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.productId": { $in: objectIds },
          },
        },
        {
          $group: {
            _id: "$items.productId",
            soldCount: { $sum: "$items.quantity" },
          },
        },
      ]),
    ]);
  } catch (err) {
    console.warn("attachRatings fallback due to aggregate error:", err.message);
    return list.map((p) => attachRatingFallback(p));
  }

  const statByProductId = new Map(
    stats.map((row) => [
      String(row._id),
      {
        rating: Number(Number(row.avgRating || 0).toFixed(1)),
        reviewCount: Number(row.reviewCount || 0),
      },
    ]),
  );

  const salesByProductId = new Map(
    sales.map((row) => [String(row._id), Number(row.soldCount || 0)]),
  );

  return list.map((p) => {
    const id = String(p?._id || "");
    const stat = statByProductId.get(id);
    if (stat) {
      return {
        ...p,
        rating: stat.rating,
        reviewCount: stat.reviewCount,
        soldCount: salesByProductId.get(id) || fallbackSoldCountFromId(id),
      };
    }
    return {
      ...attachRatingFallback(p),
      soldCount: salesByProductId.get(id) || fallbackSoldCountFromId(id),
    };
  });
}

function buildProductQuery(id) {
  const isObjectId = /^[a-f\d]{24}$/i.test(String(id || ""));
  return isObjectId
    ? { _id: id, isActive: true }
    : { slug: id, isActive: true };
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

    const productsWithRatings = await attachRatings(products);

    return res.json({
      success: true,
      data: productsWithRatings,
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

    return res.json({
      success: true,
      data: products,
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
    const product = await Product.findOne(buildProductQuery(id)).lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    let productWithRating = attachRatingFallback(product);
    try {
      [productWithRating] = await attachRatings([product]);
    } catch (err) {
      console.warn("getOne rating fallback:", err.message);
    }
    return res.json({ success: true, data: productWithRating });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id/reviews
 */
exports.getReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne(buildProductQuery(id))
      .select("_id name")
      .lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    const [stats, rows] = await Promise.all([
      Review.aggregate([
        { $match: { productId: product._id } },
        {
          $group: {
            _id: "$productId",
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
      Review.find({ productId: product._id })
        .populate({ path: "userId", select: "name" })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
    ]);

    const reviews = rows.map((row) => ({
      id: String(row._id),
      userName: String(row?.userId?.name || "Khách hàng"),
      rating: Number(row?.rating || 0),
      comment: String(row?.comment || ""),
      createdAt: row?.createdAt || null,
    }));

    const reviewsWithFallback = [
      ...reviews,
      ...buildMockReviews(product, reviews.length),
    ];

    const fallbackCount = fallbackReviewCountFromId(product._id);
    const reviewCount = Number(
      stats[0]?.reviewCount || reviewsWithFallback.length || fallbackCount,
    );
    const avgFromReviews =
      reviewsWithFallback.length > 0
        ? reviewsWithFallback.reduce(
            (sum, item) => sum + Number(item.rating || 0),
            0,
          ) / reviewsWithFallback.length
        : fallbackRatingFromId(product._id);
    const averageRating = Number(Number(avgFromReviews).toFixed(1));

    return res.json({
      success: true,
      data: {
        productId: String(product._id),
        productName: String(product.name || ""),
        averageRating,
        reviewCount,
        reviews: reviewsWithFallback,
      },
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
      : imageUrlFromBody || "";

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
      isActive:
        isActive !== undefined
          ? isActive === true || isActive === "true"
          : true,
    });

    publishToCustomers("product.changed", {
      action: "created",
      productId: String(product._id),
      isActive: product.isActive,
      category: product.category,
      updatedAt: product.updatedAt,
      source: "admin",
    });

    await createAuditLog({
      adminId: req.session?.userId,
      action: "CREATE_PRODUCT",
      target: `Product:${product._id}`,
      details: {
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
      },
      ip: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo sản phẩm thành công",
      data: product,
    });
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
    if (isActive !== undefined)
      updates.isActive = isActive === true || isActive === "true";
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

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    publishToCustomers("product.changed", {
      action: "updated",
      productId: String(product._id),
      isActive: product.isActive,
      category: product.category,
      updatedAt: product.updatedAt,
      source: "admin",
    });

    await createAuditLog({
      adminId: req.session?.userId,
      action: "UPDATE_PRODUCT",
      target: `Product:${product._id}`,
      details: {
        updates,
      },
      ip: req.ip,
    });

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

    publishToCustomers("product.changed", {
      action: "removed",
      productId: String(product._id),
      isActive: product.isActive,
      category: product.category,
      updatedAt: product.updatedAt,
      source: "admin",
    });

    await createAuditLog({
      adminId: req.session?.userId,
      action: "DELETE_PRODUCT",
      target: `Product:${product._id}`,
      details: {
        name: product.name,
        category: product.category,
      },
      ip: req.ip,
    });

    return res.json({ success: true, message: "Đã ẩn sản phẩm thành công" });
  } catch (err) {
    next(err);
  }
};
