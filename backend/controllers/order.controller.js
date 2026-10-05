"use strict";

const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Review = require("../models/Review.model");
const Voucher = require("../models/Voucher.model");
const Shipment = require("../models/Shipment.model");
const { publishToUser } = require("../services/realtime-bus");
const { validateVoucher } = require("./voucher.controller");
const { isPaymentMethodEnabled } = require("../config/payment");
const lifecycle = require("../services/order-lifecycle");
const { fail: lifecycleError } = require("../services/order-rules");

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
  "return_requested",
  "return_approved",
  "return_rejected",
  "returned",
  "refunded",
];
const RETURN_WINDOW_DAYS = Math.max(
  1,
  Number.parseInt(process.env.ORDER_RETURN_WINDOW_DAYS || "7", 10) || 7,
);
function buildOrderQuery(id) {
  const isObjectId = /^[a-f\d]{24}$/i.test(id);
  return isObjectId ? { $or: [{ _id: id }, { orderId: id }] } : { orderId: id };
}

function enrichOrderItemsWithProduct(order, productMap) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const nextItems = items.map((item) => {
    const productId = String(item?.productId || "");
    const product = productMap.get(productId);
    const imageUrl =
      item?.imageUrl ||
      item?.productImage ||
      item?.image ||
      product?.imageUrl ||
      "";

    return {
      ...item,
      productName: String(item?.productName || product?.name || "Sản phẩm"),
      imageUrl,
      productImage: imageUrl,
      product: product
        ? {
            _id: product._id,
            name: product.name,
            imageUrl: product.imageUrl,
            price: product.price,
            stock: product.stock,
          }
        : undefined,
    };
  });

  return {
    ...order,
    items: nextItems,
  };
}

function withShipmentData(order, shipmentMapByOrderId) {
  const orderId = String(order?._id || "");
  const shipments = shipmentMapByOrderId.get(orderId) || [];
  return {
    ...order,
    shipments,
    shipmentIds:
      Array.isArray(order?.shipmentIds) && order.shipmentIds.length
        ? order.shipmentIds
        : shipments.map((s) => s._id),
  };
}

async function attachShipmentsToOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];
  if (!list.length) return list;

  const orderIds = list
    .map((order) => String(order?._id || ""))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (!orderIds.length) return list;

  const shipments = await Shipment.find({ orderId: { $in: orderIds } })
    .sort({ createdAt: 1 })
    .lean();

  const shipmentMapByOrderId = new Map();
  for (const shipment of shipments) {
    const key = String(shipment.orderId || "");
    const arr = shipmentMapByOrderId.get(key) || [];
    arr.push(shipment);
    shipmentMapByOrderId.set(key, arr);
  }

  return list.map((order) => withShipmentData(order, shipmentMapByOrderId));
}

