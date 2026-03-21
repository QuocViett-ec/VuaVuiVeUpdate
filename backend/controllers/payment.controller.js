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

async function findOrderByOrderId(orderId) {
  if (!orderId) return null;
  return Order.findOne({ orderId });
}

function canAccessOrderForPayment(order, req) {
  if (!order) return false;
  const userId = String(req.session?.userId || "");
  const ownerId = String(order.userId || "");
  const isAdmin = req.session?.role === "admin";
  return Boolean(ownerId && userId && (ownerId === userId || isAdmin));
}

function isExpectedGateway(order, gateway) {
  const method = String(order?.payment?.method || "");
  return method === gateway;
}

function isOrderAmountMatched(order, amount) {
  const expected = Math.round(Number(order?.totalAmount || 0));
  const actual = Math.round(Number(amount || 0));
  return expected > 0 && actual === expected;
}

async function markOrderPaidWithGateway(order, payload) {
  if (!order.payment) order.payment = {};
  if (order.payment.status === "paid") {
    return { updated: false, order };
  }

  order.payment.status = "paid";
  order.payment.gateway = payload.gateway;
  order.payment.transactionId = payload.transactionId || "";
  order.payment.transactionTime = payload.transactionTime || new Date();
  order.payment.amount = Number(payload.amount || order.totalAmount || 0);
  order.payment.gatewayResponse = payload.gatewayResponse || null;
  await order.save();

  return { updated: true, order };
}

function getBackendOrigin(req) {
  const configured = process.env.BACKEND_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host") || "localhost:3000";
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function verifyMoMoIpnSignature(body, secretKey) {
  const fields = [
    "accessKey",
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
  ];

  const rawSignature = fields
    .map((key) => `${key}=${body?.[key] ?? ""}`)
    .join("&");

  const signed = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  return String(body?.signature || "").toLowerCase() === signed.toLowerCase();
}

// ─── VNPay ────────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/vnpay/create  (auth required)
 * Body: { orderId, amount, bankCode?, language? }
 * Returns: { success, code: "00", data: paymentUrl }
 */
exports.createVNPayUrl = async (req, res) => {
  try {
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
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    // Credentials — fallback sang sandbox test nếu chưa set .env
    const tmnCode = process.env.VNP_TMN_CODE || "TFQUUGXU";
    const secretKey =
      process.env.VNP_HASH_SECRET || "6CWJ6YCV87XZR9J3L6VUYRLZ93UHXEXK";
    const vnpUrl =
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl =
      process.env.VNP_RETURN_URL ||
      `${process.env.CUSTOMER_PORTAL_BASE || "http://localhost:4200"}/checkout/return`;

    const { orderId, amount, bankCode, language = "vn" } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Thiếu orderId" });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (!canAccessOrderForPayment(order, req)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền thanh toán đơn hàng này",
      });
    }
    if (!isExpectedGateway(order, "vnpay")) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng không dùng phương thức VNPay",
      });
    }
    if (order.payment?.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "Đơn hàng đã được thanh toán",
      });
    }

    const paymentAmount = Math.round(Number(order.totalAmount || amount || 0));
    if (!isOrderAmountMatched(order, paymentAmount)) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
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
      vnp_Amount: paymentAmount * 100,
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

    return res.json({
      success: true,
      code: "00",
      paymentUrl,
      data: paymentUrl,
    });
  } catch (err) {
    console.error("[VNPay create] error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Không tạo được link VNPay" });
  }
};

/**
 * GET /api/payment/vnpay/return
 * VNPay redirect sau giao dịch → verify HMAC → trả JSON (frontend đã xử lý params trực tiếp)
 */
