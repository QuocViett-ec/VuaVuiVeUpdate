"use strict";

const mongoose = require("mongoose");

const VALID_EVENTS = ["view_product", "add_to_cart", "purchase", "view_recipe"];

const userEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: { type: String, required: true },
    eventType: {
      type: String,
      enum: VALID_EVENTS,
      required: true,
    },
    productId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Indexes cho query nhanh theo user và theo product
userEventSchema.index({ userId: 1, createdAt: -1 });
userEventSchema.index({ productId: 1 });
userEventSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model("UserEvent", userEventSchema);
module.exports.VALID_EVENTS = VALID_EVENTS;
