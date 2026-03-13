# Tích hợp Thanh toán — VNPay Sandbox + MoMo Test

> ** MÔI TRƯỜNG TEST ONLY** — Toàn bộ credentials trong tài liệu này chỉ dùng cho mục đích phát triển và kiểm thử, không sử dụng cho production.

---

## Tổng quan kiến trúc

```
Frontend (Angular)              Backend (Express)            Cổng thanh toán
──────────────────              ─────────────────            ────────────────
/checkout                       POST /api/orders
  ├── COD  ─────────────────────── tạo đơn → redirect /orders
  ├── VNPay ───────────────────── POST /api/payment/vnpay/create
  │                                  └── HMAC-SHA512 ──────→ VNPay Sandbox
  │                                                             └─ redirect → /checkout/return
  │                                                                           └── PATCH /api/orders/:id/paid
  │                                                                               └─ navigate /orders
  └── MoMo ────────────────────── POST /api/payment/momo/create
                                     └── HMAC-SHA256 ──────→ MoMo test-payment.momo.vn
                                                               └─ redirect → /checkout/momo-return
                                                                             └── PATCH /api/orders/:id/paid
                                                                                 └─ navigate /orders
```

---

## Test Credentials (sandbox/test)

### VNPay Sandbox

| Tham số           | Giá trị                                              |
| ----------------- | ---------------------------------------------------- |
| `VNP_TMN_CODE`    | `B7MZSRZN`                                           |
| `VNP_HASH_SECRET` | `N6EHMKL4RN3B3JAB7DG75R0U7VMVLKEH`                   |
| `VNP_URL`         | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` |
| `VNP_RETURN_URL`  | `http://localhost:4200/checkout/return`              |

**Thẻ test VNPay:**

- Ngân hàng: NCB
- Số thẻ: `9704198526191432198`
- Tên chủ thẻ: `NGUYEN VAN A`
- Ngày phát hành: `07/15`
- OTP: `123456`

### MoMo Test

| Tham số             | Giá trị                                                     |
| ------------------- | ----------------------------------------------------------- |
| `MOMO_PARTNER_CODE` | `MOMO`                                                      |
| `MOMO_ACCESS_KEY`   | `F8BBA842ECF85`                                             |
| `MOMO_SECRET_KEY`   | `K951B6PE1waDMi640xX08PD3vg6EkVlz`                          |
| `MOMO_REDIRECT_URL` | `http://localhost:4200/checkout/momo-return`                |
| `MOMO_IPN_URL`      | `https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b` |
| Endpoint            | `https://test-payment.momo.vn/v2/gateway/api/create`        |

**Tài khoản test MoMo:** Đăng nhập sandbox tại https://test-payment.momo.vn với tài khoản test do MoMo cung cấp.

---

## Các file đã thêm/sửa

### Backend

| File                                        | Thay đổi                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `backend/controllers/payment.controller.js` | **NEW** — Xử lý tạo URL VNPay & MoMo, IPN callbacks |
| `backend/routes/payment.routes.js`          | **NEW** — Route `/api/payment/*`                    |
| `backend/models/Order.model.js`             | Thêm `'momo'` vào enum `payment.method`             |
| `backend/controllers/order.controller.js`   | Thêm `markOrderPaid` handler                        |
| `backend/routes/order.routes.js`            | Thêm `PATCH /:id/paid`                              |
| `backend/server.js`                         | Mount `/api/payment` routes                         |
| `backend/.env`                              | Thêm VNPay + MoMo test credentials                  |
| `backend/.env.example`                      | Cập nhật template                                   |

### Frontend

| File                                            | Thay đổi                                                   |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `frontend/src/environments/environment.ts`      | Thêm `paymentApi: 'http://localhost:3000/api/payment'`     |
| `frontend/.../checkout-page.component.ts`       | Thêm MoMo option, cập nhật URL `/api/payment/vnpay/create` |
| `frontend/.../checkout-page.component.html`     | Thêm radio button MoMo                                     |
| `frontend/.../vnpay-return-page.component.ts`   | Thêm auto-redirect `/orders` sau 3s                        |
| `frontend/.../vnpay-return-page.component.html` | Hiển thị countdown                                         |
| `frontend/.../momo-return-page.component.ts`    | **NEW** — Xử lý callback từ MoMo                           |
| `frontend/.../momo-return-page.component.html`  | **NEW** — Template kết quả MoMo                            |
| `frontend/.../momo-return-page.component.scss`  | **NEW** — Style MoMo card                                  |
| `frontend/.../checkout.routes.ts`               | Thêm route `momo-return` (lazy-loaded)                     |

