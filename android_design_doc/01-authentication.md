# Module 01: Authentication (Xác Thực Người Dùng) — Java

## 1. Tổng quan
Module xác thực quản lý flow đăng ký, đăng nhập, quên mật khẩu và phiên đăng nhập. Backend dùng **session-based auth** (cookie), Android quản lý cookie qua OkHttp CookieJar.

## 2. Các màn hình (Activities/Fragments)

### 2.1. LoginActivity
- **Input:** Email/SĐT + Mật khẩu
- **Actions:** Đăng nhập (`POST /api/auth/login`), Google Sign-In (`POST /api/auth/google`), Quên MK, Đăng ký
- **Validation:** Email/phone bắt buộc, password bắt buộc
- **Error:** 401 sai thông tin, 403 tài khoản bị vô hiệu hóa

### 2.2. RegisterActivity
- **Input:** Họ tên (min 2), SĐT (0[3-9]xxxxxxxx), Email (optional), Mật khẩu (min 6), Xác nhận MK, Địa chỉ (optional)
- **API:** `POST /api/auth/register`

### 2.3. ForgotPasswordActivity (3 bước ViewPager)
1. Nhập email/phone → `POST /api/auth/forgot-password` → nhận OTP
2. Nhập OTP 6 số → `POST /api/auth/verify-otp` → nhận resetToken (max 5 lần, 10 phút)
3. Nhập MK mới → `POST /api/auth/reset-password` (resetToken hết hạn 15 phút)

## 3. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/auth/register | ❌ | Đăng ký |
| POST | /api/auth/login | ❌ | Đăng nhập |
| POST | /api/auth/google | ❌ | Đăng nhập Google (idToken) |
| POST | /api/auth/logout | ✅ | Đăng xuất |
| GET | /api/auth/me | ✅ | Thông tin user |
| PUT | /api/auth/profile | ✅ | Cập nhật hồ sơ |
| PUT | /api/auth/password | ✅ | Đổi mật khẩu |
| POST | /api/auth/set-local-password | ✅ | Đặt MK local (Google user) |
| POST | /api/auth/forgot-password | ❌ | Yêu cầu OTP |
| POST | /api/auth/verify-otp | ❌ | Xác minh OTP |
| POST | /api/auth/reset-password | ❌ | Reset MK bằng token |

## 4. Data Models (Java)

```java
// User.java
public class User {
    private String _id;
    private String name;
    private String phone;
    private String email;
    private String address;
    private String role;       // "user"
    private String avatar;
    private String provider;   // "local" | "google"
    private String createdAt;

    // Getters & Setters
}

// LoginRequest.java
public class LoginRequest {
    private String phone;
    private String email;
    private String password;

    public LoginRequest(String phone, String email, String password) {
        this.phone = phone;
        this.email = email;
        this.password = password;
    }
}

// RegisterRequest.java
public class RegisterRequest {
    private String name;
    private String phone;
    private String email;
    private String password;
    private String address;
}

// GoogleLoginRequest.java
public class GoogleLoginRequest {
    private String idToken;
    public GoogleLoginRequest(String idToken) { this.idToken = idToken; }
}

// ForgotPasswordRequest.java
public class ForgotPasswordRequest {
    private String phone;
    private String email;
}

// VerifyOtpRequest.java
public class VerifyOtpRequest {
    private String phone;
    private String email;
    private String otp;   // 6 digits
}

// ResetPasswordRequest.java
public class ResetPasswordRequest {
    private String resetToken;
    private String newPassword;
}
```

## 5. Session Management trên Android (Java)

```java
// PortalScopeInterceptor.java
public class PortalScopeInterceptor implements Interceptor {
    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        Request request = chain.request().newBuilder()
                .addHeader("X-Portal-Scope", "customer")
                .build();
        return chain.proceed(request);
    }
}

// PersistentCookieJar: lưu cookie vào SharedPreferences
// Gửi header X-Portal-Scope: customer trong mọi request
// Khi mở app → gọi GET /api/auth/me kiểm tra session
```

## 6. Google Sign-In
1. Sử dụng Google Sign-In SDK
2. Lấy `idToken` → `POST /api/auth/google { idToken }`
3. Backend verify → tạo session → trả user info
