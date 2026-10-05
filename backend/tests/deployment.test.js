"use strict";
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { uploadDirectory } = require("../config/uploads");
const { proxyTrust } = require("../config/proxy");
const keys = ["NODE_ENV", "APP_ENV", "UPLOAD_STORAGE_MODE", "UPLOAD_DIR", "MONGO_URI"];
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
  expect(JSON.stringify(log.mock.calls)).not.toContain("private database details");
  expect(context.startupReady).not.toBe(true);
});
