"use strict";

const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User.model");
const { createAuditLog } = require("./user.controller");

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const name = (req.body?.name || "").toString().trim();
    const phone = (req.body?.phone || "").toString().trim();
    const rawEmail = (req.body?.email || "").toString().trim();
    const email = rawEmail ? rawEmail.toLowerCase() : undefined;
    const password = req.body?.password;
    const address = (req.body?.address || "").toString().trim();

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
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Số điện thoại hoặc email đã tồn tại",
      });
    }
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const phone = (req.body?.phone || "").toString().trim();
    const rawEmail = (req.body?.email || "").toString().trim();
    const email = rawEmail ? rawEmail.toLowerCase() : "";
    const password = req.body?.password;

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

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Thông tin đăng nhập không đúng" });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Tài khoản quản trị vui lòng đăng nhập tại cổng admin (http://localhost:4201/auth/login)",
      });
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
 * POST /api/auth/admin/login
 */
exports.adminLogin = async (req, res, next) => {
  try {
    const phone = (req.body?.phone || "").toString().trim();
    const rawEmail = (req.body?.email || "").toString().trim();
    const email = rawEmail ? rawEmail.toLowerCase() : "";
    const password = req.body?.password;

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

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Thông tin đăng nhập không đúng" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không có quyền truy cập cổng quản trị",
      });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.name = user.name;

    await createAuditLog({
      adminId: user._id,
      action: "ADMIN_LOGIN",
      target: `User:${user._id}`,
      details: { phone: user.phone, email: user.email, portal: "admin" },
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: "Đăng nhập quản trị thành công",
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
  const { userId, role } = req.session || {};
  if (role === "admin" && userId) {
    createAuditLog({
      adminId: userId,
      action: "ADMIN_LOGOUT",
      target: `User:${userId}`,
      details: {},
      ip: req.ip,
    });
  }
  req.session.destroy((err) => {
    if (err) return next(err);

    const cookieBaseOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined,
    };

    const activeCookieName =
      req.sessionCookieName ||
      (req.sessionScope === "admin" ? "vvv.admin.sid" : "vvv.customer.sid");

    // Clear active portal cookie and legacy cookie names for backward compatibility.
    [activeCookieName, "vvv.admin.sid", "vvv.customer.sid", "vvv.sid"].forEach(
      (name) => {
        if (!name) return;
        res.clearCookie(name, cookieBaseOptions);
      },
    );

    return res.json({ success: true, message: "Đăng xuất thành công" });
  });
};

/**
 * GET /api/auth/me
 */
exports.me = async (req, res, next) => {
  try {
    const sessionRole = String(req.session?.role || "").toLowerCase();
    const scope = req.sessionScope === "admin" ? "admin" : "customer";
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res
        .status(401)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    const userRole = String(user.role || "").toLowerCase();
    const isRoleMismatch = sessionRole && sessionRole !== userRole;
    const isScopeMismatch =
      (scope === "admin" && userRole !== "admin") ||
      (scope === "customer" && userRole === "admin");

    if (isRoleMismatch || isScopeMismatch) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ với cổng hiện tại",
      });
    }

    if (!sessionRole) {
      req.session.role = userRole;
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
    const currentPassword = req.body?.currentPassword || req.body?.oldPassword;
    const newPassword = req.body?.newPassword;
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
    const phone = (req.body?.phone || "").toString().trim();
    const rawEmail = (req.body?.email || "").toString().trim();
    const email = rawEmail ? rawEmail.toLowerCase() : "";
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

    // Trong thực tế sẽ gửi email/SMS. Không trả token qua API để tránh rờ rỉ bảo mật.
    return res.json({
      success: true,
      message:
        "Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi tới bạn",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/google
 * Đăng nhập / đăng ký bằng Google ID Token
 */
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res
        .status(400)
        .json({ success: false, message: "idToken là bắt buộc" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res
        .status(500)
        .json({ success: false, message: "Google OAuth chưa được cấu hình" });
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        success: false,
        message: "Google token không hợp lệ hoặc đã hết hạn",
      });
    }

    const { sub: googleId, name, email, picture } = payload;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Tài khoản Google không có email" });
    }

    // Tìm user theo googleId trước, rồi email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Tạo user mới từ Google
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        avatar: picture || "",
        provider: "google",
      });
    } else if (!user.googleId) {
      // Tài khoản local đã tồn tại → liên kết với Google
      user.googleId = googleId;
      user.avatar = picture || user.avatar;
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Tài khoản quản trị vui lòng đăng nhập tại cổng admin (http://localhost:4201/auth/login)",
      });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.name = user.name;

    return res.json({
      success: true,
      message: "Đăng nhập Google thành công",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
      },
    });
  } catch (err) {
    next(err);
  }
};
