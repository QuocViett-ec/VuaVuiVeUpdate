"use strict";
const { priceOrder, assertTransition, shippingFee } = require("../services/order-rules");
const product = { _id: "p1", name: "QA product", price: 50000, stock: 10, isActive: true };

test("server prices ignore supplied prices and aggregate duplicate product lines", () => {
  const result = priceOrder([{ productId: "p1", quantity: 1, price: 1 }, { productId: "p1", quantity: 2 }], [product], "quận 1");
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({ quantity: 3, price: 50000, subtotal: 150000 });
  expect(result.totalAmount).toBe(165000);
  expect(result.discount).toBe(0);
});
test.each([0, -1, 1.5, "2", NaN, 1001])("invalid quantity %s is rejected", (quantity) => {
  expect(() => priceOrder([{ productId: "p1", quantity }], [product], "address")).toThrow();
});
test("combined quantity cannot exceed stock", () => {
  expect(() => priceOrder([{ productId: "p1", quantity: 6 }, { productId: "p1", quantity: 5 }], [product], "address")).toThrow();
});
test("fixed discount cannot consume shipping; freeship starts at 300000", () => {
  const result = priceOrder([{ productId: "p1", quantity: 1 }], [product], "address", { type: "fixed", value: 999999, usedCount: 0 });
  expect(result.totalAmount).toBe(20000);
  expect(shippingFee("quận 1", 299999)).toBe(15000);
  expect(shippingFee("quận 1", 300000)).toBe(0);
});
test("used-up and expired vouchers are rejected", () => {
  for (const voucher of [{ maxUses: 1, usedCount: 1 }, { expiresAt: new Date(0) }]) {
    expect(() => priceOrder([{ productId: "p1", quantity: 1 }], [product], "address", voucher)).toThrow();
  }
});
test("online unpaid shipping and skipped states are rejected", () => {
  expect(() => assertTransition({ status: "confirmed", payment: { method: "momo", status: "pending" } }, "shipping")).toThrow();
  expect(() => assertTransition({ status: "pending", payment: { method: "cod" } }, "delivered")).toThrow();
  expect(() => assertTransition({ status: "returned", payment: { method: "cod", status: "paid" } }, "refunded")).toThrow();
});
