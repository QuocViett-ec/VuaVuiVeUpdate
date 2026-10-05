"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Voucher = require("../models/Voucher.model");
const Shipment = require("../models/Shipment.model");
const AuditLog = require("../models/AuditLog.model");
const { fail, priceOrder, assertTransition } = require("./order-rules");

function queryById(id) {
  return mongoose.Types.ObjectId.isValid(String(id)) ? { $or: [{ _id: id }, { orderId: id }] } : { orderId: String(id) };
}

async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function audit(order, action, actor, session, details = {}) {
  if (!actor?.userId) return;
  await AuditLog.create([{
    adminId: actor.userId, action, target: `Order:${order.orderId}`, details, ip: actor.ip,
  }], { session });
}

async function syncShipments(order, session, actor) {
  const status = { shipping: "in_transit", delivered: "delivered", cancelled: "cancelled", returned: "returned" }[order.status];
  if (!status) return;
  const shipments = await Shipment.find({ orderId: order._id }).session(session);
  for (const shipment of shipments) {
    if (shipment.currentStatus === status) continue;
    shipment.currentStatus = status;
    if (status === "delivered") shipment.deliveredAt = order.deliveredAt;
    shipment.statusHistory.push({ status, actorId: actor?.userId || null, source: "order_sync" });
    await shipment.save({ session });
  }
}

