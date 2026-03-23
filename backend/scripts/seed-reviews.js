"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");
const User = require("../models/User.model");
const Review = require("../models/Review.model");

const REVIEWS_MIN = 4;
const REVIEWS_MAX = 5;

const COMMENT_TEMPLATES = [
  "San pham dung mo ta, dong goi gon gang.",
  "Chat luong tot, se mua lai lan sau.",
  "Giao hang nhanh, hang toi con tuoi ngon.",
  "Gia hop ly so voi chat luong nhan duoc.",
  "Gia dinh minh dung thay on va tien loi.",
  "Shop chuan bi don nhanh, du hang.",
  "Mui vi on dinh, dung nhu mong doi.",
  "Cam on shop, trai nghiem mua hang rat tot.",
];

function makeSeedFromText(text) {
  return String(text || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function ratingFor(productId, index) {
  const seed = makeSeedFromText(productId);
  const pattern = [5, 4, 5, 4, 5, 4, 3];
  return pattern[(seed + index) % pattern.length];
}

function commentFor(productName, productId, index) {
  const seed = makeSeedFromText(productId + String(index));
  const base = COMMENT_TEMPLATES[seed % COMMENT_TEMPLATES.length];
  return `${base} (${productName})`;
}

function targetReviewsForProduct(productId) {
  const seed = makeSeedFromText(productId);
  const span = REVIEWS_MAX - REVIEWS_MIN + 1;
  return REVIEWS_MIN + (seed % span);
}

function pickFallbackKey(
  seed,
  usedOrderKeys,
  usedUserKeys,
  users,
  deliveredOrders,
) {
  if (!users.length || !deliveredOrders.length) return null;

  for (let i = 0; i < users.length * 2; i += 1) {
    const user = users[(seed + i) % users.length];
    const order = deliveredOrders[(seed * 3 + i) % deliveredOrders.length];
    const userKey = String(user._id);
    const orderKey = `${userKey}::${String(order._id)}`;
    if (!usedOrderKeys.has(orderKey) && !usedUserKeys.has(userKey)) {
      usedOrderKeys.add(orderKey);
      usedUserKeys.add(userKey);
      return {
        userId: user._id,
        orderId: order._id,
        orderCode: String(order.orderId || order._id),
      };
    }
  }

  return null;
}

async function seedReviews() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const [products, deliveredOrders, users] = await Promise.all([
      Product.find({ isActive: true }).sort({ createdAt: 1 }).lean(),
      Order.find({ status: "delivered" })
        .select("_id orderId userId items")
        .sort({ createdAt: 1 })
        .lean(),
      User.find({ role: "user", isActive: true }).select("_id").lean(),
    ]);

    if (!products.length) {
      throw new Error("Khong tim thay san pham de seed review");
    }

    if (!deliveredOrders.length) {
      throw new Error("Khong co don delivered de tao review");
    }

    const candidatesByProduct = new Map();

    for (const order of deliveredOrders) {
      const orderUserId = String(order.userId || "");
      if (!orderUserId) continue;

      for (const item of order.items || []) {
        const productId = String(item?.productId || "");
        if (!productId) continue;

        const key = `${orderUserId}::${String(order._id)}`;
        if (!candidatesByProduct.has(productId)) {
          candidatesByProduct.set(productId, new Map());
        }

        const byPair = candidatesByProduct.get(productId);
        if (!byPair.has(key)) {
          byPair.set(key, {
            userId: order.userId,
            orderId: order._id,
            orderCode: String(order.orderId || order._id),
            productImage: String(
              item?.productImage || item?.imageUrl || item?.image || "",
            ),
            productName: String(item?.productName || ""),
          });
        }
      }
    }

    await Review.deleteMany({});

    const docs = [];
    let fallbackCount = 0;

    for (const product of products) {
      const productId = String(product._id);
      const targetReviewCount = targetReviewsForProduct(productId);
      const productName = String(product.name || "San pham");
      const productImage = String(product.imageUrl || "");
      const byPair = candidatesByProduct.get(productId) || new Map();
      const uniqueByUser = new Map();
      for (const row of byPair.values()) {
        const userKey = String(row.userId);
        if (!uniqueByUser.has(userKey)) uniqueByUser.set(userKey, row);
      }

      const picked = [...uniqueByUser.values()].slice(0, targetReviewCount);
      const usedOrderKeys = new Set(
        picked.map((row) => `${String(row.userId)}::${String(row.orderId)}`),
      );
      const usedUserKeys = new Set(picked.map((row) => String(row.userId)));

      while (picked.length < targetReviewCount) {
        const seed = makeSeedFromText(productId) + picked.length;
        const fallback = pickFallbackKey(
          seed,
          usedOrderKeys,
          usedUserKeys,
          users,
          deliveredOrders,
        );
        if (!fallback) break;
        picked.push({
          ...fallback,
          productName,
          productImage,
        });
        fallbackCount += 1;
      }

      for (let i = 0; i < picked.length; i += 1) {
        const row = picked[i];
        docs.push({
          userId: row.userId,
          orderId: row.orderId,
          orderCode: row.orderCode,
          productId: product._id,
          productName: row.productName || productName,
          productImage: row.productImage || productImage,
          rating: ratingFor(productId, i),
          comment: commentFor(productName, productId, i),
        });
      }
    }

    if (!docs.length) {
      throw new Error("Khong tao duoc review nao");
    }

    await Review.insertMany(docs, { ordered: false });

    const reviewCount = await Review.countDocuments({});
    const distinctProducts = await Review.distinct("productId");

    console.log(`Seed reviews thanh cong: ${reviewCount} reviews`);
    console.log(
      `San pham co review: ${distinctProducts.length}/${products.length}`,
    );
    console.log(`Fallback reviews da dung: ${fallbackCount}`);
  } catch (err) {
    console.error("Seed reviews that bai:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedReviews();
