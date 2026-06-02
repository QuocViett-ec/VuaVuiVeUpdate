# Module A7 (21): Admin Shipment Management — Java

## 1. Tổng quan
Quản lý vận chuyển: tạo shipment cho đơn hàng, cập nhật trạng thái, theo dõi.

## 2. Màn hình

### AdminShipmentListFragment
- **RecyclerView:** Tracking#, orderId, carrier, status chip, ngày tạo
- **Filter:** Carrier, Status
- **FAB "+":** Tạo shipment mới (liên kết đơn hàng)

### AdminShipmentDetailActivity
- Header: Tracking#, carrier, status
- Dropdown cập nhật trạng thái + Note
- Timeline lịch sử trạng thái
- Thông tin giao hàng (snapshot)
- Link xem đơn hàng gốc

## 3. API Endpoints

> **Lưu ý:** Shipment permissions dùng `orders.read`/`orders.write` trên backend, không phải `shipments.read`/`shipments.write`.

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|---------|
| GET | /api/shipments | orders.read | Tất cả shipment (admin/staff/audit) |
| POST | /api/shipments | orders.write | Tạo shipment cho đơn hàng (admin/staff) |
| PATCH | /api/shipments/:id | orders.write | Cập nhật shipment - status, note, etc (admin/staff) |

## 4. Data Models

```java
public class CreateShipmentRequest {
    private String orderId;
    private String carrier;        // "internal","ghn","ghtk","viettel_post","jnt","other"
    private String trackingNumber;
    private double shippingFee;
    private String eta;            // ISO date
}

public class UpdateShipmentStatusRequest {
    private String status;
    private String note;
}
```

## 5. Status Flow
```
pending → picked → packed → shipped → in_transit → delivered
                                   ↘ failed → returned
                        cancelled (bất kỳ lúc nào)
```

## 6. Carriers

| Code | Tên |
|------|-----|
| internal | Nội bộ |
| ghn | Giao Hàng Nhanh |
| ghtk | Giao Hàng Tiết Kiệm |
| viettel_post | Viettel Post |
| jnt | J&T Express |
| other | Khác |
