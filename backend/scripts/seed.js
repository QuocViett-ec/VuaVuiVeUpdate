const { fixturePassword } = require("./test-data-guard");
"use strict";

/**
 * Seed script: tạo 1 admin user + toàn bộ sản phẩm thực tế
 * Chạy: node scripts/seed.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");

async function ensureLocalAccount({
  name,
  phone,
  email,
  password,
  role = "user",
  address = "",
}) {
  let account = await User.findOne({ email });

  if (!account && phone) {
    account = await User.findOne({ phone });
  }

  if (!account) {
    await User.create({
      name,
      phone,
      email,
      password,
      address,
      role,
      provider: "local",
      isActive: true,
    });
    account = await User.findOne({ email });
    return { created: true, account };
  }

  account.name = name;
  account.phone = phone;
  account.email = email;
  account.address = address;
  account.role = role;
  account.provider = "local";
  account.isActive = true;
  // Luôn set lại password mẫu để dễ test sau mỗi lần seed
  account.password = password;
  await account.save();
  return { created: false, account };
}

const PRODUCTS = require("./product-fixtures");

const DEMO_CUSTOMERS = [
  {
    name: "Nguyen Minh Chau",
    phone: "0900000001",
    email: "chau.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "12 Nguyen Van Cu, Quan 5, TP.HCM",
  },
  {
    name: "Tran Quoc Bao",
    phone: "0900000002",
    email: "bao.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "81 Le Van Sy, Quan 3, TP.HCM",
  },
  {
    name: "Le Hoai Thu",
    phone: "0900000003",
    email: "thu.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "24 Phan Xich Long, Phu Nhuan, TP.HCM",
  },
  {
    name: "Pham Gia Han",
    phone: "0900000004",
    email: "han.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "56 Cach Mang Thang 8, Quan 10, TP.HCM",
  },
  {
    name: "Vo Duc Khang",
    phone: "0900000005",
    email: "khang.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "102 Quang Trung, Go Vap, TP.HCM",
  },
  {
    name: "Bui Ngoc Anh",
    phone: "0900000006",
    email: "anh.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "35 Xa Lo Ha Noi, Thu Duc, TP.HCM",
  },
  {
    name: "Dang Tuan Kiet",
    phone: "0900000007",
    email: "kiet.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "88 Nguyen Huu Tho, Nha Be, TP.HCM",
  },
  {
    name: "Hoang My Linh",
    phone: "0900000008",
    email: "linh.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "17 Ly Thuong Kiet, Tan Binh, TP.HCM",
  },
  {
    name: "Nguyen Van A",
    phone: "0900000009",
    email: "vana.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "22 Pham Van Dong, Binh Thanh, TP.HCM",
  },
  {
    name: "Le Thi B",
    phone: "0900000010",
    email: "thib.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "15 Nguyen Dinh Chieu, Quan 3, TP.HCM",
  },
  {
    name: "Tran Van C",
    phone: "0900000011",
    email: "vanc.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "99 Huynh Tan Phat, Quan 7, TP.HCM",
  },
  {
    name: "Phan Thi D",
    phone: "0900000012",
    email: "thid.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "12R Truong Chinh, Tan Binh, TP.HCM",
  },
  {
    name: "Doan Van E",
    phone: "0900000013",
    email: "vane.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "7 Nguyen Hue, Quan 1, TP.HCM",
  },
  {
    name: "Vo Thi F",
    phone: "0900000014",
    email: "thif.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "123 Ba Thang Hai, Quan 10, TP.HCM",
  },
  {
    name: "Bui Van G",
    phone: "0900000015",
    email: "vang.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "45 Le Duan, Quan 1, TP.HCM",
  },
  {
    name: "Hoang Thi H",
    phone: "0900000016",
    email: "thih.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "67 Pasteur, Quan 3, TP.HCM",
  },
  {
    name: "Truong Van I",
    phone: "0900000017",
    email: "vani.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "89 Dien Bien Phu, Binh Thanh, TP.HCM",
  },
  {
    name: "Lam Thi K",
    phone: "0900000018",
    email: "thik.demo@vuavuive.vn",
    password: fixturePassword(),
    address: "2 Vo Van Ngan, Thu Duc, TP.HCM",
  },
];

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

  for (let dayOffset = 210; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - dayOffset);

    const monthFactor = SEASONAL_MULTIPLIER[day.getMonth()] ?? 1;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const weekendFactor = isWeekend ? 0.85 : 1.1;
    const recentFactor = dayOffset <= 7 ? 1.6 : dayOffset <= 30 ? 1.25 : 1;
    const rawVolume = monthFactor * weekendFactor * recentFactor;
    const orderCount = Math.max(
      0,
      Math.min(5, Math.round(rawVolume + ((dayOffset * 17) % 4) - 1)),
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
      const paymentMethod =
        PAYMENT_METHODS[(dayOffset + orderIndex) % PAYMENT_METHODS.length];
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
      updatedAt.setHours(
        createdAt.getHours() + (status === "delivered" ? 18 : 4),
      );

      orders.push({
        userId: user._id,
        items,
        delivery: {
          name: user.name,
          phone: user.phone,
          address: user.address || "TP.HCM",
          slot: DELIVERY_SLOTS[
            (dayOffset + orderIndex) % DELIVERY_SLOTS.length
          ],
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

async function seed() {
  try {
    require("./test-data-guard").assertTestDatabase();
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" MongoDB kết nối thành công");

    // Xoá sản phẩm cũ, giữ lại users
    await Order.deleteMany({});
    await Product.deleteMany({});
    console.log("  Đã xóa sản phẩm cũ");

    const adminSeed = {
      name: "Admin VuaVuiVe",
      phone: "0901234567",
      email: "admin@vuavuive.vn",
      password: fixturePassword(),
      role: "admin",
    };

    const userSeed = {
      name: "User Test VuaVuiVe",
      phone: "0912345678",
      email: "user.test@vuavuive.vn",
      password: fixturePassword(),
      role: "user",
      address: "45 Tran Hung Dao, Quan 1, TP.HCM",
    };

    const staffSeed = {
      name: "Nhân Viên VuaVuiVe",
      phone: "0923456789",
      email: "staff@vuavuive.vn",
      password: fixturePassword(),
      role: "staff",
      address: "12 Nguyen Hue, Quan 1, TP.HCM",
    };

    const auditSeed = {
      name: "Kiểm Toán VuaVuiVe",
      phone: "0934567890",
      email: "audit@vuavuive.vn",
      password: fixturePassword(),
      role: "audit",
      address: "88 Le Loi, Quan 1, TP.HCM",
    };

    const adminResult = await ensureLocalAccount(adminSeed);
    const staffResult = await ensureLocalAccount(staffSeed);
    const auditResult = await ensureLocalAccount(auditSeed);
    const userResult = await ensureLocalAccount(userSeed);
    const demoResults = await Promise.all(
      DEMO_CUSTOMERS.map((customer) => ensureLocalAccount(customer)),
    );
    const seededUsers = [
      userResult.account,
      ...demoResults.map((item) => item.account),
    ].filter(Boolean);

    console.log(
      adminResult.created
        ? " Admin tạo mới: admin@vuavuive.vn / [REDACTED]"
        : " Admin đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      staffResult.created
        ? " Staff tạo mới: staff@vuavuive.vn / [REDACTED]"
        : " Staff đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      auditResult.created
        ? " Audit tạo mới: audit@vuavuive.vn / [REDACTED]"
        : " Audit đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      userResult.created
        ? " User test tạo mới: user.test@vuavuive.vn / [REDACTED]"
        : " User test đã được cập nhật lại thông tin đăng nhập mẫu",
    );

    // Xóa _id string trước khi insert để MongoDB tự tạo ObjectId
    // (Lưu externalId để tra cứu)
    let count = 0;
    for (const p of PRODUCTS) {
      const { _id, ...data } = p;
      try {
        await Product.create({ ...data, externalId: _id });
        count++;
      } catch (e) {
        console.warn(`  Bỏ qua "${p.name}": ${e.message}`);
      }
    }
    console.log(` Đã tạo ${count}/${PRODUCTS.length} sản phẩm`);
    console.log("\n Seed hoàn tất!");
  } catch (err) {
    console.error(" Lỗi khi seed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
