# Module A1 (15): Admin Authentication — Java

## 1. Tổng quan
Admin App sử dụng cùng API auth nhưng chỉ cho phép role `admin`, `staff`, `audit`. Header: `X-Portal-Scope: admin`, cookie: `vvv.admin.sid`.

## 2. AdminLoginActivity
- **Input:** Email + Mật khẩu
- **Không hỗ trợ:** Google Sign-In, Đăng ký (admin tạo từ seed/backend)
- **API:** `POST /api/auth/login` (backend kiểm tra role ∈ {admin, staff, audit})
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

- Cookie: `vvv.admin.sid` (tách biệt với customer)
- Mở app → `GET /api/auth/me` kiểm tra session + validate role

## 4. Phân quyền (Permissions)

Backend kiểm tra permission theo role:

| Permission | Admin | Staff | Audit |
|-----------|-------|-------|-------|
| orders.read | ✅ | ✅ | ✅ |
| orders.write | ✅ | ✅ | ❌ |
| orders.export | ✅ | ✅ | ✅ |
| products.read | ✅ | ✅ | ✅ |
| products.write | ✅ | ✅ | ❌ |
| products.export | ✅ | ✅ | ✅ |
| users.read | ✅ | ❌ | ✅ |
| users.write | ✅ | ❌ | ❌ |
| vouchers.read | ✅ | ✅ | ✅ |
| vouchers.write | ✅ | ❌ | ❌ |
| shipments.read | ✅ | ✅ | ✅ |
| shipments.write | ✅ | ✅ | ❌ |

Android app ẩn/hiện menu items dựa trên role của user.

## 5. Data Models

```java
public class AdminUser {
    private String _id;
    private String name;
    private String email;
    private String phone;
    private String role;      // "admin", "staff", "audit"
    private boolean isActive;
}
```
