"use strict";

const express = require("express");
const router = express.Router();

// Stub — full implementation in Task 6
router.get("/", (req, res) =>
  res.json({ success: true, data: [], message: "Users API (stub)" }),
);

module.exports = router;
