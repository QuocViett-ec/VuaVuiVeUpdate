# Module 10: Shipment Tracking (Theo Dõi Vận Chuyển) — Java

## 1. Tổng quan
Theo dõi vận chuyển chi tiết. Hỗ trợ split package (nhiều shipment per order).

## 2. Màn hình

### ShipmentListFragment
- RecyclerView: Mã tracking, trạng thái chip, đơn liên quan
- Filter theo trạng thái

### ShipmentDetailActivity
- Header: Mã tracking, nhà vận chuyển, trạng thái
- Vertical timeline (RecyclerView + custom ItemDecoration)
- Thông tin giao hàng
- ETA, nút xem đơn gốc

## 3. Shipment Statuses

| Status | Tiếng Việt |
|--------|-----------|
| pending | Chờ xử lý |
| picked | Đã lấy hàng |
| packed | Đã đóng gói |
| shipped | Đã gửi |
| in_transit | Đang vận chuyển |
| delivered | Đã giao |
| failed | Giao thất bại |
| returned | Đã trả lại |
| cancelled | Đã hủy |

Carriers: `internal`, `ghn`, `ghtk`, `viettel_post`, `jnt`, `other`

## 4. API

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/shipments/me | ✅ |
| GET | /api/shipments/:id | ✅ |

## 5. Data Models (Java)

```java
public class Shipment {
    private String _id;
    private String orderId;
    private String customerId;
    private String carrier;
    private String trackingNumber;
    private double shippingFee;
    private String eta;
    private String deliveredAt;
    private String currentStatus;
    private DeliverySnapshot deliverySnapshot;
    private List<StatusEvent> statusHistory;
    private String createdAt;
}

public class DeliverySnapshot {
    private String name;
    private String phone;
    private String address;
    private String slot;
}

public class StatusEvent {
    private String status;
    private String at;
    private String source;
    private String note;
}
```
