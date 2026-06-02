# Module 03: Shopping Cart (Giỏ Hàng) — Java

## 1. Tổng quan
Giỏ hàng **offline-first**: lưu Room DB trước, đồng bộ server khi đăng nhập. Hỗ trợ "Lưu để mua sau".

## 2. CartFragment

- **RecyclerView** danh sách SP trong giỏ
- Mỗi item: ảnh, tên, giá, NumberPicker (+/-), tổng phụ
- **ItemTouchHelper** swipe left → xóa
- Section "Lưu để mua sau" (expandable)
- **Tổng tiền** + Nút "Thanh toán"
- Empty state khi giỏ trống

## 3. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/cart/me | ✅ | Lấy giỏ hàng |
| PUT | /api/cart/me | ✅ | Ghi đè giỏ hàng (sync) |
| POST | /api/cart/me/merge | ✅ | Merge local + server |
| DELETE | /api/cart/me | ✅ | Xóa tất cả |

## 4. Data Models (Java)

```java
public class CartItem {
    private String productId;
    private int quantity;
    private CartProductInfo product;
}

public class CartProductInfo {
    private String id;
    private String name;
    private double price;
    private int stock;
    private String cat;
    private String sub;
    private String img;
}

public class Cart {
    private List<CartItem> items;
    private List<CartItem> savedForLater;
    private String updatedAt;
}

public class CartSyncRequest {
    private List<CartItemPayload> items;
    private List<CartItemPayload> savedForLater;
}

public class CartItemPayload {
    private String productId;
    private int quantity;
}
```

## 5. Room Entity

```java
@Entity(tableName = "cart_items")
public class CartItemEntity {
    @PrimaryKey
    @NonNull
    private String productId;
    private int quantity;
    private String productName;
    private double productPrice;
    private int productStock;
    private String productImage;
    private String productCategory;
    private boolean savedForLater;
    private long updatedAt;
    // Getters & Setters
}

@Dao
public interface CartDao {
    @Query("SELECT * FROM cart_items WHERE savedForLater = 0")
    LiveData<List<CartItemEntity>> getCartItems();

    @Query("SELECT * FROM cart_items WHERE savedForLater = 1")
    LiveData<List<CartItemEntity>> getSavedItems();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void upsert(CartItemEntity item);

    @Query("DELETE FROM cart_items WHERE productId = :productId")
    void delete(String productId);

    @Query("DELETE FROM cart_items")
    void deleteAll();

    @Query("SELECT COUNT(*) FROM cart_items WHERE savedForLater = 0")
    LiveData<Integer> getCartCount();
}
```

## 6. Offline-First Flow
- **Chưa login:** Lưu Room, khi login → `POST /api/cart/merge`
- **Đã login:** Cập nhật Room trước → debounce 500ms → `POST /api/cart/sync`
- **Mở app:** `GET /api/cart` đồng bộ từ server

## 7. Cart Badge
- Badge đỏ trên BottomNavigationView icon giỏ hàng
- Cập nhật realtime khi thay đổi
