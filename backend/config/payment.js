"use strict";

// Online gateways stay disabled until explicitly enabled on the backend.
function isPaymentMethodEnabled(method) {
  if (method === "cod") return true;
  const flag = {
    vnpay: "VNPAY_ENABLED",
    momo: "MOMO_ENABLED",
  }[method];
  return !!flag && String(process.env[flag] || "").trim().toLowerCase() === "true";
}

module.exports = { isPaymentMethodEnabled };
