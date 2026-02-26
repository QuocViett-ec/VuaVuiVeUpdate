"use strict";

/**
 * Global error handler middleware
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Lỗi server nội bộ";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR] ${status} — ${message}`, err.stack);
  }

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
}

module.exports = errorHandler;