async function releaseStock(order, session) {
  if (order.stockReleased || order.returnRequest?.stockRestocked) return;
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }, { session });
  }
  order.stockReleased = true;
  order.returnRequest = order.returnRequest || {};
  order.returnRequest.stockRestocked = true;
  if (order.status === "cancelled" && order.voucherId) {
    await Voucher.updateOne({ _id: order.voucherId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
  }
}

async function createOrder(userId, body, key) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key || "")) fail(400, "Thiếu hoặc sai Idempotency-Key.");
  const canonical = {
    items: body.items.map((i) => ({ productId: String(i.productId), quantity: i.quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    delivery: { name: body.delivery.name.trim(), phone: body.delivery.phone.trim(), address: body.delivery.address.trim(), slot: String(body.delivery.slot || "") },
    paymentMethod: body.payment?.method || "cod",
    voucherCode: String(body.voucherCode || "").trim().toUpperCase(),
    note: String(body.note || "").slice(0, 1000),
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const replay = (existing) => {
    if (existing.requestHash !== hash) fail(409, "Idempotency-Key đã dùng cho nội dung đơn khác.");
    return { order: existing, replayed: true };
  };
  try {
    return await transaction(async (session) => {
      const existing = await Order.findOne({ userId, idempotencyKey: key }).session(session);
      if (existing) return replay(existing);
      const products = await Product.find({ _id: { $in: canonical.items.map((i) => i.productId) } }).session(session).lean();
      const voucher = canonical.voucherCode ? await Voucher.findOne({ code: canonical.voucherCode }).session(session) : null;
      if (canonical.voucherCode && !voucher) fail(400, "Voucher không tồn tại.");
      const totals = priceOrder(canonical.items, products, canonical.delivery.address, voucher);
      for (const item of totals.items) {
        const result = await Product.updateOne({ _id: item.productId, isActive: { $ne: false }, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }, { session });
        if (result.modifiedCount !== 1) fail(409, "Sản phẩm vừa hết hàng. Vui lòng cập nhật giỏ hàng.");
      }
      if (voucher) {
        const result = await Voucher.updateOne({ _id: voucher._id, usedCount: voucher.usedCount },
          { $inc: { usedCount: 1 } }, { session });
        if (result.modifiedCount !== 1) fail(409, "Voucher đã thay đổi. Vui lòng thử lại.");
      }
      const online = canonical.paymentMethod !== "cod";
      const ttl = Math.max(5, Number(process.env.ORDER_PAYMENT_TTL_MINUTES) || 30);
      const [order] = await Order.create([{
        ...totals, userId, delivery: canonical.delivery, note: canonical.note,
        payment: { method: canonical.paymentMethod, status: "pending" },
        voucherId: voucher?._id || null, voucherCode: canonical.voucherCode,
        idempotencyKey: key, requestHash: hash,
        paymentExpiresAt: online ? new Date(Date.now() + ttl * 60000) : null,
      }], { session });
      const [shipment] = await Shipment.create([{
        orderId: order._id, customerId: userId, shippingFee: totals.shippingFee,
        deliverySnapshot: canonical.delivery, statusHistory: [{ status: "pending", source: "order_create" }],
      }], { session });
      order.shipmentIds = [shipment._id];
      await order.save({ session });
      return { order, replayed: false };
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Order.findOne({ userId, idempotencyKey: key });
      if (existing) return replay(existing);
    }
    throw error;
  }
}

async function transitionInSession(order, nextStatus, actor, session) {
  if (order.status === nextStatus) return order;
  assertTransition(order, nextStatus);
  const previousStatus = order.status;
  order.status = nextStatus;
  if (nextStatus === "delivered") order.deliveredAt = order.deliveredAt || new Date();
  if (["cancelled", "returned"].includes(nextStatus)) await releaseStock(order, session);
  await order.save({ session });
  await syncShipments(order, session, actor);
  await audit(order, "order.transition", actor, session, { previousStatus, nextStatus });
  return order;
}

async function transition(id, nextStatus, actor, ownerOnly = false) {
  return transaction(async (session) => {
    const order = await Order.findOne(queryById(id)).session(session);
    if (!order) fail(404, "Không tìm thấy đơn hàng.");
    if (ownerOnly && String(order.userId) !== String(actor.userId) && actor.role !== "admin") fail(403, "Không có quyền cập nhật đơn hàng.");
    return transitionInSession(order, nextStatus, actor, session);
  });
}

async function refund(id, evidence, actor) {
  if (typeof evidence.reference !== "string" || evidence.reference.trim().length < 6 || evidence.reference.length > 128 ||
      typeof evidence.note !== "string" || evidence.note.trim().length < 5 || evidence.note.length > 1000) {
    fail(400, "Hoàn tiền cần mã giao dịch/bằng chứng và ghi chú xác nhận.");
  }
  return transaction(async (session) => {
    const order = await Order.findOne(queryById(id)).session(session);
    if (!order) fail(404, "Không tìm thấy đơn hàng.");
    if (order.payment.status === "refunded") {
      if (order.refund?.reference !== evidence.reference.trim() || order.refund?.amount !== evidence.amount) fail(409, "Đơn đã hoàn tiền với bằng chứng khác.");
      return order;
    }
    if (!["returned", "cancelled"].includes(order.status) || order.payment.status !== "paid") fail(409, "Chỉ ghi nhận hoàn tiền cho đơn đã trả/hủy và đã thanh toán.");
    if (evidence.amount !== order.totalAmount) fail(400, "Số tiền hoàn phải bằng tổng tiền đơn.");
    order.refund = { reference: evidence.reference.trim(), note: evidence.note.trim(), amount: evidence.amount, recordedAt: new Date(), recordedBy: actor.userId };
    order.payment.status = "refunded";
    order.status = "refunded";
    order.returnRequest.status = "refunded";
    await order.save({ session });
    await audit(order, "order.refund_recorded", actor, session, { reference: order.refund.reference, amount: evidence.amount });
    return order;
  });
}

async function expireUnpaidOrders() {
  const orders = await Order.find({ status: "pending", "payment.method": { $in: ["vnpay", "momo"] }, "payment.status": "pending", paymentExpiresAt: { $lte: new Date() } }).select("_id").limit(100).lean();
  for (const row of orders) {
    await transaction(async (session) => {
      const order = await Order.findOne({ _id: row._id, status: "pending", "payment.status": "pending", paymentExpiresAt: { $lte: new Date() } }).session(session);
      if (order) await transitionInSession(order, "cancelled", null, session);
    });
  }
  return orders.length;
}

async function recordCodPayment(id, reference, actor) {
  if (typeof reference !== "string" || reference.trim().length < 6 || reference.length > 128) fail(400, "Cần mã biên nhận thu tiền COD.");
  return transaction(async (session) => {
    const order = await Order.findOne(queryById(id)).session(session);
    if (!order) fail(404, "Không tìm thấy đơn hàng.");
    const deliveredStates = ["delivered", "return_requested", "return_approved", "return_rejected", "returned"];
    if (order.payment.method !== "cod" || !deliveredStates.includes(order.status) || !order.deliveredAt) fail(409, "Chỉ ghi nhận COD cho đơn đã giao.");
    if (order.payment.status === "paid") {
      if (order.payment.transactionId !== reference.trim()) fail(409, "COD đã ghi nhận với biên nhận khác.");
      return order;
    }
    if (order.payment.status !== "pending") fail(409, "Trạng thái thanh toán không hợp lệ.");
    Object.assign(order.payment, { status: "paid", gateway: "cod", transactionId: reference.trim(), transactionTime: new Date(), amount: order.totalAmount });
    await order.save({ session });
    await audit(order, "order.cod_collected", actor, session, { reference: reference.trim(), amount: order.totalAmount });
    return order;
  });
}

module.exports = { createOrder, transition, transitionInSession, transaction, refund, expireUnpaidOrders, queryById, audit, recordCodPayment };
