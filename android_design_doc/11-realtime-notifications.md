# Module 11: Realtime & Notifications — Java

## 1. Tổng quan
Backend hỗ trợ **SSE** cho push updates realtime.

## 2. SSE Endpoint
`GET /api/realtime/stream` (Auth ✅)

Events: `connected`, `order.status_updated`, `product.changed`, keep-alive mỗi 25s.

## 3. SSE Client (Java + OkHttp)

```java
public class SseService {
    private OkHttpClient client;
    private EventSource eventSource;

    public void connect(String baseUrl, SseListener listener) {
        Request request = new Request.Builder()
                .url(baseUrl + "/api/realtime/stream")
                .build();

        EventSource.Factory factory = EventSources.createFactory(client);
        eventSource = factory.newEventSource(request, new EventSourceListener() {
            @Override
            public void onEvent(EventSource es, String id, String type, String data) {
                switch (type) {
                    case "order.status_updated":
                        listener.onOrderUpdate(data);
                        break;
                    case "product.changed":
                        listener.onProductChanged(data);
                        break;
                }
            }

            @Override
            public void onFailure(EventSource es, Throwable t, Response response) {
                // Retry after delay
            }
        });
    }

    public void disconnect() {
        if (eventSource != null) eventSource.cancel();
    }
}

public interface SseListener {
    void onOrderUpdate(String data);
    void onProductChanged(String data);
}
```

## 4. Notifications

| Event | Notification | Action |
|-------|-------------|--------|
| Đơn xác nhận | "Đơn ORD-XX đã xác nhận" | Mở OrderDetail |
| Đang giao | "Đơn ORD-XX đang giao" | Mở OrderDetail |
| Đã giao | "Đơn ORD-XX giao thành công" | Mở OrderDetail |
| Giá SP thay đổi | "SP X giảm giá!" | Mở ProductDetail |

## 5. Foreground Service
- SSE chạy Foreground Service khi app active
- Background → dùng FCM thay thế
