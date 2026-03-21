# VuaVuiVe - System Diagrams (Mermaid)

## 1) Overall System Architecture

```mermaid
flowchart LR
  subgraph Client[Client Layer]
    CUS[Customer Portal\nAngular :4200]
    ADM[Admin Portal\nAngular :4201]
  end

  subgraph BE[Backend Layer - Node.js/Express :3000]
    API[Express App\nRoutes + Controllers]
    SES[Session Middleware\nexpress-session + connect-mongo]
    SEC[Security\nHelmet + CORS + CSRF + Rate Limit]
    SSE[Realtime SSE\n/api/realtime/stream]
    BUS[realtime-bus\nIn-memory pub/sub]
  end

  subgraph DB[Data Layer]
    MDB[(MongoDB :27017)]
    APP[(App Collections\nusers/products/orders/vouchers/...)]
    SDB[(sessions collection)]
  end

  subgraph PAY[Payment Layer]
    VNPGW[VNPay Sandbox Gateway]
    MOMOGW[MoMo Sandbox API]
    VNPDEMO[VNPay Demo App :8888\nOptional local testing]
  end

  subgraph ML[Recommendation Layer]
    MLA[Flask API :5001\n/api/recommend]
    MLM[(ML Models + Features)]
  end

  CUS --> API
  ADM --> API

  API --> SES
  API --> SEC
  API --> SSE
  SSE --> BUS

  MDB --- APP
  MDB --- SDB
  API <--> APP
  SES <--> SDB

  API -->|create signed VNPay URL| VNPGW
  API -->|create MoMo payment request| MOMOGW
  VNPDEMO --> VNPGW

  API -->|proxy recommend| MLA
  MLA --> MLM
  API -->|fallback recommendations| APP

  VNPGW -->|return/ipn callback| API
  MOMOGW -->|ipn callback| API
```

## 2) Backend Request Flow (Express)

```mermaid
flowchart TD
  REQ[HTTP Request] --> MW1[Helmet + Morgan + CORS]
  MW1 --> MW2[Body Parser JSON/URLENCODED]
  MW2 --> MW3[Session Scope Resolver\ncustomer/admin cookie]
  MW3 --> MW4[Session Middleware\nload/save sid in MongoDB sessions]
  MW4 --> MW5[CSRF Protection]
  MW5 --> RT{Match Route}

  RT -->|/api/auth| A1[Auth Controller]
  RT -->|/api/products| P1[Product Controller]
  RT -->|/api/orders| O1[Order Controller]
  RT -->|/api/payment| PY1[Payment Controller]
  RT -->|/api/admin| AD1[Admin Controllers]
  RT -->|/api/recommend| R1[Recommend Route Proxy]
  RT -->|/api/realtime| S1[SSE Stream]

  A1 --> DB[(MongoDB App Collections)]
  P1 --> DB
  O1 --> DB
  PY1 --> DB
  AD1 --> DB
  R1 --> DB

  O1 --> BUS[realtime-bus in-memory]
  S1 --> BUS

  R1 --> ML[ML API :5001]
  R1 --> FB[Local fallback from Product collection]
  FB --> DB

  A1 --> RES[JSON Response]
  P1 --> RES
  O1 --> RES
  PY1 --> RES
  AD1 --> RES
  R1 --> RES
  S1 --> SSERES[SSE Events]

  RT --> ERR[error.middleware]
  ERR --> RES
```

## 3) MongoDB ERD (Core Collections)

```mermaid
erDiagram
  USERS ||--o{ ORDERS : places
  USERS ||--o{ SESSIONS : authenticates
  USERS ||--o{ AUDIT_LOGS : performs
  USERS ||--o{ RECOMMEND_HISTORIES : receives
  USERS ||--o{ USER_EVENTS : generates
  PRODUCTS ||--o{ ORDERS : appears_in_items
  VOUCHERS o|--o{ ORDERS : applied_via_voucherCode

  USERS {
    ObjectId _id
    string name
    string email
    string phone
    string role
    string provider
    bool isActive
    datetime createdAt
  }

  PRODUCTS {
    ObjectId _id
    string externalId
    string name
    string slug
    number price
    string category
    string subCategory
    number stock
    bool isActive
    datetime createdAt
  }

  ORDERS {
    ObjectId _id
    string orderId
    ObjectId userId
    array items
    string status
    string payment.method
    string payment.status
    string payment.transactionId
    string voucherCode
    number subtotal
    number shippingFee
    number discount
    number totalAmount
    datetime createdAt
  }

  SESSIONS {
    string _id
    datetime expires
    string session_json
  }

  VOUCHERS {
    ObjectId _id
    string code
    string type
    number value
    number cap
    number minOrderValue
    number maxUses
    number usedCount
    bool isActive
    datetime expiresAt
  }

  AUDIT_LOGS {
    ObjectId _id
    ObjectId adminId
    string action
    string target
    mixed details
    string ip
    datetime createdAt
  }

  RECOMMEND_HISTORIES {
    ObjectId _id
    ObjectId userId
    array recommendations
    datetime createdAt
  }

  USER_EVENTS {
    ObjectId _id
    ObjectId userId
    string sessionId
    string eventType
    string productId
    mixed metadata
    datetime createdAt
  }
```

