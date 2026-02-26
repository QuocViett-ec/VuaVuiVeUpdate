"use strict";

/**
 * Seed script: tạo 1 admin user + sample products
 * Chạy: node scripts/seed.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Product = require("../models/Product.model");

const SAMPLE_PRODUCTS = [
  {
    name: "Cà rốt tươi",
    price: 12000,
    originalPrice: 15000,
    category: "veg",
    subCategory: "củ",
    description: "Cà rốt tươi ngon, giàu vitamin A",
    stock: 100,
    unit: "kg",
    tags: ["rau củ", "vitamin"],
  },
  {
    name: "Chuối tiêu",
    price: 25000,
    originalPrice: 30000,
    category: "fruit",
    subCategory: "chuối",
    description: "Chuối tiêu chín vàng, ngọt tự nhiên",
    stock: 50,
    unit: "nải",
    tags: ["trái cây", "chuối"],
  },
  {
    name: "Thịt heo ba chỉ",
    price: 120000,
    originalPrice: 140000,
    category: "meat",
    subCategory: "heo",
    description: "Thịt ba chỉ tươi, ít mỡ",
    stock: 30,
    unit: "kg",
    tags: ["thịt", "heo"],
  },
  {
    name: "Nước cam ép",
    price: 35000,
    originalPrice: 40000,
    category: "drink",
    subCategory: "nước trái cây",
    description: "Nước cam ép tươi 100% tự nhiên",
    stock: 200,
    unit: "chai",
    tags: ["đồ uống", "nước trái cây"],
  },
  {
    name: "Gạo ST25",
    price: 85000,
    originalPrice: 95000,
    category: "dry",
    subCategory: "gạo",
    description: "Gạo ST25 thơm ngon, hạt dài",
    stock: 500,
    unit: "kg",
    tags: ["hàng khô", "gạo"],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB kết nối thành công");

    // Xóa dữ liệu cũ
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log("🗑️  Đã xóa dữ liệu cũ");

    // Tạo admin user
    const admin = await User.create({
      name: "Admin VuaVuiVe",
      phone: "0901234567",
      email: "admin@vuavuive.vn",
      password: "Admin@123",
      role: "admin",
    });
    console.log(`👤 Admin: ${admin.email} / Admin@123`);

    // Tạo sample products
    for (const p of SAMPLE_PRODUCTS) {
      await Product.create(p);
    }
    console.log(`📦 Đã tạo ${SAMPLE_PRODUCTS.length} sản phẩm mẫu`);

    console.log("\n✅ Seed hoàn tất!");
  } catch (err) {
    console.error("❌ Lỗi khi seed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
