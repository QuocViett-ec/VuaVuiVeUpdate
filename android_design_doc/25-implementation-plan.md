# Implementation Plan: Thứ Tự Triển Khai Dự Án Android

## Tổng quan

Dự án chia thành **5 Phase**, triển khai tuần tự. Mỗi phase xây dựng trên nền tảng phase trước.
Ưu tiên: Shared Foundation → Customer 🔴 Cao → Customer 🟡 TB → Admin 🔴 Cao → Admin 🟡/🟢 còn lại.

---

## Phase 0: Foundation (Nền tảng chung) — `shared/` module

> **Thời lượng ước tính: 1–2 ngày**
> Đây là bước bắt buộc — mọi thứ phụ thuộc vào module này.

### 0.1. Khởi tạo Project & Gradle
- Tạo project multi-module trên Android Studio (theo `24-setup-guide.md`)
- Sync Gradle thành công, cả 2 app build được

### 0.2. Networking Layer (`shared/data/api/`)
- [ ] `RetrofitClient.java` — Singleton Retrofit builder
- [ ] `PersistentCookieJar.java` — Lưu cookie (session) vào SharedPreferences
- [ ] `PortalScopeInterceptor.java` — Gắn header `X-Portal-Scope`
- [ ] `CsrfInterceptor.java` — Gắn header `X-Requested-With: XMLHttpRequest` cho POST/PUT/PATCH/DELETE (CRITICAL — thiếu sẽ bị 403)
- [ ] `ApiResponse<T>.java` — Generic response wrapper
- [ ] `Pagination.java`

### 0.3. Data Models (`shared/data/dto/`)
- [ ] `User.java`
- [ ] `Product.java`
- [ ] `Order.java`, `OrderItem.java`, `DeliveryInfo.java`
- [ ] `Cart.java`, `CartItem.java`, `CartProductInfo.java`
- [ ] `Voucher.java`
- [ ] `Review.java`
- [ ] `Shipment.java`
- [ ] `PaymentDetail.java`
- [ ] Request DTOs: `LoginRequest`, `RegisterRequest`, `GoogleLoginRequest`, `CreateOrderRequest`...

### 0.4. Retrofit Interfaces (`shared/data/api/`)
- [ ] `AuthApi.java` — login, register, google, logout, me, profile, password, forgot/verify/reset
- [ ] `ProductApi.java` — list, detail, categories, reviews
- [ ] `CartApi.java` — get, sync, merge, clear
- [ ] `OrderApi.java` — create, list, detail, cancel, return, reviews, voucher
- [ ] `PaymentApi.java` — vnpay/create, momo/create
- [ ] `ShipmentApi.java` — me, detail
- [ ] `RecipeApi.java` — list, detail
- [ ] `RecommendApi.java` — recommend, event, similar, history
- [ ] `ChatbotApi.java` — customer chatbot
- [ ] `RealtimeApi.java` — SSE stream

### 0.5. Hilt DI (`shared/di/`)
- [ ] `NetworkModule.java` — Provides OkHttpClient, Retrofit, tất cả API interfaces
- [ ] `DatabaseModule.java` — Provides Room database, DAOs

### 0.6. Room Database (`shared/data/local/`)
- [ ] `AppDatabase.java` — Room database class
- [ ] `CartItemEntity.java` + `CartDao.java` — Offline-first cart
- [ ] `ProductEntity.java` + `ProductDao.java` — Offline cache sản phẩm

### 0.7. Utilities (`shared/util/`)
- [ ] `Constants.java` — Date formats, categories enum, order statuses...
- [ ] `SessionManager.java` — Check login state, lưu user info
- [ ] `NetworkUtils.java` — Check connectivity
- [ ] `CurrencyFormatter.java` — Format tiền VNĐ

### Kiểm tra Phase 0
- [ ] Unit test `AuthApi` mock response
- [ ] Build `shared` module thành công
- [ ] Cả `app-customer` và `app-admin` reference `shared` không lỗi

**Tham chiếu:** `13-data-models.md`, `14-api-endpoints.md`

---

## Phase 1: Customer App — Core Features (🔴 Ưu tiên cao)

> **Thời lượng ước tính: 5–7 ngày**
> Hoàn thành phase này = app có thể dùng được cơ bản (đăng nhập → xem SP → mua hàng → xem đơn).

