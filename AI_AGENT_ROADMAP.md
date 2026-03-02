# 🤖 VuaVuiVe — Lộ Trình Phát Triển AI Agent & Workflow Automation

> **Phiên bản tài liệu:** 1.0 — March 2026  
> **Dựa trên stack hiện tại:** Node.js 20 + Express + MongoDB · Angular 21 + SSR · Python Flask + HybridRecommender (NMF) · VNPay  
> **Mục tiêu:** Nâng cấp từ hệ thống thương mại điện tử cơ bản lên nền tảng có AI Agent thông minh và quy trình tự động hoá end-to-end

---

## 📊 Tổng Quan Kiến Trúc Hiện Tại

```
┌─────────────────────────────────────────────────────────┐
│  Frontend: Angular 21 (SSR · port 4200)                 │
│  Features: home · products · cart · checkout · orders   │
│            account · admin · recipes · recommended      │
└───────────────────┬─────────────────────────────────────┘
                    │  HTTP / REST
┌───────────────────▼─────────────────────────────────────┐
│  Backend: Node.js + Express (port 3000)                 │
│  Routes: auth · products · orders · users               │
│          admin · recommend (proxy) · recipes            │
│  DB: MongoDB (Mongoose) — Session: MongoStore           │
└───────────┬─────────────────────┬───────────────────────┘
            │                     │
┌───────────▼──────┐   ┌──────────▼──────────────────────┐
│ VNPay (port 8888)│   │ ML Recommender: Flask (port 5001)│
│ Thanh toán       │   │ HybridRecommender · NMF model    │
└──────────────────┘   │ VVVInstacartAdapter              │
                       └──────────────────────────────────┘
```

### Những gì đã có

| Tính năng                        | Trạng thái        |
| -------------------------------- | ----------------- |
| Auth (session + bcrypt)          | ✅ Hoàn chỉnh     |
| CRUD sản phẩm / đơn hàng         | ✅ Hoàn chỉnh     |
| Thanh toán VNPay                 | ✅ Hoàn chỉnh     |
| ML Hybrid Recommender (NMF)      | ✅ Hoạt động      |
| Lịch sử gợi ý (RecommendHistory) | ✅ Có sẵn         |
| Audit Log                        | ✅ Có sẵn         |
| Admin panel (Angular)            | ✅ Có sẵn         |
| CSRF / Helmet / Rate Limit       | ✅ Bảo mật cơ bản |
| **AI Chatbot**                   | ❌ Chưa có        |
| **Workflow Automation**          | ❌ Chưa có        |
| **AI Agent tự động hoá**         | ❌ Chưa có        |
| **Notification thông minh**      | ❌ Chưa có        |

---

## 🗺️ Lộ Trình 3 Giai Đoạn

```
Phase 1 : AI Chatbot + Smart Search
Phase 2 : AI Agent thông minh + Personalization
Phase 3 : Workflow Automation + Admin AI
```

---

## 🏁 PHASE 1 — AI Chatbot & Smart Search

### 1.1 Shopping Assistant Chatbot

**Mục tiêu:** Chatbot hỗ trợ mua hàng tích hợp trực tiếp vào Angular frontend, giao tiếp với backend Node.js.

#### Kiến trúc

```
[Angular ChatWidget Component]
       │  WebSocket / HTTP
       ▼
[Backend: POST /api/chat/message]  ←─→  [LLM Provider]
       │                                  (Gemini / GPT-4o)
       ├─→ Intent Detection
       ├─→ Product Search Agent     ←─→  [MongoDB products]
       ├─→ Order Status Agent       ←─→  [MongoDB orders]
       ├─→ Recommendation Agent     ←─→  [ML API :5001]
       └─→ General FAQ Agent
```

#### Cài đặt Backend

**1. Thêm dependencies:**

```bash
cd backend
npm install @google/generative-ai openai langchain @langchain/openai socket.io
```

**2. Tạo file `backend/services/chatAgent.service.js`:**

