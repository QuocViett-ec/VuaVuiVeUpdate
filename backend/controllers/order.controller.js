"use strict";

const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Review = require("../models/Review.model");
const Voucher = require("../models/Voucher.model");
const Shipment = require("../models/Shipment.model");
const { publishToUser } = require("../services/realtime-bus");
const { createAuditLog } = require("./user.controller");
const { validateVoucher, markVoucherUsed } = require("./voucher.controller");

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
const CANCELLABLE_STATUSES = ["pending", "confirmed"];
const RETURN_WINDOW_DAYS = Math.max(
  1,
  Number.parseInt(process.env.ORDER_RETURN_WINDOW_DAYS || "7", 10) || 7,
);
const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered"],
  delivered: ["return_requested"],
  cancelled: [],
  return_requested: ["return_approved", "return_rejected"],
  return_approved: ["returned", "refunded"],
  return_rejected: [],
  returned: ["refunded"],
  refunded: [],
};

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

function mapOrderStatusToShipmentStatus(orderStatus) {
  const normalized = String(orderStatus || "").toLowerCase();
  if (normalized === "shipping") return "in_transit";
  if (normalized === "delivered") return "delivered";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "returned" || normalized === "refunded") return "returned";
  return "pending";
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

async function ensureInitialShipmentForOrder(order, source = "order_create") {
  if (!order?._id || !order?.userId) return null;

  const existing = await Shipment.findOne({ orderId: order._id })
    .sort({ createdAt: 1 })
    .lean();
  if (existing) {
    if (!Array.isArray(order.shipmentIds) || !order.shipmentIds.length) {
      order.shipmentIds = [existing._id];
      await order.save();
    }
    return existing;
  }

  const mappedStatus = mapOrderStatusToShipmentStatus(order.status);
  const shipment = await Shipment.create({
    orderId: order._id,
    customerId: order.userId,
    shippingFee: Number(order.shippingFee || 0),
    currentStatus: mappedStatus,
    deliveredAt:
      mappedStatus === "delivered" ? order.deliveredAt || new Date() : null,
    deliverySnapshot: {
      name: String(order.delivery?.name || ""),
      phone: String(order.delivery?.phone || ""),
      address: String(order.delivery?.address || ""),
      slot: String(order.delivery?.slot || ""),
    },
    statusHistory: [
      {
        status: mappedStatus,
        actorId: null,
        source,
        note: `Initialized from order status: ${String(order.status || "pending")}`,
      },
    ],
  });

  order.shipmentIds = [shipment._id];
  await order.save();
  return shipment.toObject();
}

