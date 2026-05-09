# Module A8 (22): Admin Chatbot — Java

## 1. Tổng quan
Chatbot hỗ trợ admin tra đơn hàng, xem thống kê, đơn trễ, đơn nguy cơ hủy, tồn kho thấp. Hoạt động bằng **intent detection** (rule-based), KHÔNG dùng Gemini AI.

## 2. AdminChatActivity
- UI giống ChatActivity (customer) nhưng thêm màu admin theme
- RecyclerView chat bubbles
- Hỗ trợ markdown rendering (bold, bullet points) trong reply

## 3. API

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/admin-chatbot | ✅ (admin/staff/audit) |

Request: `{ "message": "tổng quan" }`

Response:
```json
{
  "success": true,
  "intent": "overview",
  "data": {
    "type": "overview",
    "message": "📊 Tổng quan hệ thống..."
  }
}
```

## 4. Supported Intents

| Intent | Trigger Keywords | Mô tả |
|--------|-----------------|-------|
| lookup_order | "ORD-XXXX", "tra đơn" | Tra cứu chi tiết 1 đơn |
| late_orders | "trễ", "chậm", "delay" | Đơn giao >48h chưa update |
| cancel_risk | "hủy", "nguy cơ", "cancel" | Đơn pending >24h/72h |
| overview | "tổng quan", "dashboard" | Thống kê hôm nay |
| pending_orders | "chờ xử lý", "pending" | Đơn đang chờ xác nhận |
| low_stock | "hết hàng", "tồn kho" | SP stock ≤ 10 |
| general | (mặc định) | Hướng dẫn sử dụng |

## 5. Data Models

```java
public class AdminChatRequest {
    private String message;
    public AdminChatRequest(String msg) { this.message = msg; }
}

public class AdminChatResponse {
    private boolean success;
    private String intent;
    private AdminChatData data;
}

public class AdminChatData {
    private String type;
    private String message;
    private Integer count;
    private Integer highRiskCount;
    private Integer mediumRiskCount;
}
```

## 6. Quick Actions
Hiển thị quick action chips ở dưới input:
- "Tổng quan" | "Đơn chờ" | "Đơn trễ" | "Hết hàng" | "Nguy cơ hủy"
