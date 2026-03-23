"use strict";

const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const User = require("../models/User.model");

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusLabel(status) {
  const labels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
    return_requested: "Yêu cầu hoàn trả",
    return_approved: "Chấp nhận hoàn trả",
    return_rejected: "Từ chối hoàn trả",
    returned: "Đã hoàn trả",
    refunded: "Đã hoàn tiền",
  };
  return labels[status] || status;
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("vi-VN") + "đ";
}

function getHoursDiff(date) {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
}

// ── Intent Detection ─────────────────────────────────────────────────────────
function detectIntent(message) {
  const msg = message.toLowerCase();

  // Tra cứu đơn hàng
  if (/ord-[a-z0-9]+/i.test(message) || /tra.*đơn|mã đơn|tìm đơn|kiểm tra đơn/.test(msg)) {
    const match = message.match(/ORD-[A-Z0-9]+/i);
    return { intent: "lookup_order", orderId: match ? match[0].toUpperCase() : null };
  }

  // Đơn trễ
  if (/trễ|chậm|delay|giao lâu|shipping lâu|đơn trễ/.test(msg)) {
    return { intent: "late_orders" };
  }

  // Nguy cơ cancel
  if (/cancel|hủy|nguy cơ|risk|từ chối/.test(msg)) {
    return { intent: "cancel_risk" };
  }

  // Dashboard / tổng quan
  if (/tổng quan|dashboard|doanh thu|thống kê|báo cáo nhanh|hôm nay/.test(msg)) {
    return { intent: "overview" };
  }

  // Đơn chờ xử lý
  if (/chờ xử lý|pending|xác nhận|xác nhận đơn/.test(msg)) {
    return { intent: "pending_orders" };
  }

  // Sản phẩm sắp hết hàng
  if (/hết hàng|tồn kho|stock|sản phẩm ít|low stock/.test(msg)) {
    return { intent: "low_stock" };
  }

  return { intent: "general" };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleLookupOrder(orderId) {
  if (!orderId) {
    return {
      type: "error",
      message: "⚠️ Vui lòng cung cấp mã đơn hàng (dạng ORD-XXXXXXXX) để tra cứu.",
    };
  }

  const order = await Order.findOne({ orderId: orderId.toUpperCase() })
    .populate("userId", "name email phone")
    .lean();

  if (!order) {
    return {
      type: "not_found",
      message: `❌ Không tìm thấy đơn hàng mã **${orderId}**. Vui lòng kiểm tra lại mã đơn.`,
    };
  }

  const ageHours = getHoursDiff(order.createdAt);
  const ageDays = Math.floor(ageHours / 24);
  const ageLabel = ageDays > 0 ? `${ageDays} ngày ${Math.floor(ageHours % 24)} giờ` : `${Math.floor(ageHours)} giờ`;

  const isLate = order.status === "shipping" && ageHours > 48;
  const isCancelRisk = order.status === "pending" && ageHours > 24;

  let warnings = [];
  if (isLate) warnings.push("⚠️ **Đơn này đang giao nhưng đã quá 48 giờ!** Có thể bị trễ.");
  if (isCancelRisk) warnings.push("⚠️ **Đơn đang chờ xác nhận hơn 24 giờ** - nguy cơ bị hủy cao!");

  const itemsList = order.items
    .map((i) => `  • ${i.productName} × ${i.quantity} = ${formatMoney(i.subtotal)}`)
    .join("\n");

  const customer = order.userId;

  return {
    type: "order_detail",
    message: `📦 **Chi tiết đơn hàng ${order.orderId}**

👤 **Khách hàng:** ${order.delivery?.name || customer?.name || "Không rõ"}
📞 **SĐT:** ${order.delivery?.phone || customer?.phone || "N/A"}
📍 **Địa chỉ:** ${order.delivery?.address || "N/A"}

🛒 **Sản phẩm:**
${itemsList}

💰 **Tổng tiền:** ${formatMoney(order.totalAmount)}
💳 **Thanh toán:** ${order.payment?.method?.toUpperCase() || "COD"} – ${order.payment?.status === "paid" ? "✅ Đã thanh toán" : "⏳ Chưa thanh toán"}
📊 **Trạng thái:** ${statusLabel(order.status)}
🕐 **Thời gian tạo:** ${new Date(order.createdAt).toLocaleString("vi-VN")} (${ageLabel} trước)
${warnings.length > 0 ? "\n" + warnings.join("\n") : ""}`,
  };
}

async function handleLateOrders() {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const lateOrders = await Order.find({
    status: "shipping",
    updatedAt: { $lt: twoDaysAgo },
  })
    .sort({ updatedAt: 1 })
    .limit(10)
    .lean();

  if (lateOrders.length === 0) {
    return {
      type: "success",
      message: "✅ **Không có đơn trễ!** Tất cả đơn đang giao đều trong thời hạn bình thường.",
    };
  }

  const list = lateOrders
    .map((o) => {
      const hours = Math.floor(getHoursDiff(o.updatedAt));
      const days = Math.floor(hours / 24);
      return `  • \`${o.orderId}\` – ${o.delivery?.name || "N/A"} – **${days} ngày ${hours % 24} giờ** chưa cập nhật`;
    })
    .join("\n");

  return {
    type: "late_orders",
    message: `⚠️ **Phát hiện ${lateOrders.length} đơn hàng có dấu hiệu trễ** (đang giao > 48 giờ chưa cập nhật):

${list}

💡 **Khuyến nghị:** Liên hệ xác nhận giao hàng với từng đơn trên để tránh khiếu nại.`,
    count: lateOrders.length,
    orders: lateOrders.map((o) => ({ orderId: o.orderId, name: o.delivery?.name })),
  };
}

async function handleCancelRisk() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const [highRisk, mediumRisk] = await Promise.all([
    Order.find({ status: "pending", createdAt: { $lt: threeDaysAgo } }).limit(5).lean(),
    Order.find({ status: "pending", createdAt: { $lt: oneDayAgo, $gte: threeDaysAgo } }).limit(10).lean(),
  ]);

  if (highRisk.length === 0 && mediumRisk.length === 0) {
    return {
      type: "success",
      message: "✅ **Không có đơn nào có nguy cơ hủy cao!** Tất cả đơn pending đều còn trong thời gian xử lý bình thường.",
    };
  }

  let msg = `🔴 **Phân tích nguy cơ hủy đơn**\n\n`;

  if (highRisk.length > 0) {
    msg += `**🚨 Nguy cơ rất cao (pending > 72 giờ): ${highRisk.length} đơn**\n`;
    highRisk.forEach((o) => {
      const hours = Math.floor(getHoursDiff(o.createdAt));
      msg += `  • \`${o.orderId}\` – ${formatMoney(o.totalAmount)} – **${Math.floor(hours/24)} ngày** chờ\n`;
    });
    msg += "\n";
  }

  if (mediumRisk.length > 0) {
    msg += `**🟡 Nguy cơ trung bình (pending 24-72 giờ): ${mediumRisk.length} đơn**\n`;
    mediumRisk.slice(0, 5).forEach((o) => {
      const hours = Math.floor(getHoursDiff(o.createdAt));
      msg += `  • \`${o.orderId}\` – ${formatMoney(o.totalAmount)} – ${hours} giờ chờ\n`;
    });
    if (mediumRisk.length > 5) msg += `  • ...và ${mediumRisk.length - 5} đơn khác\n`;
  }

  msg += `\n💡 **Hành động khuyến nghị:** Xác nhận hoặc liên hệ khách hàng cho các đơn nguy cơ cao ngay!`;

  return {
    type: "cancel_risk",
    message: msg,
    highRiskCount: highRisk.length,
    mediumRiskCount: mediumRisk.length,
  };
}

