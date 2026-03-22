"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");

const CATEGORIES = [
  "veg",
  "fruit",
  "meat",
  "drink",
  "dry",
  "spice",
  "household",
  "sweet",
  "frozen",
  "other",
];

const productReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    author: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm không được để trống"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Giá sản phẩm không được để trống"],
      min: 0,
    },
    originalPrice: { type: Number, min: 0 },
    category: {
      type: String,
      required: [true, "Danh mục không được để trống"],
      enum: CATEGORIES,
      default: "other",
    },
    subCategory: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    stock: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "kg", trim: true },
    tags: [{ type: String, trim: true }],
    reviews: { type: [productReviewSchema], default: [] },
    isActive: { type: Boolean, default: true },
    externalId: { type: String, default: null, index: true }, // ID gốc từ data cũ (100, 101...)
  },
  { timestamps: true },
);

// Auto-generate slug from name before save
productSchema.pre("save", function (next) {
  if (!this.isModified("name")) return next();
  const base = slugify(this.name);
  // Append a short random hex to avoid collisions without extra DB queries
  const suffix = crypto.randomBytes(3).toString("hex");
  this.slug = `${base}-${suffix}`;
  next();
});

module.exports = mongoose.model("Product", productSchema);