async function syncShipmentsForOrderStatus(order, options = {}) {
  if (!order?._id) return;

  const actorId = options.actorId || null;
  const source = String(options.source || "order_status_sync");
  const note = String(options.note || "");
  const nextShipmentStatus = mapOrderStatusToShipmentStatus(order.status);

  const shipments = await Shipment.find({ orderId: order._id });
  if (!shipments.length) {
    await ensureInitialShipmentForOrder(order, source);
    return;
  }

  await Promise.all(
    shipments.map(async (shipment) => {
      if (shipment.currentStatus === nextShipmentStatus) return;

      shipment.currentStatus = nextShipmentStatus;
      if (nextShipmentStatus === "delivered") {
        shipment.deliveredAt =
          shipment.deliveredAt || order.deliveredAt || new Date();
      }
      shipment.statusHistory = Array.isArray(shipment.statusHistory)
        ? shipment.statusHistory
        : [];
      shipment.statusHistory.push({
        status: nextShipmentStatus,
        at: new Date(),
        actorId:
          actorId && mongoose.Types.ObjectId.isValid(String(actorId))
            ? actorId
            : null,
        source,
        note,
      });
      await shipment.save();
    }),
  );
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

async function restockOrderItemsIdempotent(order) {
  order.returnRequest = order.returnRequest || {};
  if (order.returnRequest.stockRestocked) {
    return false;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  await Promise.all(
    items.map((item) =>
      Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: Math.max(0, Number(item.quantity || 0)) },
      }),
    ),
  );

  order.returnRequest.stockRestocked = true;
  return true;
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
    if (status !== "delivered" && status !== "confirmed") {
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
    const {
      items,
      delivery,
      payment,
      voucherCode,
      shippingFee,
      discount,
      subtotal,
      totalAmount,
      note,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng phải có ít nhất một sản phẩm",
      });
    }

    const invalidIdItem = items.find(
      (item) => !mongoose.Types.ObjectId.isValid(String(item?.productId || "")),
    );
    if (invalidIdItem) {
      return res.status(400).json({
        success: false,
        message:
          "Giỏ hàng có sản phẩm không hợp lệ. Vui lòng cập nhật lại giỏ hàng.",
      });
    }

    const productIds = items.map((item) => String(item.productId));
    const uniqueProductIds = [...new Set(productIds)];
    const foundCount = await Product.countDocuments({
      _id: { $in: uniqueProductIds },
    });
    if (foundCount !== uniqueProductIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Một số sản phẩm không còn tồn tại. Vui lòng tải lại giỏ hàng.",
      });
    }

    const products = await Product.find({ _id: { $in: uniqueProductIds } })
      .select("name stock isActive")
      .lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const quantityByProductId = new Map();
    for (const item of items) {
      const id = String(item.productId);
      const qty = Math.max(1, Number(item.quantity || 0));
      quantityByProductId.set(id, (quantityByProductId.get(id) || 0) + qty);
    }

    for (const [productId, quantity] of quantityByProductId.entries()) {
      const product = productMap.get(productId);
      if (!product || product.isActive === false) {
        return res.status(400).json({
          success: false,
          message:
            "Một số sản phẩm đang tạm ngưng bán. Vui lòng cập nhật giỏ hàng.",
        });
      }
      if (Number(product.stock || 0) < quantity) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm \"${product.name}\" chỉ còn ${Math.max(0, Number(product.stock || 0))} trong kho.`,
        });
      }
    }

    if (!delivery || !delivery.name || !delivery.phone || !delivery.address) {
      return res
        .status(400)
        .json({ success: false, message: "Thông tin giao hàng không đầy đủ" });
    }

    if (subtotal === undefined || totalAmount === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin tổng tiền" });
    }

    let validatedDiscount = Number(discount ?? 0);
    let normalizedVoucherCode = String(voucherCode || "")
      .trim()
      .toUpperCase();
    let voucherId = null;

    if (normalizedVoucherCode) {
      const voucherResult = await validateVoucher({
        code: normalizedVoucherCode,
        subtotal: Number(subtotal),
        shippingFee: Number(shippingFee ?? 0),
      });

      if (!voucherResult.ok) {
        return res.status(400).json({
          success: false,
          message: voucherResult.message,
        });
      }
      voucherId = voucherResult?.voucher?._id || null;

      if (voucherResult.type === "ship") {
        validatedDiscount = Number(shippingFee ?? 0);
      } else if (voucherResult.type === "percent") {
        const percentValue = Math.round(
          (Number(subtotal) * Number(voucherResult.value || 0)) / 100,
        );
        const cap = Number(voucherResult.cap || 0);
        validatedDiscount =
          cap > 0 ? Math.min(percentValue, cap) : percentValue;
      } else {
        validatedDiscount = Number(voucherResult.value || 0);
      }
    }

    const order = await Order.create({
      userId: req.session.userId,
      items,
      delivery,
      payment,
      voucherId,
      voucherCode: normalizedVoucherCode,
      shippingFee: shippingFee ?? 0,
      discount: validatedDiscount,
      subtotal: Number(subtotal),
      totalAmount: Math.max(
        0,
        Number(subtotal) + Number(shippingFee ?? 0) - validatedDiscount,
      ),
      note,
    });

    await ensureInitialShipmentForOrder(order, "order_create");

    if (normalizedVoucherCode) {
      await markVoucherUsed(normalizedVoucherCode);
    }

    // Giảm stock sau khi đặt hàng thành công
    await Promise.all(
      items.map((item) =>
        Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -Math.max(0, item.quantity) },
        }),
      ),
    );

    return res.status(201).json({
      success: true,
      message: "Đặt hàng thành công",
      data: {
        orderId: order.orderId,
        _id: order._id,
        shipmentIds: order.shipmentIds,
        totalAmount: order.totalAmount,
        subtotal: order.subtotal,
      },
    });
  } catch (err) {
    next(err);
  }
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
    const { status } = req.body;
    const id = req.params.id;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Giá trị cho phép: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId
      ? { $or: [{ _id: id }, { orderId: id }] }
      : { orderId: id };

    const order = await Order.findOne(query);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const previousStatus = String(order.status || "");
    const previousPaymentStatus = String(order.payment?.status || "pending");

    if (previousStatus === status) {
      return res.json({
        success: true,
        message: "Đơn hàng đã ở trạng thái này",
        data: order,
      });
    }

    const allowedNext = ALLOWED_TRANSITIONS[previousStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển từ ${previousStatus} sang ${status}`,
      });
    }

    order.status = status;
    if (status === "delivered") {
      order.payment = order.payment || {};
      order.payment.status = "paid";
      order.deliveredAt = order.deliveredAt || new Date();
    }
    if (status === "returned") {
      await restockOrderItemsIdempotent(order);
    }
    if (status === "refunded") {
      await restockOrderItemsIdempotent(order);
      order.payment = order.payment || {};
      order.payment.status = "refunded";
      order.returnRequest = order.returnRequest || {};
      order.returnRequest.status = "refunded";
      order.returnRequest.reviewedAt =
        order.returnRequest.reviewedAt || new Date();
      order.returnRequest.reviewedBy =
        order.returnRequest.reviewedBy || req.session.userId;
    }
    await order.save();
    await syncShipmentsForOrderStatus(order, {
      actorId: req.session.userId,
      source: "admin_status_update",
      note: `Order status changed to ${status}`,
    });

    const paymentStatus = String(order.payment?.status || "pending");

    await createAuditLog({
      adminId: req.session.userId,
      action: "order.update",
      target: `Order:${order.orderId || order._id}`,
      details: {
        previousStatus,
        nextStatus: order.status,
        previousPaymentStatus,
        nextPaymentStatus: paymentStatus,
      },
      ip: req.ip,
    });

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
      paymentStatus,
      previousStatus,
      previousPaymentStatus,
      updatedAt: order.updatedAt,
      source: "admin",
    });

    return res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/cancel  (auth: owner or admin)
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId
      ? { $or: [{ _id: id }, { orderId: id }] }
      : { orderId: id };

    const order = await Order.findOne(query);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng" });
    }

    const isOwner = order.userId.toString() === req.session.userId;
    const isAdmin = req.session.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "KhÃ´ng cÃ³ quyá»n thá»±c hiá»‡n hÃ nh Ä‘á»™ng nÃ y",
      });
    }

    if (order.status === "cancelled") {
      return res.json({
        success: true,
        message: "ÄÆ¡n hÃ ng Ä‘Ã£ á»Ÿ tráº¡ng thÃ¡i há»§y",
        data: order,
      });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Chá»‰ cÃ³ thá»ƒ há»§y Ä‘Æ¡n khi Ä‘ang chá» xÃ¡c nháº­n hoáº·c Ä‘Ã£ xÃ¡c nháº­n",
      });
    }

    order.status = "cancelled";
    await order.save();
    await syncShipmentsForOrderStatus(order, {
      actorId: req.session.userId,
      source: "order_cancel",
      note: "Order was cancelled",
    });

    await Promise.all(
      order.items.map((item) =>
        Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: Math.max(0, item.quantity) },
        }),
      ),
    );

    return res.json({
      success: true,
      message: "Há»§y Ä‘Æ¡n hÃ ng thÃ nh cÃ´ng",
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/paid  (admin/staff only — route-level guarded)
 * Đánh dấu đơn hàng đã thanh toán thủ công (internal/admin chỉnh sửa).
 * Không còn dùng cho browser owner sau khi VNPay/MoMo redirect.
 * Paid tự động được commit bởi IPN callback trong payment.controller.js.
 */
exports.markOrderPaid = async (req, res, next) => {
  try {
    // route đã được bảo vệ bởi requireBackofficeRole("admin","staff")
    // nhưng vẫn kiểm tra thêm để tránh nhầm lẫn
    const isAdmin =
      req.session.role === "admin" || req.session.role === "staff";
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "Chỉ admin/staff mới có thể cập nhật trạng thái thanh toán thủ công",
      });
    }

    const gateway = String(req.body?.gateway || "").trim();
    const transactionId = String(req.body?.transactionId || "").trim();

    if (!gateway) {
      return res.status(400).json({
        success: false,
        message: "Thiếu gateway (momo | vnpay | cod | ...)",
      });
    }
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message:
          "Thiếu transactionId — không thể đánh dấu paid không có mã giao dịch",
      });
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(req.params.id);
    const query = isObjectId
      ? { $or: [{ _id: req.params.id }, { orderId: req.params.id }] }
      : { orderId: req.params.id };

    const order = await Order.findOne(query);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (order.payment?.status === "paid") {
      return res.json({
        success: true,
        message: "Đơn hàng đã ở trạng thái thanh toán (idempotent)",
        data: order,
      });
    }

    const expectedMethod = String(order.payment?.method || "");
    if (expectedMethod && expectedMethod !== gateway) {
      return res.status(400).json({
        success: false,
        message: `Gateway không khớp: đơn dùng ${expectedMethod}, nhưng nhận ${gateway}`,
      });
    }

    order.payment = order.payment || {};
    order.payment.status = "paid";
    order.payment.gateway = gateway;
    order.payment.transactionId = transactionId;
    order.payment.transactionTime = new Date();
    order.payment.amount = Number(order.totalAmount || 0);
    await order.save();

    console.log(
      JSON.stringify({
        event: "admin.mark_paid",
        gateway,
        orderId: String(order.orderId || ""),
        transactionId,
        adminId: req.session.userId,
        source: "admin_manual",
      }),
    );

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
      paymentStatus: "paid",
      updatedAt: order.updatedAt,
      source: "admin_manual",
    });

    return res.json({
      success: true,
      message: "Cập nhật trạng thái thanh toán thành công",
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/return-request (auth: owner)
 */
exports.requestReturn = async (req, res, next) => {
  try {
    const id = req.params.id;
    const query = buildOrderQuery(id);
    const order = await Order.findOne(query);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const isOwner = String(order.userId) === String(req.session.userId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền yêu cầu trả hàng cho đơn này",
      });
    }

    if (String(order.status) !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể yêu cầu trả hàng khi đơn đã giao",
      });
    }

    if (!isWithinReturnWindow(order)) {
      return res.status(400).json({
        success: false,
        message: `Đơn đã quá thời hạn trả hàng (${RETURN_WINDOW_DAYS} ngày)`,
      });
    }

    const reason = String(req.body?.reason || "").trim();
    const note = String(req.body?.note || "").trim();
    const images = Array.isArray(req.body?.images)
      ? req.body.images.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (reason.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do trả hàng (ít nhất 5 ký tự)",
      });
    }

    order.status = "return_requested";
    order.returnRequest = {
      status: "pending",
      stockRestocked: false,
      requestedAt: new Date(),
      reason,
      note,
      images,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: "",
    };
    await order.save();

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
      paymentStatus: String(order.payment?.status || "pending"),
      updatedAt: order.updatedAt,
      source: "customer_return_request",
    });

    return res.json({
      success: true,
      message: "Đã gửi yêu cầu trả hàng",
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/orders/:id/return-review (admin/staff)
 */
exports.reviewReturnRequest = async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderQuery(req.params.id));
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (String(order.status) !== "return_requested") {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng chưa ở trạng thái chờ duyệt trả hàng",
      });
    }

    const decision = String(req.body?.decision || "")
      .trim()
      .toLowerCase();
    const reviewNote = String(req.body?.reviewNote || "").trim();

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision phải là approve hoặc reject",
      });
    }

    const nextStatus =
      decision === "approve" ? "return_approved" : "return_rejected";
    order.status = nextStatus;
    order.returnRequest = order.returnRequest || {};
    order.returnRequest.status =
      decision === "approve" ? "approved" : "rejected";
    order.returnRequest.reviewedAt = new Date();
    order.returnRequest.reviewedBy = req.session.userId;
    order.returnRequest.reviewNote = reviewNote;
    await order.save();

    await createAuditLog({
      adminId: req.session.userId,
      action: "order.return_review",
      target: `Order:${order.orderId || order._id}`,
      details: {
        decision,
        previousStatus: "return_requested",
        nextStatus,
      },
      ip: req.ip,
    });

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
      paymentStatus: String(order.payment?.status || "pending"),
      updatedAt: order.updatedAt,
      source: "admin_return_review",
    });

    return res.json({
      success: true,
      message: "Đã xử lý yêu cầu trả hàng",
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/refund (admin)
 */
exports.markOrderRefunded = async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderQuery(req.params.id));
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (!["return_approved", "returned"].includes(String(order.status))) {
      return res.status(400).json({
        success: false,
        message: "Chỉ hoàn tiền cho đơn đã duyệt trả hoặc đã nhận hàng trả",
      });
    }

    order.status = "refunded";
    order.payment = order.payment || {};
    order.payment.status = "refunded";
    order.returnRequest = order.returnRequest || {};
    await restockOrderItemsIdempotent(order);
    order.returnRequest.status = "refunded";
    order.returnRequest.reviewedAt =
      order.returnRequest.reviewedAt || new Date();
    order.returnRequest.reviewedBy =
      order.returnRequest.reviewedBy || req.session.userId;
    await order.save();
    await syncShipmentsForOrderStatus(order, {
      actorId: req.session.userId,
      source: "admin_refund",
      note: "Order refunded",
    });

    await createAuditLog({
      adminId: req.session.userId,
      action: "order.refund",
      target: `Order:${order.orderId || order._id}`,
      details: {
        nextStatus: "refunded",
        paymentStatus: "refunded",
      },
      ip: req.ip,
    });

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
      paymentStatus: "refunded",
      updatedAt: order.updatedAt,
      source: "admin_refund",
    });

    return res.json({
      success: true,
      message: "Đã đánh dấu hoàn tiền",
      data: order,
    });
  } catch (err) {
    next(err);
  }
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
    const { orderIds = [], status } = req.body || {};

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách orderIds không hợp lệ",
      });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Giá trị cho phép: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const orders = await Order.find({ orderId: { $in: orderIds } });
    let updatedCount = 0;

    for (const order of orders) {
      const previousStatus = String(order.status || "");
      if (previousStatus === status) continue;
      // Admin force bulk override: bypass strict step-by-step
      // const allowedNext = ALLOWED_TRANSITIONS[previousStatus] || [];
      // if (!allowedNext.includes(status)) continue;

      const previousPaymentStatus = String(order.payment?.status || "pending");
      order.status = status;
      if (status === "delivered") {
        order.payment = order.payment || {};
        order.payment.status = "paid";
        order.deliveredAt = order.deliveredAt || new Date();
      }
      await order.save();
      await syncShipmentsForOrderStatus(order, {
        actorId: req.session.userId,
        source: "admin_bulk_status_update",
        note: `Bulk status changed to ${status}`,
      });
      updatedCount += 1;

      const nextPaymentStatus = String(order.payment?.status || "pending");
      await createAuditLog({
        adminId: req.session.userId,
        action: "order.bulk_update",
        target: `Order:${order.orderId || order._id}`,
        details: {
          previousStatus,
          nextStatus: status,
          previousPaymentStatus,
          nextPaymentStatus,
        },
        ip: req.ip,
      });
    }

    return res.json({
      success: true,
      message: `Đã cập nhật ${updatedCount}/${orderIds.length} đơn hàng`,
      data: { updatedCount, requested: orderIds.length },
    });
  } catch (err) {
    next(err);
  }
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
