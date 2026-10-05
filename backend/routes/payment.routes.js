"use strict";

const express = require("express");
const router = express.Router();
const paymentCtrl = require("../controllers/payment.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { isPaymentMethodEnabled } = require("../config/payment");

function requireGatewayEnabled(gateway) {
  return (req, res, next) => {
    if (!isPaymentMethodEnabled(gateway)) {
      return res.status(503).json({
        success: false,
        message: "Phương thức thanh toán này đang tạm ngưng. Vui lòng chọn thanh toán khi nhận hàng.",
      });
    }
    next();
  };
}

// ─── VNPay ───────────────────────────────────────────────────────────────────
// Tạo URL thanh toán VNPay (cần đăng nhập)
router.post("/vnpay/create", requireAuth, requireGatewayEnabled("vnpay"), paymentCtrl.createVNPayUrl);
// VNPay redirect callback (không cần auth — VNPay gọi về)
router.get("/vnpay/return", paymentCtrl.vnpayReturn);
// VNPay IPN server-to-server callback
router.get("/vnpay/ipn", paymentCtrl.vnpayIPN);

// ─── MoMo ────────────────────────────────────────────────────────────────────
// Tạo URL thanh toán MoMo (cần đăng nhập)
router.post("/momo/create", requireAuth, requireGatewayEnabled("momo"), paymentCtrl.createMoMoUrl);
// MoMo redirect callback (verify + idempotent commit)
router.get("/momo/return", paymentCtrl.momoReturn);
// MoMo IPN server-to-server callback
router.post("/momo/ipn", paymentCtrl.momoIPN);

module.exports = router;