---

## Các bước triển khai đã thực hiện

### Bước 1: Cấu hình credentials test

- Thêm `VNP_*` và `MOMO_*` vào `backend/.env`
- Thêm `paymentApi` vào `frontend/src/environments/environment.ts`

### Bước 2: Backend — Payment Controller

- `createVNPayUrl`: Tạo HMAC-SHA512 + build VNPay URL sandbox
- `createMoMoUrl`: Tạo HMAC-SHA256 + gọi `test-payment.momo.vn/v2/gateway/api/create`
- `vnpayIPN` / `momoIPN`: Cập nhật `payment.status = 'paid'` khi success

### Bước 3: Backend — Đánh dấu đơn đã thanh toán

- `markOrderPaid`: `PATCH /api/orders/:id/paid` — kiểm tra owner/admin, set `payment.status = 'paid'`

### Bước 4: Backend — Mount routes

- `/api/payment` → `payment.routes.js`

### Bước 5: Frontend — Checkout flow

- Thêm `paymentMethod = 'momo'` vào checkout form
- VNPay: `fetch POST /api/payment/vnpay/create` → redirect `data.data`
- MoMo: `fetch POST /api/payment/momo/create` → redirect `data.payUrl`

### Bước 6: Frontend — Return pages

- **VNPay return** (`/checkout/return`): verify → `markOrderPaid` → countdown 3s → navigate `/orders`
- **MoMo return** (`/checkout/momo-return`): đọc `resultCode` → `markOrderPaid` nếu `=0` → countdown 3s → navigate `/orders`

---

## API Reference

### POST `/api/payment/vnpay/create` _(auth required)_

```json
// Request
{ "orderId": "ORD-XXXX", "amount": 150000, "bankCode": "", "language": "vn" }

// Response 200
{ "success": true, "code": "00", "data": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..." }
```

### POST `/api/payment/momo/create` _(auth required)_

```json
// Request
{ "orderId": "ORD-XXXX", "amount": 150000 }

// Response 200
{ "success": true, "payUrl": "https://test-payment.momo.vn/v2/gateway/pay?..." }

// Response 400 (MoMo lỗi)
{ "success": false, "message": "...", "resultCode": 1001 }
```

### PATCH `/api/orders/:id/paid` _(auth required — owner or admin)_

```json
// Response 200
{ "success": true, "message": "Cập nhật trạng thái thanh toán thành công", "data": { ... } }
```

---

## Cách test thủ công

### Test VNPay

1. Khởi động backend `cd backend && npm run dev`
2. Khởi động frontend `cd frontend && ng serve`
3. Đăng nhập, thêm hàng vào giỏ, vào trang Thanh toán
4. Chọn ** VNPay**, điền thông tin, nhấn "Đặt hàng"
5. Browser redirect tới sandbox VNPay → dùng thẻ test NCB ở trên
6. Sau khi thanh toán → về `/checkout/return` → countdown 3s → `/orders`
7. Kiểm tra order trong DB: `payment.status` = `'paid'`

### Test MoMo

1. Làm các bước 1-3 như trên
2. Chọn ** MoMo**, điền thông tin, nhấn "Đặt hàng"
3. Browser redirect tới `test-payment.momo.vn` → đăng nhập tài khoản test MoMo
4. Xác nhận thanh toán
5. Sau khi thanh toán → về `/checkout/momo-return` → countdown 3s → `/orders`
6. Kiểm tra order trong DB: `payment.status` = `'paid'`

---

## Lưu ý quan trọng

1. **Test credentials chỉ dùng cho dev** — Khi production, thay toàn bộ `VNP_*` và `MOMO_*` trong `.env` bằng credentials thật từ:
   - VNPay: https://sandbox.vnpayment.vn/devreg/
   - MoMo: https://business.momo.vn/

2. **IPN không hoạt động trên localhost** — MoMo và VNPay cần server public để gọi IPN. Dùng `ngrok` để test IPN:

   ```bash
   ngrok http 3000
   # Cập nhật MOMO_IPN_URL và VNP_RETURN_URL trong .env
   ```

3. **CORS credentials** — Tất cả fetch calls đến `/api/payment/*` đều dùng `credentials: 'include'` để gửi session cookie.

4. **Số tiền MoMo** — MoMo nhận amount theo đơn vị VND (không nhân 100). VNPay nhân 100.

5. **Order model** — `payment.method` hỗ trợ `'cod' | 'vnpay' | 'momo'`. `payment.status` là `'pending' | 'paid'`.
