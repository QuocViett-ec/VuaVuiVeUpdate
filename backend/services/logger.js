"use strict";

const sensitive = /password|secret|token|cookie|authorization|email|phone|address|transactionId|reference|sessionId|uri/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([key, val]) => [key, sensitive.test(key) ? "[REDACTED]" : redact(val)]));
  if (typeof value === "string") return value
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[REDACTED]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
  return value;
}
function log(level, event, fields = {}) {
  const output = JSON.stringify(redact({ timestamp: new Date().toISOString(), level, event, ...fields }));
  (level === "error" ? console.error : console.log)(output);
}
module.exports = { redact, log };
