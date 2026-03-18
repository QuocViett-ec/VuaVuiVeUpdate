"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const UserEvent = require("../models/UserEvent.model");

const SECTIONS = ["personal", "similar", "trending"];
const SEGMENTS = ["new_account", "with_history"];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function dayAtOffset(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [products, users] = await Promise.all([
    Product.find({ isActive: true }).select("_id").lean(),
    User.find({ role: "user", isActive: true }).select("_id createdAt").lean(),
  ]);

  if (!products.length) {
    throw new Error("No active products found. Please run seed first.");
  }

  const ordersByUser = await Order.aggregate([
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  const orderCountMap = new Map(
    ordersByUser.map((x) => [String(x._id), Number(x.count || 0)]),
  );

  const withHistoryUsers = users.filter(
    (u) => (orderCountMap.get(String(u._id)) || 0) > 0,
  );
  const newAccountUsers = users.filter(
    (u) => (orderCountMap.get(String(u._id)) || 0) === 0,
  );

  const pickUserIdBySegment = (segment) => {
    if (segment === "with_history" && withHistoryUsers.length) {
      return String(pickRandom(withHistoryUsers)._id);
    }
    if (segment === "new_account" && newAccountUsers.length) {
      return String(pickRandom(newAccountUsers)._id);
    }
    return null;
  };

  await UserEvent.deleteMany({ "metadata.source": "recommended_page" });

  const events = [];

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = dayAtOffset(dayOffset);

    for (const section of SECTIONS) {
      for (const segment of SEGMENTS) {
        const sectionFactor =
          section === "personal" ? 1.0 : section === "similar" ? 1.2 : 1.35;
        const segmentFactor = segment === "with_history" ? 1.15 : 0.95;

        const baseImpressions = randInt(65, 125);
        const impressions = Math.round(
          baseImpressions * sectionFactor * segmentFactor,
        );

        const clickRate =
          segment === "with_history"
            ? section === "personal"
              ? 0.145
              : section === "similar"
                ? 0.108
                : 0.085
            : section === "personal"
              ? 0.082
              : section === "similar"
                ? 0.062
                : 0.05;

        const addRate =
          segment === "with_history"
            ? section === "personal"
              ? 0.072
              : section === "similar"
                ? 0.05
                : 0.04
            : section === "personal"
              ? 0.032
              : section === "similar"
                ? 0.022
                : 0.018;

        const clicks = Math.max(1, Math.round(impressions * clickRate));
        const adds = Math.max(0, Math.round(impressions * addRate));

        const userId = pickUserIdBySegment(segment);

        for (let i = 0; i < impressions; i++) {
          const createdAt = new Date(day);
          createdAt.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
          events.push({
            userId,
            sessionId: `${segment}-session-${dayOffset}-${i % 18}`,
            eventType: "view_product",
            productId: String(pickRandom(products)._id),
            metadata: {
              source: "recommended_page",
              section,
              action: "impression",
              user_segment: segment,
            },
            createdAt,
            updatedAt: createdAt,
          });
        }

        for (let i = 0; i < clicks; i++) {
          const createdAt = new Date(day);
          createdAt.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
          events.push({
            userId,
            sessionId: `${segment}-session-${dayOffset}-${i % 18}`,
            eventType: "view_product",
            productId: String(pickRandom(products)._id),
            metadata: {
              source: "recommended_page",
              section,
              action: "click",
              user_segment: segment,
            },
            createdAt,
            updatedAt: createdAt,
          });
        }

        for (let i = 0; i < adds; i++) {
          const createdAt = new Date(day);
          createdAt.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
          events.push({
            userId,
            sessionId: `${segment}-session-${dayOffset}-${i % 18}`,
            eventType: "add_to_cart",
            productId: String(pickRandom(products)._id),
            metadata: {
              source: "recommended_page",
              section,
              action: "add_to_cart",
              user_segment: segment,
            },
            createdAt,
            updatedAt: createdAt,
          });
        }
      }
    }
  }

  const chunkSize = 5000;
  for (let i = 0; i < events.length; i += chunkSize) {
    await UserEvent.insertMany(events.slice(i, i + chunkSize), {
      ordered: false,
    });
  }

  console.log(
    `[seed-ml-events] Inserted ${events.length} recommended_page events`,
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[seed-ml-events] Failed:", err.message);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
