"use strict";

function configuredOrigins() {
  return (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:4200,http://localhost:4201"))
    .split(",").map((value) => value.trim()).filter(Boolean);
}

function isAllowedOrigin(origin) {
  return !origin || configuredOrigins().includes(origin);
}

module.exports = { configuredOrigins, isAllowedOrigin };
