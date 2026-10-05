"use strict";
const path = require("path");
function uploadDirectory() {
  const configured = process.env.UPLOAD_DIR;
  const mode = process.env.UPLOAD_STORAGE_MODE || (process.env.NODE_ENV === "production" ? "persistent" : "ephemeral");
  if (!["persistent", "ephemeral"].includes(mode)) throw new Error("Invalid UPLOAD_STORAGE_MODE.");
  if (process.env.NODE_ENV === "production" && mode === "ephemeral" && process.env.APP_ENV !== "staging") {
    throw Object.assign(new Error("Ephemeral uploads are allowed only in explicitly configured staging."), { status: 503 });
  }
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) {
    throw Object.assign(new Error("UPLOAD_DIR must be an absolute path on persistent storage in production."), { status: 503 });
  }
  return configured ? path.resolve(configured) : path.join(__dirname, "../uploads");
}
module.exports = { uploadDirectory };
