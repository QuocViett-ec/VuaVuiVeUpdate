# Module A4 (18): Admin Product Management — Java

## 1. Tổng quan
CRUD sản phẩm: tạo mới, sửa, xóa (soft delete), xem tất cả (bao gồm inactive), xuất CSV.

## 2. Màn hình

### AdminProductListFragment
- **RecyclerView:** Hình, tên, giá, stock, category, status (active/inactive)
- **Search + Filter:** Tìm tên, lọc category, lọc stock thấp
- **FAB "+":** Tạo SP mới
- **Swipe/long press:** Sửa / Xóa
- **Menu "Xuất CSV"**

### ProductEditActivity (Tạo + Sửa)
- **ImageView** + Button "Chọn ảnh" (Gallery/Camera)
- **EditText:** Tên, Giá bán, Giá gốc, Mô tả, Đơn vị
- **Spinner:** Category (10 options), SubCategory
- **EditText:** Stock
- **ChipGroup:** Tags (thêm/xóa tag)
- **Switch:** isActive
- **Button "Lưu"**

## 3. API Endpoints

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/products | products.read | Tất cả SP (kể cả inactive) |
| POST | /api/products | products.write | Tạo SP mới |
| PUT | /api/products/:id | products.write | Cập nhật SP |
| DELETE | /api/products/:id | products.write | Soft delete |
| GET | /api/admin/products/export | products.export | Xuất CSV |

## 4. Image Upload
- Chọn ảnh từ Gallery hoặc Camera
- Compress trước khi upload
- `POST /api/products` với Multipart form-data

```java
// Retrofit interface
@Multipart
@POST("/api/products")
Call<ApiResponse<Product>> createProduct(
    @Part("name") RequestBody name,
    @Part("price") RequestBody price,
    @Part("category") RequestBody category,
    @Part("stock") RequestBody stock,
    @Part("unit") RequestBody unit,
    @Part("description") RequestBody description,
    @Part MultipartBody.Part image
);
```

## 5. Data Models

```java
public class ProductCreateRequest {
    private String name;
    private double price;
    private Double originalPrice;
    private String category;
    private String subCategory;
    private String description;
    private int stock;
    private String unit;
    private List<String> tags;
}

public class ProductUpdateRequest extends ProductCreateRequest {
    private Boolean isActive;
}
```

## 6. Categories (for Spinner)

```java
public static final String[][] CATEGORIES = {
    {"veg", "Rau củ"},
    {"fruit", "Trái cây"},
    {"meat", "Thịt"},
    {"drink", "Đồ uống"},
    {"dry", "Đồ khô"},
    {"spice", "Gia vị"},
    {"household", "Đồ gia dụng"},
    {"sweet", "Bánh kẹo"},
    {"frozen", "Đông lạnh"},
    {"other", "Khác"}
};
```
