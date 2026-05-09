# Module A2 (16): Admin Dashboard — Java

## 1. Tổng quan
Trang tổng quan hiển thị thống kê doanh thu, đơn hàng, user, SP sắp hết hàng. Dữ liệu được lấy từ nhiều API + admin chatbot.

## 2. DashboardFragment

```
┌──────────────────────────────┐
│  📊 Dashboard                │
├──────────────────────────────┤
│  ┌──────┐  ┌──────┐         │
│  │Đơn HN│  │Doanh │         │  ← CardView stats
│  │ 245  │  │ Thu  │         │
│  │      │  │ 15tr │         │
│  └──────┘  └──────┘         │
│  ┌──────┐  ┌──────┐         │
│  │Users │  │Chờ XN│         │
│  │ 1.2k │  │  12  │         │
│  └──────┘  └──────┘         │
├──────────────────────────────┤
│  ⏳ Đơn chờ xử lý (12)      │
│  • ORD-ABC – Nguyễn A – 85k │ ← RecyclerView
│  • ORD-DEF – Trần B – 120k  │
├──────────────────────────────┤
│  📉 SP sắp hết hàng (5)     │
│  • Cà chua bi – còn 3 kg 🔴 │
│  • Thịt ba rọi – còn 8 kg 🟠│
├──────────────────────────────┤
│  ⚠️ Đơn trễ giao (2)        │
│  • ORD-XYZ – 3 ngày chưa CN │
└──────────────────────────────┘
```

## 3. Dữ liệu Dashboard

Lấy từ **Admin Chatbot API** (intent-based):

| Dữ liệu | Intent | API |
|----------|--------|-----|
| Tổng quan | "overview" | POST /api/admin-chatbot |
| Đơn chờ xử lý | "pending_orders" | POST /api/admin-chatbot |
| SP sắp hết | "low_stock" | POST /api/admin-chatbot |
| Đơn trễ | "late_orders" | POST /api/admin-chatbot |

Hoặc gọi trực tiếp:

| Dữ liệu | API |
|----------|-----|
| Tổng đơn | GET /api/admin/orders?page=1&limit=1 (lấy total) |
| Đơn pending | GET /api/admin/orders?status=pending |
| SP low stock | GET /api/admin/products?stockBelow=10 |
| Users | GET /api/users?page=1&limit=1 (lấy total) |

## 4. Auto Refresh
- Pull-to-refresh
- Auto refresh mỗi 60 giây (Handler.postDelayed)
- SSE listener cho order updates

## 5. Data Models

```java
public class DashboardStats {
    private int todayOrders;
    private int monthOrders;
    private int totalOrders;
    private int pendingCount;
    private int shippingCount;
    private long totalRevenue;
    private int totalUsers;
}
```
