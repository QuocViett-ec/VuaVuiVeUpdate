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
    return conn;
  } catch (err) {
    const isAuthError =
      Number(err?.code || 0) === 8000 ||
      /bad auth|authentication failed/i.test(String(err?.message || ""));

    if (isAuthError) {
      throw new Error(
        "MongoDB authentication failed. Please verify MONGO_URI username/password and URL encoding.",
      );
    }

    if (retries > 0) {
      console.warn(
        `  Kết nối MongoDB thất bại, thử lại sau ${RETRY_DELAY_MS / 1000}s... (còn ${retries} lần)`,
      );
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    throw new Error(`Không thể kết nối MongoDB: ${err.message}`);
  }
}

module.exports = connectDB;