```javascript
"use strict";
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt cho shopping assistant
const SYSTEM_PROMPT = `Bạn là trợ lý mua hàng thông minh của Vựa Vui Vẻ - cửa hàng thực phẩm sạch.
Nhiệm vụ của bạn:
1. Giúp khách hàng tìm sản phẩm phù hợp
2. Tra cứu trạng thái đơn hàng
3. Tư vấn công thức nấu ăn
4. Giải đáp thắc mắc về thanh toán, giao hàng
Luôn trả lời bằng tiếng Việt, thân thiện và ngắn gọn.`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "searchProducts",
        description: "Tìm kiếm sản phẩm theo tên, danh mục hoặc giá",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Từ khóa tìm kiếm" },
            category: { type: "string", description: "Danh mục sản phẩm" },
            maxPrice: { type: "number", description: "Giá tối đa (VND)" },
          },
          required: ["query"],
        },
      },
      {
        name: "getOrderStatus",
        description: "Tra cứu trạng thái đơn hàng của người dùng",
        parameters: {
          type: "object",
          properties: {
            orderId: { type: "string", description: "Mã đơn hàng" },
          },
          required: ["orderId"],
        },
      },
      {
        name: "getRecommendations",
        description: "Lấy sản phẩm gợi ý cho người dùng",
        parameters: {
          type: "object",
          properties: {
            userId: { type: "string" },
            limit: { type: "number", default: 5 },
          },
        },
      },
    ],
  },
];

// Tool implementations
async function executeToolCall(toolName, args, userId) {
  switch (toolName) {
    case "searchProducts": {
      const filter = { isActive: true };
      if (args.category) filter.category = args.category;
      if (args.maxPrice) filter.price = { $lte: args.maxPrice };
      const products = await Product.find({
        ...filter,
        $text: { $search: args.query },
      })
        .limit(5)
        .lean();
      return { products };
    }
    case "getOrderStatus": {
      const order = await Order.findOne({
        orderId: args.orderId,
        userId,
      }).lean();
      if (!order) return { error: "Không tìm thấy đơn hàng" };
      return {
        order: {
          orderId: order.orderId,
          status: order.status,
          totalAmount: order.totalAmount,
        },
      };
    }
    case "getRecommendations": {
      const fetch = require("node-fetch");
      const res = await fetch(
        `${process.env.RECOMMENDER_API || "http://localhost:5001"}/api/recommend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: args.userId, topN: args.limit || 5 }),
        },
      );
      const data = await res.json();
      return { recommendations: data.recommendations || [] };
    }
    default:
      return { error: "Unknown tool" };
  }
}

async function chat(history, userMessage, userId) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools,
  });

  const chatSession = model.startChat({ history });
  let result = await chatSession.sendMessage(userMessage);

  // Agentic loop: xử lý tool calls
  while (result.response.functionCalls()?.length) {
    const toolResults = await Promise.all(
      result.response.functionCalls().map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: await executeToolCall(call.name, call.args, userId),
        },
      })),
    );
    result = await chatSession.sendMessage(toolResults);
  }

  return result.response.text();
}

module.exports = { chat };
```

**3. Tạo `backend/routes/chat.routes.js`:**

```javascript
"use strict";
const express = require("express");
const router = express.Router();
const { chat } = require("../services/chatAgent.service");

