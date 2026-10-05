"use strict";
const crypto = require("crypto");
const Order = require("../models/Order.model");
const { verifyMoMoSignature, isOrderAmountMatched } = require("../controllers/payment.controller");
const { markOrderPaidWithGateway } = require("../services/payment-state");
const fields = ["amount", "extraData", "message", "orderId", "orderInfo", "orderType", "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"];

afterEach(() => jest.restoreAllMocks());

test("actual MoMo helper validates signed payload and rejects modified/missing fields", () => {
  const secret = crypto.randomBytes(32).toString("hex");
  const body = Object.fromEntries(fields.map((field) => [field, "qa"]));
  body.signature = crypto.createHmac("sha256", secret).update(fields.map((field) => `${field}=${body[field]}`).join("&")).digest("hex");
  expect(verifyMoMoSignature(body, secret)).toBe(true);
  expect(verifyMoMoSignature({ ...body, amount: "1" }, secret)).toBe(false);
  expect(verifyMoMoSignature({ ...body, transId: undefined }, secret)).toBe(false);
  expect(verifyMoMoSignature({}, secret)).toBe(false);
});

test("actual amount checker rejects mismatches and zero orders", () => {
  expect(isOrderAmountMatched({ totalAmount: 50000 }, 50000)).toBe(true);
  expect(isOrderAmountMatched({ totalAmount: 50000 }, 1)).toBe(false);
  expect(isOrderAmountMatched({ totalAmount: 0 }, 0)).toBe(false);
});

test("duplicate paid callback does not replace transaction or write again", async () => {
  const update = jest.spyOn(Order, "findOneAndUpdate");
  const order = { _id: "qa", totalAmount: 50000, status: "confirmed", payment: { method: "momo", status: "paid", transactionId: "original" } };
  const result = await markOrderPaidWithGateway(order, { gateway: "momo", transactionId: "duplicate", amount: 50000 });
  expect(result.updated).toBe(false);
  expect(order.payment.transactionId).toBe("original");
  expect(update).not.toHaveBeenCalled();
});

test("successful payment uses conditional atomic update; late payment does not reopen cancelled order", async () => {
  const order = { _id: "qa", totalAmount: 50000, status: "cancelled", payment: { method: "momo", status: "pending" } };
  const next = { ...order, payment: { ...order.payment, status: "paid", transactionId: "qa-transaction" } };
  const update = jest.spyOn(Order, "findOneAndUpdate").mockResolvedValue({ toObject: () => next });
  await markOrderPaidWithGateway(order, { gateway: "momo", transactionId: "qa-transaction", amount: 50000 });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled", "payment.status": "pending" }), expect.any(Object), expect.any(Object));
  expect(update.mock.calls[0][1].$set.status).toBeUndefined();
  expect(order.status).toBe("cancelled");
  expect(order.payment.status).toBe("paid");
});