### 1.1. Authentication (Module 01) — Làm đầu tiên
- [ ] `LoginActivity` — Email/SĐT + mật khẩu, validation
- [ ] `RegisterActivity` — Form đăng ký, validation regex VN phone
- [ ] `ForgotPasswordActivity` — ViewPager2 (3 bước: nhập email → OTP → đặt MK mới)
- [ ] Google Sign-In flow (lấy idToken → POST /api/auth/google)
- [ ] `AuthViewModel` — login, register, logout, checkSession
- [ ] `AuthRepository` — gọi AuthApi, lưu session
- [ ] Auto-check session khi mở app (GET /api/auth/me)
- [ ] `CustomerModule.java` → provides `portalScope = "customer"`

**Tham chiếu:** `01-authentication.md`

### 1.2. Product Catalog (Module 02) — Màn hình chính
- [ ] `HomeFragment` — Màn hình chính với BottomNavigationView
- [ ] `ProductListFragment` — RecyclerView Grid (2 cột), SearchView, category chips
- [ ] `ProductAdapter` + `item_product.xml` — Card layout với Glide
- [ ] `ProductDetailActivity` — Ảnh, giá, mô tả, rating, reviews, SP tương tự
- [ ] `ProductViewModel` — load list, search, filter, pagination (endless scroll)
- [ ] `ProductRepository` — gọi ProductApi + cache Room
- [ ] Offline cache: hiển thị từ Room khi mất mạng

**Tham chiếu:** `02-product-catalog.md`

### 1.3. Shopping Cart (Module 03) — Offline-first
- [ ] `CartFragment` — RecyclerView, swipe-to-delete, NumberPicker +/-
- [ ] Section "Lưu để mua sau" (expandable)
- [ ] `CartViewModel` — CRUD cart items, tính tổng, cart count badge
- [ ] `CartRepository` — Room trước → debounce sync server
- [ ] Merge flow khi login: `POST /api/cart/me/merge`
- [ ] Cart badge trên BottomNavigationView

**Tham chiếu:** `03-shopping-cart.md`

### 1.4. Checkout & Payment (Module 04)
- [ ] `CheckoutActivity` — Thông tin giao hàng, danh sách SP, voucher, tổng kết
- [ ] `VoucherBottomSheetDialogFragment` — Chọn/áp voucher
- [ ] `PaymentWebViewActivity` — WebView cho VNPay/MoMo
- [ ] Geolocation: FusedLocationProviderClient → Nominatim reverse geocode → auto-fill địa chỉ
- [ ] COD flow, VNPay flow, MoMo flow (intercept return URL)
- [ ] `CheckoutViewModel` + `CheckoutRepository`

**Tham chiếu:** `04-checkout-payment.md`

### 1.5. Order Management (Module 05)
- [ ] `OrderListFragment` — Danh sách đơn, filter theo status (TabLayout)
- [ ] `OrderDetailActivity` — Chi tiết đơn, timeline trạng thái
- [ ] Hủy đơn (PATCH /api/orders/:id/cancel)
- [ ] Yêu cầu trả hàng (POST /api/orders/:id/return-request)
- [ ] `OrderViewModel` + `OrderRepository`

**Tham chiếu:** `05-order-management.md`

### Kiểm tra Phase 1
- [ ] Flow hoàn chỉnh: Đăng ký → Đăng nhập → Xem SP → Thêm giỏ → Checkout COD → Xem đơn
- [ ] Google Sign-In hoạt động
- [ ] VNPay/MoMo WebView redirect đúng
- [ ] Offline cart hoạt động (thêm SP khi offline, merge khi online)

---

## Phase 2: Customer App — Secondary Features (🟡 Trung bình + 🟢 Thấp)

> **Thời lượng ước tính: 3–4 ngày**

### 2.1. User Account (Module 06) 🟡
- [ ] `AccountFragment` — Hiển thị hồ sơ, avatar, stats
- [ ] `EditProfileActivity` — Cập nhật tên, SĐT, địa chỉ, avatar
- [ ] Đổi mật khẩu, đặt mật khẩu local (cho Google user)

**Tham chiếu:** `06-user-account.md`

### 2.2. Recipes (Module 07) 🟡
- [ ] `RecipeListFragment` — Danh sách công thức
- [ ] `RecipeDetailActivity` — Chi tiết + nút "Mua nguyên liệu" → thêm vào giỏ

**Tham chiếu:** `07-recipes.md`

### 2.3. Chatbot AI (Module 08) 🟡
- [ ] `ChatActivity` — Chat UI (RecyclerView), gửi/nhận message
- [ ] Gọi `POST /api/chatbot` với message
- [ ] Hiển thị gợi ý SP trong chat (clickable → ProductDetail)

**Tham chiếu:** `08-chatbot-ai.md`

