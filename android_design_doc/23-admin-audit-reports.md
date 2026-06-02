# Module A9 (23): Admin Audit Logs & Reports — Java

## 1. Tổng quan
Nhật ký hoạt động admin và chức năng xuất báo cáo CSV. Role `audit` chuyên xem logs.

## 2. Màn hình

### AuditLogFragment (Nếu có audit log API)
- **RecyclerView:** Thời gian, user (admin/staff), action, target, chi tiết
- **Filter:** Theo ngày, theo user, theo action type
- **Actions tracked:**
  - Đăng nhập/đăng xuất admin
  - Tạo/sửa/xóa sản phẩm
  - Cập nhật trạng thái đơn hàng
  - Duyệt/từ chối trả hàng
  - Tạo/sửa/xóa voucher
  - Thay đổi role/status user

### ReportsFragment
- **Xuất báo cáo:**
  - Đơn hàng CSV → `GET /api/admin/orders/export`
  - Sản phẩm CSV → `GET /api/admin/products/export`
  - Users CSV → `GET /api/admin/users/export`

## 3. Audit Log API Endpoints

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/users/audit-logs | audit.read | Danh sách audit logs (admin, audit) |
| POST | /api/users/audit-logs | — (admin only) | Tạo audit log thủ công |

## 4. Export CSV (Java)

```java
public class CsvExporter {
    public void downloadCsv(String endpoint, String filename) {
        // Dùng Retrofit ResponseBody
        // Lưu vào Downloads folder
        Call<ResponseBody> call = adminApi.exportCsv(endpoint);
        call.enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, retrofit2.Response<ResponseBody> response) {
                if (response.isSuccessful() && response.body() != null) {
                    saveToDownloads(response.body(), filename);
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                // Error handling
            }
        });
    }

    private void saveToDownloads(ResponseBody body, String filename) {
        // Sử dụng ContentResolver + MediaStore (Android 10+)
        // hoặc Environment.getExternalStoragePublicDirectory
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, "text/csv");

        Uri uri = context.getContentResolver()
            .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

        try (OutputStream os = context.getContentResolver().openOutputStream(uri);
             InputStream is = body.byteStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
        }
    }
}
```

## 5. Export CSV API

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | /api/admin/orders/export | orders.export | CSV đơn hàng |
| GET | /api/admin/products/export | products.export | CSV sản phẩm |
| GET | /api/admin/users/export | users.read | CSV users |

## 6. Recommendation Telemetry (Admin)

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/recommend/telemetry/sections | ✅ admin | Hiệu quả sections gợi ý |

```java
public class SectionMetrics {
    private String section;     // "personal","similar","trending"
    private int impressions;
    private int clicks;
    private int addToCart;
    private double ctr;
    private double addToCartRate;
}
```

## 7. Role Access

| Feature | Admin | Staff | Audit |
|---------|-------|-------|-------|
| Xem audit logs | ✅ | ❌ | ✅ |
| Export orders CSV | ✅ | ✅ | ❌ |
| Export products CSV | ✅ | ✅ | ❌ |
| Export users CSV | ✅ | ❌ | ✅ |
| View telemetry | ✅ | ❌ | ✅ |
