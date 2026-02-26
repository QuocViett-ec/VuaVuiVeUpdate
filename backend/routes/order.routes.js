"use strict";

const express = require("express");
const router = express.Router();

// Stub — full implementation in Task 5
router.get("/", (req, res) =>
  res.json({ success: true, data: [], message: "Orders API (stub)" }),
);

module.exports = router;
