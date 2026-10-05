"use strict";

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered", "returned"],
  delivered: ["return_requested"],
  cancelled: [],
  return_requested: ["return_approved", "return_rejected"],
  return_approved: ["returned"],
  return_rejected: [],
  returned: ["refunded"],
  refunded: [],
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function shippingFee(address, subtotal) {
  const text = String(address || "").toLowerCase();
  if (!text) return 20000;
  if (subtotal >= 300000) return 0;
  if (/q\.\s*\d+|quận|tp\./.test(text)) return 15000;
  if (/h\.\s*|huyện/.test(text)) return 25000;
  return 20000;
}

function priceOrder(items, products, address, voucher) {
  const map = new Map(products.map((p) => [String(p._id), p]));
  const quantities = new Map();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
      fail(400, "Số lượng phải là số nguyên từ 1 đến 1000.");
    }
    const id = String(item.productId);
    quantities.set(id, (quantities.get(id) || 0) + item.quantity);
  }
  const pricedItems = [...quantities].map(([id, quantity]) => {
    const p = map.get(id);
    if (!p || p.isActive === false) fail(400, "Sản phẩm không tồn tại hoặc đang ngưng bán.");
    if (quantity > 1000 || p.stock < quantity) fail(409, "Sản phẩm không đủ tồn kho.");
    if (!Number.isSafeInteger(p.price) || p.price < 0) fail(409, "Giá sản phẩm chưa hợp lệ.");
    return { productId: p._id, productName: p.name, quantity, price: p.price, subtotal: p.price * quantity };
  });
  const subtotal = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isSafeInteger(subtotal)) fail(400, "Tổng tiền vượt giới hạn cho phép.");
  const fee = shippingFee(address, subtotal);
  let discount = 0;
  if (voucher) {
    const now = new Date();
    if (voucher.isActive === false || (voucher.startsAt && now < voucher.startsAt) ||
        (voucher.expiresAt && now > voucher.expiresAt) ||
        (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) ||
        subtotal < voucher.minOrderValue) fail(400, "Voucher không hợp lệ hoặc không đủ điều kiện.");
    if (voucher.type === "ship") discount = fee;
    else if (voucher.type === "fixed") discount = Math.min(subtotal, voucher.value);
    else {
      discount = Math.round(subtotal * Math.min(100, voucher.value) / 100);
      if (voucher.cap > 0) discount = Math.min(discount, voucher.cap);
    }
  }
  return { items: pricedItems, subtotal, shippingFee: fee, discount, totalAmount: subtotal + fee - discount };
}

function assertTransition(order, nextStatus) {
  if (order.status === nextStatus) return;
  if (!TRANSITIONS[order.status]?.includes(nextStatus)) {
    fail(409, `Không thể chuyển từ ${order.status} sang ${nextStatus}.`);
  }
  if (["shipping", "delivered"].includes(nextStatus) && order.payment.method !== "cod" && order.payment.status !== "paid") {
    fail(409, "Đơn thanh toán online chưa được xác nhận đã trả tiền.");
  }
  if (nextStatus === "refunded") fail(400, "Vui lòng dùng thao tác hoàn tiền có bằng chứng.");
  if (order.status === "shipping" && nextStatus === "returned" && order.returnRequest?.status !== "approved") {
    fail(409, "Cần nhận lại toàn bộ kiện giao thất bại trước khi hoàn kho.");
  }
}

module.exports = { TRANSITIONS, fail, shippingFee, priceOrder, assertTransition };
