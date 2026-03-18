"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { spawnSync } = require("child_process");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Order = require("../models/Order.model");
const fetch = global.fetch || require("node-fetch");

const TEST_USER_EMAIL = "user.test@vuavuive.vn";
const TEST_USER_NAME = "User Test";
const TEST_USER_PHONE = "0912345678";

const BACKEND_API =
  process.env.BACKEND_API || `http://localhost:${process.env.PORT || 3000}`;
const RECOMMENDER_API = process.env.RECOMMENDER_API || "http://localhost:5001";

function runNodeScript(relativeScriptPath, label) {
  process.stdout.write(`\n[STEP] ${label}\n`);
  const result = spawnSync(process.execPath, [relativeScriptPath], {
    cwd: require("path").join(__dirname, ".."),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  process.stdout.write("[INFO] Recommender smoke test started\n");
  process.stdout.write(`[INFO] Backend API: ${BACKEND_API}\n`);
  process.stdout.write(`[INFO] ML API: ${RECOMMENDER_API}\n`);

  runNodeScript(
    "scripts/create-test-user.js",
    "Create deterministic test user",
  );
  runNodeScript("scripts/seed-orders.js", "Seed order history");

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: TEST_USER_EMAIL }).lean();
  if (!user) {
    throw new Error(`Test user not found: ${TEST_USER_EMAIL}`);
  }

  const orderCount = await Order.countDocuments({ userId: user._id });
  if (orderCount < 1) {
    throw new Error(
      `Expected at least 1 order for test user, got ${orderCount}`,
    );
  }

  await mongoose.disconnect();

  process.stdout.write(`\n[CHECK] Test user id: ${String(user._id)}\n`);
  process.stdout.write(`[CHECK] Test user orders: ${orderCount}\n`);

  const mlHealth = await fetchJson(`${RECOMMENDER_API}/health`);
  if (mlHealth?.status !== "ok") {
    throw new Error(`ML health is not ok: ${JSON.stringify(mlHealth)}`);
  }
  process.stdout.write("[CHECK] ML health: ok\n");

  const backendHealth = await fetchJson(`${BACKEND_API}/api/health`);
  if (backendHealth?.status !== "ok") {
    throw new Error(
      `Backend health is not ok: ${JSON.stringify(backendHealth)}`,
    );
  }
  process.stdout.write("[CHECK] Backend health: ok\n");

  const recommendPayload = {
    user_id: String(user._id),
    user_email: TEST_USER_EMAIL,
    user_name: TEST_USER_NAME,
    user_phone: TEST_USER_PHONE,
    n: 5,
    filter_purchased: true,
  };

  const recommendResponse = await fetchJson(`${BACKEND_API}/api/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(recommendPayload),
  });

  if (!recommendResponse?.success) {
    throw new Error(
      `Recommend API failed: ${JSON.stringify(recommendResponse)}`,
    );
  }

  const method = recommendResponse?.data?.method;
  const recommendations = recommendResponse?.data?.recommendations || [];

  if (method === "local_fallback") {
    throw new Error(
      "Recommend API returned local_fallback instead of ML method",
    );
  }

  if (!Array.isArray(recommendations) || recommendations.length < 1) {
    throw new Error("Recommend API returned empty recommendations");
  }

  process.stdout.write(`[CHECK] Recommend method: ${method}\n`);
  process.stdout.write(`[CHECK] Recommend items: ${recommendations.length}\n`);

  const seedProductId = recommendations[0]?.product_id;
  if (!seedProductId) {
    throw new Error(
      "No product_id found in first recommendation for similar test",
    );
  }

  const similarResponse = await fetchJson(
    `${BACKEND_API}/api/recommend/similar-ml`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ product_id: seedProductId, n: 4 }),
    },
  );

  if (!similarResponse?.success) {
    throw new Error(`Similar API failed: ${JSON.stringify(similarResponse)}`);
  }

  const similarMethod = similarResponse?.data?.method;
  const similarItems = similarResponse?.data?.similar_items || [];

  if (similarMethod === "local_fallback") {
    throw new Error("Similar API returned local_fallback instead of ML method");
  }

  if (!Array.isArray(similarItems) || similarItems.length < 1) {
    throw new Error("Similar API returned empty similar_items");
  }

  process.stdout.write(`[CHECK] Similar method: ${similarMethod}\n`);
  process.stdout.write(`[CHECK] Similar items: ${similarItems.length}\n`);

  process.stdout.write(
    "\n[PASS] Recommender smoke test completed successfully\n",
  );
}

main()
  .then(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exitCode = 0;
  })
  .catch(async (err) => {
    process.stderr.write(`\n[FAIL] ${err.message}\n`);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exitCode = 1;
  });
