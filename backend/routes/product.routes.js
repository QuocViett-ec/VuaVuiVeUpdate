"use strict";

const express = require("express");
const router = express.Router();

// Stub — full implementation in Task 4
router.get("/", (req, res) =>
  res.json({ success: true, data: [], message: "Products API (stub)" }),
);

module.exports = router;
