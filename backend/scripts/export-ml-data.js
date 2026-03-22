"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");
const User = require("../models/User.model");

const OUTPUT_DIR =
  process.env.ML_BACKOFFICE_DATA_DIR ||
  path.resolve(__dirname, "../../../backoffice/data");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function normalizeProductId(product) {
  return String(product.externalId || product._id);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [products, users, orders] = await Promise.all([
    Product.find({ isActive: true })
      .sort({ createdAt: 1 })
      .select(
        "_id externalId name price category subCategory imageUrl stock isActive",
      )
      .lean(),
    User.find({ role: "user", isActive: true })
      .sort({ createdAt: 1 })
      .select("_id name email phone createdAt")
      .lean(),
    Order.find({})
      .sort({ createdAt: 1 })
      .select(
        "_id userId items delivery payment status createdAt updatedAt totalAmount subtotal shippingFee discount",
      )
      .lean(),
  ]);

  const productIds = products.map((product) => product._id);
  const soldCountMap = await buildSoldCountMap(productIds);

  const productIdMap = new Map(
    products.map((product) => [String(product._id), normalizeProductId(product)]),
  );
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const exportedProducts = products.map((product) => ({
    id: normalizeProductId(product),
    mongoId: String(product._id),
    name: product.name,
    price: Number(product.price || 0),
    image: product.imageUrl || "",
    category: String(product.category || "other").toLowerCase(),
    subcategory: String(product.subCategory || "all").toLowerCase(),
    stock: Number(product.stock || 0),
    popular: Number(soldCountMap.get(String(product._id)) || 0),
  }));

  const exportedUsers = users.map((user) => ({
    id: String(user._id),
    name: user.name || "",
    email: (user.email || "").toLowerCase(),
    phone: user.phone || "",
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
  }));

  const exportedOrders = orders
    .map((order) => {
      const user = userMap.get(String(order.userId));
      const items = (order.items || [])
        .map((item) => {
          const productId = productIdMap.get(String(item.productId));
          if (!productId) return null;
          return {
            productId,
            quantity: Number(item.quantity || 1),
            price: Number(item.price || 0),
            subtotal: Number(item.subtotal || 0),
            productName: item.productName || "",
          };
        })
        .filter(Boolean);

      if (!items.length) {
        return null;
      }

      return {
        id: String(order._id),
        userId: String(order.userId),
        email: user?.email || "",
        customerName: order.delivery?.name || user?.name || "",
        phone: order.delivery?.phone || user?.phone || "",
        status: String(order.status || "pending").toLowerCase(),
        payment_status: String(order.payment?.status || "pending").toLowerCase(),
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
        updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shippingFee || 0),
        discount: Number(order.discount || 0),
        totalAmount: Number(order.totalAmount || 0),
        items,
      };
    })
    .filter(Boolean);

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "products.json"),
    JSON.stringify(exportedProducts, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "users.json"),
    JSON.stringify(exportedUsers, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "orders.json"),
    JSON.stringify(exportedOrders, null, 2),
    "utf8",
  );

  console.log(
    `[export-ml-data] Exported ${exportedProducts.length} products, ${exportedUsers.length} users, ${exportedOrders.length} orders -> ${OUTPUT_DIR}`,
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[export-ml-data] Failed:", err.message);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
