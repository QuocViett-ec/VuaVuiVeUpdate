"use strict";

/**
 * payment.controller.js
 * Xử lý thanh toán VNPay Sandbox + MoMo Test
 * CHỈ DÙNG MÔI TRƯỜNG TEST — không dùng cho production
 */

const crypto = require("crypto");
const https = require("https");
const Order = require("../models/Order.model");

// ─── VNPay utilities ──────────────────────────────────────────────────────────

/** Sort object keys (encode keys+values) theo yêu cầu VNPay */
function vnpSortObject(obj) {
  const sorted = {};
  const encodedKeys = Object.keys(obj).map(encodeURIComponent).sort();
  for (const encKey of encodedKeys) {
    const origKey = decodeURIComponent(encKey);
    sorted[encKey] = encodeURIComponent(String(obj[origKey])).replace(
      /%20/g,
      "+",
    );
  }
  return sorted;
}

/** Stringify sorted VNPay params (không encode lại) */
function vnpStringify(sorted) {
  return Object.keys(sorted)
    .map((k) => `${k}=${sorted[k]}`)
    .join("&");
}

// ─── VNPay ────────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/vnpay/create  (auth required)
 * Body: { orderId, amount, bankCode?, language? }
 * Returns: { success, code: "00", data: paymentUrl }
 */
exports.createVNPayUrl = (req, res) => {
  process.env.TZ = "Asia/Ho_Chi_Minh";

  const date = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const createDate =
    date.getFullYear() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds());

  const ipAddr =
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";

  // Credentials — fallback sang sandbox test nếu chưa set .env
  const tmnCode = process.env.VNP_TMN_CODE || "B7MZSRZN";
  const secretKey =
    process.env.VNP_HASH_SECRET || "N6EHMKL4RN3B3JAB7DG75R0U7VMVLKEH";
  const vnpUrl =
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl =
    process.env.VNP_RETURN_URL || "http://localhost:4200/checkout/return";

  const { orderId, amount, bankCode, language = "vn" } = req.body;

  if (!orderId || !amount) {
    return res
      .status(400)
      .json({ success: false, message: "Thiếu orderId hoặc amount" });
  }

  let vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: language || "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: orderId,
    vnp_OrderInfo: "Thanh toan don hang " + orderId,
    vnp_OrderType: "other",
    vnp_Amount: Math.round(Number(amount)) * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  if (bankCode) vnp_Params.vnp_BankCode = bankCode;

  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  sorted["vnp_SecureHash"] = signed;
  const paymentUrl = vnpUrl + "?" + vnpStringify(sorted);

  return res.json({ success: true, code: "00", data: paymentUrl });
};

/**
 * GET /api/payment/vnpay/return
 * VNPay redirect sau giao dịch → verify HMAC → trả JSON (frontend đã xử lý params trực tiếp)
 */
exports.vnpayReturn = (req, res) => {
  const vnp_Params = { ...req.query };
  const secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  const secretKey =
    process.env.VNP_HASH_SECRET || "N6EHMKL4RN3B3JAB7DG75R0U7VMVLKEH";
  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  if (secureHash !== signed) {
    return res.json({
      success: false,
      code: "97",
      message: "Chữ ký không hợp lệ",
    });
  }

  const code = vnp_Params["vnp_ResponseCode"];
  return res.json({ success: code === "00", code });
};

/**
 * GET /api/payment/vnpay/ipn
 * VNPay server-to-server callback → cập nhật DB
 */
exports.vnpayIPN = async (req, res) => {
  const vnp_Params = { ...req.query };
  const secureHash = vnp_Params["vnp_SecureHash"];
  const orderId = vnp_Params["vnp_TxnRef"];
  const rspCode = vnp_Params["vnp_ResponseCode"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  const secretKey =
    process.env.VNP_HASH_SECRET || "N6EHMKL4RN3B3JAB7DG75R0U7VMVLKEH";
  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  if (secureHash !== signed) {
    return res.json({ RspCode: "97", Message: "Checksum failed" });
  }

  try {
    if (rspCode === "00") {
      await Order.findOneAndUpdate({ orderId }, { "payment.status": "paid" });
    }
    return res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (err) {
    console.error("[VNPay IPN] error:", err.message);
    return res.json({ RspCode: "99", Message: "Internal error" });
  }
};

// ─── MoMo ────────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/momo/create  (auth required)
 * Body: { orderId, amount, orderInfo? }
 * Returns: { success, payUrl }
 */
exports.createMoMoUrl = (req, res) => {
  // Credentials — fallback sang test nếu chưa set .env
  const partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO";
  const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
  const secretKey =
    process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
  const redirectUrl =
    process.env.MOMO_REDIRECT_URL ||
    "http://localhost:4200/checkout/momo-return";
  const ipnUrl =
    process.env.MOMO_IPN_URL ||
    "https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b";

  const {
    orderId,
    amount,
    orderInfo = "Thanh toan don hang VuaVuiVe",
  } = req.body;

  if (!orderId || !amount) {
    return res
      .status(400)
      .json({ success: false, message: "Thiếu orderId hoặc amount" });
  }

  const requestId = partnerCode + Date.now();
  const requestType = "captureWallet";
  const extraData = "";
  const amountStr = String(Math.round(Number(amount)));

  // HMAC-SHA256 raw signature (thứ tự fields cố định theo tài liệu MoMo)
  const rawSignature =
    "accessKey=" +
    accessKey +
    "&amount=" +
    amountStr +
    "&extraData=" +
    extraData +
    "&ipnUrl=" +
    ipnUrl +
    "&orderId=" +
    orderId +
    "&orderInfo=" +
    orderInfo +
    "&partnerCode=" +
    partnerCode +
    "&redirectUrl=" +
    redirectUrl +
    "&requestId=" +
    requestId +
    "&requestType=" +
    requestType;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const requestBody = JSON.stringify({
    partnerCode,
    accessKey,
    requestId,
    amount: amountStr,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: "vi",
  });

  const options = {
    hostname: "test-payment.momo.vn",
    port: 443,
    path: "/v2/gateway/api/create",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
    },
  };

  const momoReq = https.request(options, (momoRes) => {
    let data = "";
    momoRes.on("data", (chunk) => (data += chunk));
    momoRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.payUrl) {
          return res.json({ success: true, payUrl: parsed.payUrl });
        }
        // MoMo trả lỗi — vẫn trả về thông tin để frontend xử lý
        return res.status(400).json({
          success: false,
          message: parsed.message || "MoMo trả về lỗi",
          resultCode: parsed.resultCode,
        });
      } catch {
        return res
          .status(500)
          .json({ success: false, message: "Lỗi parse response MoMo" });
      }
    });
  });

  momoReq.on("error", (err) => {
    console.error("[MoMo] request error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Không kết nối được MoMo: " + err.message,
    });
  });

  momoReq.write(requestBody);
  momoReq.end();
};

/**
 * POST /api/payment/momo/ipn
 * MoMo server-to-server callback → cập nhật DB
 */
exports.momoIPN = async (req, res) => {
  const { orderId, resultCode } = req.body;
  console.log("[MoMo IPN] orderId:", orderId, " resultCode:", resultCode);

  try {
    if (resultCode === 0) {
      await Order.findOneAndUpdate({ orderId }, { "payment.status": "paid" });
    }
    return res.json({ status: 0, message: "success" });
  } catch (err) {
    console.error("[MoMo IPN] error:", err.message);
    return res.status(500).json({ status: 1, message: "Internal error" });
  }
};
