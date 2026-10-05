"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");
const lifecycle = require("../services/order-lifecycle");
const { markOrderPaidWithGateway } = require("../services/payment-state");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const User = require("../models/User.model");
const Shipment = require("../models/Shipment.model");
const Voucher = require("../models/Voucher.model");
const AuditLog = require("../models/AuditLog.model");
const Review = require("../models/Review.model");
const { updateShipment, createShipment } = require("../services/shipment-lifecycle");

const testUri = process.env.MONGO_TEST_URI;
const suite = testUri ? describe : describe.skip;
suite("isolated MongoDB replica-set integration", () => {
  let user, product, server, base, cookie;
  const password = crypto.randomBytes(24).toString("base64url");
  const key = () => crypto.randomUUID();
  const body = () => ({ items: [{ productId: String(product._id), quantity: 1, price: 1 }],
    delivery: { name: "QA fixture", phone: "0900000000", address: "quận 1" },
    payment: { method: "cod", status: "paid" }, subtotal: 1, discount: 999999 });

  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\//.test(testUri)) throw new Error("Integration tests require an explicit loopback MongoDB URI.");
    const dbName = `vvv_qa_${crypto.randomBytes(6).toString("hex")}_test`;
    process.env.MONGO_URI = testUri;
    process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
    await mongoose.connect(testUri, { dbName });
    await Promise.all([Order, Product, User, Shipment, Voucher, AuditLog, Review].map((model) => model.init()));
    const app = require("../server");
    server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}`;
  }, 30000);

  beforeEach(async () => {
    for (const model of [Order, Product, User, Shipment, Voucher, AuditLog, Review]) await model.deleteMany({});
    user = await User.create({ name: "QA fixture", phone: "0900000000", password, role: "user" });
    product = await Product.create({ name: "QA product", slug: key(), price: 50000, stock: 1, category: "veg", isActive: true });
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: user.phone, password }) });
    expect(res.status).toBe(200);
    cookie = res.headers.get("set-cookie").split(";")[0];
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      if (!/^vvv_qa_[a-f0-9]+_test$/.test(mongoose.connection.name)) throw new Error("Refusing unsafe cleanup.");
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  async function postOrder(idempotencyKey, payload = body()) {
    return fetch(`${base}/api/orders`, { method: "POST", headers: {
      "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Idempotency-Key": idempotencyKey, Cookie: cookie,
    }, body: JSON.stringify(payload) });
  }

  async function checkReleaseHealth() {
    const previous = process.env.RELEASE_SHA;
    process.env.RELEASE_SHA = "a".repeat(40);
    try {
      const res = await fetch(`${base}/api/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "ok", revision: "a".repeat(40),
        db: { ready: true }, payments: { momo: false, vnpay: false } });
    } finally {
      if (previous === undefined) delete process.env.RELEASE_SHA;
      else process.env.RELEASE_SHA = previous;
    }
  }

  test("API derives money and pending status from server data", async () => {
    await checkReleaseHealth();
    const res = await postOrder(key()); const result = await res.json();
    expect(res.status).toBe(201);
    expect(result.data).toMatchObject({ subtotal: 50000, discount: 0, totalAmount: 65000, payment: { status: "pending" } });
    expect((await Product.findById(product._id)).stock).toBe(0);
    expect(await Shipment.countDocuments()).toBe(1);
  });

  test("two buyers cannot buy the last unit", async () => {
    const responses = await Promise.all([postOrder(key()), postOrder(key())]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(0);
  });

  test("concurrent retries produce one order and one stock deduction", async () => {
    const id = key();
    const responses = await Promise.all([postOrder(id), postOrder(id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await Order.countDocuments()).toBe(1);
    expect(await Shipment.countDocuments()).toBe(1);
  });

  test("reusing a key for a different request returns conflict", async () => {
    const id = key(); expect((await postOrder(id)).status).toBe(201);
    expect((await postOrder(id, { ...body(), note: "changed" })).status).toBe(409);
  });

  test("shipment failure rolls back stock, order and voucher", async () => {
    const voucher = await Voucher.create({ code: "QA", type: "fixed", value: 1000, maxUses: 1 });
    jest.spyOn(Shipment, "create").mockRejectedValueOnce(new Error("Injected fixture failure"));
    expect((await postOrder(key(), { ...body(), voucherCode: "QA" })).status).toBe(500);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Product.findById(product._id)).stock).toBe(1);
    expect((await Voucher.findById(voucher._id)).usedCount).toBe(0);
  });

  test("concurrent cancellations restock only once", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "user" };
    await Promise.all([lifecycle.transition(order._id, "cancelled", actor, true), lifecycle.transition(order._id, "cancelled", actor, true)]);
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test("locking the user revokes an existing cookie immediately", async () => {
    await User.updateOne({ _id: user._id }, { isActive: false });
    expect((await fetch(`${base}/api/orders/me`, { headers: { Cookie: cookie } })).status).toBe(401);
  });

  test("unpaid expiration releases stock; COD is never expired", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    await Order.updateOne({ _id: order._id }, { paymentExpiresAt: new Date(0) });
    await lifecycle.expireUnpaidOrders();
    expect((await Order.findById(order._id)).status).toBe("pending");
    await Order.updateOne({ _id: order._id }, { "payment.method": "momo", paymentExpiresAt: new Date(0) });
    await lifecycle.expireUnpaidOrders();
    expect((await Order.findById(order._id)).status).toBe("cancelled");
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test("duplicate callback cannot change the accepted transaction", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    await Order.updateOne({ _id: order._id }, { "payment.method": "momo" });
    const first = await Order.findById(order._id); const second = await Order.findById(order._id);
    await Promise.all([first, second].map((o) => markOrderPaidWithGateway(o, { gateway: "momo", transactionId: "qa-transaction", amount: order.totalAmount })));
    expect((await Order.findById(order._id)).payment.transactionId).toBe("qa-transaction");
  });

  test("customer cannot mark an order paid or create a disabled gateway payment", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const headers = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookie };
    const paid = await fetch(`${base}/api/orders/${order._id}/paid`, { method: "PATCH", headers, body: JSON.stringify({ gateway: "cod", transactionId: "fake-receipt" }) });
    expect(paid.status).toBe(403);
    const online = await postOrder(key(), { ...body(), payment: { method: "momo" } });
    expect(online.status).toBe(503);
    expect((await Order.findById(order._id)).payment.status).toBe("pending");
  });

  test("password changes revoke old sessions", async () => {
    const current = await User.findById(user._id).select("+password");
    current.password = crypto.randomBytes(24).toString("base64url");
    await current.save();
    expect((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status).toBe(401);
  });

  test("delivery alone does not mark COD paid; a receipt is required", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "admin" };
    for (const status of ["confirmed", "shipping", "delivered"]) await lifecycle.transition(order._id, status, actor);
    expect((await Order.findById(order._id)).payment.status).toBe("pending");
    await expect(lifecycle.recordCodPayment(order._id, "", actor)).rejects.toMatchObject({ status: 400 });
    await lifecycle.recordCodPayment(order._id, "qa-receipt", actor);
    expect((await Order.findById(order._id)).payment.status).toBe("paid");
  });

  test("returns restock once and refund recording requires matching evidence", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "admin" };
    for (const status of ["confirmed", "shipping", "delivered"]) await lifecycle.transition(order._id, status, actor);
    await lifecycle.recordCodPayment(order._id, "qa-receipt", actor);
    for (const status of ["return_requested", "return_approved", "returned"]) await lifecycle.transition(order._id, status, actor);
    await lifecycle.transition(order._id, "returned", actor);
    expect((await Product.findById(product._id)).stock).toBe(1);
    const evidence = { amount: order.totalAmount, reference: "qa-refund-evidence", note: "Verified synthetic refund evidence" };
    await expect(lifecycle.refund(order._id, { ...evidence, amount: 1 }, actor)).rejects.toMatchObject({ status: 400 });
    await lifecycle.refund(order._id, evidence, actor);
    await lifecycle.refund(order._id, evidence, actor);
    expect(await AuditLog.countDocuments({ action: "order.refund_recorded" })).toBe(1);
    expect((await Order.findById(order._id)).payment.status).toBe("refunded");
  });

  test("COD collection can be reconciled after return request without changing order status", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "admin" };
    for (const status of ["confirmed", "shipping", "delivered", "return_requested"]) await lifecycle.transition(order._id, status, actor);
    await lifecycle.recordCodPayment(order._id, "qa-late-cod-receipt", actor);
    expect((await Order.findById(order._id))).toMatchObject({ status: "return_requested", payment: { status: "paid" } });
  });

  test("a delivered package does not deliver other packages or mark payment paid", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "admin" };
    await lifecycle.transition(order._id, "confirmed", actor);
    const second = await createShipment({ orderId: order._id }, actor);
    for (const status of ["picked", "packed", "in_transit", "delivered"]) {
      await updateShipment({ _id: order.shipmentIds[0] }, { currentStatus: status }, actor);
    }
    expect((await Order.findById(order._id)).status).toBe("shipping");
    expect((await Shipment.findById(second._id)).currentStatus).toBe("pending");
    for (const status of ["picked", "packed", "in_transit", "delivered"]) await updateShipment({ _id: second._id }, { currentStatus: status }, actor);
    expect((await Order.findById(order._id)).status).toBe("delivered");
    expect((await Order.findById(order._id)).payment.status).toBe("pending");
  });

  test("voucher capacity is atomic between simultaneous buyers", async () => {
    await Product.updateOne({ _id: product._id }, { stock: 2 });
    const voucher = await Voucher.create({ code: "QA", type: "fixed", value: 1000, maxUses: 1 });
    const responses = await Promise.all([postOrder(key(), { ...body(), voucherCode: "QA" }), postOrder(key(), { ...body(), voucherCode: "QA" })]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await Voucher.findById(voucher._id)).usedCount).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test("failed delivery restocks only after the package is received back", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    const actor = { userId: user._id, role: "admin" };
    await lifecycle.transition(order._id, "confirmed", actor);
    for (const status of ["picked", "packed", "in_transit", "failed"]) await updateShipment({ _id: order.shipmentIds[0] }, { currentStatus: status }, actor);
    expect((await Product.findById(product._id)).stock).toBe(0);
    await expect(lifecycle.transition(order._id, "returned", actor)).rejects.toMatchObject({ status: 409 });
    await updateShipment({ _id: order.shipmentIds[0] }, { currentStatus: "returned" }, actor);
    expect((await Order.findById(order._id)).status).toBe("returned");
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test("catalog does not fabricate ratings or sales", async () => {
    const response = await fetch(`${base}/api/products/${product._id}`);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ rating: 0, reviewCount: 0, soldCount: 0 });
  });

  test("late payment callback preserves cancellation and released stock", async () => {
    const { order } = await lifecycle.createOrder(user._id, body(), key());
    await Order.updateOne({ _id: order._id }, { "payment.method": "momo" });
    await lifecycle.transition(order._id, "cancelled", { userId: user._id, role: "user" }, true);
    const cancelled = await Order.findById(order._id);
    await markOrderPaidWithGateway(cancelled, { gateway: "momo", transactionId: "qa-late-payment", amount: order.totalAmount });
    expect((await Order.findById(order._id))).toMatchObject({ status: "cancelled", payment: { status: "paid" } });
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test("recommendation proxy ignores spoofed identity and replaces stale ML price and stock", async () => {
    const realFetch = global.fetch;
    const upstream = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ recommendations: [{ product_id: String(product._id), price: 1, stock: 999, score: 100, rating: 5 }] }) });
    const response = await realFetch(`${base}/api/recommend`, { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: JSON.stringify({ user_id: "another-user", user_email: "spoof@example.invalid", n: 1 }) });
    expect(response.status).toBe(200);
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({ user_id: String(user._id), n: 1, filter_purchased: true });
    expect((await response.json()).data.recommendations[0]).toMatchObject({ price: 50000, stock: 1, rating: 0, reviewCount: 0 });
  });
});
