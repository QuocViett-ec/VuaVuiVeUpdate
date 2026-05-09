# Module 02: Product Catalog (Danh Mục Sản Phẩm) — Java

## 1. Tổng quan
Module lõi cho phép duyệt, tìm kiếm, lọc và xem chi tiết sản phẩm. Hỗ trợ phân trang, đánh giá, sản phẩm tương tự.

## 2. Các màn hình

### 2.1. ProductListFragment
- **RecyclerView Grid** (2 cột, GridLayoutManager)
- **SearchView** phía trên (debounce 300ms)
- **Category chips:** HorizontalScrollView hoặc RecyclerView horizontal
- **Sort spinner:** Mới nhất, Giá tăng, Giá giảm
- **Pagination:** Endless scroll (load thêm khi cuộn)
- **SwipeRefreshLayout** pull-to-refresh

**Categories:**

| Code | Tên |
|------|-----|
| veg | Rau củ |
| fruit | Trái cây |
| meat | Thịt |
| drink | Đồ uống |
| dry | Đồ khô |
| spice | Gia vị |
| household | Đồ gia dụng |
| sweet | Bánh kẹo |
| frozen | Đông lạnh |
| other | Khác |

### 2.2. ProductDetailActivity
- ImageView (full-width, zoom gesture)
- Tên, giá bán, giá gốc (strikethrough), đơn vị
- Badge giảm giá (% discount)
- Rating bar + số đánh giá
- Mô tả, tình trạng kho
- Nút "Thêm vào giỏ" + NumberPicker (+/-)
- Section "Đánh giá" (RecyclerView)
- Section "SP tương tự" (Horizontal RecyclerView)

### 2.3. SearchActivity
- SearchView với debounce
- Lịch sử tìm kiếm (SharedPreferences)
- RecyclerView kết quả

## 3. API Endpoints

| Method | Endpoint | Auth | Query Params |
|--------|----------|------|-------------|
| GET | /api/products | ❌ | category, search, page, limit, sort |
| GET | /api/products/categories | ❌ | - |
| GET | /api/products/:id | ❌ | - (ObjectId/slug) |
| GET | /api/products/:id/reviews | ❌ | - |
| GET | /api/recommend/similar/:id | ❌ | SP tương tự |

## 4. Data Models (Java)

```java
public class Product {
    private String _id;
    private String name;
    private String slug;
    private double price;
    private Double originalPrice;
    private String category;
    private String subCategory;
    private String description;
    private String imageUrl;
    private int stock;
    private String unit;
    private List<String> tags;
    private boolean isActive;
    private Double rating;
    private Integer reviewCount;
    private Integer soldCount;
    // Getters & Setters
}

public class ProductListResponse {
    private boolean success;
    private List<Product> data;
    private Pagination pagination;
}

public class Pagination {
    private int total;
    private int page;
    private int limit;
    private int totalPages;
}

public class Review {
    private String id;
    private String userName;
    private int rating;
    private String comment;
    private String createdAt;
}
```

## 5. Product Card (item_product.xml)
```
┌─────────────────────┐
│  [Hình ảnh SP]       │  ← Glide async load
│  [-20% badge]        │
│  Tên SP (max 2 dòng) │
│  ★ 4.5 (12)          │
│  ₫45,000 /kg         │
│  ₫55,000 (gạch)      │
│  [+ Thêm vào giỏ]    │
└─────────────────────┘
```

## 6. Offline Cache
- Cache SP vào Room DB
- Khi offline hiển thị từ cache
- Banner "Đang offline" ở trên

## 7. Image Loading (Glide)
```java
Glide.with(context)
    .load(BASE_URL + product.getImageUrl())
    .placeholder(R.drawable.placeholder)
    .error(R.drawable.error_image)
    .transition(DrawableTransitionOptions.withCrossFade())
    .into(imageView);
```
