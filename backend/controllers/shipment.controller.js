"use strict";

const mongoose = require("mongoose");
const Shipment = require("../models/Shipment.model");
const Order = require("../models/Order.model");
const { publishToUser } = require("../services/realtime-bus");
const { createAuditLog } = require("./user.controller");

const SHIPMENT_STATUSES = [
  "pending",
  "picked",
  "packed",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

function buildShipmentQuery(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""))
    ? { _id: id }
    : {
        trackingNumber: String(id || "")
          .trim()
          .toUpperCase(),
      };
}

function mapShipmentsToOrderStatus(shipments, fallback) {
  const statuses = (Array.isArray(shipments) ? shipments : [])
    .map((item) => String(item.currentStatus || "").toLowerCase())
    .filter(Boolean);

  if (!statuses.length) return fallback || "pending";
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  if (statuses.every((status) => status === "delivered")) return "delivered";
  if (
    statuses.some(
      (status) =>
        status === "in_transit" ||
        status === "shipped" ||
        status === "packed" ||
        status === "picked",
    )
  ) {
    return "shipping";
  }
  if (statuses.some((status) => status === "returned")) return "returned";
  return fallback || "confirmed";
}

async function syncOrderStatusFromShipments(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const shipments = await Shipment.find({ orderId })
    .select("currentStatus deliveredAt")
    .lean();
  if (!shipments.length) return order;

  const nextOrderStatus = mapShipmentsToOrderStatus(
    shipments,
    String(order.status || "pending"),
  );
  if (nextOrderStatus !== order.status) {
    order.status = nextOrderStatus;
  }

  if (nextOrderStatus === "delivered") {
    const deliveredAt = shipments
      .map((row) => (row.deliveredAt ? new Date(row.deliveredAt).getTime() : 0))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    if (deliveredAt) {
      order.deliveredAt = order.deliveredAt || new Date(deliveredAt);
      order.payment = order.payment || {};
      if (order.payment.status !== "refunded") {
        order.payment.status = "paid";
      }
    }
  }

  await order.save();
  return order;
}

