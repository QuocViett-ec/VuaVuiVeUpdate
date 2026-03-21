"use strict";

const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["ship", "percent", "fixed"],
      required: true,
      default: "percent",
    },
    value: { type: Number, required: true, min: 0 },
    cap: { type: Number, default: 0, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Voucher", voucherSchema);