function isWithinReturnWindow(order) {
  const baseDate = order?.deliveredAt || order?.updatedAt || order?.createdAt;
  if (!baseDate) return false;
  const elapsed = Date.now() - new Date(baseDate).getTime();
  return elapsed >= 0 && elapsed <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function calcDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function estimateVoucherDiscount(voucher, subtotal, shippingFee) {
  const type = String(voucher?.type || "");
  const value = Math.max(0, Number(voucher?.value || 0));
  const cap = Math.max(0, Number(voucher?.cap || 0));
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const safeShipping = Math.max(0, Number(shippingFee || 0));

  if (type === "ship") return safeShipping;
  if (type === "fixed") return value;
  if (type === "percent") {
    const discount = Math.round((safeSubtotal * value) / 100);
    return cap > 0 ? Math.min(discount, cap) : discount;
  }
  return 0;
}

/**
 * GET /api/orders/:id/reviews/me
 * Lấy các review của chính user cho đơn hàng này
 */
exports.getMyOrderReviews = async (req, res, next) => {
  try {
    const query = buildOrderQuery(req.params.id);
    const order = await Order.findOne(query).lean();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const isOwner = String(order.userId) === String(req.session.userId);
    const isAdmin = String(req.session.role || "") === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đánh giá của đơn hàng này",
      });
    }

    const reviews = await Review.find({
      userId: req.session.userId,
      orderId: order._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/reviews
 * Body: { reviews: [{ productId, rating, comment }] }
 */
exports.submitOrderReviews = async (req, res, next) => {
  try {
    const query = buildOrderQuery(req.params.id);
    const order = await Order.findOne(query).lean();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const isOwner = String(order.userId) === String(req.session.userId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đánh giá đơn hàng này",
      });
    }

    const status = String(order.status || "");
    if (status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể đánh giá khi đơn hàng đã xác nhận hoặc đã giao",
      });
    }

    const reviews = Array.isArray(req.body?.reviews) ? req.body.reviews : [];
    if (!reviews.length) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng gửi ít nhất 1 đánh giá sản phẩm",
      });
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    const orderItemByProduct = new Map(
      orderItems.map((it) => [String(it.productId), it]),
    );

    const payload = [];
    for (const row of reviews) {
      const productId = String(row?.productId || "").trim();
      const rating = Number(row?.rating || 0);
      const comment = String(row?.comment || "").trim();

      if (!productId || !orderItemByProduct.has(productId)) {
        return res.status(400).json({
          success: false,
          message: "Đánh giá có sản phẩm không thuộc đơn hàng",
        });
      }

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Số sao phải trong khoảng từ 1 đến 5",
        });
      }

      if (comment.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Nội dung đánh giá tối đa 500 ký tự",
        });
      }

      const item = orderItemByProduct.get(productId);
      payload.push({
        productId,
        productName: String(item?.productName || ""),
        productImage: String(
          item?.productImage || item?.imageUrl || item?.image || "",
        ),
        rating,
        comment,
      });
    }

    const saved = [];
    for (const row of payload) {
      const doc = await Review.findOneAndUpdate(
        {
          userId: req.session.userId,
          orderId: order._id,
          productId: row.productId,
        },
        {
          $set: {
            orderCode: String(order.orderId || order._id),
            productName: row.productName,
            productImage: row.productImage,
            rating: row.rating,
            comment: row.comment,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean();
      saved.push(doc);
    }

    return res.status(201).json({
      success: true,
      message: "Gửi đánh giá thành công",
      data: saved,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/voucher/available
 * Query: subtotal, shippingFee
 */
exports.listApplicableVouchers = async (req, res, next) => {
  try {
    const subtotal = Math.max(0, Number(req.query?.subtotal || 0));
    const shippingFee = Math.max(0, Number(req.query?.shippingFee || 0));
    const now = new Date();

    const vouchers = await Voucher.find({
      isActive: true,
      $and: [
        {
          $or: [
            { startsAt: { $exists: false } },
            { startsAt: null },
            { startsAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gte: now } },
          ],
        },
        {
          $or: [
            { maxUses: { $exists: false } },
            { maxUses: 0 },
            { $expr: { $gt: ["$maxUses", "$usedCount"] } },
          ],
        },
      ],
    })
      .sort({ expiresAt: 1, createdAt: -1 })
      .lean();

    const data = vouchers
      .map((voucher) => {
        const minOrderValue = Math.max(0, Number(voucher.minOrderValue || 0));
        const canApply = subtotal >= minOrderValue;
        const estimatedDiscount = estimateVoucherDiscount(
          voucher,
          subtotal,
          shippingFee,
        );
        const daysLeft = calcDaysLeft(voucher.expiresAt);

        return {
          code: String(voucher.code || "").toUpperCase(),
          type: voucher.type,
          value: Number(voucher.value || 0),
          cap: Number(voucher.cap || 0),
          minOrderValue,
          maxUses: Number(voucher.maxUses || 0),
          usedCount: Number(voucher.usedCount || 0),
          expiresAt: voucher.expiresAt || null,
          note: String(voucher.note || ""),
          canApply,
          estimatedDiscount: canApply ? estimatedDiscount : 0,
          daysLeft,
        };
      })
      .sort((a, b) => {
        if (a.canApply !== b.canApply) return a.canApply ? -1 : 1;
        return b.estimatedDiscount - a.estimatedDiscount;
      })
      .slice(0, 30);

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/voucher/validate (auth required)
 */
exports.validateVoucherForCheckout = async (req, res, next) => {
  try {
    const { code, subtotal = 0, shippingFee = 0 } = req.body || {};
    const normalizedCode = String(code || "")
      .trim()
      .toUpperCase();

    const result = await validateVoucher({
      code: normalizedCode,
      subtotal: Number(subtotal || 0),
      shippingFee: Number(shippingFee || 0),
    });

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          ok: false,
          message: result.message,
        },
      });
    }

    return res.json({
      success: true,
      message: result.message,
      data: {
        ok: true,
        voucherId: result?.voucher?._id || null,
        type: result.type,
        value: Number(result.value || 0),
        cap: Number(result.cap || 0),
        message: result.message,
        warning: String(result.warning || ""),
        expiresAt: result.expiresAt || null,
        daysLeft:
          result.daysLeft === null || result.daysLeft === undefined
            ? null
            : Number(result.daysLeft),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders  (auth required)
 */
exports.createOrder = async (req, res, next) => {
  try {
    const body = req.body || {};
    const method = body.payment?.method ?? "cod";
    if (!["cod", "vnpay", "momo"].includes(method)) {
      return res.status(400).json({ success: false, message: "Phương thức thanh toán không hợp lệ." });
    }
    if (!isPaymentMethodEnabled(method)) {
      return res.status(503).json({ success: false, message: "Phương thức thanh toán này đang tạm ngưng. Vui lòng chọn thanh toán khi nhận hàng." });
    }
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
      return res.status(400).json({ success: false, message: "Đơn hàng phải có ít nhất một sản phẩm" });
    }
    if (body.items.some((i) => !i || !mongoose.Types.ObjectId.isValid(String(i.productId || "")))) {
      return res.status(400).json({ success: false, message: "Sản phẩm không hợp lệ." });
    }
    if (!body.delivery || ["name", "phone", "address"].some((field) =>
      typeof body.delivery[field] !== "string" || !body.delivery[field].trim() || body.delivery[field].length > 500)) {
      return res.status(400).json({ success: false, message: "Thông tin giao hàng không hợp lệ." });
    }
    if (!/^0[3-9]\d{8}$/.test(body.delivery.phone.trim())) {
      return res.status(400).json({ success: false, message: "Số điện thoại giao hàng không hợp lệ." });
    }
    const result = await lifecycle.createOrder(req.session.userId, body, req.get("Idempotency-Key"));
    return res.status(result.replayed ? 200 : 201).json({ success: true, data: result.order, replayed: result.replayed });
  } catch (err) { next(err); }
};
/**
 * GET /api/orders/me  (auth required)
 */
exports.getMyOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query?.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;
    const status = String(req.query?.status || "")
      .trim()
      .toLowerCase();

    const query = { userId: req.session.userId };
    if (status && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const productIds = [
      ...new Set(
        orders
          .flatMap((order) => (Array.isArray(order?.items) ? order.items : []))
          .map((item) => String(item?.productId || ""))
          .filter(Boolean),
      ),
    ];

    let productMap = new Map();
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select("name imageUrl price stock")
        .lean();
      productMap = new Map(products.map((p) => [String(p._id), p]));
    }

    const enrichedOrders = orders.map((order) =>
      enrichOrderItemsWithProduct(order, productMap),
    );
    const ordersWithShipments = await attachShipmentsToOrders(enrichedOrders);

    return res.json({
      success: true,
      data: {
        items: ordersWithShipments,
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

/**
 * GET /api/orders/:id  (auth: owner or admin)
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const isObjectId = /^[a-f\d]{24}$/i.test(req.params.id);
    const query = isObjectId
      ? { $or: [{ _id: req.params.id }, { orderId: req.params.id }] }
      : { orderId: req.params.id };
    const order = await Order.findOne(query).lean();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const isOwner = order.userId.toString() === req.session.userId;
    const isAdmin = req.session.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này",
      });
    }

    const productIds = [
      ...new Set(
        (Array.isArray(order?.items) ? order.items : [])
          .map((item) => String(item?.productId || ""))
          .filter(Boolean),
      ),
    ];

    let productMap = new Map();
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select("name imageUrl price stock")
        .lean();
      productMap = new Map(products.map((p) => [String(p._id), p]));
    }

    const enrichedOrder = enrichOrderItemsWithProduct(order, productMap);
    const [orderWithShipments] = await attachShipmentsToOrders([enrichedOrder]);

    return res.json({ success: true, data: orderWithShipments });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/orders/:id/status  (admin only)
 */
exports.updateStatus = async (req, res, next) => {
  try {
    if (!["confirmed", "shipping", "delivered", "cancelled", "returned"].includes(req.body?.status)) {
      return res.status(400).json({ success: false, message: "Use the dedicated return/refund workflow." });
    }
    const order = await lifecycle.transition(req.params.id, req.body?.status, {
      userId: req.session.userId, role: req.session.role, ip: req.ip,
    });
    publishToUser(order.userId, "order.status_updated", {
      orderId: order.orderId, dbId: String(order._id), status: order.status,
      paymentStatus: order.payment.status, updatedAt: order.updatedAt, source: "admin",
    });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
/**
 * PATCH /api/orders/:id/cancel  (auth: owner or admin)
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await lifecycle.transition(req.params.id, "cancelled", {
      userId: req.session.userId, role: req.session.role, ip: req.ip,
    }, true);
    publishToUser(order.userId, "order.status_updated", {
      orderId: order.orderId, dbId: String(order._id), status: order.status,
      paymentStatus: order.payment.status, updatedAt: order.updatedAt, source: "order_cancel",
    });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
/**
 * PATCH /api/orders/:id/paid  (admin/staff only — route-level guarded)
 * Đánh dấu đơn hàng đã thanh toán thủ công (internal/admin chỉnh sửa).
 * Không còn dùng cho browser owner sau khi VNPay/MoMo redirect.
 * Paid tự động được commit bởi IPN callback trong payment.controller.js.
 */
exports.markOrderPaid = async (req, res, next) => {
  try {
    if (!["admin", "staff"].includes(req.session.role)) return res.status(403).json({ success: false });
    if (req.body?.gateway !== "cod") return res.status(400).json({ success: false, message: "Online payments require a verified provider callback." });
    const order = await lifecycle.recordCodPayment(req.params.id, req.body.transactionId, { userId: req.session.userId, ip: req.ip });
    publishToUser(order.userId, "order.status_updated", { orderId: order.orderId, status: order.status, paymentStatus: order.payment.status });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
/**
 * POST /api/orders/:id/return-request (auth: owner)
 */
exports.requestReturn = async (req, res, next) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 5 || reason.length > 1000) return res.status(400).json({ success: false, message: "Return reason must contain 5-1000 characters." });
    const order = await lifecycle.transaction(async (session) => {
      const current = await Order.findOne(buildOrderQuery(req.params.id)).session(session);
      if (!current) lifecycleError(404, "Order not found.");
      if (String(current.userId) !== String(req.session.userId)) lifecycleError(403, "Order does not belong to this user.");
      if (current.status !== "delivered" || !isWithinReturnWindow(current)) lifecycleError(409, "Order is outside the return window.");
      current.returnRequest = {
        status: "pending", requestedAt: new Date(), reason,
        note: String(req.body?.note || "").slice(0, 1000),
        images: Array.isArray(req.body?.images) ? req.body.images.filter((i) => typeof i === "string").slice(0, 5) : [],
      };
      return lifecycle.transitionInSession(current, "return_requested", { userId: req.session.userId, ip: req.ip }, session);
    });
    publishToUser(order.userId, "order.status_updated", { orderId: order.orderId, status: order.status, paymentStatus: order.payment.status });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
/**
 * PUT /api/orders/:id/return-review (admin/staff)
 */
exports.reviewReturnRequest = async (req, res, next) => {
  try {
    const decision = req.body?.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ success: false, message: "Invalid return decision." });
    const order = await lifecycle.transaction(async (session) => {
      const current = await Order.findOne(buildOrderQuery(req.params.id)).session(session);
      if (!current) lifecycleError(404, "Order not found.");
      if (current.status !== "return_requested") lifecycleError(409, "Return request was already reviewed.");
      current.returnRequest.status = decision === "approve" ? "approved" : "rejected";
      current.returnRequest.reviewedAt = new Date();
      current.returnRequest.reviewedBy = req.session.userId;
      current.returnRequest.reviewNote = String(req.body?.reviewNote || "").slice(0, 1000);
      return lifecycle.transitionInSession(current, decision === "approve" ? "return_approved" : "return_rejected", { userId: req.session.userId, ip: req.ip }, session);
    });
    publishToUser(order.userId, "order.status_updated", { orderId: order.orderId, status: order.status, paymentStatus: order.payment.status });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};
/**
 * PATCH /api/orders/:id/refund (admin)
 */
exports.markOrderRefunded = async (req, res, next) => {
  try {
    const order = await lifecycle.refund(req.params.id, req.body || {}, {
      userId: req.session.userId, role: req.session.role, ip: req.ip,
    });
    publishToUser(order.userId, "order.status_updated", {
      orderId: order.orderId, dbId: String(order._id), status: order.status,
      paymentStatus: order.payment.status, updatedAt: order.updatedAt, source: "admin_refund",
    });
    res.json({ success: true, message: "Đã ghi nhận bằng chứng hoàn tiền.", data: order });
  } catch (err) { next(err); }
};
/**
 * GET /api/admin/orders  (admin only)
 * Query: ?status=&page=&limit=
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, q = "" } = req.query;

    const filter = {};
    if (status && VALID_STATUSES.includes(status)) filter.status = status;

    const keyword = String(q || "").trim();
    if (keyword) {
      const regex = new RegExp(
        keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      filter.$or = [
        { orderId: regex },
        { "delivery.name": regex },
        { "delivery.phone": regex },
        { note: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);
    const ordersWithShipments = await attachShipmentsToOrders(orders);

    return res.json({
      success: true,
      data: ordersWithShipments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/orders/bulk-status (backoffice)
 * Body: { orderIds: string[], status: string }
 */
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { orderIds, status } = req.body || {};
    if (!Array.isArray(orderIds) || !orderIds.length || orderIds.length > 100 ||
        orderIds.some((id) => typeof id !== "string") || !["confirmed", "shipping", "delivered", "cancelled", "returned"].includes(status)) {
      return res.status(400).json({ success: false, message: "Danh sách đơn/trạng thái không hợp lệ." });
    }
    const results = [];
    for (const id of [...new Set(orderIds)]) {
      try {
        const order = await lifecycle.transition(id, status, { userId: req.session.userId, role: req.session.role, ip: req.ip });
        results.push({ orderId: id, success: true });
        publishToUser(order.userId, "order.status_updated", { orderId: order.orderId, status: order.status, paymentStatus: order.payment.status });
      } catch (err) {
        if (!err.status) throw err;
        results.push({ orderId: id, success: false, message: err.message });
      }
    }
    res.json({ success: true, data: { updatedCount: results.filter((r) => r.success).length, requested: orderIds.length, results } });
  } catch (err) { next(err); }
};
/**
 * GET /api/admin/orders/export?status=&q=
 */
exports.exportOrdersCsv = async (req, res, next) => {
  try {
    const { status, q = "" } = req.query;
    const filter = {};
    if (status && VALID_STATUSES.includes(status)) filter.status = status;

    const keyword = String(q || "").trim();
    if (keyword) {
      const regex = new RegExp(
        keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      filter.$or = [
        { orderId: regex },
        { "delivery.name": regex },
        { "delivery.phone": regex },
      ];
    }

    const rows = await Order.find(filter).sort({ createdAt: -1 }).lean();
    const header = [
      "orderId",
      "customerName",
      "phone",
      "paymentMethod",
      "paymentStatus",
      "status",
      "subtotal",
      "shippingFee",
      "discount",
      "totalAmount",
      "createdAt",
    ];

    const csv = [
      header.join(","),
      ...rows.map((o) =>
        [
          o.orderId || "",
          o.delivery?.name || "",
          o.delivery?.phone || "",
          o.payment?.method || "",
          o.payment?.status || "",
          o.status || "",
          o.subtotal || 0,
          o.shippingFee || 0,
          o.discount || 0,
          o.totalAmount || 0,
          o.createdAt ? new Date(o.createdAt).toISOString() : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-${Date.now()}.csv"`,
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (err) {
    next(err);
  }
};
