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
        enum: ["pending", "paid", "refunded"],
        default: "pending",
      },
      gateway: { type: String, default: "" },
      transactionId: { type: String, default: "" },
      transactionTime: { type: Date },
      amount: { type: Number, default: 0, min: 0 },
      gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    voucherCode: { type: String, default: "" },
    shippingFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled",
        "return_requested",
        "return_approved",
        "return_rejected",
        "returned",
        "refunded",
      ],
      default: "pending",
    },
    deliveredAt: { type: Date, default: null },
    returnRequest: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected", "refunded"],
        default: "none",
      },
      stockRestocked: { type: Boolean, default: false },
      requestedAt: { type: Date, default: null },
      reason: { type: String, default: "" },
      images: { type: [String], default: [] },
      note: { type: String, default: "" },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewNote: { type: String, default: "" },
    },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