exports.createShipmentForOrder = async (req, res, next) => {
  try {
    const { orderId, carrier, trackingNumber, eta, shippingFee, note } =
      req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(orderId || ""))) {
      return res
        .status(400)
        .json({ success: false, message: "orderId không hợp lệ" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const shipment = await Shipment.create({
      orderId: order._id,
      customerId: order.userId,
      carrier: String(carrier || "internal")
        .trim()
        .toLowerCase(),
      trackingNumber:
        String(trackingNumber || "")
          .trim()
          .toUpperCase() || null,
      eta: eta ? new Date(eta) : null,
      shippingFee: Math.max(0, Number(shippingFee ?? 0)),
      deliverySnapshot: {
        name: String(order.delivery?.name || ""),
        phone: String(order.delivery?.phone || ""),
        address: String(order.delivery?.address || ""),
        slot: String(order.delivery?.slot || ""),
      },
      statusHistory: [
        {
          status: "pending",
          actorId: req.session?.userId || null,
          source: "admin_create",
          note: String(note || "Created by admin").slice(0, 500),
        },
      ],
    });

    const shipmentIds = Array.isArray(order.shipmentIds)
      ? order.shipmentIds.map((id) => String(id))
      : [];
    if (!shipmentIds.includes(String(shipment._id))) {
      order.shipmentIds = [...shipmentIds, String(shipment._id)];
      await order.save();
    }

    await createAuditLog({
      adminId: req.session?.userId,
      action: "shipment.create",
      target: `Shipment:${shipment._id}`,
      details: {
        orderId: String(order._id),
        orderCode: String(order.orderId || ""),
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber || "",
      },
      ip: req.ip,
    });

    return res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

exports.listMyShipments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query?.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const query = { customerId: req.session.userId };
    if (
      req.query?.status &&
      SHIPMENT_STATUSES.includes(String(req.query.status))
    ) {
      query.currentStatus = String(req.query.status);
    }

    const [total, items] = await Promise.all([
      Shipment.countDocuments(query),
      Shipment.find(query)
        .populate("orderId", "orderId status totalAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getShipmentById = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne(buildShipmentQuery(req.params.id))
      .populate("orderId", "orderId userId status totalAmount")
      .populate("customerId", "name phone email")
      .lean();

    if (!shipment) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy shipment" });
    }

    const isOwner =
      String(shipment.customerId?._id || shipment.customerId || "") ===
      String(req.session.userId || "");
    const isBackoffice = ["admin", "staff", "audit"].includes(
      String(req.session.role || "").toLowerCase(),
    );

    if (!isOwner && !isBackoffice) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Bạn không có quyền xem shipment này",
        });
    }

    return res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

exports.listShipmentsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query?.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const query = {};
    if (
      req.query?.status &&
      SHIPMENT_STATUSES.includes(String(req.query.status))
    ) {
      query.currentStatus = String(req.query.status);
    }
    if (req.query?.carrier) {
      query.carrier = String(req.query.carrier).trim().toLowerCase();
    }

    const keyword = String(req.query?.q || "").trim();
    if (keyword) {
      const regex = new RegExp(
        keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [
        { trackingNumber: regex },
        { "deliverySnapshot.name": regex },
        { "deliverySnapshot.phone": regex },
      ];
    }

    const [total, items] = await Promise.all([
      Shipment.countDocuments(query),
      Shipment.find(query)
        .populate("orderId", "orderId status totalAmount")
        .populate("customerId", "name phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateShipment = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne(buildShipmentQuery(req.params.id));
    if (!shipment) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy shipment" });
    }

    const nextStatus = req.body?.currentStatus
      ? String(req.body.currentStatus).trim().toLowerCase()
      : null;
    if (nextStatus && !SHIPMENT_STATUSES.includes(nextStatus)) {
      return res
        .status(400)
        .json({ success: false, message: "currentStatus không hợp lệ" });
    }

    const previousStatus = shipment.currentStatus;

    if (req.body?.carrier !== undefined) {
      shipment.carrier = String(req.body.carrier || "internal")
        .trim()
        .toLowerCase();
    }
    if (req.body?.trackingNumber !== undefined) {
      shipment.trackingNumber =
        String(req.body.trackingNumber || "")
          .trim()
          .toUpperCase() || null;
    }
    if (req.body?.eta !== undefined) {
      shipment.eta = req.body.eta ? new Date(req.body.eta) : null;
    }
    if (req.body?.shippingFee !== undefined) {
      shipment.shippingFee = Math.max(0, Number(req.body.shippingFee || 0));
    }

    if (nextStatus && nextStatus !== shipment.currentStatus) {
      shipment.currentStatus = nextStatus;
      if (nextStatus === "delivered") {
        shipment.deliveredAt = shipment.deliveredAt || new Date();
      }
      shipment.statusHistory = Array.isArray(shipment.statusHistory)
        ? shipment.statusHistory
        : [];
      shipment.statusHistory.push({
        status: nextStatus,
        actorId: req.session?.userId || null,
        source: "admin_update",
        note: String(req.body?.note || "").slice(0, 500),
      });
    }

    await shipment.save();
    const order = await syncOrderStatusFromShipments(shipment.orderId);

    await createAuditLog({
      adminId: req.session?.userId,
      action: "shipment.update",
      target: `Shipment:${shipment._id}`,
      details: {
        previousStatus,
        nextStatus: shipment.currentStatus,
        orderId: String(shipment.orderId || ""),
        trackingNumber: shipment.trackingNumber || "",
      },
      ip: req.ip,
    });

    if (order) {
      publishToUser(order.userId, "order.status_updated", {
        orderId: String(order.orderId || ""),
        dbId: String(order._id),
        userId: String(order.userId || ""),
        status: order.status,
        paymentStatus: String(order.payment?.status || "pending"),
        updatedAt: order.updatedAt,
        source: "shipment_update",
      });
    }

    return res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};
