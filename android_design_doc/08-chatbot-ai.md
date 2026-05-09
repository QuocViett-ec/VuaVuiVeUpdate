# Module 08: Chatbot AI (Chat Hỗ Trợ) — Java

## 1. Tổng quan
Chatbot "VuiVe Bot" dùng Gemini AI, trả lời tiếng Việt về SP, đặt hàng, giao hàng, thanh toán.

## 2. ChatActivity
- **FloatingActionButton** ở góc dưới phải (toàn app) → mở ChatActivity
- **RecyclerView** chat bubbles (user phải, bot trái, 2 ViewHolder types)
- **EditText** + ImageButton gửi
- **ProgressBar** khi chờ phản hồi
- Error inline: "Không thể kết nối. Thử lại?"

## 3. API

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/chatbot | ❌ |

Request: `{ "message": "..." }` → Response: `{ "success": true, "reply": "..." }`

## 4. Data Models (Java)

```java
public class ChatMessage {
    private String id;
    private String content;
    private boolean isUser;
    private long timestamp;

    public ChatMessage(String content, boolean isUser) {
        this.id = UUID.randomUUID().toString();
        this.content = content;
        this.isUser = isUser;
        this.timestamp = System.currentTimeMillis();
    }
}

public class ChatRequest {
    private String message;
    public ChatRequest(String message) { this.message = message; }
}

public class ChatResponse {
    private boolean success;
    private String reply;
}
```

## 5. RecyclerView Adapter

```java
public class ChatAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
    private static final int TYPE_USER = 0;
    private static final int TYPE_BOT = 1;
    private List<ChatMessage> messages = new ArrayList<>();

    @Override
    public int getItemViewType(int position) {
        return messages.get(position).isUser() ? TYPE_USER : TYPE_BOT;
    }
    // ... inflate item_chat_user.xml / item_chat_bot.xml
}
```

## 6. Notes
- Lịch sử chat trong session (không persist)
- Timeout: 12 giây
- Không cần đăng nhập