// POST /api/chat/message  { message, history }
router.post("/message", async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Tin nhắn trống" });
    const userId = req.session?.userId || null;
    const reply = await chat(history, message, userId);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

**4. Đăng ký route trong `server.js`:**

```javascript
const chatRoutes = require("./routes/chat.routes");
app.use("/api/chat", chatRoutes);
```

**5. Thêm vào `.env`:**

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Cài đặt Frontend (Angular)

**Tạo `frontend/src/app/shared/chat-widget/`:**

```typescript
// chat-widget.component.ts
import { Component, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

@Component({
  selector: "app-chat-widget",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./chat-widget.component.html",
  styleUrl: "./chat-widget.component.scss",
})
export class ChatWidgetComponent {
  isOpen = signal(false);
  isLoading = signal(false);
  messages = signal<ChatMessage[]>([
    {
      role: "model",
      text: "👋 Xin chào! Tôi là trợ lý Vựa Vui Vẻ. Tôi có thể giúp bạn tìm sản phẩm, tra đơn hàng hoặc tư vấn nấu ăn!",
      timestamp: new Date(),
    },
  ]);
  inputText = "";

  constructor(private http: HttpClient) {}

  toggle() {
    this.isOpen.update((v) => !v);
  }

  async sendMessage() {
    if (!this.inputText.trim() || this.isLoading()) return;
    const userMsg = this.inputText.trim();
    this.inputText = "";
    this.messages.update((m) => [
      ...m,
      { role: "user", text: userMsg, timestamp: new Date() },
    ]);
    this.isLoading.set(true);

    const history = this.messages()
      .slice(1)
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

    this.http
      .post<{ success: boolean; reply: string }>("/api/chat/message", {
        message: userMsg,
        history,
      })
      .subscribe({
        next: (res) => {
          this.messages.update((m) => [
            ...m,
            { role: "model", text: res.reply, timestamp: new Date() },
          ]);
          this.isLoading.set(false);
        },
        error: () => {
          this.messages.update((m) => [
            ...m,
            {
              role: "model",
              text: "Xin lỗi, tôi gặp lỗi. Vui lòng thử lại!",
              timestamp: new Date(),
            },
          ]);
          this.isLoading.set(false);
        },
      });
  }
}
```

```html
<!-- chat-widget.component.html -->
<div class="chat-fab" (click)="toggle()">
  <span *ngIf="!isOpen()">💬</span>
  <span *ngIf="isOpen()">✕</span>
</div>

<div class="chat-window" *ngIf="isOpen()">
  <div class="chat-header">🛒 Trợ lý Vựa Vui Vẻ</div>
  <div class="chat-messages">
    <div *ngFor="let msg of messages()" [class]="'bubble ' + msg.role">
      {{ msg.text }}
    </div>
    <div *ngIf="isLoading()" class="bubble model typing">
      <span></span><span></span><span></span>
    </div>
  </div>
  <div class="chat-input">
    <input
      [(ngModel)]="inputText"
      (keydown.enter)="sendMessage()"
      placeholder="Nhập câu hỏi..."
    />
    <button (click)="sendMessage()" [disabled]="isLoading()">Gửi</button>
  </div>
</div>
```

```scss
// chat-widget.component.scss
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2e7d32;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
  &:hover {
    transform: scale(1.1);
  }
}
.chat-window {
  position: fixed;
  bottom: 90px;
  right: 24px;
  width: 360px;
  height: 520px;
  border-radius: 16px;
  background: white;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-header {
  background: #2e7d32;
  color: white;
  padding: 16px;
  font-weight: 600;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  &.user {
    align-self: flex-end;
    background: #2e7d32;
    color: white;
    border-radius: 12px 12px 2px 12px;
  }
  &.model {
    align-self: flex-start;
    background: #f1f3f4;
    color: #333;
    border-radius: 12px 12px 12px 2px;
  }
}
.typing span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  margin: 0 2px;
  animation: bounce 0.8s infinite alternate;
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}
@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}
.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #eee;
  input {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px;
  }
  button {
    background: #2e7d32;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
  }
}
```

---

### 1.2 Smart Search với Vector Similarity

**Mục tiêu:** Thay thế `$text search` thuần MongoDB bằng tìm kiếm ngữ nghĩa.

```bash
# Thêm vào backend
npm install @xenova/transformers  # hoặc dùng Gemini Embeddings API
```

**Flow:**

```
[User query] → [Gemini text-embedding-004] → [vector]
                                                  │
[MongoDB Products + cached embeddings] → [cosine similarity] → [top-k results]
```

**Tạo `backend/services/vectorSearch.service.js`:**

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

async function embedText(text) {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB);
}

