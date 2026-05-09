# Module A6 (20): Admin Voucher Management — Java

## 1. Tổng quan
CRUD voucher: tạo mã giảm giá, cập nhật, xóa. Chỉ admin có quyền write.

## 2. Màn hình

### VoucherListFragment
- **RecyclerView:** Code, type (chip), value, minOrder, used/max, status, hạn
- **FAB "+":** Tạo voucher mới
- **Swipe:** Sửa/Xóa

### VoucherEditActivity (Tạo + Sửa)
- **EditText:** Code (uppercase, unique)
- **Spinner type:** ship / percent / fixed
- **EditText:** Value, Cap (nếu percent), Min order value
- **EditText:** Max uses
- **DatePicker:** Starts at, Expires at
- **Switch:** isActive
- **EditText:** Note
- **Button "Lưu"**

## 3. API Endpoints

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/vouchers | vouchers.read | Danh sách |
| POST | /api/admin/vouchers | vouchers.write | Tạo mới |
| PUT | /api/admin/vouchers/:code | vouchers.write | Cập nhật |
| DELETE | /api/admin/vouchers/:code | vouchers.write | Xóa |

## 4. Data Models

```java
public class VoucherCreateRequest {
    private String code;
    private String type;           // "ship", "percent", "fixed"
    private double value;
    private double cap;            // Chỉ dùng cho percent
    private double minOrderValue;
    private int maxUses;
    private String startsAt;       // ISO date
    private String expiresAt;      // ISO date
    private boolean isActive;
    private String note;
}

public class Voucher {
    private String _id;
    private String code;
    private String type;
    private double value;
    private double cap;
    private double minOrderValue;
    private int maxUses;
    private int usedCount;
    private String startsAt;
    private String expiresAt;
    private boolean isActive;
    private String note;
    private String createdAt;
}
```

## 5. Voucher Types

| Type | Mô tả | Fields |
|------|-------|--------|
| ship | Miễn phí ship | value (ignored), cap (ignored) |
| percent | Giảm % | value (%), cap (max discount) |
| fixed | Giảm cố định | value (amount), cap (ignored) |
