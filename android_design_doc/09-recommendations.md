# Module 09: Recommendations (Gợi Ý SP) — Java

## 1. Tổng quan
Gợi ý cá nhân hóa dựa trên hành vi user. Backend proxy ML service, fallback local khi ML down.

## 2. RecommendedFragment
- Section "Dành cho bạn" (Horizontal RecyclerView)
- Section "SP tương tự" (Horizontal RecyclerView)
- Section "Đang thịnh hành" (Horizontal RecyclerView)

## 3. API

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | /api/recommend | ❌ | Gợi ý cá nhân |
| POST | /api/recommend/event | ❌ | Ghi nhận event |
| GET | /api/recommend/similar/:id | ❌ | SP tương tự |
| POST | /api/recommend/similar-ml | ❌ | SP tương tự (ML) |
| GET | /api/recommend/history | ✅ | Lịch sử gợi ý |

## 4. Data Models (Java)

```java
public class Recommendation {
    private String product_id;
    private double score;
    private String name;
    private double price;
    private String image;
    private String category;
    private String reason;
}

public class RecommendRequest {
    private String user_id;
    private int n;
    public RecommendRequest(String userId, int n) {
        this.user_id = userId;
        this.n = n;
    }
}

public class RecommendResponse {
    private String user_id;
    private List<Recommendation> recommendations;
    private int count;
    private String method;  // "ml_model" | "local_fallback"
}

// User events
public class UserEventRequest {
    private String eventType;  // "view_product","add_to_cart","purchase","view_recipe"
    private String productId;
    private Map<String, Object> metadata;
}
```

## 5. Event Tracking
Gửi events khi user xem SP, thêm giỏ, mua hàng, xem recipe. Không cần đăng nhập.
