"use strict";

const express = require("express");
const router = express.Router();
const adminChatbotCtrl = require("../controllers/adminChatbot.controller");
const {
  requireAuth,
  requireBackofficeRole,
} = require("../middleware/auth.middleware");

// Chỉ admin, staff, audit mới dùng được chatbot admin
router.use(requireAuth, requireBackofficeRole("admin", "staff", "audit"));

router.post("/", adminChatbotCtrl.chat);

module.exports = router;
