"use strict";
const { log } = require("../services/logger");

/**
 * Global error handler middleware
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.code === 11000 ? 409 :
    ["ValidationError", "CastError", "MulterError"].includes(err.name) ? 400 : (err.status || err.statusCode || 500);
  const message = status >= 500 ? "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau." :
    err.code === 11000 ? "Dữ liệu đã tồn tại hoặc giao dịch bị trùng." :
    ["ValidationError", "CastError", "MulterError"].includes(err.name) ? "Dữ liệu gửi lên không hợp lệ." : err.message;
  log(status >= 500 ? "error" : "warn", "request.error", { requestId: req.requestId, status, errorName: err.name, path: req.path });

  res.status(status).json({
    success: false,
    message,
    requestId: req.requestId,
  });
}

module.exports = errorHandler;
