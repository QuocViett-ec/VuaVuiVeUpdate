# Module 06: User Account (Tài Khoản) — Java

## 1. AccountFragment

```
┌──────────────────────────────┐
│  [Avatar]  Nguyễn Văn A      │
│           user@email.com     │
│           0912345678          │
├──────────────────────────────┤
│  📋 Đơn hàng của tôi    →   │
│  📍 Sổ địa chỉ          →   │
│  🔑 Đổi mật khẩu        →   │
│  🚚 Theo dõi vận chuyển  →   │
│  ⭐ Đánh giá của tôi     →   │
│  🍳 Công thức yêu thích  →   │
├──────────────────────────────┤
│  📞 Liên hệ hỗ trợ      →   │
│  ℹ️  Phiên bản 1.0.0        │
├──────────────────────────────┤
│  🔴 Đăng xuất               │
└──────────────────────────────┘
```

## 2. EditProfileActivity
- EditText: Họ tên, SĐT, Địa chỉ
- API: `PUT /api/auth/profile`

## 3. ChangePasswordActivity
- EditText: MK hiện tại, MK mới, Xác nhận MK mới
- API: `PUT /api/auth/password`
- Google user chưa có MK: nút "Đặt MK" → `POST /api/auth/set-local-password`

## 4. API

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/auth/me | ✅ | Thông tin user |
| PUT | /api/auth/profile | ✅ | Cập nhật hồ sơ |
| PUT | /api/auth/password | ✅ | Đổi MK |
| POST | /api/auth/set-local-password | ✅ | Đặt MK local |
| POST | /api/auth/logout | ✅ | Đăng xuất |
