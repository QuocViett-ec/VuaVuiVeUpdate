# Module 13: Data Models (MongoDB → Android Java)

## 1. API Response Wrapper

```java
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
    private Pagination pagination;
    // Getters
}

public class Pagination {
    private int total;
    private int page;
    private int limit;
    private int totalPages;
}
```

## 2. User

| MongoDB Field | Java Type | Ghi chú |
|---------------|-----------|---------|
| _id | String | ObjectId |
| name | String | required, min 2 |
| phone | String | unique, sparse, regex VN |
| email | String | unique, sparse, lowercase |
| avatar | String | default "" |
| provider | String | "local" \| "google" |
| address | String | |
| role | String | "user","admin","staff","audit" |
| isActive | boolean | default true |
| createdAt | String | ISO date |

```java
public class User {
    private String _id;
    private String name;
    private String phone;
    private String email;
    private String avatar;
    private String provider;
    private String address;
    private String role;
    private boolean isActive;
    private String createdAt;
    private String updatedAt;
    // Getters & Setters
}
```

## 3. Product

```java
public class Product {
    private String _id;
    private String name;
    private String slug;
    private double price;
    private Double originalPrice;
    private String category;     // enum 10 values
    private String subCategory;
    private String description;
    private String imageUrl;
    private int stock;
    private String unit;
    private List<String> tags;
    private boolean isActive;
    private Integer externalId;
    private Double rating;
    private Integer reviewCount;
    private Integer soldCount;
    private String createdAt;
    private String updatedAt;
}
```

## 4. Cart

```java
public class Cart {
    private List<CartItem> items;
    private List<CartItem> savedForLater;
    private String updatedAt;
}

public class CartItem {
    private String productId;
    private int quantity;
    private CartProductInfo product;
}
```

## 5. Order

```java
public class Order {
    private String _id;
    private String orderId;      // "ORD-XXXXXXXX"
    private String userId;
    private List<OrderItem> items;
    private DeliveryInfo delivery;
    private PaymentDetail payment;
    private String voucherId;
    private String voucherCode;
    private double shippingFee;
    private double discount;
    private double subtotal;
    private double totalAmount;
    private String status;       // 10 statuses
    private String deliveredAt;
    private List<String> shipmentIds;
    private ReturnRequest returnRequest;
    private String note;
    private String createdAt;
    private String updatedAt;
}
```

## 6. Shipment

```java
public class Shipment {
    private String _id;
    private String orderId;
    private String customerId;
    private String carrier;       // enum 6
    private String trackingNumber;
    private double shippingFee;
    private String eta;
    private String deliveredAt;
    private String currentStatus; // enum 9
    private DeliverySnapshot deliverySnapshot;
    private List<StatusEvent> statusHistory;
    private String createdAt;
}
```

## 7. Review

```java
public class Review {
    private String _id;
    private String userId;
    private String orderId;
    private String orderCode;
    private String productId;
    private String productName;
    private String productImage;
    private int rating;          // 1-5
    private String comment;      // max 500
    private String createdAt;
}
```

## 8. Voucher

```java
public class Voucher {
    private String _id;
    private String code;         // unique, uppercase
    private String type;         // "ship","percent","fixed"
    private double value;
    private double cap;
    private double minOrderValue;
    private int maxUses;
    private int usedCount;
    private String startsAt;
    private String expiresAt;
    private boolean isActive;
    private String note;
}
```

## 9. UserEvent

```java
public class UserEvent {
    private String userId;
    private String sessionId;
    private String eventType;    // "view_product","add_to_cart","purchase","view_recipe"
    private String productId;
    private Map<String, Object> metadata;
}
```

## 10. AuditLog (Admin)

```java
public class AuditLog {
    private String _id;
    private String adminId;       // ObjectId ref User
    private String action;        // "order.status_updated", "product.created", etc
    private String target;        // "Order:ORD-XXX", "Product:abc123"
    private Map<String, Object> details;  // before/after context
    private String ip;
    private String createdAt;
}
```

## 11. RecommendHistory

```java
public class RecommendHistory {
    private String _id;
    private String userId;
    private List<RecommendItem> recommendations;
    private String createdAt;
}

public class RecommendItem {
    private String productId;
    private double score;
    private String reason;
}
```

## 12. PaymentDetail (Chi tiết — đầy đủ từ backend)

```java
public class PaymentDetail {
    private String method;           // "cod", "vnpay", "momo"
    private String status;           // "pending", "paid", "refunded"
    private String gateway;          // gateway code/name
    private String transactionId;    // gateway transaction ID
    private String transactionTime;  // ISO date - thời điểm thanh toán
    private double amount;           // số tiền thanh toán
    private Object gatewayResponse;  // Raw gateway payload (optional)
}
```

## 13. DashboardStats (Admin)

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