module.exports = { embedText, cosineSimilarity };
```

> **Lưu ý:** Nếu dùng MongoDB Atlas, có thể dùng native **Atlas Vector Search** (index type: vectorSearch) thay cho tính toán thủ công.

---

## 🤖 PHASE 2 — AI Agent Thông Minh & Personalization

### 2.1 Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                       │
│         (Phân loại intent → dispatch đến sub-agent)         │
└───┬──────────┬──────────┬──────────┬──────────┬───────── ───┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
[Product]  [Order]  [Recipe]  [Support]  [Analytics]
 Agent      Agent    Agent     Agent      Agent
```

**Tạo `backend/agents/orchestrator.agent.js`:**

```javascript
"use strict";
const { GoogleGenerativeAI } = require("@google/generative-ai");

const INTENT_PROMPT = `Phân loại tin nhắn người dùng thành 1 trong các intent sau:
- PRODUCT_SEARCH: tìm sản phẩm, hỏi giá, xem danh mục
- ORDER_STATUS: tra đơn hàng, hủy đơn, theo dõi giao hàng
- RECIPE: hỏi công thức nấu ăn, nguyên liệu
- PAYMENT: hỏi về thanh toán, VNPay, COD
- RECOMMENDATION: gợi ý sản phẩm phù hợp
- GENERAL: câu hỏi chung khác
Chỉ trả về tên intent, không giải thích.`;

async function classifyIntent(message) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent([INTENT_PROMPT, message]);
  return result.response.text().trim();
}

module.exports = { classifyIntent };
```

---

### 2.2 Nâng Cấp ML Recommender

**Thêm vào `ml/VuaVuiVe_Recommender/src/api.py`:**

```python
@app.route('/api/recommend/contextual', methods=['POST'])
def contextual_recommend():
    """Gợi ý theo ngữ cảnh: thời gian, thời tiết, lịch sử xem"""
    data = request.json
    user_id = data.get('userId')
    context = {
        'hour': data.get('hour', 12),          # Giờ trong ngày
        'weather': data.get('weather', 'sunny'), # Thời tiết
        'viewed': data.get('viewedProducts', []) # Sản phẩm vừa xem
    }
    # Logic: sáng → rau củ, quả; trưa/tối → thịt, hải sản; mưa → soup, hot
    recs = recommender.recommend_contextual(user_id, context)
    return jsonify({'recommendations': recs})

@app.route('/api/recommend/bundle', methods=['POST'])
def bundle_recommend():
    """Gợi ý combo / bundle sản phẩm hay mua kèm (Apriori / Association Rules)"""
    data = request.json
    product_ids = data.get('productIds', [])
    bundles = recommender.get_frequently_bought_together(product_ids)
    return jsonify({'bundles': bundles})

@app.route('/api/chat/product-qa', methods=['POST'])
def product_qa():
    """Trả lời câu hỏi về sản phẩm bằng RAG"""
    data = request.json
    question = data.get('question', '')
    product_context = data.get('productContext', {})
    # Sử dụng Gemini + product data để trả lời
    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    prompt = f"""Dựa trên thông tin sản phẩm sau:
    {product_context}
    Trả lời câu hỏi: {question}
    Trả lời ngắn gọn bằng tiếng Việt."""
    response = model.generate_content(prompt)
    return jsonify({'answer': response.text})
```

---

### 2.3 Personalization Engine

**Tạo `backend/services/personalization.service.js`:**

