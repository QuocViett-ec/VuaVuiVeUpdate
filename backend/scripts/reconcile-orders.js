"use strict";

// Read-only summary; no customer fields, payment references or credentials in output.
const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Shipment = require("../models/Shipment.model");
const Product = require("../models/Product.model");
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be injected");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const counts = await Order.aggregate([{ $group: { _id: { status: "$status", method: "$payment.method", payment: "$payment.status" }, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }]);
    const unpaidDeliveredCod = await Order.countDocuments({ status: "delivered", "payment.method": "cod", "payment.status": "pending" });
    const paidCancelled = await Order.countDocuments({ status: "cancelled", "payment.status": "paid" });
    const overdueOnline = await Order.countDocuments({ status: "pending", "payment.method": { $in: ["momo", "vnpay"] }, "payment.status": "pending", paymentExpiresAt: { $lte: new Date() } });
    const pendingOnlineWithoutExpiry = await Order.countDocuments({ status: "pending", "payment.method": { $in: ["momo", "vnpay"] }, "payment.status": "pending", paymentExpiresAt: null });
    const invalidMoney = await Order.aggregate([
      { $match: { $expr: { $ne: ["$totalAmount", { $subtract: [{ $add: [{ $sum: "$items.subtotal" }, "$shippingFee"] }, "$discount"] }] } } },
      { $count: "count" },
    ]);
    const orphanOrders = await Order.aggregate([
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "owner" } },
      { $match: { owner: { $size: 0 } } }, { $count: "count" },
    ]);
    const orphanShipments = await Shipment.aggregate([
      { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
      { $match: { order: { $size: 0 } } }, { $count: "count" },
    ]);
    const negativeStock = await Product.countDocuments({ stock: { $lt: 0 } });
    console.log(JSON.stringify({ counts, unpaidDeliveredCod, paidCancelled, overdueOnline, pendingOnlineWithoutExpiry,
      invalidMoney: invalidMoney[0]?.count || 0, orphanOrders: orphanOrders[0]?.count || 0,
      orphanShipments: orphanShipments[0]?.count || 0, negativeStock }));
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error("Reconciliation failed; check connectivity in a secure operator session."); process.exitCode = 1; });
