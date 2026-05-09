# Module A3 (17): Admin Order Management — Java

## 1. Tổng quan
Quản lý toàn bộ đơn hàng: xem, lọc, cập nhật trạng thái đơn lẻ/hàng loạt, duyệt trả hàng, xuất CSV.

## 2. Màn hình

### AdminOrderListFragment
- **TabLayout:** Tất cả | Pending | Confirmed | Shipping | Delivered | Cancelled | Returns
- **RecyclerView:** Mã đơn, khách hàng, tổng tiền, trạng thái chip, ngày
- **Search:** Tìm theo orderId, tên khách
- **Bulk actions:** CheckBox multi-select → Button "Cập nhật trạng thái"
- **Export:** Menu button → "Xuất CSV"
- **Pagination + SwipeRefreshLayout**

### AdminOrderDetailActivity
- Toàn bộ thông tin đơn hàng (giống customer nhưng có thêm quyền sửa)
- **Dropdown thay đổi trạng thái** (pending→confirmed→shipping→delivered)
- **Thông tin thanh toán chi tiết** (mã giao dịch, gateway)
- **Return request section:** Nếu có yêu cầu trả → Button "Duyệt" / "Từ chối"
- **Shipments liên kết:** Danh sách shipment của đơn

## 3. API Endpoints

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/orders | orders.read | Tất cả đơn (page, limit, status, search) |
| PATCH | /api/orders/:id/status | orders.write | Cập nhật trạng thái 1 đơn |
| PATCH | /api/admin/orders/bulk-status | orders.write | Bulk update status |
| POST | /api/orders/:id/return-review | orders.write | Duyệt/từ chối trả hàng |
| GET | /api/admin/orders/export | orders.export | Xuất CSV |

## 4. Bulk Update Status

```java
public class BulkStatusRequest {
    private List<String> orderIds;
    private String newStatus;
    private String note;
}

// Sử dụng
// PATCH /api/admin/orders/bulk-status
// Body: { orderIds: ["id1","id2"], newStatus: "confirmed" }
```

## 5. Return Review

```java
public class ReturnReviewRequest {
    private String action;     // "approve" | "reject"
    private String reviewNote; // Ghi chú admin
}

// POST /api/orders/:id/return-review
```

## 6. Status Transitions (Admin)
- pending → confirmed → shipping → delivered
- pending/confirmed → cancelled
- return_requested → return_approved / return_rejected
- return_approved → returned → refunded

## 7. Export CSV
- `GET /api/admin/orders/export` → response Content-Type: text/csv
- Lưu file vào Downloads folder
- Dùng DownloadManager hoặc Retrofit ResponseBody
