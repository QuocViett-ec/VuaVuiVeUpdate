"use strict";

const mongoose = require("mongoose");

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectDB(retries = MAX_RETRIES) {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(` MongoDB đã kết nối: ${conn.connection.host}`);
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `  Kết nối MongoDB thất bại, thử lại sau ${RETRY_DELAY_MS / 1000}s... (còn ${retries} lần)`,
      );
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    console.error(" Không thể kết nối MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
