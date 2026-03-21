"use strict";

const Voucher = require("../models/Voucher.model");
const { createAuditLog } = require("./user.controller");

function normalizeCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase();
}

function startOfDay(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calcDaysLeft(expiresAt) {
  const end = startOfDay(expiresAt);
  if (!end) return null;
  const now = startOfDay(new Date());
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function isVoucherValid(voucher, now = new Date()) {
  if (!voucher || voucher.isActive === false) return false;
  if (voucher.startsAt && now < voucher.startsAt) return false;
  if (voucher.expiresAt && now > voucher.expiresAt) return false;
  if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) return false;
  return true;
}

exports.listVouchers = async (req, res, next) => {
  try {
    const { q = "", status = "all", page = 1, limit = 30 } = req.query;
    const filter = {};
    if (q) filter.code = { $regex: String(q).trim(), $options: "i" };
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      Voucher.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Voucher.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createVoucher = async (req, res, next) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mã voucher" });
    }

    const payload = {
      code,
      type: req.body?.type || "percent",
      value: Number(req.body?.value || 0),
      cap: Number(req.body?.cap || 0),
      minOrderValue: Number(req.body?.minOrderValue || 0),
      maxUses: Number(req.body?.maxUses || 0),
      startsAt: req.body?.startsAt || undefined,
      expiresAt: req.body?.expiresAt || undefined,
      isActive: req.body?.isActive !== false,
      note: String(req.body?.note || ""),
    };

    const created = await Voucher.create(payload);

    await createAuditLog({
      adminId: req.session?.userId,
      action: "CREATE_VOUCHER",
      target: `Voucher:${created.code}`,
      details: payload,
      ip: req.ip,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

exports.updateVoucher = async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code || req.body?.code);
    const update = {};
    const fields = [
      "type",
      "value",
      "cap",
      "minOrderValue",
      "maxUses",
      "startsAt",
      "expiresAt",
      "isActive",
      "note",
    ];
    for (const field of fields) {
      if (req.body?.[field] !== undefined) update[field] = req.body[field];
    }

    if (update.value !== undefined) update.value = Number(update.value);
    if (update.cap !== undefined) update.cap = Number(update.cap);
    if (update.minOrderValue !== undefined)
      update.minOrderValue = Number(update.minOrderValue);
    if (update.maxUses !== undefined) update.maxUses = Number(update.maxUses);

    const voucher = await Voucher.findOneAndUpdate({ code }, update, {
      new: true,
      runValidators: true,
    });

    if (!voucher) {
      return res
        .status(404)
        .json({ success: false, message: "Voucher không tồn tại" });
    }

    await createAuditLog({
      adminId: req.session?.userId,
      action: "UPDATE_VOUCHER",
      target: `Voucher:${voucher.code}`,
      details: update,
      ip: req.ip,
    });

    return res.json({ success: true, data: voucher });
  } catch (err) {
    next(err);
  }
};

exports.deleteVoucher = async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code);
    const voucher = await Voucher.findOneAndUpdate(
      { code },
      { isActive: false },
      { new: true },
    );

    if (!voucher) {
      return res
        .status(404)
        .json({ success: false, message: "Voucher không tồn tại" });
    }

    await createAuditLog({
      adminId: req.session?.userId,
      action: "DELETE_VOUCHER",
      target: `Voucher:${voucher.code}`,
      details: { isActive: false },
      ip: req.ip,
    });

    return res.json({ success: true, message: "Đã vô hiệu hóa voucher" });
  } catch (err) {
    next(err);
  }
};

exports.validateVoucher = async ({ code, subtotal = 0, shippingFee = 0 }) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return { ok: false, message: "Bạn chưa nhập mã." };
  }

  const voucher = await Voucher.findOne({ code: normalizedCode }).lean();
  if (!voucher || !isVoucherValid(voucher)) {
    return { ok: false, message: "Mã không hợp lệ hoặc đã hết hạn." };
  }

  const subtotalNumber = Math.max(0, Number(subtotal || 0));
  const shippingNumber = Math.max(0, Number(shippingFee || 0));
  const daysLeft = calcDaysLeft(voucher.expiresAt);
  const nearExpiryWarning =
    daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
      ? `Mã còn hiệu lực ${daysLeft === 0 ? "đến hết hôm nay" : `trong ${daysLeft} ngày`}.`
      : "";

  if (subtotalNumber < Number(voucher.minOrderValue || 0)) {
    return {
      ok: false,
      message: `Đơn hàng chưa đạt tối thiểu ${voucher.minOrderValue || 0}đ để dùng mã.`,
    };
  }

  if (voucher.type === "ship") {
    return {
      ok: true,
      type: "ship",
      value: shippingNumber,
      cap: 0,
      message: "Đã áp dụng freeship.",
      warning: nearExpiryWarning,
      expiresAt: voucher.expiresAt || null,
      daysLeft,
      voucher,
    };
  }

  if (voucher.type === "percent") {
    return {
      ok: true,
      type: "percent",
      value: Number(voucher.value || 0),
      cap: Number(voucher.cap || 0),
      message: `Đã áp dụng giảm ${voucher.value || 0}%.`,
      warning: nearExpiryWarning,
      expiresAt: voucher.expiresAt || null,
      daysLeft,
      voucher,
    };
  }

  return {
    ok: true,
    type: "fixed",
    value: Number(voucher.value || 0),
    cap: 0,
    message: `Đã áp dụng giảm ${voucher.value || 0}đ.`,
    warning: nearExpiryWarning,
    expiresAt: voucher.expiresAt || null,
    daysLeft,
    voucher,
  };
};

exports.markVoucherUsed = async (code) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return;
  await Voucher.findOneAndUpdate(
    { code: normalizedCode },
    { $inc: { usedCount: 1 } },
  );
};
