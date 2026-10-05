"use strict";

// Does not load .env files. Connection and role are injected by the operator.
const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Shipment = require("../models/Shipment.model");
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be injected by the operator");
  if (process.argv.includes("--staging-only") && (process.env.APP_ENV !== "staging" ||
      !/^[a-zA-Z0-9_-]+_staging$/.test(new URL(process.env.MONGO_URI).pathname.slice(1)))) {
    throw new Error("Staging index repair requires APP_ENV=staging and an explicit *_staging database.");
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const duplicates = await Order.aggregate([
      { $match: { "payment.transactionId": { $type: "string", $gt: "" } } },
      { $group: { _id: { gateway: "$payment.gateway", transactionId: "$payment.transactionId" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $count: "groups" },
    ]);
    const count = duplicates[0]?.groups || 0;
    console.log(JSON.stringify({ duplicatePaymentGroups: count, mode: process.argv.includes("--apply") ? "apply" : "read-only" }));
    if (count) throw new Error("Reconcile duplicate payment references before creating indexes");
    if (process.argv.includes("--apply")) {
      if (process.env.ALLOW_INDEX_CHANGES !== "true") throw new Error("Explicit operator approval ALLOW_INDEX_CHANGES=true is required");
      // Creates declared indexes. Never drops existing indexes or changes business documents.
      await Order.createIndexes();
      await Shipment.createIndexes();
      console.log("Declared order/shipment indexes created.");
    } else {
      for (const model of [Order, Shipment]) {
        const indexes = await model.collection.indexes();
        console.log(JSON.stringify({ collection: model.collection.name, indexes: indexes.map(({ name, unique }) => ({ name, unique: !!unique })) }));
      }
    }
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error("Index check failed. Inspect duplicate counts and index definitions in a secure operator session."); process.exitCode = 1; });
