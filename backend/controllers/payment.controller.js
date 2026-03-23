"use strict";

/**
 * payment.controller.js
 * Xử lý thanh toán VNPay Sandbox + MoMo Test
 * Backend callback/return đã verify là nguồn sự thật duy nhất của payment status.
 * IPN server-to-server là nguồn commit paid chính.
 * Return endpoint commit theo cơ chế idempotent để đồng bộ UI nhanh hơn.
 */

const crypto = require("crypto");
const https = require("https");
const Order = require("../models/Order.model");
const { publishToUser } = require("../services/realtime-bus");

// ─── Structured logging ───────────────────────────────────────────────────────

/**
 * payLog — structured JSON log cho tất cả payment events
 * Fields chuẩn: gateway, orderId, transactionId, resultCode,
 *               signatureValid, amountExpected, amountActual,
 *               idempotentHit, source, event
 */
function payLog(event, fields = {}) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event, ...fields }),
  );
}

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

function shouldPromoteOrderStatusAfterPaid(order) {
  return String(order?.status || "") === "pending";
}

function publishOrderStatusUpdated(order, source) {
  if (!order?.userId) return;
  publishToUser(order.userId, "order.status_updated", {
    orderId: String(order.orderId || ""),
    dbId: String(order._id || ""),
    userId: String(order.userId || ""),
    status: String(order.status || ""),
    paymentStatus: String(order.payment?.status || "pending"),
    updatedAt: order.updatedAt,
    source,
  });
}

async function markOrderPaidWithGateway(order, payload) {
  if (!order.payment) order.payment = {};

  const wasPaid = order.payment.status === "paid";
  const canPromoteStatus = shouldPromoteOrderStatusAfterPaid(order);

  if (wasPaid && !canPromoteStatus) {
    return {
      updated: false,
      order,
      paymentUpdated: false,
      statusUpdated: false,
    };
  }

  if (!wasPaid) {
    order.payment.status = "paid";
    order.payment.gateway = payload.gateway;
    order.payment.transactionId = payload.transactionId || "";
    order.payment.transactionTime = payload.transactionTime || new Date();
    order.payment.amount = Number(payload.amount || order.totalAmount || 0);
    order.payment.gatewayResponse = payload.gatewayResponse || null;
  }

  if (canPromoteStatus) {
    order.status = "confirmed";
  }

  await order.save();

  return {
    updated: true,
    order,
    paymentUpdated: !wasPaid,
    statusUpdated: canPromoteStatus,
  };
}

