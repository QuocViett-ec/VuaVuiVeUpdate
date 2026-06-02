# Module A1 (15): Admin Authentication — Java

## 1. Tổng quan
Admin App sử dụng cùng API auth nhưng chỉ cho phép role `admin`, `staff`, `audit`. Header: `X-Portal-Scope: admin`, cookie: `vvv.admin.sid`.

## 2. AdminLoginActivity
- **Input:** Email + Mật khẩu
- **Không hỗ trợ:** Google Sign-In, Đăng ký (admin tạo từ seed/backend)
- **API:** `POST /api/auth/admin/login` (backend kiểm tra role ∈ {admin, staff, audit})
- **Error:** 403 nếu role = "user" (không phải admin)

## 3. Session Management

```java
// AdminPortalInterceptor.java
public class AdminPortalInterceptor implements Interceptor {
    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        Request request = chain.request().newBuilder()
                .addHeader("X-Portal-Scope", "admin")
                .build();
        return chain.proceed(request);
    }
}
```

- Cookie: `vvv.admin.sid` (tách biệt với customer `vvv.customer.sid`)
- Mở app → `GET /api/auth/me` kiểm tra session + validate role
- Nếu role không phải admin/staff/audit → logout + quay về login

## 4. Phân quyền (Permissions)

Backend kiểm tra permission theo role (từ `auth.middleware.js`):

| Permission | Admin | Staff | Audit |
|-----------|-------|-------|-------|
| dashboard.read | ✅ | ✅ | ✅ |
| reports.read | ✅ | ✅ | ✅ |
| orders.read | ✅ | ✅ | ❌ (qua admin routes) |
| orders.write | ✅ | ✅ | ❌ |
| orders.export | ✅ | ✅ | ❌ (qua admin routes) |
| products.read | ✅ | ✅ | ❌ (qua admin routes) |
| products.write | ✅ | ✅ | ❌ |
| products.export | ✅ | ✅ | ❌ (qua admin routes) |
| users.read | ✅ | ❌ | ✅ |
| users.write | ✅ | ❌ | ❌ |
| vouchers.read | ✅ | ✅ | ❌ (qua admin routes) |
| vouchers.write | ✅ | ✅ | ❌ |
| audit.read | ✅ | ❌ | ✅ |

> **Lưu ý:** Admin role có permission `*` (wildcard) nên có tất cả quyền.
> Staff có vouchers.write (khác với bản thiết kế cũ).
> Shipment permissions dùng `orders.read`/`orders.write` trên backend.

Android app ẩn/hiện menu items dựa trên role của user:
- **Admin:** Hiện tất cả menus
- **Staff:** Ẩn Users, Audit Logs
- **Audit:** Chỉ hiện Dashboard, Users (read-only), Audit Logs, Reports

## 5. Data Models

```java
public class AdminUser {
    private String _id;
    private String name;
    private String email;
    private String phone;
    private String role;      // "admin", "staff", "audit"
    private boolean isActive;
    private String createdAt;
}

public class AdminLoginRequest {
    private String email;
    private String password;
}
```

## 6. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/auth/admin/login | ❌ | Đăng nhập admin |
| POST | /api/auth/logout | ✅ | Đăng xuất |
| GET | /api/auth/me | ✅ | Thông tin admin (kiểm tra role) |
