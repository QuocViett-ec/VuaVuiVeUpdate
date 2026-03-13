"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      default: () =>
        "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: { type: [orderItemSchema], required: true },
    delivery: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      slot: { type: String, default: "" },
    },
    payment: {
      method: {
        type: String,
        enum: ["cod", "vnpay", "momo"],
        default: "cod",
      },
      status: {
        type: String,
        enum: ["pending", "paid"],
        default: "pending",
      },
    },
    voucherCode: { type: String, default: "" },
    shippingFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
      default: "pending",
    },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
