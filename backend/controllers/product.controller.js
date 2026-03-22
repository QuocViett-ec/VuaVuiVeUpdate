"use strict";

const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Review = require("../models/Review.model");
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

function attachRatingFallback(product) {
  const id = String(product?._id || product?.id || "");
  return {
    ...product,
    rating: fallbackRatingFromId(id),
    reviewCount: 0,
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

  const stats = await Review.aggregate([
    {
      $match: {
        productId: {
          $in: ids.map((id) => new mongoose.Types.ObjectId(id)),
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
  ]);

  const statByProductId = new Map(
    stats.map((row) => [
      String(row._id),
      {
        rating: Number(Number(row.avgRating || 0).toFixed(1)),
        reviewCount: Number(row.reviewCount || 0),
      },
    ]),
  );

  return list.map((p) => {
    const id = String(p?._id || "");
    const stat = statByProductId.get(id);
    if (stat) {
      return {
        ...p,
        rating: stat.rating,
        reviewCount: stat.reviewCount,
      };
    }

    return attachRatingFallback(p);
  });
}

function buildProductQuery(id) {
  const isObjectId = /^[a-f\d]{24}$/i.test(String(id || ""));
  return isObjectId ? { _id: id, isActive: true } : { slug: id, isActive: true };
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
    const [productWithRating] = await attachRatings([product]);
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

    const averageRating = Number(
      Number(stats[0]?.averageRating || fallbackRatingFromId(product._id)).toFixed(1),
    );
    const reviewCount = Number(stats[0]?.reviewCount || 0);

    const reviews = rows.map((row) => ({
      id: String(row._id),
      userName: String(row?.userId?.name || "Khách hàng"),
      rating: Number(row?.rating || 0),
      comment: String(row?.comment || ""),
      createdAt: row?.createdAt || null,
    }));

    return res.json({
      success: true,
      data: {
        productId: String(product._id),
        productName: String(product.name || ""),
        averageRating,
        reviewCount,
        reviews,
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