```javascript
"use strict";
const RecommendHistory = require("../models/RecommendHistory.model");
const Order = require("../models/Order.model");

/**
 * Tính User Profile dựa trên lịch sử mua hàng
 */
async function getUserProfile(userId) {
  const orders = await Order.find({ userId, status: "delivered" })
    .populate("items.productId", "category name")
    .lean();

  const categoryCount = {};
  let totalSpent = 0;

  orders.forEach((order) => {
    totalSpent += order.totalAmount;
    order.items.forEach((item) => {
      const cat = item.productId?.category || "unknown";
      categoryCount[cat] = (categoryCount[cat] || 0) + item.quantity;
    });
  });

  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  return {
    userId,
    topCategories,
    totalOrders: orders.length,
    totalSpent,
    segment:
      totalSpent > 2000000 ? "vip" : totalSpent > 500000 ? "regular" : "new",
  };
}

module.exports = { getUserProfile };
```

---

## ⚙️ PHASE 3 — Workflow Automation

### 3.1 Order Processing Automation

**Luồng tự động hoàn chỉnh:**

```
[Đặt hàng] → [Xác nhận tự động] → [Kiểm tra kho ML]
                                           │
                           ┌───────────────┴──────────────┐
                      [còn hàng]                    [hết hàng]
                           │                              │
                    [Xác nhận + SMS]            [Gợi ý thay thế AI]
                           │
                    [Shipping webhook] → [Update status] → [Email confirm]
                           │
                    [Delivered] → [Trigger review request] → [Update ML model]
```

**Tạo `backend/services/orderAutomation.service.js`:**

```javascript
"use strict";
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");

/**
 * Tự động cập nhật trạng thái đơn hàng theo thời gian
 * Chạy bằng node-cron mỗi 30 phút
 */
async function autoProgressOrders() {
  const now = new Date();

  // Đơn "pending" quá 2 giờ → confirmed
  const pendingOrders = await Order.find({
    status: "pending",
    createdAt: { $lt: new Date(now - 2 * 60 * 60 * 1000) },
    "payment.method": "cod",
  });
  for (const order of pendingOrders) {
    order.status = "confirmed";
    await order.save();
    console.log(`[AUTO] Order ${order.orderId} → confirmed`);
    // TODO: gửi email/SMS thông báo
  }

  // Đơn "confirmed" quá 24 giờ → shipping
  const confirmedOrders = await Order.find({
    status: "confirmed",
    updatedAt: { $lt: new Date(now - 24 * 60 * 60 * 1000) },
  });
  for (const order of confirmedOrders) {
    order.status = "shipping";
    await order.save();
    console.log(`[AUTO] Order ${order.orderId} → shipping`);
  }
}

/**
 * Kiểm tra sản phẩm sắp hết hàng → cảnh báo admin
 */
async function checkLowStock(threshold = 10) {
  const lowStock = await Product.find({
    stock: { $lte: threshold },
    isActive: true,
  }).lean();

  if (lowStock.length > 0) {
    console.warn(
      `[ALERT] ${lowStock.length} sản phẩm sắp hết hàng:`,
      lowStock.map((p) => `${p.name} (còn ${p.stock})`).join(", "),
    );
    // TODO: emit socket event đến admin panel
  }
  return lowStock;
}

module.exports = { autoProgressOrders, checkLowStock };
```

**Thêm cron jobs vào `server.js`:**

```javascript
const cron = require("node-cron");
const {
  autoProgressOrders,
  checkLowStock,
} = require("./services/orderAutomation.service");

// Chạy mỗi 30 phút
cron.schedule("*/30 * * * *", autoProgressOrders);

// Kiểm tra kho mỗi sáng 8h
cron.schedule("0 8 * * *", checkLowStock);
```

```bash
npm install node-cron
```

---

### 3.2 Real-time Notifications (Socket.IO)

```bash
npm install socket.io
```

**Tích hợp vào `server.js`:**

```javascript
const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN, credentials: true },
});

// Namespace cho admin
const adminNS = io.of("/admin");
adminNS.use((socket, next) => {
  // Verify admin session
  next();
});

adminNS.on("connection", (socket) => {
  console.log("Admin connected:", socket.id);
  socket.join("admin-room");
});

// Export io để dùng trong services
app.set("io", io);

// Trong orderAutomation.service.js:
// const io = req.app.get("io");
// io.of("/admin").to("admin-room").emit("low-stock-alert", lowStock);

httpServer.listen(PORT);
```

