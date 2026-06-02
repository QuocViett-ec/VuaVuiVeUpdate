# Module 04: Checkout & Payment (Thanh Toán) — Java

## 1. Tổng quan
Flow: Giỏ hàng → Thông tin giao hàng → Chọn thanh toán → Áp voucher → Đặt hàng → Thanh toán online

## 2. CheckoutActivity

- **Thông tin giao hàng:** EditText (name, phone, address), Spinner slot (optional)
- **Danh sách SP:** RecyclerView tóm tắt
- **Voucher:** EditText + Button "Áp dụng", hoặc mở VoucherBottomSheetDialogFragment
- **Phương thức:** RadioGroup (COD / VNPay / MoMo)
- **Tổng kết:** Tạm tính, phí ship, giảm giá, tổng cộng
- **Button "Đặt hàng"**

## 3. Payment Flow

### COD:
`POST /api/orders` (method=cod) → OrderConfirmationActivity

### VNPay:
1. `POST /api/orders` (method=vnpay) → orderId
2. `POST /api/payment/vnpay/create` → paymentUrl
3. Mở WebView với paymentUrl
4. Intercept return URL → parse `vnp_ResponseCode == "00"` = thành công

### MoMo:
1. `POST /api/orders` (method=momo) → orderId
2. `POST /api/payment/momo/create` → payUrl
3. Mở WebView/Custom Tab
4. Parse return URL kết quả

## 4. WebView Payment (Java)

```java
public class PaymentWebViewActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_payment_webview);

        String paymentUrl = getIntent().getStringExtra("paymentUrl");
        webView = findViewById(R.id.webView);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.contains("/checkout/return") || url.contains("/checkout/momo-return")) {
                    Uri uri = Uri.parse(url);
                    handlePaymentResult(uri);
                    return true;
                }
                return false;
            }
        });
        webView.loadUrl(paymentUrl);
    }

    private void handlePaymentResult(Uri uri) {
        // Parse VNPay: vnp_ResponseCode, vnp_TxnRef
        // Parse MoMo: resultCode, orderId
        Intent result = new Intent();
        result.putExtra("success", /* parse result */);
        setResult(RESULT_OK, result);
        finish();
    }
}
```

## 5. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | /api/orders/voucher/available | ❌ | Voucher khả dụng |
| POST | /api/orders/voucher/validate | ✅ | Validate voucher |
| POST | /api/orders | ✅ | Tạo đơn hàng |
| POST | /api/payment/vnpay/create | ✅ | URL VNPay |
| GET | /api/payment/vnpay/return | ❌ | VNPay redirect callback |
| GET | /api/payment/vnpay/ipn | ❌ | VNPay IPN (server-to-server) |
| POST | /api/payment/momo/create | ✅ | URL MoMo |
| GET | /api/payment/momo/return | ❌ | MoMo redirect callback |
| POST | /api/payment/momo/ipn | ❌ | MoMo IPN (server-to-server) |

> **Lưu ý:** IPN endpoints là server-to-server callback, Android app không cần gọi trực tiếp.
> MoMo return là GET (không phải POST).

## 6. Data Models (Java)

```java
public class CreateOrderRequest {
    private List<OrderItemRequest> items;
    private DeliveryInfo delivery;
    private PaymentInfo payment;
    private String voucherCode;
    private double shippingFee;
    private double discount;
    private double subtotal;
    private double totalAmount;
    private String note;
}

public class OrderItemRequest {
    private String productId;
    private String productName;
    private int quantity;
    private double price;
    private double subtotal;
}

public class DeliveryInfo {
    private String name;
    private String phone;
    private String address;
    private String slot;   // "Sáng", "Chiều", "Tối"
}

public class PaymentInfo {
    private String method;  // "cod", "vnpay", "momo"
}

public class VoucherInfo {
    private String code;
    private String type;    // "ship", "percent", "fixed"
    private double value;
    private double cap;
    private double minOrderValue;
    private boolean canApply;
    private double estimatedDiscount;
    private Integer daysLeft;
}
```

## 7. Voucher Types

| Type | Tính toán |
|------|-----------|
| ship | discount = shippingFee |
| percent | discount = subtotal × value% (max cap) |
| fixed | discount = value |

## 8. Geolocation (Android)
- Sử dụng `FusedLocationProviderClient` để lấy tọa độ GPS
- Reverse geocode qua Nominatim: `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&accept-language=vi`
- Tự động điền địa chỉ giao hàng khi user nhấn "Dùng vị trí hiện tại"
- Quyền cần xin: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- Web frontend cũng dùng tương tự qua `GeolocationService` + Nominatim
