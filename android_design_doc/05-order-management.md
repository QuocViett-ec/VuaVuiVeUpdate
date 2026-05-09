# Module 05: Order Management (Quản Lý Đơn Hàng) — Java

## 1. Tổng quan
Xem danh sách đơn, chi tiết, theo dõi trạng thái, hủy đơn, yêu cầu trả hàng, đánh giá SP.

## 2. Các màn hình

### 2.1. OrderListFragment
- TabLayout filter: Tất cả | Chờ xác nhận | Đang giao | Đã giao | Đã hủy
- RecyclerView: Mã đơn, ngày, trạng thái badge, tổng tiền, SP tóm tắt
- Endless scroll pagination
- SwipeRefreshLayout

### 2.2. OrderDetailActivity
- **Header:** Mã đơn, trạng thái (chip màu), ngày tạo
- **Timeline:** Vertical Stepper (pending → confirmed → shipping → delivered)
- **Delivery info:** Tên, SĐT, địa chỉ
- **RecyclerView items:** Hình, tên, qty, giá, thành tiền
- **Payment info:** Phương thức, trạng thái, mã giao dịch
- **Tổng kết:** Tạm tính, ship, giảm giá, tổng
- **Actions:** Hủy đơn, Trả hàng, Đánh giá, Mua lại

## 3. Order Statuses

| Status | Tiếng Việt | Màu | Hành động |
|--------|-----------|------|-----------|
| pending | Chờ xác nhận | 🟡 | Hủy đơn |
| confirmed | Đã xác nhận | 🔵 | Hủy đơn |
| shipping | Đang giao | 🟠 | - |
| delivered | Đã giao | 🟢 | Trả hàng, Đánh giá |
| cancelled | Đã hủy | ⚫ | - |
| return_requested | Yêu cầu trả | 🟣 | - |
| return_approved | Duyệt trả | 🟣 | - |
| returned | Đã trả | 🔴 | - |
| refunded | Đã hoàn tiền | 🟢 | - |

## 4. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/orders/me | ✅ | Danh sách (status, page, limit) |
| GET | /api/orders/:id | ✅ | Chi tiết |
| PATCH | /api/orders/:id/cancel | ✅ | Hủy đơn |
| POST | /api/orders/:id/return-request | ✅ | Yêu cầu trả |
| POST | /api/orders/:id/reviews | ✅ | Gửi đánh giá |
| GET | /api/orders/:id/reviews/me | ✅ | Đánh giá của tôi |

## 5. Data Models (Java)

```java
public class Order {
    private String _id;
    private String orderId;       // "ORD-XXXXXXXX"
    private String userId;
    private List<OrderItem> items;
    private DeliveryInfo delivery;
    private PaymentDetail payment;
    private String voucherCode;
    private double shippingFee;
    private double discount;
    private double subtotal;
    private double totalAmount;
    private String status;
    private String deliveredAt;
    private String note;
    private List<Shipment> shipments;
    private ReturnRequest returnRequest;
    private String createdAt;
    private String updatedAt;
}

public class OrderItem {
    private String productId;
    private String productName;
    private int quantity;
    private double price;
    private double subtotal;
    private String imageUrl;
}

public class PaymentDetail {
    private String method;
    private String status;         // "pending", "paid", "refunded"
    private String transactionId;
    private double amount;
}

public class ReturnRequest {
    private String status;
    private String requestedAt;
    private String reason;
    private String reviewNote;
}
```

## 6. Return Request
- Chỉ khi delivered trong 7 ngày
- Body: `{ reason }` → status chuyển `return_requested`

## 7. Review Flow
- Status delivered/confirmed → mở ReviewBottomSheetDialogFragment
- Rating 1-5 + comment (max 500) per SP per đơn