**Angular Socket Service:**

```typescript
// frontend/src/app/core/services/socket.service.ts
import { Injectable } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io(`${environment.apiUrl}/admin`, { withCredentials: true });
  }

  on<T>(event: string): Observable<T> {
    return new Observable((observer) => {
      this.socket.on(event, (data: T) => observer.next(data));
    });
  }

  emit(event: string, data: unknown) {
    this.socket.emit(event, data);
  }
}
```

```bash
npm install socket.io-client
```

---

### 3.3 Email Automation

**Cài đặt:**

```bash
npm install nodemailer
```

**Tạo `backend/services/emailAutomation.service.js`:**

```javascript
"use strict";
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password
  },
});

const templates = {
  orderConfirmed: (order) => ({
    subject: `✅ Đơn hàng ${order.orderId} đã được xác nhận`,
    html: `
      <h2>Xin chào ${order.delivery.name}!</h2>
      <p>Đơn hàng <strong>${order.orderId}</strong> của bạn đã được xác nhận.</p>
      <p>Tổng tiền: <strong>${order.totalAmount.toLocaleString("vi-VN")}đ</strong></p>
      <p>Dự kiến giao hàng trong <strong>2-3 ngày làm việc</strong>.</p>
      <hr>
      <p style="color:#2e7d32">🛒 Vựa Vui Vẻ — Thực phẩm sạch, tươi mỗi ngày</p>
    `,
  }),

  orderShipping: (order) => ({
    subject: `🚚 Đơn hàng ${order.orderId} đang được giao`,
    html: `<p>Đơn hàng của bạn đang trên đường giao đến địa chỉ: <strong>${order.delivery.address}</strong></p>`,
  }),

  weeklyRecommendation: (user, products) => ({
    subject: `🎁 Gợi ý sản phẩm tuần này dành riêng cho bạn!`,
    html: `
      <h2>Xin chào ${user.name}!</h2>
      <p>Dựa trên sở thích của bạn, chúng tôi gợi ý:</p>
      ${products.map((p) => `<div><b>${p.name}</b> — ${p.price.toLocaleString("vi-VN")}đ</div>`).join("")}
      <a href="http://localhost:4200/recommended" style="background:#2e7d32;color:white;padding:10px 20px;text-decoration:none;border-radius:8px">Xem ngay</a>
    `,
  }),
};

async function sendEmail(to, template) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    ...template,
  });
}

module.exports = { sendEmail, templates };
```

**Thêm vào `.env`:**

```env
EMAIL_USER=vuavuive@gmail.com
EMAIL_PASS=your_app_password
```

**Cron job gửi email gợi ý hàng tuần (Chủ nhật 9h):**

```javascript
cron.schedule("0 9 * * 0", async () => {
  const users = await User.find({ isActive: true }).lean();
  for (const user of users) {
    // Lấy gợi ý từ ML
    // Gửi email
    await sendEmail(
      user.email,
      templates.weeklyRecommendation(user, recommendations),
    );
  }
});
```

---

### 3.4 AI-Powered Admin Analytics

**Tạo `backend/routes/analytics.routes.js`:**

