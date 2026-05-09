# Module 14: API Endpoints Reference (Customer + Admin)

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.vuavuive.vn`

## Headers bắt buộc
```
Content-Type: application/json
X-Portal-Scope: customer   (Customer App)
X-Portal-Scope: admin      (Admin App)
Cookie: vvv.customer.sid / vvv.admin.sid (tự động qua CookieJar)
```

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

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/cart | ✅ |
| POST | /api/cart/sync | ✅ |
| POST | /api/cart/merge | ✅ |
| DELETE | /api/cart | ✅ |

### 4. Orders

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/orders | ✅ |
| GET | /api/orders/me | ✅ |
| GET | /api/orders/:id | ✅ |
| PATCH | /api/orders/:id/cancel | ✅ |
| POST | /api/orders/:id/return-request | ✅ |
| POST | /api/orders/:id/reviews | ✅ |
| GET | /api/orders/:id/reviews/me | ✅ |
| GET | /api/orders/voucher/available | ❌ |
| POST | /api/orders/voucher/validate | ✅ |

### 5. Payment

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/payment/vnpay/create | ✅ |
| GET | /api/payment/vnpay/return | ❌ |
| POST | /api/payment/momo/create | ✅ |
| POST | /api/payment/momo/return | ❌ |

### 6. Shipments

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/shipments/me | ✅ |
| GET | /api/shipments/:id | ✅ |

### 7. Recommendations

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/recommend | ❌ |
| POST | /api/recommend/event | ❌ |
| GET | /api/recommend/similar/:id | ❌ |
| POST | /api/recommend/similar-ml | ❌ |
| GET | /api/recommend/history | ✅ |

### 8. Recipes

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/recipes | ❌ |
| GET | /api/recipes/:id | ❌ |

### 9. Chatbot & Realtime

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/chatbot | ❌ |
| GET | /api/realtime/stream | ✅ |

---

## ADMIN API

> Tất cả admin endpoint yêu cầu `requireAuth` + `requireBackofficeRole("admin","staff","audit")`
> Header: `X-Portal-Scope: admin`

### A1. Admin Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/auth/login | ❌ | Login (role admin/staff/audit) |
| POST | /api/auth/logout | ✅ | Logout |
| GET | /api/auth/me | ✅ | Thông tin admin |

### A2. Admin Orders

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/orders | orders.read | Tất cả đơn hàng (phân trang, filter) |
| PATCH | /api/admin/orders/bulk-status | orders.write | Cập nhật trạng thái hàng loạt |
| GET | /api/admin/orders/export | orders.export | Xuất CSV |
| PATCH | /api/orders/:id/status | orders.write | Cập nhật trạng thái 1 đơn |
| POST | /api/orders/:id/return-review | orders.write | Duyệt/từ chối trả hàng |

### A3. Admin Products

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/products | products.read | Tất cả SP (kể cả inactive) |
| POST | /api/products | products.write | Tạo SP mới |
| PUT | /api/products/:id | products.write | Cập nhật SP |
| DELETE | /api/products/:id | products.write | Xóa SP (soft delete) |
| GET | /api/admin/products/export | products.export | Xuất CSV |

### A4. Admin Users

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users | users.read | Danh sách users |
| GET | /api/users/:id | users.read | Chi tiết user |
| PUT | /api/users/:id/role | users.write | Thay đổi role |
| PUT | /api/users/:id/active | users.write | Vô hiệu hóa/kích hoạt |
| GET | /api/admin/users/export | users.read | Xuất CSV |

### A5. Admin Vouchers

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/vouchers | vouchers.read | Danh sách voucher |
| POST | /api/admin/vouchers | vouchers.write | Tạo voucher |
| PUT | /api/admin/vouchers/:code | vouchers.write | Cập nhật voucher |
| DELETE | /api/admin/vouchers/:code | vouchers.write | Xóa voucher |

### A6. Admin Shipments

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/shipments | shipments.read | Tất cả shipment |
| POST | /api/shipments | shipments.write | Tạo shipment |
| PATCH | /api/shipments/:id/status | shipments.write | Cập nhật trạng thái |

### A7. Admin Chatbot

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/admin-chatbot | ✅ (admin/staff/audit) | Chat hỗ trợ admin |

### A8. Health

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/health | ❌ |

---

## Error Response Format
```json
{ "success": false, "message": "Mô tả lỗi tiếng Việt" }
```

## HTTP Status Codes
200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests, 500 Server Error