async function handleOverview() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    todayOrders,
    monthOrders,
    totalOrders,
    pendingCount,
    shippingCount,
    totalRevenue,
    totalUsers,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "shipping" }),
    Order.aggregate([
      { $match: { status: { $in: ["delivered", "confirmed", "shipping"] }, "payment.status": "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    User.countDocuments({ role: "user" }),
  ]);

  const revenue = totalRevenue[0]?.total || 0;

  return {
    type: "overview",
    message: `📊 **Tổng quan hệ thống – ${now.toLocaleDateString("vi-VN")}**

📅 **Hôm nay:** ${todayOrders} đơn mới
📆 **Tháng này:** ${monthOrders} đơn
📦 **Tổng đơn hàng:** ${totalOrders.toLocaleString("vi-VN")}
⏳ **Đơn chờ xử lý:** ${pendingCount} đơn ${pendingCount > 10 ? "⚠️" : "✅"}
🚚 **Đơn đang giao:** ${shippingCount} đơn
💰 **Doanh thu (đã thanh toán):** ${formatMoney(revenue)}
👥 **Người dùng:** ${totalUsers.toLocaleString("vi-VN")}`,
  };
}

async function handlePendingOrders() {
  const pendingOrders = await Order.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();

  if (pendingOrders.length === 0) {
    return {
      type: "success",
      message: "✅ **Không có đơn nào đang chờ xử lý!** Tuyệt vời!",
    };
  }

  const list = pendingOrders
    .map((o) => {
      const hours = Math.floor(getHoursDiff(o.createdAt));
      return `  • \`${o.orderId}\` – ${o.delivery?.name || "N/A"} – ${formatMoney(o.totalAmount)} – ${hours}h chờ`;
    })
    .join("\n");

  return {
    type: "pending_orders",
    message: `⏳ **Có ${pendingOrders.length} đơn hàng đang chờ xác nhận:**

${list}

💡 Xác nhận đơn sớm để tránh nguy cơ khách hủy đơn!`,
    count: pendingOrders.length,
  };
}

async function handleLowStock() {
  const lowStockProducts = await Product.find({ stock: { $lte: 10 }, isActive: { $ne: false } })
    .sort({ stock: 1 })
    .limit(15)
    .lean();

  if (lowStockProducts.length === 0) {
    return {
      type: "success",
      message: "✅ **Tồn kho ổn định!** Không có sản phẩm nào sắp hết hàng.",
    };
  }

  const list = lowStockProducts
    .map((p) => `  • **${p.name}** – còn **${p.stock}** ${p.unit || "cái"} ${p.stock === 0 ? "🔴 HẾT" : p.stock <= 5 ? "🟠" : "🟡"}`)
    .join("\n");

  return {
    type: "low_stock",
    message: `📉 **${lowStockProducts.length} sản phẩm sắp hết hàng:**

${list}

💡 Nên nhập thêm hàng cho các sản phẩm bôi màu đỏ và cam!`,
    count: lowStockProducts.length,
  };
}

async function handleGeneral(message) {
  return {
    type: "general",
    message: `🤖 **Tôi có thể giúp bạn:**

• 📦 **Tra đơn hàng** – nhập mã ORD-XXXXXXXX hoặc nói "tra đơn [mã]"
• ⚠️ **Đơn trễ** – hỏi "đơn hàng nào đang bị trễ?"
• 🔴 **Nguy cơ cancel** – hỏi "đơn nào có nguy cơ bị hủy?"
• 📊 **Tổng quan** – hỏi "tổng quan hệ thống hôm nay"
• ⏳ **Đơn chờ xử lý** – hỏi "đơn nào đang chờ xác nhận?"
• 📉 **Tồn kho thấp** – hỏi "sản phẩm nào sắp hết hàng?"

Hãy thử hỏi tôi bất kỳ điều gì về đơn hàng!`,
  };
}

// ── Main Controller ──────────────────────────────────────────────────────────

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        message: "Thiếu nội dung tin nhắn",
      });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
    }

    const { intent, orderId } = detectIntent(trimmed);

    let result;
    switch (intent) {
      case "lookup_order":
        result = await handleLookupOrder(orderId);
        break;
      case "late_orders":
        result = await handleLateOrders();
        break;
      case "cancel_risk":
        result = await handleCancelRisk();
        break;
      case "overview":
        result = await handleOverview();
        break;
      case "pending_orders":
        result = await handlePendingOrders();
        break;
      case "low_stock":
        result = await handleLowStock();
        break;
      default:
        result = await handleGeneral(trimmed);
    }

    return res.json({
      success: true,
      intent,
      data: result,
    });
  } catch (err) {
    console.error("[AdminChatbot] Lỗi:", err.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xử lý yêu cầu",
      data: {
        type: "error",
        message: "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.",
      },
    });
  }
};
