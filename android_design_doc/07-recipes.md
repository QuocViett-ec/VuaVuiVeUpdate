# Module 07: Recipes (Công Thức Nấu Ăn) — Java

## 1. Tổng quan
Danh sách 40+ công thức nấu ăn với nguyên liệu có sẵn trong cửa hàng. Cho phép thêm nguyên liệu vào giỏ.

## 2. Màn hình

### RecipeListFragment
- RecyclerView Grid (2 cột)
- SearchView tìm theo tên
- Mỗi card: ImageView + TextView tên

### RecipeDetailActivity
- ImageView lớn
- Tên món
- RecyclerView nguyên liệu (tên, qty, unit)
- Button "Thêm tất cả vào giỏ"
- Mỗi nguyên liệu có nút "Thêm" riêng

## 3. API

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/recipes | ❌ | Danh sách (?q=search) |
| GET | /api/recipes/:id | ❌ | Chi tiết |

## 4. Data Models (Java)

```java
public class Recipe {
    private String id;
    private String name;
    private String image;
    private List<Ingredient> ingredients;
}

public class Ingredient {
    private String name;
    private String qty;
    private String unit;
}
```

## 5. Add-to-Cart Logic
1. Lấy tên ingredient
2. Search product: `GET /api/products?search={name}`
3. Tìm thấy → thêm vào giỏ
4. Không tìm thấy → Toast "Không tìm thấy SP tương ứng"
