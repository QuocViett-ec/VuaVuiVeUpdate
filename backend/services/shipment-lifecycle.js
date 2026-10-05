"use strict";

const Order = require("../models/Order.model");
const Shipment = require("../models/Shipment.model");
const { fail } = require("./order-rules");
const { transaction, transitionInSession, audit } = require("./order-lifecycle");

const TRANSITIONS = {
  pending: ["picked", "cancelled"], picked: ["packed", "cancelled"],
  packed: ["shipped", "in_transit", "cancelled"], shipped: ["in_transit", "delivered", "failed"],
  in_transit: ["delivered", "failed"], failed: ["in_transit", "returned"],
  delivered: ["returned"], returned: [], cancelled: [],
};

async function updateShipment(query, body, actor) {
  return transaction(async (session) => {
    const shipment = await Shipment.findOne(query).session(session);
    if (!shipment) fail(404, "Không tìm thấy shipment.");
    const order = await Order.findById(shipment.orderId).session(session);
    if (!order) fail(409, "Shipment không có đơn hàng hợp lệ.");
    // Serialize changes to different packages of the same order.
    await Order.updateOne({ _id: order._id }, { $inc: { __v: 1 } }, { session });
    const status = body.currentStatus;
    if (status && status !== shipment.currentStatus) {
      if (!TRANSITIONS[shipment.currentStatus]?.includes(status)) fail(409, "Không thể chuyển trạng thái shipment.");
      if (["cancelled", "refunded"].includes(order.status)) fail(409, "Đơn đã kết thúc.");
      if (status === "cancelled") fail(409, "Vui lòng hủy ở cấp đơn để hoàn tồn kho đúng.");
      if (status === "returned" && order.status !== "return_approved" && !(order.status === "shipping" && shipment.currentStatus === "failed")) fail(409, "Đơn chưa được duyệt trả hàng hoặc kiện chưa giao thất bại.");
      if (["picked", "packed", "shipped", "in_transit", "delivered"].includes(status) && !["confirmed", "shipping"].includes(order.status)) {
        fail(409, "Đơn chưa được xác nhận hoặc đang xử lý trả hàng.");
      }
      shipment.currentStatus = status;
      if (status === "delivered") shipment.deliveredAt = new Date();
      shipment.statusHistory.push({ status, actorId: actor.userId, source: "admin_update", note: String(body.note || "").slice(0, 500) });
    }
    for (const field of ["carrier", "trackingNumber", "eta", "shippingFee"]) {
      if (body[field] !== undefined) shipment[field] = body[field];
    }
    await shipment.save({ session });
    const all = await Shipment.find({ orderId: order._id }).session(session).lean();
    let target = order.status;
    if (all.every((s) => s.currentStatus === "returned")) target = "returned";
    else if (all.every((s) => s.currentStatus === "delivered")) target = "delivered";
    else if (all.some((s) => ["picked", "packed", "shipped", "in_transit"].includes(s.currentStatus))) target = "shipping";
    if (target !== order.status) {
      // Individual package updates must not mark other packages delivered.
      const previousStatus = order.status;
      const { assertTransition } = require("./order-rules");
      if (target === "returned" && order.status === "shipping") {
        order.returnRequest.status = "approved";
        order.returnRequest.reason = "Delivery failed; all packages received back.";
        order.returnRequest.reviewedAt = new Date();
        order.returnRequest.reviewedBy = actor.userId;
      }
      assertTransition(order, target);
      order.status = target;
      if (target === "delivered") order.deliveredAt = new Date();
      if (target === "returned") {
        order.status = previousStatus;
        await transitionInSession(order, target, actor, session);
      } else await order.save({ session });
    }
    await audit(order, "shipment.update", actor, session, { shipmentId: String(shipment._id), status: shipment.currentStatus });
    return { shipment, order };
  });
}

async function createShipment(body, actor) {
  return transaction(async (session) => {
    const order = await Order.findById(body.orderId).session(session);
    if (!order) fail(404, "Không tìm thấy đơn hàng.");
    if (!["pending", "confirmed", "shipping"].includes(order.status)) fail(409, "Không thể thêm kiện cho đơn đã kết thúc.");
    const [shipment] = await Shipment.create([{
      orderId: order._id, customerId: order.userId, carrier: body.carrier || "internal",
      trackingNumber: body.trackingNumber || null, eta: body.eta || null,
      shippingFee: body.shippingFee || 0, deliverySnapshot: order.delivery,
      statusHistory: [{ status: "pending", actorId: actor.userId, source: "admin_create" }],
    }], { session });
    order.shipmentIds.push(shipment._id);
    await order.save({ session });
    await audit(order, "shipment.create", actor, session, { shipmentId: String(shipment._id) });
    return shipment;
  });
}

module.exports = { updateShipment, createShipment, TRANSITIONS };
