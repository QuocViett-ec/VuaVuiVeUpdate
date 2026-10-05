"use strict";

const Order = require("../models/Order.model");
const { fail } = require("./order-rules");

async function markOrderPaidWithGateway(order, payload) {
  if (!payload.transactionId || payload.gateway !== order.payment.method ||
      !Number.isSafeInteger(payload.amount) || payload.amount !== order.totalAmount || payload.amount <= 0) {
    fail(400, "Thông tin giao dịch không khớp đơn hàng.");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (order.payment.status === "refunded") fail(409, "Đơn đã hoàn tiền.");
    if (order.payment.status === "paid") return { updated: false, order, paymentUpdated: false, statusUpdated: false };
    const promote = order.status === "pending";
    const updated = await Order.findOneAndUpdate({
      _id: order._id, status: order.status, "payment.status": "pending", "payment.method": payload.gateway,
    }, { $set: {
      "payment.status": "paid", "payment.gateway": payload.gateway,
      "payment.transactionId": payload.transactionId || "",
      "payment.transactionTime": payload.transactionTime || new Date(),
      "payment.amount": payload.amount, paymentExpiresAt: null,
      ...(promote ? { status: "confirmed" } : {}),
    } }, { new: true, runValidators: true });
    if (updated) {
      Object.assign(order, updated.toObject());
      return { updated: true, order, paymentUpdated: true, statusUpdated: promote };
    }
    const current = await Order.findById(order._id);
    if (!current) fail(404, "Không tìm thấy đơn hàng.");
    Object.assign(order, current.toObject());
  }
  fail(409, "Đơn đang được cập nhật. Vui lòng đối soát lại giao dịch.");
}

module.exports = { markOrderPaidWithGateway };