function getBackendOrigin(req) {
  const configured = process.env.BACKEND_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host") || "localhost:3000";
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function isNonPublicUrl(target) {
  try {
    const parsed = new URL(String(target || ""));
    const hostname = String(parsed.hostname || "").toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return true;
  }
}

const MOMO_SIGNATURE_FIELDS_V2 = [
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

const MOMO_SIGNATURE_FIELDS_V2_WITH_ACCESS_KEY = [
  "accessKey",
  ...MOMO_SIGNATURE_FIELDS_V2,
];

/**
 * MoMo callback/IPN thực tế có thể khác nhau theo phiên bản docs/account:
 * - đa số payload v2 không kèm accessKey
 * - một số payload legacy có accessKey
 *
 * Hàm verify thử cả 2 biến thể và chỉ chấp nhận nếu khớp HMAC.
 */
function verifyMoMoSignature(payload, secretKey, fallbackAccessKey = "") {
  const providedSignature = String(payload?.signature || "").toLowerCase();
  if (!providedSignature) return false;

  const source = { ...payload };
  if (
    (source.accessKey === undefined || source.accessKey === null) &&
    fallbackAccessKey
  ) {
    source.accessKey = fallbackAccessKey;
  }

  const fieldSets = [
    MOMO_SIGNATURE_FIELDS_V2,
    MOMO_SIGNATURE_FIELDS_V2_WITH_ACCESS_KEY,
  ];

  for (const fields of fieldSets) {
    const missingRequiredField = fields.some(
      (key) => source[key] === undefined || source[key] === null,
    );
    if (missingRequiredField) continue;

    const rawSignature = fields
      .map((key) => `${key}=${String(source[key])}`)
      .join("&");

    const signed = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex")
      .toLowerCase();

    if (signed === providedSignature) {
      return true;
    }
  }

  return false;
}

/**
 * requireVNPayConfig — fail-fast nếu VNPay env vars thiếu
 * Gọi ở đầu mỗi VNPay handler để tránh chạy với configs không hợp lệ.
 */
function requireVNPayConfig() {
  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  if (!tmnCode || !secretKey) {
    const missing = [
      !tmnCode && "VNP_TMN_CODE",
      !secretKey && "VNP_HASH_SECRET",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Thiếu cấu hình VNPay bắt buộc: ${missing}`);
  }
  return { tmnCode, secretKey };
}

// ─── VNPay ────────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/vnpay/create  (auth required)
 * Body: { orderId, amount, bankCode?, language? }
 * Returns: { success, code: "00", data: paymentUrl }
 */
exports.createVNPayUrl = async (req, res) => {
  try {
    // Fail fast nếu thiếu cấu hình VNPay
    let vnpConfig;
    try {
      vnpConfig = requireVNPayConfig();
    } catch (cfgErr) {
      payLog("vnpay.create.config_error", { error: cfgErr.message });
      return res.status(500).json({ success: false, message: cfgErr.message });
    }
    const { tmnCode, secretKey } = vnpConfig;

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

    const vnpUrl =
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl =
      process.env.VNP_RETURN_URL ||
      `${process.env.CUSTOMER_PORTAL_BASE || "http://localhost:4200"}/checkout/return`;

    if (process.env.NODE_ENV === "production" && isNonPublicUrl(returnUrl)) {
      return res.status(500).json({
        success: false,
        message: "VNP_RETURN_URL không hợp lệ cho production",
      });
    }

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
      payLog("vnpay.create.amount_mismatch", {
        gateway: "vnpay",
        orderId,
        amountExpected: order.totalAmount,
        amountActual: paymentAmount,
        source: "create",
      });
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    payLog("vnpay.create", {
      gateway: "vnpay",
      orderId,
      amountExpected: paymentAmount,
      source: "create",
    });

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
/**
 * GET /api/payment/vnpay/return
 * VNPay redirect sau giao dịch → verify HMAC → trả JSON cho frontend.
 * Verify chữ ký + cập nhật DB theo cơ chế idempotent.
 * IPN vẫn là nguồn commit chính, return endpoint giúp đồng bộ nhanh trạng thái UI.
 */
exports.vnpayReturn = async (req, res) => {
  // Fail fast nếu thiếu config
  let secretKey;
  try {
    ({ secretKey } = requireVNPayConfig());
  } catch (cfgErr) {
    payLog("vnpay.return.config_error", { error: cfgErr.message });
    return res.status(500).json({ success: false, message: cfgErr.message });
  }

  const vnp_Params = { ...req.query };
  const secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  const code = vnp_Params["vnp_ResponseCode"];
  const orderId = String(vnp_Params["vnp_TxnRef"] || "");
  const transactionId = String(vnp_Params["vnp_TransactionNo"] || "");
  const paidAmount = Math.round(Number(vnp_Params["vnp_Amount"] || 0) / 100);

  if (!secureHash || secureHash !== signed) {
    payLog("vnpay.return.sig_fail", {
      gateway: "vnpay",
      orderId,
      transactionId,
      signatureValid: false,
      source: "return",
    });
    return res.json({
      success: false,
      code: "97",
      message: "Chữ ký không hợp lệ",
    });
  }

  // Bắt buộc có orderId từ vnp_TxnRef (không dùng fallback regex)
  if (!orderId) {
    return res.json({
      success: false,
      code: "01",
      message: "Thiếu vnp_TxnRef — không xác định được mã đơn hàng",
    });
  }

  try {
    const order = await findOrderByOrderId(orderId);
    if (!order) {
      return res.json({
        success: false,
        code: "01",
        message: "Không tìm thấy đơn hàng",
      });
    }

    if (!isOrderAmountMatched(order, paidAmount)) {
      payLog("vnpay.return.amount_mismatch", {
        gateway: "vnpay",
        orderId,
        transactionId,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        signatureValid: true,
        source: "return",
      });
      return res.json({
        success: false,
        code: "04",
        message: "Sai lệch số tiền thanh toán",
      });
    }

    if (!isExpectedGateway(order, "vnpay")) {
      return res.json({
        success: false,
        code: "02",
        message: "Đơn hàng không dùng phương thức VNPay",
      });
    }

    if (code === "00") {
      const { updated } = await markOrderPaidWithGateway(order, {
        gateway: "vnpay",
        transactionId,
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.query,
      });

      if (updated) {
        publishOrderStatusUpdated(order, "vnpay_return");
      }

      payLog("vnpay.return.commit", {
        gateway: "vnpay",
        orderId,
        transactionId,
        resultCode: code,
        signatureValid: true,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        idempotentHit: !updated,
        source: "return",
      });

      return res.json({
        success: true,
        code,
        message: "Thanh toán thành công",
        orderId,
        transactionId,
        amount: paidAmount,
      });
    }

    payLog("vnpay.return.failed", {
      gateway: "vnpay",
      orderId,
      transactionId,
      resultCode: code,
      signatureValid: true,
      amountExpected: order.totalAmount,
      amountActual: paidAmount,
      source: "return",
    });

    return res.json({
      success: false,
      code,
      message: "Thanh toán thất bại",
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
  // Fail fast nếu thiếu config
  let secretKey;
  try {
    ({ secretKey } = requireVNPayConfig());
  } catch (cfgErr) {
    payLog("vnpay.ipn.config_error", { error: cfgErr.message });
    return res.json({ RspCode: "99", Message: cfgErr.message });
  }

  const vnp_Params = { ...req.query };
  const secureHash = vnp_Params["vnp_SecureHash"];
  const hashType = vnp_Params["vnp_SecureHashType"];
  const orderId = String(vnp_Params["vnp_TxnRef"] || "");
  const rspCode = vnp_Params["vnp_ResponseCode"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  // Từ chối hash type không hợp lệ (phải là HmacSHA512 hoặc bỏ trống)
  if (hashType && hashType !== "HmacSHA512") {
    payLog("vnpay.ipn.invalid_hash_type", {
      gateway: "vnpay",
      orderId,
      hashType,
    });
    return res.json({ RspCode: "97", Message: "Invalid hash type" });
  }

  const sorted = vnpSortObject(vnp_Params);
  const signData = vnpStringify(sorted);
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  if (!secureHash || secureHash !== signed) {
    payLog("vnpay.ipn.sig_fail", {
      gateway: "vnpay",
      orderId,
      signatureValid: false,
      source: "ipn",
    });
    return res.json({ RspCode: "97", Message: "Checksum failed" });
  }

  try {
    if (!orderId) {
      return res.json({
        RspCode: "01",
        Message: "Missing orderId (vnp_TxnRef)",
      });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      payLog("vnpay.ipn.order_not_found", {
        gateway: "vnpay",
        orderId,
        source: "ipn",
      });
      return res.json({ RspCode: "01", Message: "Order not found" });
    }
    if (!isExpectedGateway(order, "vnpay")) {
      return res.json({ RspCode: "02", Message: "Gateway mismatch" });
    }

    const rawVnpAmount = Number(vnp_Params["vnp_Amount"] || 0);
    const paidAmount = Math.round(rawVnpAmount / 100);
    if (!isOrderAmountMatched(order, paidAmount)) {
      payLog("vnpay.ipn.amount_mismatch", {
        gateway: "vnpay",
        orderId,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        signatureValid: true,
        source: "ipn",
      });
      return res.json({ RspCode: "04", Message: "Invalid amount" });
    }

    if (rspCode === "00") {
      const transactionId = String(vnp_Params["vnp_TransactionNo"] || "");
      const { updated } = await markOrderPaidWithGateway(order, {
        gateway: "vnpay",
        transactionId,
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.query,
      });
      payLog("vnpay.ipn.commit", {
        gateway: "vnpay",
        orderId,
        transactionId,
        resultCode: rspCode,
        signatureValid: true,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        idempotentHit: !updated,
        source: "ipn",
      });
      if (updated) {
        publishOrderStatusUpdated(order, "vnpay_ipn");
      }
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
    const defaultIpnUrl = `${getBackendOrigin(req)}/api/payment/momo/ipn`;
    const configuredIpnUrl = String(process.env.MOMO_IPN_URL || "").trim();
    const shouldOverrideDevWebhook =
      process.env.NODE_ENV !== "production" &&
      /(?:^|\.)webhook\.site$/i.test(
        (() => {
          try {
            return new URL(configuredIpnUrl).hostname;
          } catch {
            return "";
          }
        })(),
      );
    const ipnUrl =
      configuredIpnUrl && !shouldOverrideDevWebhook
        ? configuredIpnUrl
        : defaultIpnUrl;

    if (shouldOverrideDevWebhook) {
      payLog("momo.create.ipn_override", {
        gateway: "momo",
        source: "create",
        configuredIpnUrl,
        usingIpnUrl: ipnUrl,
        reason: "webhook_site_is_not_backend",
      });
    }

    if (
      process.env.NODE_ENV === "production" &&
      (isNonPublicUrl(redirectUrl) || isNonPublicUrl(ipnUrl))
    ) {
      return res.status(500).json({
        success: false,
        message: "MOMO_REDIRECT_URL/MOMO_IPN_URL không hợp lệ cho production",
      });
    }

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
 * GET /api/payment/momo/return
 * MoMo redirect callback → verify signature + cập nhật DB theo cơ chế idempotent
 */
exports.momoReturn = async (req, res) => {
  const orderId = String(req.query?.orderId || "");
  const transactionId = String(req.query?.transId || "");
  const resultCode = String(req.query?.resultCode || "");
  const paidAmount = Math.round(Number(req.query?.amount || 0));

  try {
    const secretKey = process.env.MOMO_SECRET_KEY;
    const accessKey = process.env.MOMO_ACCESS_KEY || "";

    if (!secretKey) {
      payLog("momo.return.config_error", {
        gateway: "momo",
        orderId,
        error: "missing MOMO_SECRET_KEY",
      });
      return res.status(500).json({
        success: false,
        code: "99",
        message: "Thiếu cấu hình MoMo",
      });
    }

    const returnAlreadyPaidIfAny = async (reason) => {
      if (!orderId) return false;
      const existingOrder = await findOrderByOrderId(orderId);
      if (!existingOrder) return false;
      if (!isExpectedGateway(existingOrder, "momo")) return false;
      if (String(existingOrder.payment?.status || "") !== "paid") return false;

      const { updated } = await markOrderPaidWithGateway(existingOrder, {
        gateway: "momo",
        transactionId:
          transactionId || String(existingOrder.payment?.transactionId || ""),
        transactionTime: existingOrder.payment?.transactionTime || new Date(),
        amount: Number(
          existingOrder.payment?.amount || existingOrder.totalAmount || 0,
        ),
        gatewayResponse: req.query,
      });

      if (updated) {
        publishOrderStatusUpdated(existingOrder, "momo_return");
      }

      payLog("momo.return.already_paid", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        reason,
        source: "return",
      });

      return res.json({
        success: true,
        code: "00",
        message: "Thanh toán thành công",
        orderId: String(existingOrder.orderId || orderId),
        transactionId:
          transactionId || String(existingOrder.payment?.transactionId || ""),
        amount: Number(
          existingOrder.payment?.amount || existingOrder.totalAmount || 0,
        ),
      });
    };

    const sigValid = verifyMoMoSignature(req.query, secretKey, accessKey);
    if (!sigValid) {
      if (await returnAlreadyPaidIfAny("signature_invalid_but_order_paid"))
        return;

      const isDevSigBypassEnabled =
        process.env.NODE_ENV !== "production" &&
        String(process.env.MOMO_DEV_ALLOW_RETURN_SIG_BYPASS || "true") !==
          "false";

      if (isDevSigBypassEnabled && Number(resultCode) === 0 && orderId) {
        const orderForBypass = await findOrderByOrderId(orderId);
        if (
          orderForBypass &&
          isExpectedGateway(orderForBypass, "momo") &&
          isOrderAmountMatched(orderForBypass, paidAmount)
        ) {
          const { updated } = await markOrderPaidWithGateway(orderForBypass, {
            gateway: "momo",
            transactionId,
            transactionTime: new Date(),
            amount: paidAmount,
            gatewayResponse: req.query,
          });

          if (updated) {
            publishOrderStatusUpdated(orderForBypass, "momo_return_dev_bypass");
          }

          payLog("momo.return.dev_sig_bypass_commit", {
            gateway: "momo",
            orderId,
            transactionId,
            resultCode,
            signatureValid: false,
            amountExpected: orderForBypass.totalAmount,
            amountActual: paidAmount,
            idempotentHit: !updated,
            source: "return",
            queryKeys: Object.keys(req.query || {}).sort(),
          });

          return res.json({
            success: true,
            code: "00",
            message: "Thanh toán thành công",
            orderId,
            transactionId,
            amount: paidAmount,
          });
        }
      }

      payLog("momo.return.sig_fail", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        signatureValid: false,
        amountActual: paidAmount,
        queryKeys: Object.keys(req.query || {}).sort(),
        source: "return",
      });
      return res.json({
        success: false,
        code: "97",
        message: "Chữ ký không hợp lệ",
      });
    }

    if (!orderId) {
      return res.json({
        success: false,
        code: "01",
        message: "Thiếu orderId",
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
    if (!isExpectedGateway(order, "momo")) {
      return res.json({
        success: false,
        code: "02",
        message: "Đơn hàng không dùng phương thức MoMo",
      });
    }

    if (!isOrderAmountMatched(order, paidAmount)) {
      if (await returnAlreadyPaidIfAny("amount_mismatch_but_order_paid"))
        return;

      payLog("momo.return.amount_mismatch", {
        gateway: "momo",
        orderId,
        transactionId,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        signatureValid: true,
        source: "return",
      });
      return res.json({
        success: false,
        code: "04",
        message: "Sai lệch số tiền thanh toán",
      });
    }

    if (Number(resultCode) === 0) {
      const { updated } = await markOrderPaidWithGateway(order, {
        gateway: "momo",
        transactionId,
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.query,
      });

      if (updated) {
        publishOrderStatusUpdated(order, "momo_return");
      }

      payLog("momo.return.commit", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        signatureValid: true,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        idempotentHit: !updated,
        source: "return",
      });

      return res.json({
        success: true,
        code: "00",
        message: "Thanh toán thành công",
        orderId,
        transactionId,
        amount: paidAmount,
      });
    }

    payLog("momo.return.failed", {
      gateway: "momo",
      orderId,
      transactionId,
      resultCode,
      signatureValid: true,
      source: "return",
    });

    if (await returnAlreadyPaidIfAny("result_non_zero_but_order_paid")) return;

    return res.json({
      success: false,
      code: resultCode || "99",
      message: String(req.query?.message || "Thanh toán thất bại"),
      orderId,
      transactionId,
      amount: paidAmount,
    });
  } catch (err) {
    console.error("[MoMo return] error:", err.message);
    return res.status(500).json({
      success: false,
      code: "99",
      message: "Lỗi xử lý callback MoMo",
    });
  }
};

/**
 * POST /api/payment/momo/ipn
 * MoMo server-to-server callback → cập nhật DB
 */
exports.momoIPN = async (req, res) => {
  const { orderId, resultCode } = req.body;
  const transactionId = String(req.body?.transId || "");

  try {
    const secretKey = process.env.MOMO_SECRET_KEY;
    if (!secretKey) {
      payLog("momo.ipn.config_error", {
        gateway: "momo",
        orderId,
        error: "missing MOMO_SECRET_KEY",
      });
      return res
        .status(500)
        .json({ status: 1, message: "missing momo secret" });
    }

    const sigValid = verifyMoMoSignature(
      req.body,
      secretKey,
      process.env.MOMO_ACCESS_KEY || "",
    );
    if (!sigValid) {
      payLog("momo.ipn.sig_fail", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        signatureValid: false,
        source: "ipn",
      });
      return res.status(400).json({ status: 1, message: "invalid signature" });
    }

    const order = await findOrderByOrderId(orderId);
    if (!order) {
      payLog("momo.ipn.order_not_found", {
        gateway: "momo",
        orderId,
        source: "ipn",
      });
      return res.status(404).json({ status: 1, message: "order not found" });
    }
    if (!isExpectedGateway(order, "momo")) {
      return res.status(400).json({ status: 1, message: "gateway mismatch" });
    }

    const paidAmount = Math.round(Number(req.body?.amount || 0));
    if (!isOrderAmountMatched(order, paidAmount)) {
      payLog("momo.ipn.amount_mismatch", {
        gateway: "momo",
        orderId,
        transactionId,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        signatureValid: true,
        source: "ipn",
      });
      return res.status(400).json({ status: 1, message: "invalid amount" });
    }

    if (Number(resultCode) === 0) {
      const { updated } = await markOrderPaidWithGateway(order, {
        gateway: "momo",
        transactionId,
        transactionTime: new Date(),
        amount: paidAmount,
        gatewayResponse: req.body,
      });
      payLog("momo.ipn.commit", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        signatureValid: true,
        amountExpected: order.totalAmount,
        amountActual: paidAmount,
        idempotentHit: !updated,
        source: "ipn",
      });
      if (updated) {
        publishOrderStatusUpdated(order, "momo_ipn");
      }
    } else {
      payLog("momo.ipn.failed", {
        gateway: "momo",
        orderId,
        transactionId,
        resultCode,
        signatureValid: true,
        source: "ipn",
      });
    }
    return res.json({ status: 0, message: "success" });
  } catch (err) {
    console.error("[MoMo IPN] error:", err.message);
    return res.status(500).json({ status: 1, message: "Internal error" });
  }
};
