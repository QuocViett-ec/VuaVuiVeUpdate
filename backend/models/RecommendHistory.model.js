"use strict";

const mongoose = require("mongoose");

const recommendationItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    score: { type: Number, default: 0 },
    reason: { type: String, default: "" },
  },
  { _id: false },
);

const recommendHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recommendations: { type: [recommendationItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RecommendHistory", recommendHistorySchema);
