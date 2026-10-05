const { fixturePassword } = require("./test-data-guard");
/**
 * Script tạo user test cho môi trường development
 * Chạy: node scripts/create-test-user.js
 */
"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User.model");

const TEST_USER = {
  name: "User Test",
  email: "user.test@vuavuive.vn",
  phone: "0912345678",
  password: fixturePassword(),
  role: "user",
  address: "123 Đường Test, Quận 1, TP.HCM",
  isActive: true,
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error(" MONGO_URI chưa được set trong .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(" Đã kết nối MongoDB");

  // Xoá user cũ nếu tồn tại (để reset password)
  await User.deleteOne({
    $or: [{ email: TEST_USER.email }, { phone: TEST_USER.phone }],
  });

  const user = await User.create(TEST_USER);
  console.log(" Tạo user test thành công:");
  console.log("Fixture personal data: [REDACTED]");
  console.log("Fixture personal data: [REDACTED]");
  console.log("Fixture personal data: [REDACTED]");
  console.log(`   Role  : ${user.role}`);
  console.log(`   Pass  : [REDACTED]`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(" Lỗi:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
