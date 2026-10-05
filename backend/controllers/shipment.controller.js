"use strict";

const mongoose = require("mongoose");
const Shipment = require("../models/Shipment.model");
const Order = require("../models/Order.model");
const { publishToUser } = require("../services/realtime-bus");
const lifecycle = require("../services/shipment-lifecycle");

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

exports.createShipmentForOrder = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.body?.orderId || ""))) {
      return res.status(400).json({ success: false, message: "orderId không hợp lệ." });
    }
    const shipment = await lifecycle.createShipment(req.body, { userId: req.session.userId, ip: req.ip });
    res.status(201).json({ success: true, data: shipment });
  } catch (err) { next(err); }
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
    const { shipment, order } = await lifecycle.updateShipment(buildShipmentQuery(req.params.id), req.body || {}, { userId: req.session.userId, ip: req.ip });
    publishToUser(order.userId, "order.status_updated", {
      orderId: order.orderId, dbId: String(order._id), status: order.status,
      paymentStatus: order.payment.status, updatedAt: order.updatedAt, source: "shipment_update",
    });
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
};
