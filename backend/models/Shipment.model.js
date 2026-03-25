"use strict";

const mongoose = require("mongoose");

const SHIPMENT_STATUSES = [
  "pending",
  "picked",
  "packed",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

const shipmentStatusEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      required: true,
    },
    at: { type: Date, default: Date.now },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    source: { type: String, default: "system" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    carrier: {
      type: String,
      enum: ["internal", "ghn", "ghtk", "viettel_post", "jnt", "other"],
      default: "internal",
    },
    trackingNumber: { type: String, default: null, trim: true },
    shippingFee: { type: Number, default: 0, min: 0 },
    eta: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    currentStatus: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: "pending",
    },
    deliverySnapshot: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      slot: { type: String, default: "" },
    },
    statusHistory: {
      type: [shipmentStatusEventSchema],
      default: [{ status: "pending", source: "system" }],
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

shipmentSchema.pre("save", function normalizeTracking(next) {
  const normalized = String(this.trackingNumber || "")
    .trim()
    .toUpperCase();
  this.trackingNumber = normalized || null;
  next();
});

shipmentSchema.index({ orderId: 1, createdAt: -1 });
shipmentSchema.index({ customerId: 1, createdAt: -1 });
shipmentSchema.index(
  { carrier: 1, trackingNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      trackingNumber: { $exists: true, $type: "string", $ne: "" },
    },
  },
);
shipmentSchema.index({ currentStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("Shipment", shipmentSchema);
module.exports.SHIPMENT_STATUSES = SHIPMENT_STATUSES;
