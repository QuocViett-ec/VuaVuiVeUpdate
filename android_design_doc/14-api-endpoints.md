# Module 14: API Endpoints Reference (Customer + Admin)

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.vuavuive.vn`

## Headers bắt buộc
```
Content-Type: application/json
X-Portal-Scope: customer   (Customer App)
X-Portal-Scope: admin      (Admin App)
X-Requested-With: XMLHttpRequest   (bắt buộc cho POST/PUT/PATCH/DELETE — CSRF protection)
Cookie: vvv.customer.sid / vvv.admin.sid (tự động qua CookieJar)
```

> **Lưu ý CSRF:** Backend yêu cầu header `X-Requested-With: XMLHttpRequest` cho tất cả state-changing request (POST/PUT/PATCH/DELETE). Nếu thiếu → 403 "CSRF validation failed". Các endpoint sau KHÔNG cần header này: login, register, google, forgot-password, verify-otp, reset-password, momo/ipn.

---

## CUSTOMER API

### 1. Authentication

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/auth/register | ❌ | Đăng ký |
| POST | /api/auth/login | ❌ | Đăng nhập |
| POST | /api/auth/google | ❌ | Google Sign-In |
| POST | /api/auth/logout | ✅ | Đăng xuất |
| GET | /api/auth/me | ✅ | Thông tin user |
| PUT | /api/auth/profile | ✅ | Cập nhật hồ sơ |
| PUT | /api/auth/password | ✅ | Đổi MK |
| POST | /api/auth/set-local-password | ✅ | Đặt MK local |
| POST | /api/auth/forgot-password | ❌ | Gửi OTP |
| POST | /api/auth/verify-otp | ❌ | Xác minh OTP |
| POST | /api/auth/reset-password | ❌ | Reset MK |

### 2. Products

| Method | Endpoint | Auth | Query |
|--------|----------|------|-------|
| GET | /api/products | ❌ | category, search, page, limit, sort |
| GET | /api/products/categories | ❌ | - |
| GET | /api/products/:id | ❌ | ObjectId/slug |
| GET | /api/products/:id/reviews | ❌ | - |

### 3. Cart

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/cart/me | ✅ | Lấy giỏ hàng |
| PUT | /api/cart/me | ✅ | Ghi đè giỏ hàng (sync) |
| POST | /api/cart/me/merge | ✅ | Merge local + server |
| DELETE | /api/cart/me | ✅ | Xóa tất cả |

### 4. Orders

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/orders | ✅ | Tạo đơn hàng |
| GET | /api/orders/me | ✅ | Danh sách đơn (status, page, limit) |
| GET | /api/orders/:id | ✅ | Chi tiết đơn |
| PATCH | /api/orders/:id/cancel | ✅ | Hủy đơn |
| POST | /api/orders/:id/return-request | ✅ | Yêu cầu trả hàng |
| POST | /api/orders/:id/reviews | ✅ | Gửi đánh giá |
| GET | /api/orders/:id/reviews/me | ✅ | Đánh giá của tôi |
| GET | /api/orders/voucher/available | ❌ | Voucher khả dụng |
| POST | /api/orders/voucher/validate | ✅ | Validate voucher |

### 5. Payment

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/payment/vnpay/create | ✅ | Tạo URL VNPay |
| GET | /api/payment/vnpay/return | ❌ | VNPay redirect callback |
| GET | /api/payment/vnpay/ipn | ❌ | VNPay IPN server callback |
| POST | /api/payment/momo/create | ✅ | Tạo URL MoMo |
| GET | /api/payment/momo/return | ❌ | MoMo redirect callback |
| POST | /api/payment/momo/ipn | ❌ | MoMo IPN server callback |

### 6. Shipments (Customer)

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/shipments/me | ✅ |
| GET | /api/shipments/:id | ✅ |

### 7. Recommendations

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/recommend | ❌ | Gợi ý cá nhân |
| POST | /api/recommend/event | ❌ | Ghi nhận event |
| GET | /api/recommend/similar/:id | ❌ | SP tương tự (content-based) |
| POST | /api/recommend/similar-ml | ❌ | SP tương tự (ML model) |
| GET | /api/recommend/history | ✅ | Lịch sử gợi ý |

### 8. Recipes

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/recipes | ❌ |
| GET | /api/recipes/:id | ❌ |

### 9. Chatbot & Realtime

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/chatbot | ❌ | Customer chatbot (Gemini AI) |
| GET | /api/realtime/stream | ✅ | SSE event stream |

---

## ADMIN API

> Tất cả admin endpoint yêu cầu `requireAuth` + `requireBackofficeRole("admin","staff","audit")`
> Header: `X-Portal-Scope: admin`, Cookie: `vvv.admin.sid`

### A1. Admin Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/auth/admin/login | ❌ | Login admin (role admin/staff/audit) |
| POST | /api/auth/logout | ✅ | Logout |
| GET | /api/auth/me | ✅ | Thông tin admin |

### A2. Dashboard Stats

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users/dashboard/stats | dashboard.read | Thống kê tổng quan (đơn, doanh thu, users) |
| GET | /api/users/dashboard/analytics | dashboard.read | Phân tích chi tiết |

### A3. Admin Orders

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/orders | orders.read | Tất cả đơn hàng (phân trang, filter) |
| PATCH | /api/admin/orders/bulk-status | orders.write | Cập nhật trạng thái hàng loạt |
| GET | /api/admin/orders/export | orders.export | Xuất CSV |
| PUT | /api/orders/:id/status | orders.write | Cập nhật trạng thái 1 đơn |
| PUT | /api/orders/:id/return-review | orders.write | Duyệt/từ chối trả hàng |
| PATCH | /api/orders/:id/paid | orders.write | Đánh dấu đã thanh toán |
| PATCH | /api/orders/:id/refund | orders.write | Đánh dấu đã hoàn tiền (chỉ admin) |

### A4. Admin Products

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/products | products.read | Tất cả SP (kể cả inactive) |
| POST | /api/products | products.write | Tạo SP mới (multipart/form-data) |
| PUT | /api/products/:id | products.write | Cập nhật SP (multipart/form-data) |
| DELETE | /api/products/:id | products.write | Xóa SP (soft delete) |
| GET | /api/admin/products/export | products.export | Xuất CSV |

### A5. Admin Users

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users/users | users.read | Danh sách users (admin, audit) |
| GET | /api/users/users/:id | users.read | Chi tiết user |
| PUT | /api/users/users/:id | users.write | Cập nhật user (role, isActive) — chỉ admin |
| DELETE | /api/users/users/:id | users.write | Xóa user — chỉ admin |
| GET | /api/admin/users/export | users.read | Xuất CSV |

### A6. Admin Vouchers

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/vouchers | vouchers.read | Danh sách voucher |
| POST | /api/admin/vouchers | vouchers.write | Tạo voucher |
| PUT | /api/admin/vouchers/:code | vouchers.write | Cập nhật voucher |
| DELETE | /api/admin/vouchers/:code | vouchers.write | Xóa voucher |

### A7. Admin Shipments

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/shipments | orders.read | Tất cả shipment (admin/staff/audit) |
| POST | /api/shipments | orders.write | Tạo shipment (admin/staff) |
| PATCH | /api/shipments/:id | orders.write | Cập nhật shipment (admin/staff) |

### A8. Admin Chatbot

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/admin/chatbot | ✅ (admin/staff/audit) | Chat hỗ trợ admin (intent-based) |

### A9. Audit Logs

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users/audit-logs | audit.read | Danh sách audit logs (admin, audit) |
| POST | /api/users/audit-logs | — (admin only) | Tạo audit log thủ công |

### A10. Recommendation Telemetry

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/recommend/telemetry/sections | ✅ (admin only) | Hiệu quả sections gợi ý |

### A11. Health

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/health | ❌ |

---

## Error Response Format
```json
{ "success": false, "message": "Mô tả lỗi tiếng Việt" }
```

## HTTP Status Codes
200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests, 500 Server Error, 502 Bad Gateway, 504 Gateway Timeout

## Notes
- Payment IPN endpoints (vnpay/ipn, momo/ipn) là server-to-server callback, Android app không cần gọi trực tiếp
- VNPay/MoMo return URLs được intercept bởi WebView trong app
- Admin chatbot mount tại `/api/admin/chatbot` (không phải `/api/admin-chatbot`)
- Shipment permissions dùng `orders.read`/`orders.write` trên backend
