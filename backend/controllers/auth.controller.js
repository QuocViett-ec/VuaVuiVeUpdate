"use strict";

const crypto = require("crypto");
const User = require("../models/User.model");

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, phone, email, password, address } = req.body;

    if (!name || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Tên và mật khẩu là bắt buộc" });
    }
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại hoặc email là bắt buộc",
      });
    }

    const existingUser = await User.findOne({
      $or: [phone ? { phone } : null, email ? { email } : null].filter(Boolean),
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Số điện thoại hoặc email đã tồn tại",
      });
    }

    const user = await User.create({ name, phone, email, password, address });

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.name = user.name;

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { phone, email, password } = req.body;

    if (!password || (!phone && !email)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập số điện thoại/email và mật khẩu",
      });
    }

    const query = phone ? { phone } : { email };
    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Thông tin đăng nhập không đúng" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Thông tin đăng nhập không đúng" });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.name = user.name;

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("vvv.sid");
    return res.json({ success: true, message: "Đăng xuất thành công" });
  });
};

/**
 * GET /api/auth/me
 */
exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res
        .status(401)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }
    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { name, phone, address },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }
    req.session.name = user.name;
    return res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới",
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const user = await User.findById(req.session.userId).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Mật khẩu hiện tại không đúng" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp số điện thoại hoặc email",
      });
    }

    const query = phone ? { phone } : { email };
    const user = await User.findOne(query);
    if (!user) {
      // Trả 200 để không leak thông tin
      return res.json({
        success: true,
        message: "Nếu tài khoản tồn tại, token đặt lại mật khẩu đã được tạo",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save({ validateBeforeSave: false });

    // Trong thực tế sẽ gửi email/SMS. Ở đây trả token để test.
    return res.json({
      success: true,
      message: "Token đặt lại mật khẩu đã được tạo",
      data: { resetToken: token },
    });
  } catch (err) {
    next(err);
  }
};
