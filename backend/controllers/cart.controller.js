"use strict";

const mongoose = require("mongoose");
const Cart = require("../models/Cart.model");
const Product = require("../models/Product.model");

function normalizeIncomingItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const map = new Map();

  for (const row of rawItems) {
    const rawId =
      row?.productId || row?.id || row?.product?._id || row?.product?.id;
    const productId = String(rawId || "").trim();
    const quantity = Math.max(0, Number.parseInt(row?.quantity, 10) || 0);

    if (
      !productId ||
      !mongoose.Types.ObjectId.isValid(productId) ||
      quantity <= 0
    ) {
      continue;
    }

    map.set(productId, (map.get(productId) || 0) + quantity);
  }

  return [...map.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

async function sanitizeItemsWithStock(items) {
  if (!items.length) return [];
  const ids = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: ids }, isActive: true })
    .select("_id stock")
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return items
    .map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) return null;
      const stock = Math.max(0, Number(product.stock || 0));
      const quantity = Math.min(stock, Math.max(0, Number(item.quantity || 0)));
      if (quantity <= 0) return null;
      return {
        productId: new mongoose.Types.ObjectId(String(item.productId)),
        quantity,
      };
    })
    .filter(Boolean);
}

function mapCartItemForClient(row) {
  const product = row?.productId;
  if (!product) return null;

  const productId = String(product?._id || row?.productId || "");
  if (!productId) return null;

  return {
    productId,
    quantity: Math.max(1, Number(row?.quantity || 1)),
    product: {
      id: productId,
      name: String(product?.name || "Sản phẩm"),
      price: Number(product?.price || 0),
      stock: Number(product?.stock || 0),
      cat: String(product?.category || "other"),
      sub: String(product?.subCategory || "all"),
      img: String(product?.imageUrl || ""),
    },
  };
}

async function loadCartWithProducts(userId) {
  const cart = await Cart.findOne({ userId })
    .populate(
      "items.productId",
      "name price stock imageUrl category subCategory",
    )
    .populate(
      "savedForLater.productId",
      "name price stock imageUrl category subCategory",
    )
    .lean();

  if (!cart) {
    return {
      items: [],
      savedForLater: [],
      updatedAt: null,
    };
  }

  return {
    items: (cart.items || []).map(mapCartItemForClient).filter(Boolean),
    savedForLater: (cart.savedForLater || [])
      .map(mapCartItemForClient)
      .filter(Boolean),
    updatedAt: cart.updatedAt || null,
  };
}

exports.getMyCart = async (req, res, next) => {
  try {
    const data = await loadCartWithProducts(req.session.userId);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.syncMyCart = async (req, res, next) => {
  try {
    const items = normalizeIncomingItems(req.body?.items || []);
    const savedForLater = normalizeIncomingItems(req.body?.savedForLater || []);

    const [safeItems, safeSaved] = await Promise.all([
      sanitizeItemsWithStock(items),
      sanitizeItemsWithStock(savedForLater),
    ]);

    await Cart.findOneAndUpdate(
      { userId: req.session.userId },
      {
        $set: {
          userId: req.session.userId,
          items: safeItems,
          savedForLater: safeSaved,
        },
      },
      { upsert: true, new: true },
    );

    const data = await loadCartWithProducts(req.session.userId);
    return res.json({
      success: true,
      data,
      message: "Đồng bộ giỏ hàng thành công",
    });
  } catch (err) {
    next(err);
  }
};

exports.mergeMyCart = async (req, res, next) => {
  try {
    const incomingItems = normalizeIncomingItems(req.body?.items || []);
    const incomingSaved = normalizeIncomingItems(req.body?.savedForLater || []);

    const existing = await Cart.findOne({ userId: req.session.userId }).lean();

    const mergeList = (a, b) => {
      const map = new Map();
      [...(a || []), ...(b || [])].forEach((row) => {
        const id = String(row.productId || "");
        const qty = Math.max(0, Number(row.quantity || 0));
        if (!id || qty <= 0) return;
        map.set(id, Math.max(map.get(id) || 0, qty));
      });
      return [...map.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    };

    const mergedItems = mergeList(existing?.items || [], incomingItems);
    const mergedSaved = mergeList(existing?.savedForLater || [], incomingSaved);

    const [safeItems, safeSaved] = await Promise.all([
      sanitizeItemsWithStock(mergedItems),
      sanitizeItemsWithStock(mergedSaved),
    ]);

    await Cart.findOneAndUpdate(
      { userId: req.session.userId },
      {
        $set: {
          userId: req.session.userId,
          items: safeItems,
          savedForLater: safeSaved,
        },
      },
      { upsert: true, new: true },
    );

    const data = await loadCartWithProducts(req.session.userId);
    return res.json({
      success: true,
      data,
      message: "Merge giỏ hàng thành công",
    });
  } catch (err) {
    next(err);
  }
};

exports.clearMyCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.session.userId },
      {
        $set: {
          items: [],
          savedForLater: [],
        },
      },
      { upsert: true },
    );

    return res.json({ success: true, message: "Đã xóa giỏ hàng" });
  } catch (err) {
    next(err);
  }
};