### 2.4. Reviews & Ratings (Module 12) 🟢
- [ ] Gửi đánh giá sau mua (star rating + comment)
- [ ] Hiển thị đánh giá của tôi trong OrderDetail

**Tham chiếu:** `12-reviews-ratings.md`

### 2.5. Recommendations (Module 09) 🟢
- [ ] Section "Gợi ý cho bạn" trên HomeFragment
- [ ] SP tương tự trên ProductDetailActivity
- [ ] Ghi nhận user events (view, add_to_cart, purchase)

**Tham chiếu:** `09-recommendations.md`

### 2.6. Shipment Tracking (Module 10) 🟢
- [ ] Timeline vận chuyển trong OrderDetailActivity
- [ ] Thông tin carrier, tracking number, ETA

**Tham chiếu:** `10-shipment-tracking.md`

### 2.7. Realtime Notifications (Module 11) 🟢
- [ ] `SseService.java` — OkHttp SSE client
- [ ] Notification khi đơn hàng cập nhật, SP giảm giá
- [ ] Foreground service khi app active

**Tham chiếu:** `11-realtime-notifications.md`

### Kiểm tra Phase 2
- [ ] Customer App hoàn chỉnh tất cả tính năng
- [ ] Polish UI, loading states, error handling, empty states

---

## Phase 3: Admin App — Core Features (🔴 Ưu tiên cao)

> **Thời lượng ước tính: 4–5 ngày**
> Tận dụng code shared/ đã viết từ Phase 0.

### 3.1. Admin Auth (Module A1)
- [ ] `AdminLoginActivity` — Email + password (không Google Sign-In)
- [ ] Validate role ∈ {admin, staff, audit}, reject "user" role
- [ ] `AdminModule.java` → provides `portalScope = "admin"`
- [ ] Session check + role-based menu visibility

**Tham chiếu:** `15-admin-authentication.md`

### 3.2. Admin Retrofit Interfaces — thêm vào `shared/`
- [ ] `AdminOrderApi.java` — list, bulk-status, export, update status, return-review, paid, refund
- [ ] `AdminProductApi.java` — list, create (multipart), update (multipart), delete, export
- [ ] `AdminUserApi.java` — list, detail, update, delete, export
- [ ] `AdminVoucherApi.java` — list, create, update, delete
- [ ] `AdminShipmentApi.java` — list, create, update
- [ ] `AdminChatbotApi.java` — admin chatbot
- [ ] `AuditLogApi.java` — list, create
- [ ] `DashboardApi.java` — stats, analytics

### 3.3. Dashboard (Module A2)
- [ ] `DashboardFragment` — CardView stats (đơn hôm nay, doanh thu, users, pending)
- [ ] Đơn chờ xử lý (RecyclerView)
- [ ] SP sắp hết hàng
- [ ] MPAndroidChart cho biểu đồ doanh thu
- [ ] Pull-to-refresh + auto refresh 60s

**Tham chiếu:** `16-admin-dashboard.md`

### 3.4. Admin Order Management (Module A3)
- [ ] `AdminOrderListFragment` — Tất cả đơn, filter status/date, phân trang
- [ ] `AdminOrderDetailActivity` — Chi tiết + cập nhật trạng thái
- [ ] Bulk update status (multi-select → PATCH)
- [ ] Duyệt/từ chối trả hàng
- [ ] Đánh dấu đã thanh toán / đã hoàn tiền
- [ ] Export CSV

**Tham chiếu:** `17-admin-order-management.md`

### 3.5. Admin Product Management (Module A4)
- [ ] `AdminProductListFragment` — Tất cả SP (kể cả inactive)
- [ ] `ProductEditActivity` — Tạo/sửa SP, upload ảnh (multipart/form-data)
- [ ] Soft delete sản phẩm
- [ ] Export CSV

**Tham chiếu:** `18-admin-product-management.md`

### Kiểm tra Phase 3
- [ ] Admin login → Dashboard hiển thị đúng stats
- [ ] CRUD đơn hàng, cập nhật trạng thái
- [ ] CRUD sản phẩm, upload ảnh thành công
- [ ] Phân quyền: Staff không thấy Users/Audit, Audit chỉ đọc

---

## Phase 4: Admin App — Secondary Features (🟡 + 🟢)

> **Thời lượng ước tính: 3–4 ngày**

### 4.1. User Management (Module A5) 🟡
- [ ] `UserListFragment` — Danh sách users, search
- [ ] Cập nhật role, vô hiệu hóa tài khoản (chỉ admin)
- [ ] Export CSV

**Tham chiếu:** `19-admin-user-management.md`

