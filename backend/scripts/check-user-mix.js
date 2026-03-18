"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: "user.test@vuavuive.vn" }).lean();
  if (!user) {
    console.log("USER_NOT_FOUND");
    await mongoose.disconnect();
    return;
  }

  const orders = await Order.find({
    userId: user._id,
    status: { $ne: "cancelled" },
  }).lean();
  const products = await Product.find({}, "_id category name").lean();
  const pMap = new Map(products.map((p) => [String(p._id), p]));

  const cat = {};
  const top = {};

  for (const order of orders) {
    for (const item of order.items || []) {
      const p = pMap.get(String(item.productId));
      if (!p) continue;
      const qty = Number(item.quantity || 1);
      cat[p.category] = (cat[p.category] || 0) + qty;
      top[p.name] = (top[p.name] || 0) + qty;
    }
  }

  const categories = Object.entries(cat).sort((a, b) => b[1] - a[1]);
  const topProducts = Object.entries(top)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log(
    JSON.stringify(
      {
        email: user.email,
        orders: orders.length,
        categories,
        topProducts,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
