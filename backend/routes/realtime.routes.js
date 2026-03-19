"use strict";

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { registerClient } = require("../services/realtime-bus");

router.get("/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  // Suggest a less aggressive reconnect cadence on transient failures.
  res.write("retry: 5000\n\n");

  registerClient({
    req,
    res,
    userId: req.session?.userId,
    role: req.session?.role || "user",
  });
});

module.exports = router;
