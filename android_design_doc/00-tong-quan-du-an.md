# Tổng Quan Dự Án Vựa Vui Vẻ — Thiết Kế Android (Java)

## 1. Giới thiệu

**Vựa Vui Vẻ** là nền tảng thương mại điện tử chuyên bán thực phẩm tươi sống. Dự án Android gồm **2 app riêng biệt**:

- **Customer App** — Mua sắm cho khách hàng
- **Admin App** — Quản trị cho admin/staff/audit

Cả 2 cùng gọi chung **Backend API** (Node.js + Express + MongoDB).

## 2. Kiến trúc tổng thể

```
┌────────────────────┐  ┌────────────────────┐
│   Customer App     │  │    Admin App        │
│   (Android/Java)   │  │   (Android/Java)    │
│  ┌──────────────┐  │  │  ┌──────────────┐   │
│  │ Browse/Cart  │  │  │  │ Dashboard    │   │
│  │ Checkout     │  │  │  │ Orders Mgmt  │   │
│  │ Orders       │  │  │  │ Products Mgmt│   │
│  │ Account      │  │  │  │ Users Mgmt   │   │
│  └──────┬───────┘  │  │  │ Vouchers     │   │
│         │          │  │  │ Shipments    │   │
│  ┌──────▼───────┐  │  │  │ Audit Logs   │   │
│  │   Retrofit   │  │  │  └──────┬───────┘   │
│  └──────┬───────┘  │  │         │            │
└─────────┼──────────┘  └─────────┼────────────┘
          │ HTTPS                 │ HTTPS
          └───────────┬───────────┘
              ┌───────▼───────┐
              │  Backend API  │
              │  Port 3000    │
              └───────┬───────┘
              ┌───────▼───────┐
              │   MongoDB     │
              └───────────────┘
```

## 3. Modules — Customer App

| # | Module | Ưu tiên | Mô tả |
|---|--------|---------|-------|
| 1 | Authentication | 🔴 Cao | Đăng ký, đăng nhập local + Google, quên MK |
| 2 | Product Catalog | 🔴 Cao | Duyệt SP, tìm kiếm, lọc, chi tiết |
| 3 | Shopping Cart | 🔴 Cao | Giỏ hàng offline-first, sync server |
| 4 | Checkout & Payment | 🔴 Cao | Đặt hàng, COD/VNPay/MoMo, voucher |
| 5 | Order Management | 🔴 Cao | Xem đơn, trạng thái, hủy/trả hàng |
| 6 | User Account | 🟡 TB | Hồ sơ, đổi mật khẩu |
| 7 | Recipes | 🟡 TB | Công thức nấu ăn + mua nguyên liệu |
| 8 | Chatbot AI | 🟡 TB | Chat hỗ trợ (Gemini AI) |
| 9 | Recommendations | 🟢 Thấp | Gợi ý SP cá nhân hóa |
| 10| Shipment Tracking | 🟢 Thấp | Theo dõi vận chuyển |
| 11| Realtime Updates | 🟢 Thấp | SSE push cho đơn hàng |
| 12| Reviews & Ratings | 🟢 Thấp | Đánh giá SP sau mua |

## 4. Modules — Admin App

| # | Module | Ưu tiên | Mô tả |
|---|--------|---------|-------|
| A1 | Admin Auth | 🔴 Cao | Đăng nhập admin/staff/audit |
| A2 | Dashboard | 🔴 Cao | Thống kê doanh thu, đơn hàng, users |
| A3 | Order Management | 🔴 Cao | Xem/cập nhật trạng thái đơn, bulk update |
| A4 | Product Management | 🔴 Cao | CRUD sản phẩm, upload ảnh |
| A5 | User Management | 🟡 TB | Danh sách users, phân quyền, vô hiệu hóa |
| A6 | Voucher Management | 🟡 TB | CRUD voucher |
| A7 | Shipment Management | 🟡 TB | Tạo/cập nhật shipment |
| A8 | Admin Chatbot | 🟢 Thấp | Chatbot hỗ trợ admin (tra đơn, thống kê) |
| A9 | Audit Logs | 🟢 Thấp | Nhật ký hoạt động |
| A10| Reports & Export | 🟢 Thấp | Xuất CSV đơn hàng/SP/users |