### 4.2. Voucher Management (Module A6) 🟡
- [ ] `VoucherListFragment` — Danh sách voucher
- [ ] Tạo/sửa/xóa voucher (type: ship/percent/fixed)

**Tham chiếu:** `20-admin-voucher-management.md`

### 4.3. Shipment Management (Module A7) 🟡
- [ ] `ShipmentListFragment` — Danh sách shipment
- [ ] Tạo/cập nhật shipment, đổi trạng thái

**Tham chiếu:** `21-admin-shipment-management.md`

### 4.4. Admin Chatbot (Module A8) 🟢
- [ ] `AdminChatActivity` — Chat UI
- [ ] Intent-based: tra đơn, thống kê, SP sắp hết...

**Tham chiếu:** `22-admin-chatbot.md`

### 4.5. Audit Logs & Reports (Module A9–A10) 🟢
- [ ] `AuditLogFragment` — Danh sách audit logs, filter action/admin/date
- [ ] Export reports (CSV đơn hàng, SP, users)

**Tham chiếu:** `23-admin-audit-reports.md`

### Kiểm tra Phase 4
- [ ] Admin App hoàn chỉnh tất cả tính năng
- [ ] Phân quyền đúng cho admin/staff/audit
- [ ] Export CSV hoạt động

---

## Phase 5: Polish & Release

> **Thời lượng ước tính: 2–3 ngày**

### 5.1. UI/UX Polish
- [ ] Loading skeletons (shimmer effect) cho product list, order list
- [ ] Empty state illustrations
- [ ] Error state handling (no internet, server error, timeout)
- [ ] Snackbar/Toast cho feedback actions
- [ ] App icon và splash screen cho cả 2 app

### 5.2. Performance
- [ ] ProGuard rules kiểm tra kỹ
- [ ] Image caching strategy (Glide disk cache)
- [ ] Room database migration strategy
- [ ] Memory leak check (LeakCanary)

### 5.3. Testing
- [ ] Kiểm tra trên Emulator API 26, 30, 35
- [ ] Kiểm tra trên thiết bị thật (nếu có)
- [ ] Test offline mode, network switching
- [ ] Test payment flow end-to-end

### 5.4. Release
- [ ] Tạo release keystore
- [ ] Build APK/AAB cho cả 2 app
- [ ] Chuẩn bị tài liệu demo

---

## Tổng kết Timeline

| Phase | Nội dung | Thời lượng | Tích lũy |
|-------|----------|-----------|----------|
| **0** | Foundation (shared module) | 1–2 ngày | 1–2 ngày |
| **1** | Customer Core (Auth → Product → Cart → Checkout → Order) | 5–7 ngày | 6–9 ngày |
| **2** | Customer Secondary (Account, Recipe, Chat, Reviews...) | 3–4 ngày | 9–13 ngày |
| **3** | Admin Core (Auth → Dashboard → Orders → Products) | 4–5 ngày | 13–18 ngày |
| **4** | Admin Secondary (Users, Vouchers, Shipments, Audit...) | 3–4 ngày | 16–22 ngày |
| **5** | Polish & Release | 2–3 ngày | 18–25 ngày |

**Tổng: ~3–4 tuần** (làm full-time). Nếu part-time (~3h/ngày): ~6–8 tuần.

---

## Dependency Graph (Module nào cần làm trước)

```
Phase 0: shared/
    │
    ├──────────────────────────────┐
    │                              │
Phase 1: Customer App          Phase 3: Admin App
    │                              │
    ├── 1.1 Auth ◄─ bắt buộc      ├── 3.1 Admin Auth
    ├── 1.2 Product ◄─ cần Auth    ├── 3.2 Admin APIs (shared/)
    ├── 1.3 Cart ◄─ cần Product    ├── 3.3 Dashboard ◄─ cần Auth
    ├── 1.4 Checkout ◄─ cần Cart   ├── 3.4 Admin Orders
    └── 1.5 Order ◄─ cần Checkout  └── 3.5 Admin Products
    │                              │
Phase 2: Customer Secondary    Phase 4: Admin Secondary
    │                              │
    └── Độc lập với nhau           └── Độc lập với nhau
         (làm thứ tự nào cũng OK)       (làm thứ tự nào cũng OK)
```

> **Lưu ý quan trọng:**
> - Phase 1 module phải làm **tuần tự** (Auth → Product → Cart → Checkout → Order) vì có dependency chain
> - Phase 2 module **độc lập**, làm thứ tự nào cũng được
> - Phase 3 có thể bắt đầu **song song** với Phase 2 nếu muốn nhanh (vì shared/ đã hoàn thành)
> - Phase 4 module **độc lập**, làm thứ tự nào cũng được
