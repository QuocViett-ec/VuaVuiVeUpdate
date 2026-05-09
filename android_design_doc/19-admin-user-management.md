# Module A5 (19): Admin User Management — Java

## 1. Tổng quan
Quản lý danh sách users: xem, phân quyền, vô hiệu hóa/kích hoạt, xuất CSV. Chỉ admin có quyền write.

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

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users | users.read | Danh sách users |
| GET | /api/users/:id | users.read | Chi tiết user |
| PUT | /api/users/:id/role | users.write | Thay đổi role |
| PUT | /api/users/:id/active | users.write | Enable/disable |
| GET | /api/admin/users/export | users.read | Xuất CSV |

## 4. Data Models

```java
public class UserListResponse {
    private boolean success;
    private List<User> data;
    private Pagination pagination;
}

public class UpdateRoleRequest {
    private String role;  // "user","admin","staff","audit"
}

public class UpdateActiveRequest {
    private boolean isActive;
}
```

## 5. Phân quyền
- **Admin:** Xem + sửa role + enable/disable
- **Staff:** Không có quyền users
- **Audit:** Chỉ xem (read-only)
