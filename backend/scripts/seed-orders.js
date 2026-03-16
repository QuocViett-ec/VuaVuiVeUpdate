"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");

const DELIVERY_SLOTS = ["09:00-11:00", "13:00-15:00", "18:00-20:00"];
const PAYMENT_METHODS = ["cod", "vnpay", "momo"];
const SEASONAL_MULTIPLIER = {
  0: 1.15,
  1: 0.92,
  2: 1.0,
  3: 1.08,
  4: 1.16,
  5: 1.22,
  6: 1.35,
  7: 1.32,
  8: 1.18,
  9: 1.26,
  10: 1.42,
  11: 1.55,
};

function monthCampaignNote(monthIndex) {
  const notes = [
    "Tet sale",
    "Nhu cau sau Tet",
    "Mua sam cuoi tuan",
    "Thang rau sach",
    "Khuyen mai combo gia dinh",
    "Mua he trai cay",
    "Mua mua giao nhanh",
    "Back to school",
    "Trung thu",
    "Mua sam cuoi nam",
    "11.11 sale",
    "Noel va Tet Duong lich",
  ];
  return notes[monthIndex] || "";
}

function pickProductsForOrder(allProducts, dayOffset, orderIndex) {
  const itemCount = 1 + ((dayOffset + orderIndex) % 4);
  const start = (dayOffset * 7 + orderIndex * 11) % allProducts.length;
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const product = allProducts[(start + i * 3) % allProducts.length];
    const quantity = 1 + ((dayOffset + orderIndex + i) % 3);
    items.push({
      productId: product._id,
      productName: product.name,
      quantity,
      price: product.price,
      subtotal: product.price * quantity,
    });
  }

  return items;
}

function computeShippingFee(address, subtotal) {
  if (subtotal >= 300000) return 0;
  if (/thu duc|go vap|tan binh|phu nhuan|quan/i.test(address)) return 15000;
  if (/nha be|binh chanh|hoc mon/i.test(address)) return 25000;
  return 20000;
}

function decideOrderStatus(dayOffset, orderIndex) {
  if (dayOffset <= 1) {
    return ["pending", "confirmed", "shipping"][(dayOffset + orderIndex) % 3];
  }
  if (dayOffset <= 5) {
    return ["confirmed", "shipping", "delivered"][(dayOffset + orderIndex) % 3];
  }
  if ((dayOffset + orderIndex) % 11 === 0) return "cancelled";
  return "delivered";
}

function buildDemoOrders(users, products) {
  const now = new Date();
  const orders = [];

  for (let dayOffset = 365; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - dayOffset);

    const monthFactor = SEASONAL_MULTIPLIER[day.getMonth()] ?? 1;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const weekendFactor = isWeekend ? 0.9 : 1.2;
    // Tăng nhẹ volume vào các ngày cuối tháng
    const endOfMonthFactor = day.getDate() > 25 ? 1.3 : 1.0;
    // Nhiều đơn hơn trong 30 ngày gần nhất
    const recentFactor = dayOffset <= 7 ? 2.0 : dayOffset <= 30 ? 1.5 : 1.1;
    
    // Tăng volume cơ bản để biểu đồ nhìn đẹp hơn
    const rawVolume = monthFactor * weekendFactor * endOfMonthFactor * recentFactor * 2.5;
    const orderCount = Math.max(
      1, // Ít nhất 1 đơn mỗi ngày
      Math.min(15, Math.round(rawVolume + ((dayOffset * 17) % 5) - 1)),
    );

    for (let orderIndex = 0; orderIndex < orderCount; orderIndex++) {
      const user = users[(dayOffset + orderIndex * 2) % users.length];
      const items = pickProductsForOrder(products, dayOffset, orderIndex);
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const shippingFee = computeShippingFee(user.address || "", subtotal);
      const voucherCode =
        subtotal > 260000 && (dayOffset + orderIndex) % 5 === 0
          ? "GIAM10"
          : shippingFee > 0 && (dayOffset + orderIndex) % 7 === 0
            ? "FREESHIP"
            : "";
      const discount =
        voucherCode === "GIAM10"
          ? Math.round(subtotal * 0.1)
          : voucherCode === "FREESHIP"
            ? shippingFee
            : 0;
      const totalAmount = Math.max(0, subtotal + shippingFee - discount);
      const status = decideOrderStatus(dayOffset, orderIndex);
      const paymentMethod = PAYMENT_METHODS[(dayOffset + orderIndex) % PAYMENT_METHODS.length];
      const paymentStatus =
        status === "cancelled"
          ? "pending"
          : paymentMethod === "cod" && dayOffset <= 2
            ? "pending"
            : "paid";
      const createdAt = new Date(day);
      createdAt.setHours(8 + ((dayOffset + orderIndex * 3) % 12));
      createdAt.setMinutes((dayOffset * 13 + orderIndex * 19) % 60);
      createdAt.setSeconds((dayOffset * 29 + orderIndex * 7) % 60);

      const updatedAt = new Date(createdAt);
      updatedAt.setHours(createdAt.getHours() + (status === "delivered" ? 18 : 4));

      orders.push({
        userId: user._id,
        items,
        delivery: {
          name: user.name,
          phone: user.phone,
          address: user.address || "TP.HCM",
          slot: DELIVERY_SLOTS[(dayOffset + orderIndex) % DELIVERY_SLOTS.length],
        },
        payment: {
          method: paymentMethod,
          status: paymentStatus,
        },
        voucherCode,
        shippingFee,
        discount,
        subtotal,
        totalAmount,
        status,
        note: monthCampaignNote(createdAt.getMonth()),
        createdAt,
        updatedAt,
      });
    }
  }

  return orders;
}

async function seedOrders() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const users = await User.find({ role: "user", isActive: true }).sort({ createdAt: 1 }).lean();
    const products = await Product.find().sort({ createdAt: 1 }).lean();

    if (!users.length || !products.length) {
      throw new Error("Can seed orders only after users and products are seeded");
    }

    await Order.deleteMany({});
    const orders = buildDemoOrders(users, products);
    await Order.insertMany(orders);

    console.log(`Created ${orders.length} demo orders for dashboard and reports`);
  } catch (err) {
    console.error("Order seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedOrders();
