"use strict";

const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const { publishToUser } = require("../services/realtime-bus");

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
];
const CANCELLABLE_STATUSES = ["pending", "confirmed"];

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

    const order = await Order.create({
      userId: req.session.userId,
      items,
      delivery,
      payment,
      voucherCode,
      shippingFee: shippingFee ?? 0,
      discount: discount ?? 0,
      subtotal: Number(subtotal),
      totalAmount: Number(totalAmount),
      note,
    });

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
    const orders = await Order.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: orders });
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

    return res.json({ success: true, data: order });
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

    const order = await Order.findOneAndUpdate(
      query,
      { status },
      { new: true },
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    publishToUser(order.userId, "order.status_updated", {
      orderId: String(order.orderId || ""),
      dbId: String(order._id),
      userId: String(order.userId || ""),
      status: order.status,
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
 * PATCH /api/orders/:id/paid  (auth: owner or admin)
 * Đánh dấu đơn hàng đã thanh toán — được gọi sau khi VNPay/MoMo redirect về frontend
 */
exports.markOrderPaid = async (req, res, next) => {
  try {
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

    const isOwner = order.userId.toString() === req.session.userId;
    const isAdmin = req.session.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền thực hiện hành động này",
      });
    }

    order.payment.status = "paid";
    await order.save();

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
 * GET /api/admin/orders  (admin only)
 * Query: ?status=&page=&limit=
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && VALID_STATUSES.includes(status)) filter.status = status;

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

    return res.json({
      success: true,
      data: orders,
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