exports.vnpayReturn = async (req, res) => {
  const vnp_Params = { ...req.query };
  const secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  const secretKey =
    process.env.VNP_HASH_SECRET || "6CWJ6YCV87XZR9J3L6VUYRLZ93UHXEXK";
  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  if (!secureHash || secureHash !== signed) {
    return res.json({
      success: false,
      code: "97",
      message: "Chữ ký không hợp lệ",
    });
  }

  const code = vnp_Params["vnp_ResponseCode"];
  const orderId = String(vnp_Params["vnp_TxnRef"] || "");
  const transactionId = String(vnp_Params["vnp_TransactionNo"] || "");
  const paidAmount = Math.round(Number(vnp_Params["vnp_Amount"] || 0) / 100);

  try {
    if (!orderId) {
      return res.json({
        success: false,
        code: "01",
        message: "Thiếu mã đơn hàng từ VNPay",
      });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res.json({
        success: false,
        code: "01",
        message: "Không tìm thấy đơn hàng",
      });
    }

    if (!isOrderAmountMatched(order, paidAmount)) {
      return res.json({
        success: false,
        code: "04",
        message: "Sai lệch số tiền thanh toán",
      });
    }

    if (code === "00") {
      await markOrderPaidWithGateway(order, {
        gateway: "vnpay",
        transactionId,
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.query,
      });
    }

    return res.json({
      success: code === "00",
      code,
      message: code === "00" ? "Thanh toán thành công" : "Thanh toán thất bại",
      orderId,
      transactionId,
      amount: paidAmount,
    });
  } catch (err) {
    console.error("[VNPay return] error:", err.message);
    return res.status(500).json({
      success: false,
      code: "99",
      message: "Lỗi xử lý callback VNPay",
    });
  }
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
    process.env.VNP_HASH_SECRET || "6CWJ6YCV87XZR9J3L6VUYRLZ93UHXEXK";
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
    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    const rawVnpAmount = Number(vnp_Params["vnp_Amount"] || 0);
    const paidAmount = Math.round(rawVnpAmount / 100);
    if (!isOrderAmountMatched(order, paidAmount)) {
      return res.json({ RspCode: "04", Message: "Invalid amount" });
    }

    if (rspCode === "00") {
      await markOrderPaidWithGateway(order, {
        gateway: "vnpay",
        transactionId: vnp_Params["vnp_TransactionNo"] || "",
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.query,
      });
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
exports.createMoMoUrl = async (req, res) => {
  try {
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const customerPortal =
      process.env.CUSTOMER_PORTAL_BASE || "http://localhost:4200";
    const redirectUrl =
      process.env.MOMO_REDIRECT_URL || `${customerPortal}/checkout/momo-return`;
    const ipnUrl =
      process.env.MOMO_IPN_URL ||
      `${getBackendOrigin(req)}/api/payment/momo/ipn`;

    if (!partnerCode || !accessKey || !secretKey) {
      return res.status(500).json({
        success: false,
        message:
          "Thiếu cấu hình MOMO_PARTNER_CODE/MOMO_ACCESS_KEY/MOMO_SECRET_KEY",
      });
    }

    const {
      orderId,
      amount,
      orderInfo = "Thanh toan don hang VuaVuiVe",
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Thiếu orderId" });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (!canAccessOrderForPayment(order, req)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền thanh toán đơn hàng này",
      });
    }
    if (!isExpectedGateway(order, "momo")) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng không dùng phương thức MoMo",
      });
    }
    if (order.payment?.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "Đơn hàng đã được thanh toán",
      });
    }

    const paymentAmount = Math.round(Number(order.totalAmount || amount || 0));
    if (!isOrderAmountMatched(order, paymentAmount)) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    const requestId = partnerCode + Date.now();
    const requestType = process.env.MOMO_REQUEST_TYPE || "payWithMethod";
    const extraData = "";
    const amountStr = String(paymentAmount);

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

    const momoEndpoint =
      process.env.MOMO_CREATE_ENDPOINT ||
      process.env.MOMO_ENDPOINT ||
      "https://test-payment.momo.vn/v2/gateway/api/create";
    const momoUrl = new URL(momoEndpoint);
    if (momoUrl.pathname === "/v2/gateway/pay") {
      momoUrl.pathname = "/v2/gateway/api/create";
      momoUrl.search = "";
    }

    const options = {
      hostname: momoUrl.hostname,
      port: Number(momoUrl.port) || 443,
      path: `${momoUrl.pathname}${momoUrl.search || ""}`,
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

          const payUrl = String(parsed.payUrl || "").trim();
          let isValidPayUrl = false;
          if (payUrl) {
            try {
              const parsedPayUrl = new URL(payUrl);
              const allowedHosts = ["test-payment.momo.vn", "payment.momo.vn"];
              isValidPayUrl =
                allowedHosts.includes(parsedPayUrl.hostname) &&
                parsedPayUrl.pathname === "/v2/gateway/pay" &&
                Boolean(parsedPayUrl.search);
            } catch {
              isValidPayUrl = false;
            }
          }

          if (isValidPayUrl) {
            return res.json({
              success: true,
              payUrl,
              paymentUrl: payUrl,
            });
          }

          if (payUrl && !isValidPayUrl) {
            return res.status(400).json({
              success: false,
              message: "MoMo trả về payUrl không hợp lệ",
              resultCode: parsed.resultCode,
            });
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
  } catch (err) {
    console.error("[MoMo create] error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Không tạo được link MoMo" });
  }
};

/**
 * POST /api/payment/momo/ipn
 * MoMo server-to-server callback → cập nhật DB
 */
exports.momoIPN = async (req, res) => {
  const { orderId, resultCode } = req.body;
  console.log("[MoMo IPN] orderId:", orderId, " resultCode:", resultCode);

  try {
    const secretKey = process.env.MOMO_SECRET_KEY;
    if (!secretKey) {
      return res
        .status(500)
        .json({ status: 1, message: "missing momo secret" });
    }
    if (!verifyMoMoIpnSignature(req.body, secretKey)) {
      return res.status(400).json({ status: 1, message: "invalid signature" });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ status: 1, message: "order not found" });
    }

    const paidAmount = Math.round(Number(req.body?.amount || 0));
    if (!isOrderAmountMatched(order, paidAmount)) {
      return res.status(400).json({ status: 1, message: "invalid amount" });
    }

    if (Number(resultCode) === 0) {
      await markOrderPaidWithGateway(order, {
        gateway: "momo",
        transactionId: String(req.body?.transId || ""),
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.body,
      });
    }
    return res.json({ status: 0, message: "success" });
  } catch (err) {
    console.error("[MoMo IPN] error:", err.message);
    return res.status(500).json({ status: 1, message: "Internal error" });
  }
};
