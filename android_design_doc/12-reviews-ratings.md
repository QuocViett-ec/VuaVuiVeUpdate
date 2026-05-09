# Module 12: Reviews & Ratings (Đánh Giá) — Java

## 1. Tổng quan
Đánh giá SP sau mua. Unique per (userId, orderId, productId). Rating 1-5 + comment max 500.

## 2. Vị trí hiển thị
- ProductDetailActivity → section đánh giá
- OrderDetailActivity → nút "Đánh giá" khi delivered/confirmed
- AccountFragment → "Đánh giá của tôi"

## 3. ReviewBottomSheetDialogFragment
```
┌──────────────────────────────┐
│  Đánh giá: Cà chua bi        │
│  [img]  ₫25,000              │
│  ★ ★ ★ ★ ☆  (RatingBar)     │
│  [EditText: Nhận xét...]     │
│  [Hủy]        [Gửi đánh giá]│
└──────────────────────────────┘
```

## 4. API

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/products/:id/reviews | ❌ |
| POST | /api/orders/:id/reviews | ✅ |
| GET | /api/orders/:id/reviews/me | ✅ |

## 5. Data Models (Java)

```java
public class ReviewSubmission {
    private String productId;
    private int rating;      // 1-5
    private String comment;  // max 500
}

public class SubmitReviewsRequest {
    private List<ReviewSubmission> reviews;
}

public class Review {
    private String id;
    private String userName;
    private int rating;
    private String comment;
    private String createdAt;
}
```

## 6. Business Rules
- Chỉ khi order delivered/confirmed
- SP phải thuộc đơn đó
- Rating bắt buộc, comment optional max 500
- Upsert: gửi lại sẽ cập nhật
