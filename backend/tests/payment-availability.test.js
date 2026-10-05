"use strict";

const { isPaymentMethodEnabled } = require("../config/payment");
const paymentRouter = require("../routes/payment.routes");
const { createOrder } = require("../controllers/order.controller");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");

const originalFlags = {
  MOMO_ENABLED: process.env.MOMO_ENABLED,
  VNPAY_ENABLED: process.env.VNPAY_ENABLED,
};

beforeEach(() => {
  delete process.env.MOMO_ENABLED;
  delete process.env.VNPAY_ENABLED;
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const [name, value] of Object.entries(originalFlags)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function responseMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

test("COD remains enabled while online gateways default to disabled", () => {
  expect(isPaymentMethodEnabled("cod")).toBe(true);
  expect(isPaymentMethodEnabled("momo")).toBe(false);
  expect(isPaymentMethodEnabled("vnpay")).toBe(false);
});

test.each([
  ["momo", "MOMO_ENABLED"],
  ["vnpay", "VNPAY_ENABLED"],
])("%s can be enabled independently and disabled again", (gateway, flag) => {
  process.env[flag] = "false";
  expect(isPaymentMethodEnabled(gateway)).toBe(false);
  process.env[flag] = "true";
  expect(isPaymentMethodEnabled(gateway)).toBe(true);
  expect(isPaymentMethodEnabled(gateway === "momo" ? "vnpay" : "momo")).toBe(false);
  process.env[flag] = "false";
  expect(isPaymentMethodEnabled(gateway)).toBe(false);
});

test.each([
  ["momo", "MOMO_ENABLED"],
  ["vnpay", "VNPAY_ENABLED"],
])("%s creation route stops before calling its provider when disabled", (gateway, flag) => {
  const route = paymentRouter.stack.find((layer) => layer.route?.path === `/${gateway}/create`).route;
  const gate = route.stack[1].handle;
  const res = responseMock();
  const next = jest.fn();

  gate({}, res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(next).not.toHaveBeenCalled();

  process.env[flag] = "true";
  gate({}, responseMock(), next);
  expect(next).toHaveBeenCalledTimes(1);
});

test.each(["momo", "vnpay"])("new %s orders are rejected before database access", async (gateway) => {
  const create = jest.spyOn(Order, "create");
  const count = jest.spyOn(Product, "countDocuments");
  const res = responseMock();
  const next = jest.fn();

  await createOrder({ body: { payment: { method: gateway }, items: [{}] } }, res, next);

  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  expect(create).not.toHaveBeenCalled();
  expect(count).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test.each([undefined, "cod"])("COD/default order reaches normal item validation (%s)", async (method) => {
  const res = responseMock();
  await createOrder({ body: { payment: method ? { method } : undefined } }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: "Đơn hàng phải có ít nhất một sản phẩm",
  });
});

test("existing callback and IPN routes remain available", () => {
  const paths = paymentRouter.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  expect(paths).toEqual(expect.arrayContaining([
    "/momo/return", "/momo/ipn", "/vnpay/return", "/vnpay/ipn",
  ]));
});