Ghi chu ERD:
- Quan he Voucher -> Order la quan he mem qua truong voucherCode (khong phai FK cung).
- Sessions la collection do connect-mongo quan ly de luu session dang nhap.

## 4) Auth + Session Flow (Customer/Admin)

```mermaid
sequenceDiagram
  participant U as User (Customer/Admin)
  participant FE as Frontend (4200/4201)
  participant BE as Backend
  participant SS as Session Store (MongoDB:sessions)
  participant DB as MongoDB (users)

  U->>FE: Submit login form
  FE->>BE: POST /api/auth/login or /api/auth/admin/login
  BE->>DB: Find user + verify password/role
  DB-->>BE: User record
  BE->>BE: Resolve session scope from route/origin
  BE->>SS: Create session document
  SS-->>BE: sessionId
  BE-->>FE: Set-Cookie (vvv.customer.sid or vvv.admin.sid)
  FE-->>U: Login success

  U->>FE: Access protected page
  FE->>BE: Request with cookie
  BE->>SS: Load session by sid
  SS-->>BE: userId + role
  BE->>BE: requireAuth/requirePermission
  BE-->>FE: Authorized data
```

## 5) Order + Payment (VNPay/MoMo) Flow

```mermaid
sequenceDiagram
  participant C as Customer FE
  participant B as Backend
  participant O as Orders Collection
  participant PDB as Products Collection
  participant VDB as Vouchers Collection
  participant P as VNPay/MoMo Gateway

  C->>B: POST /api/orders (items, delivery, payment)
  B->>PDB: Validate products + stock
  B->>VDB: Validate voucher (if provided)
  B->>O: Create order (pending)
  B->>VDB: Mark voucher used (if any)
  B->>PDB: Decrease stock per item
  O-->>B: orderId
  B-->>C: order created

  alt VNPay
    C->>B: POST /api/payment/vnpay/create (orderId)
    B->>O: Verify owner/admin + payment method + amount
    B-->>C: paymentUrl
    C->>P: Redirect to VNPay paymentUrl
    P-->>B: GET /api/payment/vnpay/ipn (signed callback)
    B->>O: verify amount/signature and update payment.status=paid
    P-->>B: GET /api/payment/vnpay/return
    B-->>C: Return payment result
  else MoMo
    C->>B: POST /api/payment/momo/create (orderId)
    B->>O: Verify owner/admin + payment method + amount
    B-->>C: payUrl
    C->>P: Redirect to MoMo
    P-->>B: POST /api/payment/momo/ipn
    B->>O: verify signature and update payment.status=paid
  end

  B-->>C: GET /api/orders/:id returns paid status
```

## 6) Recommendation Pipeline (Backend + ML + MongoDB)

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant BE as Backend /api/recommend
  participant ML as Flask ML API :5001
  participant MDB as MongoDB

  FE->>BE: POST /api/recommend (user_id, n, filters)
  BE->>ML: Proxy POST /api/recommend

  alt ML available
    ML-->>BE: recommendations[]
  else ML timeout/error
    BE->>MDB: Query Product fallback (stock + recency heuristic)
    MDB-->>BE: fallback recommendations[]
  end

  BE->>MDB: Save RecommendHistory (if logged in)
  BE-->>FE: success + data.recommendations

  FE->>BE: POST /api/recommend/event (view/add_to_cart/purchase)
  BE->>MDB: Save UserEvent telemetry
  BE-->>FE: success
