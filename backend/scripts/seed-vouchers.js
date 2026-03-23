"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Voucher = require("../models/Voucher.model");

function inDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const VOUCHERS = [
  // Voucher dành cho khách mới tạo tài khoản lần đầu (quản trị theo mã).
  {
    code: "WELCOME10",
    type: "percent",
    value: 10,
    cap: 50000,
    minOrderValue: 150000,
    maxUses: 5000,
    startsAt: new Date(),
    expiresAt: inDays(365),
    isActive: true,
    note: "Ưu đãi cho khách mới đăng ký tài khoản lần đầu",
  },
  {
    code: "WELCOME30K",
    type: "fixed",
    value: 30000,
    cap: 0,
    minOrderValue: 250000,
    maxUses: 3000,
    startsAt: new Date(),
    expiresAt: inDays(365),
    isActive: true,
    note: "Ưu đãi đơn đầu tiên cho tài khoản mới",
  },
  {
    code: "NEWMEMBERFS",
    type: "ship",
    value: 0,
    cap: 0,
    minOrderValue: 99000,
    maxUses: 8000,
    startsAt: new Date(),
    expiresAt: inDays(365),
    isActive: true,
    note: "Freeship cho khách hàng mới",
  },

  // Voucher dùng lâu dài với số lượng lớn.
  {
    code: "SAVE5DAILY",
    type: "percent",
    value: 5,
    cap: 25000,
    minOrderValue: 120000,
    maxUses: 500000,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-12-31T23:59:59.000Z"),
    isActive: true,
    note: "Mã giảm hằng ngày dùng lâu dài",
  },
  {
    code: "FREESHIPPLUS",
    type: "ship",
    value: 0,
    cap: 0,
    minOrderValue: 149000,
    maxUses: 500000,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-12-31T23:59:59.000Z"),
    isActive: true,
    note: "Mã freeship dùng lâu dài",
  },
  {
    code: "BIGSAVE50K",
    type: "fixed",
    value: 50000,
    cap: 0,
    minOrderValue: 450000,
    maxUses: 200000,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-12-31T23:59:59.000Z"),
    isActive: true,
    note: "Mã giảm cố định số lượng lớn, dùng lâu dài",
  },
];

async function seedVouchers() {
  if (!process.env.MONGO_URI) {
    throw new Error("Thiếu biến môi trường MONGO_URI");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB kết nối thành công");

  let created = 0;
  let updated = 0;

  for (const voucher of VOUCHERS) {
    const payload = {
      ...voucher,
      code: String(voucher.code || "")
        .trim()
        .toUpperCase(),
    };

    const result = await Voucher.updateOne(
      { code: payload.code },
      { $set: payload, $setOnInsert: { usedCount: 0 } },
      { upsert: true },
    );

    if (result.upsertedCount > 0) created += 1;
    else updated += 1;
  }

  console.log(`Seed voucher hoàn tất: tạo mới ${created}, cập nhật ${updated}`);
}

seedVouchers()
  .catch((err) => {
    console.error("Seed voucher thất bại:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