```javascript
"use strict";
const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");

// GET /api/analytics/ai-summary — Tóm tắt kinh doanh bằng AI
router.get("/ai-summary", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [recentOrders, lowStockProducts] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).limit(50).lean(),
      Product.find({ stock: { $lte: 10 }, isActive: true }).lean(),
    ]);

    const stats = {
      totalRevenue: recentOrders.reduce((s, o) => s + o.totalAmount, 0),
      orderCount: recentOrders.length,
      pendingOrders: recentOrders.filter((o) => o.status === "pending").length,
      lowStockCount: lowStockProducts.length,
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Bạn là chuyên gia phân tích kinh doanh. Dựa trên số liệu sau:
    - Doanh thu 50 đơn gần nhất: ${stats.totalRevenue.toLocaleString("vi-VN")}đ
    - Số đơn hàng: ${stats.orderCount} (đang chờ: ${stats.pendingOrders})
    - Sản phẩm sắp hết hàng: ${stats.lowStockCount}
    Đưa ra 3-5 nhận xét ngắn gọn và đề xuất hành động bằng tiếng Việt.`;

    const result = await model.generateContent(prompt);
    res.json({ success: true, stats, aiSummary: result.response.text() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

### 3.5 Webhook & Event-Driven Automation

**Tạo `backend/services/eventBus.service.js`:**

```javascript
"use strict";
const EventEmitter = require("events");
const { sendEmail, templates } = require("./emailAutomation.service");
const Order = require("../models/Order.model");
const User = require("../models/User.model");

const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

// ── Event: order.created ──────────────────────────────────────
eventBus.on("order.created", async ({ orderId }) => {
  try {
    const order = await Order.findOne({ orderId }).lean();
    const user = await User.findById(order.userId).lean();
    if (user?.email) {
      await sendEmail(user.email, templates.orderConfirmed(order));
    }
    console.log(`[EVENT] order.created → email sent to ${user?.email}`);
  } catch (err) {
    console.error("[EventBus] order.created error:", err.message);
  }
});

// ── Event: order.status.changed ──────────────────────────────
eventBus.on("order.status.changed", async ({ orderId, newStatus }) => {
  if (newStatus === "shipping") {
    const order = await Order.findOne({ orderId }).lean();
    const user = await User.findById(order.userId).lean();
    if (user?.email) {
      await sendEmail(user.email, templates.orderShipping(order));
    }
  }
});

// ── Event: product.low_stock ──────────────────────────────────
eventBus.on("product.low_stock", ({ products }) => {
  const io = global.io;
  if (io) {
    io.of("/admin").to("admin-room").emit("low-stock-alert", { products });
  }
});

module.exports = eventBus;
```

**Sử dụng trong Order Controller:**

```javascript
// Trong order.controller.js, sau khi tạo đơn thành công:
const eventBus = require("../services/eventBus.service");
eventBus.emit("order.created", { orderId: newOrder.orderId });

// Sau khi cập nhật trạng thái:
eventBus.emit("order.status.changed", { orderId, newStatus: status });
```

---

## 📱 PHASE 3b — Progressive Web App (PWA) + Push Notifications

```bash
cd frontend
ng add @angular/pwa
```

**Sau khi cài PWA, thêm Web Push:**

```bash
npm install web-push
```

**Backend — tạo VAPID keys:**

```bash
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
```

**Thêm vào `.env`:**

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:vuavuive@gmail.com
```

---

## 🗂️ Cấu Trúc File Mới Cần Tạo

```
VuaVuiVeUpdate/
├── backend/
│   ├── agents/
│   │   └── orchestrator.agent.js       ← NEW: Multi-agent orchestrator
│   ├── services/
│   │   ├── chatAgent.service.js        ← NEW: Gemini chatbot + tools
│   │   ├── vectorSearch.service.js     ← NEW: Embedding-based search
│   │   ├── personalization.service.js  ← NEW: User profile engine
│   │   ├── orderAutomation.service.js  ← NEW: Cron-based automation
│   │   ├── emailAutomation.service.js  ← NEW: Nodemailer templates
│   │   └── eventBus.service.js         ← NEW: Event-driven architecture
│   └── routes/
│       ├── chat.routes.js              ← NEW: /api/chat/*
│       └── analytics.routes.js         ← NEW: /api/analytics/*
│
├── frontend/src/app/
│   ├── shared/
│   │   ├── chat-widget/               ← NEW: Floating chat component
│   │   └── notification-bell/         ← NEW: Real-time notifications
│   ├── features/
│   │   └── admin/
│   │       └── ai-dashboard/          ← NEW: AI analytics panel
│   └── core/services/
│       └── socket.service.ts          ← NEW: Socket.IO client
│
└── ml/VuaVuiVe_Recommender/src/
    └── api.py                         ← EXTEND: /contextual, /bundle, /qa
```

---

## 🔧 Tóm Tắt Dependencies Cần Cài

### Backend (npm)

```bash
npm install @google/generative-ai node-cron nodemailer socket.io web-push
# Tuỳ chọn:
npm install langchain @langchain/google-genai bull redis
```

### Frontend (npm)

```bash
npm install socket.io-client
ng add @angular/pwa
```

### ML (pip)

```bash
pip install google-generativeai flask-socketio
```

### Biến môi trường mới (`.env`)

```env
GEMINI_API_KEY=AIza...
EMAIL_USER=vuavuive@gmail.com
EMAIL_PASS=xxxx_xxxx_xxxx_xxxx
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:vuavuive@gmail.com
```

---

## 📋 Checklist Triển Khai

### Phase 1 — Chatbot cơ bản

- [ ] Lấy Gemini API Key từ https://aistudio.google.com
- [ ] Tạo `chatAgent.service.js` + `chat.routes.js`
- [ ] Đăng ký route `/api/chat` trong `server.js`
- [ ] Tạo `ChatWidgetComponent` trong Angular
- [ ] Thêm `ChatWidgetComponent` vào `AppComponent`
- [ ] Thêm `GEMINI_API_KEY` vào `.env`
- [ ] Test: hỏi "Có rau củ gì?" → phải gọi tool searchProducts

### Phase 1 — Smart Search

- [ ] Thêm text index MongoDB cho `Product.name + Product.description`
- [ ] Tạo `vectorSearch.service.js`
- [ ] Tạo route `GET /api/products/search?q=...`
- [ ] Tích hợp vào search bar Angular

### Phase 2 — Multi-Agent

- [ ] Tạo `orchestrator.agent.js` với intent classification
- [ ] Extend `api.py`: `/contextual`, `/bundle`, `/product-qa`
- [ ] Tạo `personalization.service.js`
- [ ] Thêm endpoint `GET /api/users/profile/ai`

### Phase 3 — Automation

- [ ] Cài `node-cron` + tạo `orderAutomation.service.js`
- [ ] Cài `socket.io` + tích hợp vào `server.js`
- [ ] Cài `nodemailer` + tạo `emailAutomation.service.js`
- [ ] Tạo `eventBus.service.js` + kết nối với Order Controller
- [ ] Tạo `analytics.routes.js` với AI summary
- [ ] Cài `@angular/pwa` + thêm `SocketService`
- [ ] Test toàn bộ luồng: đặt hàng → email → admin notification

---

## 🎯 KPI & Metrics Kỳ Vọng

| Metric              | Trước          | Sau Phase 1  | Sau Phase 3  |
| ------------------- | -------------- | ------------ | ------------ |
| Tỷ lệ chuyển đổi    | ~2%            | ~3.5%        | ~5%          |
| Thời gian xử lý đơn | Thủ công       | -            | Tự động 80%  |
| Độ chính xác gợi ý  | NMF baseline   | + Contextual | + Bundle AI  |
| Phản hồi khách hàng | Email thủ công | -            | Tự động 100% |

---

## 📚 Tài Liệu Tham Khảo

- [Google Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Gemini Function Calling Guide](https://ai.google.dev/gemini-api/docs/function-calling)
- [LangChain.js Docs](https://js.langchain.com/docs)
- [Socket.IO Angular Integration](https://socket.io/how-to/use-with-angular)
- [Angular PWA Guide](https://angular.dev/ecosystem/service-workers)
- [Nodemailer Docs](https://nodemailer.com)
- [node-cron Docs](https://github.com/node-cron/node-cron)

---

_Tài liệu được tạo ngày 02/03/2026 — VuaVuiVe AI Roadmap v1.0_
