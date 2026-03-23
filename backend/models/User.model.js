"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên không được để trống"],
      trim: true,
      minlength: 2,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^(0[3-9]\d{8})$/, "Số điện thoại không hợp lệ"],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    googleId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: "" },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    address: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["user", "admin", "staff", "audit"],
      default: "user",
    },
    isActive: { type: Boolean, default: true },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    passwordResetOtpHash: { type: String, select: false },
    passwordResetOtpExpires: { type: Date, select: false },
    passwordResetOtpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

// Hash password before save (only for local provider)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
