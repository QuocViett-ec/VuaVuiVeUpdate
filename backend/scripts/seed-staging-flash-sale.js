"use strict";

// Operator-injected configuration only; never loads .env or production data.
const mongoose = require("mongoose");
const Product = require("../models/Product.model");

async function main() {
  const seedCatalog = process.env.SEED_STAGING_CATALOG === "true";
  if ((!seedCatalog && process.env.SEED_STAGING_FLASH_SALE !== "true") || process.env.APP_ENV !== "staging" ||
      !/^[a-zA-Z0-9_-]+_staging$/.test(new URL(process.env.MONGO_URI).pathname.slice(1))) {
    throw new Error("Flash Sale fixtures require explicit staging approval and a *_staging database.");
  }
  const fixtures = [
    { _id: "f1a500000000000000000001", name: "[Staging] Rau muống", slug: "staging-flash-rau-muong",
      price: 12000, originalPrice: 20000, subCategory: "leafy", imageUrl: "/images/VEG/leaf/raumuong.jpg" },
    { _id: "f1a500000000000000000002", name: "[Staging] Nấm kim châm", slug: "staging-flash-nam-kim-cham",
      price: 15000, originalPrice: 25000, subCategory: "all", imageUrl: "/images/VEG/mushroom/namkimcham.jpg" },
    { _id: "f1a500000000000000000003", name: "[Staging] Cải bẹ xanh", slug: "staging-flash-cai-be-xanh",
      price: 18000, originalPrice: 24000, subCategory: "leafy", imageUrl: "/images/VEG/cabbage/caibexanh.jpg" },
  ];
  if (seedCatalog) {
    for (const { _id, ...product } of require("./product-fixtures")) {
      fixtures.push({ ...product, _id: "ca7a10" + _id.padStart(18, "0"),
        externalId: _id, slug: `staging-catalog-${_id}`, imageUrl: "/" + product.imageUrl });
    }
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    let inserted = 0;
    for (const fixture of fixtures) {
      const result = await Product.updateOne({ _id: fixture._id }, { $setOnInsert: {
        category: "veg", stock: 50, unit: "bó/gói", isActive: true,
        description: "Sản phẩm mẫu dùng kiểm thử Flash Sale trên staging.", tags: ["staging", "flash-sale"],
        ...fixture,
      } }, { upsert: true, runValidators: true });
      inserted += result.upsertedCount || 0;
    }
    console.log(JSON.stringify({ event: "staging.products_seeded", inserted, fixtures: fixtures.length }));
  } finally { await mongoose.disconnect(); }
}

main().catch(() => {
  console.error("Staging Flash Sale seed failed; database details omitted.");
  process.exitCode = 1;
});