## 5. Tech Stack (Java)

| Layer | Công nghệ |
|-------|-----------|
| Language | **Java 17** |
| UI Framework | XML Layouts + View Binding (hoặc Jetpack Compose Java interop) |
| Architecture | MVVM (ViewModel + LiveData) |
| DI | Hilt (Dagger) |
| Networking | Retrofit 2 + OkHttp 4 + Gson |
| Local Storage | Room (SQLite) + SharedPreferences |
| Image Loading | Glide |
| Navigation | Jetpack Navigation Component |
| Auth (Google) | Google Sign-In SDK |
| Payment | WebView (VNPay/MoMo redirect) |
| Push Notify | FCM hoặc SSE (OkHttp EventSource) |

## 6. Cấu trúc thư mục Android đề xuất

```
app/src/main/java/vn/vuavuive/customer/   (Customer App)
├── data/
│   ├── api/          # Retrofit interfaces
│   ├── dto/          # Request/Response DTOs
│   ├── local/        # Room DAOs, entities
│   └── repository/   # Repository implementations
├── ui/
│   ├── auth/         # LoginActivity, RegisterActivity
│   ├── home/         # HomeFragment
│   ├── product/      # ProductListFragment, ProductDetailActivity
│   ├── cart/         # CartFragment
│   ├── checkout/     # CheckoutActivity
│   ├── order/        # OrderListFragment, OrderDetailActivity
│   ├── account/      # AccountFragment, EditProfileActivity
│   ├── recipe/       # RecipeListFragment
│   ├── chat/         # ChatActivity
│   └── common/       # BaseActivity, adapters, custom views
├── viewmodel/        # ViewModels
├── di/               # Hilt modules
└── util/             # Helpers, constants

app/src/main/java/vn/vuavuive/admin/     (Admin App)
├── data/
│   ├── api/          # Admin API interfaces
│   ├── dto/
│   └── repository/
├── ui/
│   ├── auth/         # AdminLoginActivity
│   ├── dashboard/    # DashboardFragment
│   ├── orders/       # AdminOrderListFragment, OrderDetailActivity
│   ├── products/     # AdminProductListFragment, ProductEditActivity
│   ├── users/        # UserListFragment
│   ├── vouchers/     # VoucherListFragment
│   ├── shipments/    # ShipmentListFragment
│   ├── audit/        # AuditLogFragment
│   └── chatbot/      # AdminChatActivity
├── viewmodel/
├── di/
└── util/
```

## 7. Tài liệu chi tiết

**Customer App:**
- [01 - Authentication](./01-authentication.md)
- [02 - Product Catalog](./02-product-catalog.md)
- [03 - Shopping Cart](./03-shopping-cart.md)
- [04 - Checkout & Payment](./04-checkout-payment.md)
- [05 - Order Management](./05-order-management.md)
- [06 - User Account](./06-user-account.md)
- [07 - Recipes](./07-recipes.md)
- [08 - Chatbot AI](./08-chatbot-ai.md)
- [09 - Recommendations](./09-recommendations.md)
- [10 - Shipment Tracking](./10-shipment-tracking.md)
- [11 - Realtime & Notifications](./11-realtime-notifications.md)
- [12 - Reviews & Ratings](./12-reviews-ratings.md)

**Admin App:**
- [15 - Admin Authentication](./15-admin-authentication.md)
- [16 - Admin Dashboard](./16-admin-dashboard.md)
- [17 - Admin Order Management](./17-admin-order-management.md)
- [18 - Admin Product Management](./18-admin-product-management.md)
- [19 - Admin User Management](./19-admin-user-management.md)
- [20 - Admin Voucher Management](./20-admin-voucher-management.md)
- [21 - Admin Shipment Management](./21-admin-shipment-management.md)
- [22 - Admin Chatbot](./22-admin-chatbot.md)
- [23 - Admin Audit & Reports](./23-admin-audit-reports.md)

**Tham chiếu chung:**
- [13 - Data Models](./13-data-models.md)
- [14 - API Endpoints](./14-api-endpoints.md)
