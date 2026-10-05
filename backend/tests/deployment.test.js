"use strict";
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { uploadDirectory } = require("../config/uploads");
const { proxyTrust } = require("../config/proxy");
const keys = ["NODE_ENV", "APP_ENV", "UPLOAD_STORAGE_MODE", "UPLOAD_DIR", "MONGO_URI"];

test("Flash Sale fixtures refuse production and preserve existing staging products on rerun", async () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "../scripts/seed-staging-flash-sale.js"), "utf8");
  const documents = new Map();
  const db = { connect: jest.fn(), disconnect: jest.fn() };
  const product = { updateOne: jest.fn(async (filter, update, options) => {
    expect(options).toEqual({ upsert: true, runValidators: true });
    expect(Object.keys(update)).toEqual(["$setOnInsert"]);
    const exists = documents.has(filter._id);
    if (!exists) documents.set(filter._id, { ...update.$setOnInsert });
    return { upsertedCount: exists ? 0 : 1 };
  }) };
  async function run(environment, database, approval) {
    const context = {
      URL, process: { env: { APP_ENV: environment, MONGO_URI: `mongodb://127.0.0.1:27019/${database}`,
        SEED_STAGING_FLASH_SALE: approval } },
      console: { log: jest.fn(), error: jest.fn() },
      require: name => name === "mongoose" ? db : product,
    };
    await require("vm").runInNewContext(source, context);
    return context;
  }
  for (const [environment, database, approval] of [
    ["production", "shop_staging", "true"], ["staging", "shop", "true"], ["staging", "shop_staging", "false"],
  ]) {
    expect((await run(environment, database, approval)).process.exitCode).toBe(1);
    expect(db.connect).not.toHaveBeenCalled();
    expect(product.updateOne).not.toHaveBeenCalled();
  }
  expect((await run("staging", "shop_staging", "true")).process.exitCode).toBeUndefined();
  expect(documents.size).toBe(3);
  for (const fixture of documents.values()) {
    expect(fixture.originalPrice).toBeGreaterThan(fixture.price);
    expect(fixture.stock).toBeGreaterThan(0);
  }
  documents.values().next().value.price = 11000;
  await run("staging", "shop_staging", "true");
  expect(documents.size).toBe(3);
  expect(documents.values().next().value.price).toBe(11000);
  expect(db.disconnect).toHaveBeenCalledTimes(2);
});
let previous;
beforeEach(() => { previous = Object.fromEntries(keys.map(key => [key, process.env[key]])); });
afterEach(() => {
  jest.restoreAllMocks();
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});
test("Render free staging explicitly opts into temporary absolute upload storage", () => {
  Object.assign(process.env, { NODE_ENV: "production", APP_ENV: "staging", UPLOAD_STORAGE_MODE: "ephemeral", UPLOAD_DIR: "/tmp/qa-staging-uploads" });
  expect(uploadDirectory()).toBe(require("path").resolve("/tmp/qa-staging-uploads"));
  process.env.APP_ENV = "production";
  expect(() => uploadDirectory()).toThrow(/only.*staging/);
});
test("staging still refuses an absent upload directory", () => {
  Object.assign(process.env, { NODE_ENV: "production", APP_ENV: "staging", UPLOAD_STORAGE_MODE: "ephemeral" });
  delete process.env.UPLOAD_DIR;
  expect(() => uploadDirectory()).toThrow(/absolute/);
});
test.each(["mongodb://127.0.0.1:27019/shop", "mongodb://127.0.0.1:27019/"])("staging rejects a non-staging database before connecting", async uri => {
  Object.assign(process.env, { APP_ENV: "staging", MONGO_URI: uri });
  const connect = jest.spyOn(mongoose, "connect");
  await expect(connectDB(0)).rejects.toThrow(/staging database/);
  expect(connect).not.toHaveBeenCalled();
});
test("staging preserves the explicitly selected isolated database", async () => {
  Object.assign(process.env, { APP_ENV: "staging", NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:27019/shop_staging" });
  const connect = jest.spyOn(mongoose, "connect").mockResolvedValue({ connection: { host: "qa-loopback" } });
  await connectDB(0);
  expect(connect).toHaveBeenCalledWith(process.env.MONGO_URI, expect.objectContaining({ autoIndex: false }));
});
test("Render proxy hop count is a number so secure cookies work behind the proxy", () => {
  expect(proxyTrust("1", true)).toBe(1);
  expect(proxyTrust("true", true)).toBe(1);
  expect(proxyTrust("false", true)).toBe(false);
  expect(proxyTrust(undefined, true)).toBe(1);
});

test.each([26, undefined])("startup logs identify index failures without exposing database errors (code %s)", async code => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "../server.js"), "utf8");
  const log = jest.fn();
  const context = {
    process: { env: { NODE_ENV: "production" } },
    app: { listen: jest.fn() }, PORT: 10000, configErrors: [], startupErrors: [], log,
    connectDB: async () => {},
    mongoose: { connection: { db: { admin: () => ({ command: async () => ({ setName: "qa" }) }) } } },
    require: name => name === "./config/origins" ? { configuredOrigins: () => [] } : {
      collection: { indexes: async () => {
        if (code) throw Object.assign(new Error("private database details"), { code });
        return [];
      } },
    },
  };
  await require("vm").runInNewContext(source.slice(source.indexOf("async function startServer()"), source.indexOf("async function shutdown()")) + "\nstartServer()", context);
  expect(log).toHaveBeenCalledWith("error", "server.startup_failed", { stage: "database.indexes", code: code ?? null });
  if (!code) expect(log).toHaveBeenCalledWith("error", "database.indexes_missing", {
    indexes: ["userId_1_idempotencyKey_1", "payment.gateway_1_payment.transactionId_1"],
    environment: "production", stagingDatabase: false,
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain("private database details");
  expect(context.startupReady).not.toBe(true);
});

test.each([
  ["staging", "shop_staging", "true", 0, true],
  ["production", "shop_staging", "true", 0, false],
  ["staging", "shop", "true", 0, false],
  ["staging", "shop_staging", "false", 0, false],
  ["staging", "shop_staging", "true", 1, false],
])("operator index repair guards environment=%s database=%s approval=%s duplicates=%s", async (environment, database, approval, duplicates, allowed) => {
  const db = { connect: jest.fn(), disconnect: jest.fn() };
  const order = {
    aggregate: jest.fn().mockResolvedValue(duplicates ? [{ groups: duplicates }] : []),
    createIndexes: jest.fn(),
  };
  const shipment = { createIndexes: jest.fn() };
  const context = {
    URL, process: { argv: ["node", "check-production-indexes.js", "--apply", "--staging-only"],
      env: { APP_ENV: environment, MONGO_URI: `mongodb://127.0.0.1:27019/${database}`, ALLOW_INDEX_CHANGES: approval } },
    console: { log: jest.fn(), error: jest.fn() },
    require: name => name === "mongoose" ? db : name.includes("Order.model") ? order : shipment,
  };
  const source = require("fs").readFileSync(require("path").join(__dirname, "../scripts/check-production-indexes.js"), "utf8");
  await require("vm").runInNewContext(source, context);
  expect(order.createIndexes).toHaveBeenCalledTimes(allowed ? 1 : 0);
  expect(shipment.createIndexes).toHaveBeenCalledTimes(allowed ? 1 : 0);
  expect(context.process.exitCode).toBe(allowed ? undefined : 1);
  if (environment !== "staging" || !database.endsWith("_staging")) expect(db.connect).not.toHaveBeenCalled();
});
