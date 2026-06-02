# Module A5 (19): Admin User Management — Java

## 1. Tổng quan
Quản lý danh sách users: xem, cập nhật role/status, xóa, xuất CSV. Chỉ admin có quyền write.

## 2. Màn hình

### UserListFragment
- **RecyclerView:** Avatar, tên, email, phone, role (chip), status (active/inactive)
- **Search:** Tìm theo tên, email, phone
- **Filter:** Role (tất cả/user/admin/staff/audit), Status (active/inactive)
- **Pagination + SwipeRefreshLayout**
- **Menu "Xuất CSV"**

### UserDetailActivity
- Thông tin user đầy đủ
- **Spinner role:** Thay đổi role (chỉ admin)
- **Switch isActive:** Vô hiệu hóa/kích hoạt
- **Lịch sử đơn hàng** của user (optional)

## 3. API Endpoints

> **Lưu ý:** User management APIs mount tại `/api/users/` trong `user.routes.js` (không phải `/api/users/:id/role` hay `/api/users/:id/active` riêng lẻ).

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users/users | users.read | Danh sách users (admin, audit) |
| GET | /api/users/users/:id | users.read | Chi tiết user (admin, audit) |
| PUT | /api/users/users/:id | users.write | Cập nhật user (chỉ admin) |
| DELETE | /api/users/users/:id | users.write | Xóa user (chỉ admin) |
| GET | /api/admin/users/export | users.read | Xuất CSV (admin, audit) |

## 4. Data Models

```java
public class UserListResponse {
    private boolean success;
    private List<User> data;
    private Pagination pagination;
}

// PUT /api/users/users/:id — Body chứa các fields cần update
public class UpdateUserRequest {
    private String role;      // "user","admin","staff","audit" (optional)
    private Boolean isActive; // true/false (optional)
    private String name;      // (optional)
}
```

## 5. Phân quyền
- **Admin:** Xem + sửa (role, isActive) + xóa → full CRUD
- **Staff:** Không có quyền users (menu ẩn)
- **Audit:** Chỉ xem danh sách (read-only, menu hiện nhưng ẩn nút sửa/xóa)

## 6. Lưu ý Backend
- Endpoint mount: `server.js` → `app.use("/api/users", userRoutes)`
- Bên trong `user.routes.js`, routes là `/users` và `/users/:id`
- Nên path đầy đủ = `/api/users/users` và `/api/users/users/:id`
- Dashboard stats cũng mount cùng prefix: `/api/users/dashboard/stats`
