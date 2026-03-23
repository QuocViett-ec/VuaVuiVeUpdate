"use strict";

/**
 * tests/payment.test.js
 * Unit tests cho payment hardening logic.
 * Dùng Jest — chạy: npx jest tests/payment.test.js
 *
 * Cài đặt một lần:
 *   cd backend && npm install --save-dev jest
 */

const crypto = require("crypto");

// ─── Inline implementation helpers cần test ──────────────────────────────────
// (tách ra để test không cần require toàn bộ controller với DB deps)

const MOMO_IPN_REQUIRED_FIELDS = [
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

function verifyMoMoIpnSignature(body, secretKey) {
  for (const key of MOMO_IPN_REQUIRED_FIELDS) {
    if (body?.[key] === undefined || body?.[key] === null) {
      return false;
    }
  }
  const rawSignature = MOMO_IPN_REQUIRED_FIELDS
    .map((key) => `${key}=${String(body[key])}`)
    .join("&");
  const signed = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");
  return String(body?.signature || "").toLowerCase() === signed.toLowerCase();
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
  if (order.save) await order.save();
  return { updated: true, order };
}

// ─── Tests: verifyMoMoIpnSignature ───────────────────────────────────────────

const SECRET = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

function makeMomoBody(overrides = {}) {
  const base = {
    accessKey: "F8BBA842ECF85",
    amount: "50000",
    extraData: "",
    message: "Successful.",
    orderId: "ORD-TEST-001",
    orderInfo: "Thanh toan don hang",
    orderType: "momo_wallet",
    partnerCode: "MOMO",
    payType: "qr",
    requestId: "MOMOabc123",
    responseTime: "1700000000000",
    resultCode: "0",
    transId: "3000000001",
  };
  const body = { ...base, ...overrides };

  // Tính chữ ký hợp lệ
  const rawSignature = MOMO_IPN_REQUIRED_FIELDS
    .map((k) => `${k}=${body[k]}`)
    .join("&");
  body.signature = crypto
    .createHmac("sha256", SECRET)
    .update(rawSignature)
    .digest("hex");
  return body;
}

describe("verifyMoMoIpnSignature", () => {
  test("valid body với chữ ký đúng → true", () => {
    const body = makeMomoBody();
    expect(verifyMoMoIpnSignature(body, SECRET)).toBe(true);
  });

  test("chữ ký sai → false", () => {
    const body = makeMomoBody();
    body.signature = "invalidsignature";
    expect(verifyMoMoIpnSignature(body, SECRET)).toBe(false);
  });

  test("field bị thiếu (transId = undefined) → false", () => {
    const body = makeMomoBody();
    delete body.transId;
    expect(verifyMoMoIpnSignature(body, SECRET)).toBe(false);
  });

  test("field null (extraData = null) → false", () => {
    const body = makeMomoBody();
    body.extraData = null;
    expect(verifyMoMoIpnSignature(body, SECRET)).toBe(false);
  });

  test("body rỗng → false", () => {
    expect(verifyMoMoIpnSignature({}, SECRET)).toBe(false);
  });

  test("secret sai → false", () => {
    const body = makeMomoBody();
    expect(verifyMoMoIpnSignature(body, "wrong-secret")).toBe(false);
  });
});

// ─── Tests: isOrderAmountMatched ─────────────────────────────────────────────

describe("isOrderAmountMatched", () => {
  test("chính xác → true", () => {
    expect(isOrderAmountMatched({ totalAmount: 150000 }, 150000)).toBe(true);
  });

  test("làm tròn số lẻ phù hợp → true", () => {
    // Math.round(150000.3) = 150000, Math.round(150000.1) = 150000 → khớp
    expect(isOrderAmountMatched({ totalAmount: 150000.3 }, 150000.1)).toBe(true);
  });

  test("sai số tiền → false", () => {
    expect(isOrderAmountMatched({ totalAmount: 150000 }, 100000)).toBe(false);
  });

  test("amount = 0 → false", () => {
    expect(isOrderAmountMatched({ totalAmount: 150000 }, 0)).toBe(false);
  });

  test("totalAmount = 0 → false", () => {
    expect(isOrderAmountMatched({ totalAmount: 0 }, 0)).toBe(false);
  });

  test("totalAmount undefined → false", () => {
    expect(isOrderAmountMatched({}, 100000)).toBe(false);
  });
});

// ─── Tests: markOrderPaidWithGateway (idempotency) ───────────────────────────

describe("markOrderPaidWithGateway", () => {
  test("lần đầu commit → updated = true, status = paid", async () => {
    const order = { totalAmount: 100000, payment: { status: "pending" }, save: jest.fn() };
    const result = await markOrderPaidWithGateway(order, {
      gateway: "vnpay",
      transactionId: "TXN-001",
      amount: 100000,
    });
    expect(result.updated).toBe(true);
    expect(order.payment.status).toBe("paid");
    expect(order.payment.transactionId).toBe("TXN-001");
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  test("callback trùng (đã paid) → updated = false, không save lại", async () => {
    const order = { totalAmount: 100000, payment: { status: "paid", transactionId: "TXN-001" }, save: jest.fn() };
    const result = await markOrderPaidWithGateway(order, {
      gateway: "vnpay",
      transactionId: "TXN-001",
      amount: 100000,
    });
    expect(result.updated).toBe(false);
    expect(order.save).not.toHaveBeenCalled();
  });

  test("idempotent: transactionId cũ không bị ghi đè", async () => {
    const order = { totalAmount: 100000, payment: { status: "paid", transactionId: "TXN-ORIGINAL" }, save: jest.fn() };
    await markOrderPaidWithGateway(order, { gateway: "vnpay", transactionId: "TXN-NEW", amount: 100000 });
    expect(order.payment.transactionId).toBe("TXN-ORIGINAL"); // không thay đổi
  });
});