```

## 7) Admin Backoffice Flow

```mermaid
flowchart LR
  A[Admin Portal :4201] --> B1[/api/admin/*]
  A --> B2[/api/products write routes]

  B1 --> M1[AuthN/AuthZ\nrequireBackofficeRole + requirePermission]
  B2 --> M2[AuthN/AuthZ\nrequireBackofficeRole admin/staff + products.write]

  M1 --> C1[Orders Management + Bulk Status]
  M1 --> C3[Vouchers Management]
  M1 --> C4[Export CSV (orders/products/users)]
  M2 --> C2[Create/Update/Delete Product]

  C1 --> DB[(MongoDB)]
  C2 --> DB
  C3 --> DB
  C4 --> DB

  C1 --> AL[Audit Logs (order update actions)]
  AL --> DB
```

## 8) BPMN-Style Process Diagrams

Luu y:
- Mermaid khong ho tro BPMN 2.0 native XML day du, nhung so do duoi day duoc ve theo phong cach BPMN (pool/lane, event, gateway, task) de dua vao report.

### 8.1 BPMN - Dang Nhap (Customer/Admin)

```mermaid
flowchart LR
  subgraph L1[Lane: User]
    S1((Start)) --> U1[Nhap email/mat khau]
    U1 --> U2[Gui yeu cau dang nhap]
  end

  subgraph L2[Lane: Frontend]
    F1[POST /api/auth/login\nhoac /api/auth/admin/login]
  end

  subgraph L3[Lane: Backend]
    B1[Validate input]
    B2[Tim user + verify password/role]
    G1{Hop le?}
    B3[Tao session trong MongoDB:sessions]
    B4[Set-Cookie\nvvv.customer.sid / vvv.admin.sid]
    B5[Tra loi loi 401/403]
  end

  subgraph L4[Lane: MongoDB]
    M1[(users)]
    M2[(sessions)]
  end

  U2 --> F1
  F1 --> B1 --> B2
  B2 --> M1
  B2 --> G1
  G1 -- No --> B5 --> E2((End: Login Failed))
  G1 -- Yes --> B3 --> M2
  B3 --> B4 --> E1((End: Login Success))
```

### 8.2 BPMN - Dat Hang va Thanh Toan

```mermaid
flowchart LR
  subgraph C[Lane: Customer]
    C0((Start)) --> C1[Checkout]
    C1 --> C2[Gui POST /api/orders]
    C7[Chon cong thanh toan]
  end

  subgraph FE[Lane: Frontend]
    F1[Hien thi trang thanh toan]
    F2[Goi tao link thanh toan]
    F3[Redirect toi cong thanh toan]
    F4[Hien thi ket qua thanh toan]
  end

  subgraph BE[Lane: Backend]
    B1[Validate items + delivery + tong tien]
    B2[Validate voucher neu co]
    G1{Hop le?}
    B3[Tao order status=pending]
    B4[Mark voucher used]
    B5[Tru stock san pham]
    G2{Phuong thuc?}
    B6[Tao VNPay URL\n/api/payment/vnpay/create]
    B7[Tao MoMo payUrl\n/api/payment/momo/create]
    B8[Xac minh IPN/return + cap nhat payment.status=paid]
    B9[Tra ve trang thai don]
    B10[Tra ve loi dat hang]
  end

  subgraph DB[Lane: MongoDB]
    D1[(products)]
    D2[(vouchers)]
    D3[(orders)]
  end

  subgraph PG[Lane: Payment Gateway]
    P1[VNPay Sandbox]
    P2[MoMo Sandbox]
    P3[IPN/Callback ve Backend]
  end

  C2 --> B1
  B1 --> D1
  B1 --> B2
  B2 --> D2
  B2 --> G1
  G1 -- No --> B10 --> E0((End: Failed))
  G1 -- Yes --> B3 --> D3
  B3 --> B4 --> D2
  B4 --> B5 --> D1
  B5 --> C7
  C7 --> F2 --> G2

  G2 -- VNPay --> B6 --> F3 --> P1 --> P3 --> B8
  G2 -- MoMo --> B7 --> F3 --> P2 --> P3 --> B8

  B8 --> D3
  B8 --> B9 --> F4 --> E1((End: Completed))
```

### 8.3 BPMN - Recommendation with Fallback

```mermaid
flowchart LR
  subgraph U[Lane: User/Frontend]
    S0((Start)) --> U1[Open Recommended Page]
    U1 --> U2[POST /api/recommend]
  end

  subgraph B[Lane: Backend]
    B1[Proxy request toi ML API]
    G1{ML response OK?}
    B2[Lay recommendations tu ML]
    B3[Lay fallback tu Product\n(stock + recency)]
    B4[Luu RecommendHistory neu da login]
    B5[Tra danh sach goi y]
  end

  subgraph M[Lane: ML Service]
    M1[Flask /api/recommend]
  end

  subgraph D[Lane: MongoDB]
    D1[(products)]
    D2[(recommendhistories)]
  end

  U2 --> B1 --> M1 --> G1
  G1 -- Yes --> B2 --> B4
  G1 -- No --> B3 --> D1 --> B4
  B4 --> D2
  B4 --> B5 --> E0((End))
```
