# Vựa Vui Vẻ — Copilot Agent Instructions

## Tổng quan dự án

Đây là bài tập lớn môn Web2 (Angular + Node.js + MongoDB + ML).

- **Frontend**: Angular 17+ Standalone Components tại `frontend/`
- **Backend**: Express.js MVC tại `backend/` (đang xây dựng)
- **Database**: MongoDB (Mongoose)
- **ML**: Python Flask Recommender tại `VuaVuiVe_Recommender/`

## Nguyên tắc bắt buộc

### Angular (frontend/)

- Dùng **Standalone Components** (KHÔNG dùng NgModule)
- Dùng **Signals** cho state (`signal()`, `computed()`, `effect()`)
- Dùng **native control flow**: `@if`, `@for`, `@switch` — KHÔNG dùng `*ngIf`, `*ngFor`
- **Reactive Forms** phải dùng `FormBuilder`, `FormGroup`, `Validators`
- **Custom Validators** phải implement `ValidatorFn` hoặc `AsyncValidatorFn`
- `ChangeDetectionStrategy.OnPush` cho mọi component
- `inject()` thay cho constructor injection
- File styles: `.scss`
- KHÔNG import `standalone: true` (mặc định trong Angular 17+)

### Backend (backend/)

- Kiến trúc **MVC**: Models → Controllers → Routes
- **MongoDB** qua Mongoose (KHÔNG dùng JSON file)
- **express-session** + **connect-mongo** cho authentication
- **bcryptjs** để hash password
- **multer** cho file upload
- Mọi route cần auth phải qua `authMiddleware`
- Mọi route admin phải qua `adminMiddleware`
- Trả về JSON chuẩn: `{ success, data, message, error }`

---

## Danh sách Tasks

### TASK-1: Express Backend MVC Structure ✅ DONE

File đã tạo: `backend/server.js`, `backend/package.json`, `backend/.env`
Cần hoàn thiện: config/, models/, controllers/, routes/, middleware/

### TASK-2: MongoDB Connection + Mongoose Models

**File cần tạo:**

- `backend/config/db.js` — mongoose.connect() với retry logic
- `backend/models/User.model.js` — fields: name, phone, email, password(hashed), address, role('user'|'admin'), createdAt
- `backend/models/Product.model.js` — fields: name, slug, price, originalPrice, category, subCategory, description, imageUrl, stock, unit, tags[], isActive, createdAt
- `backend/models/Order.model.js` — fields: orderId(unique), userId(ref User), items[{productId,productName,quantity,price,subtotal}], delivery{name,phone,address,slot}, payment{method('cod'|'vnpay'),status('pending'|'paid')}, voucherCode, shippingFee, discount, subtotal, totalAmount, status('pending'|'confirmed'|'shipping'|'delivered'|'cancelled'), note, createdAt
- `backend/models/AuditLog.model.js` — fields: adminId(ref User), action, target, details, ip, createdAt

### TASK-3: Auth API (Session + Cookie)

**File cần tạo:**

- `backend/controllers/auth.controller.js`
- `backend/routes/auth.routes.js`
- `backend/middleware/auth.middleware.js`

**Endpoints:**

```
POST /api/auth/register  → validate → bcrypt hash → save User → set session → return user
POST /api/auth/login     → find user by phone/email → bcrypt compare → set session → return user
POST /api/auth/logout    → req.session.destroy() → clear cookie
GET  /api/auth/me        → return req.session user hoặc 401
PUT  /api/auth/profile   → update name/phone/address (auth required)
PUT  /api/auth/password  → change password (verify old, hash new)
POST /api/auth/forgot-password → generate reset token, save to user
```

**Session object:** `req.session.userId`, `req.session.role`, `req.session.name`

**auth.middleware.js:**

```js
exports.requireAuth = (req, res, next) => {
  /* check req.session.userId */
};
exports.requireAdmin = (req, res, next) => {
  /* check req.session.role === 'admin' */
};
```

### TASK-4: Products CRUD + File Upload

**File cần tạo:**

- `backend/controllers/product.controller.js`
- `backend/routes/product.routes.js`
- `backend/middleware/upload.middleware.js` — multer diskStorage → `uploads/products/`

**Endpoints:**

```
GET    /api/products              → list với query: ?category=&search=&page=&limit=&sort=
GET    /api/products/:id          → detail by id or slug
POST   /api/products              → create (admin) + multer upload single('image')
PUT    /api/products/:id          → update (admin) + multer upload single('image')
DELETE /api/products/:id          → soft delete isActive=false (admin)
GET    /api/products/categories   → list distinct categories
```

**upload.middleware.js:**

```js
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/products/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
exports.uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");
```

### TASK-5: Orders CRUD

**File cần tạo:**

- `backend/controllers/order.controller.js`
- `backend/routes/order.routes.js`

**Endpoints:**

```
POST /api/orders             → tạo đơn (auth) — lưu MongoDB, trả orderId
GET  /api/orders/me          → đơn của user hiện tại (auth), sort by createdAt desc
GET  /api/orders/:id         → chi tiết đơn (auth, chỉ owner hoặc admin)
PUT  /api/orders/:id/status  → cập nhật status (admin only)
GET  /api/admin/orders       → all orders (admin), filter ?status=&page=
```

### TASK-6: Users + Admin Endpoints

**File cần tạo:**

- `backend/controllers/user.controller.js`
- `backend/routes/user.routes.js`

**Endpoints:**

```
GET    /api/admin/users              → list users (admin), ?search=&page=
GET    /api/admin/users/:id          → user detail + orders count
PUT    /api/admin/users/:id          → update role/status (admin)
DELETE /api/admin/users/:id          → delete (admin)
GET    /api/admin/audit-logs         → list logs (admin), ?page=&limit=
POST   /api/admin/audit-logs         → create log (internal use)
GET    /api/admin/dashboard/stats    → { totalUsers, totalOrders, totalRevenue, pendingOrders }
```

### TASK-7: Angular Reactive Forms + Custom Validators

**Files cần sửa:**

#### `frontend/src/app/features/auth/register-page/register-page.component.ts`

Chuyển sang Reactive Forms:

```ts
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";

// Custom validators:
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  return /^(0[3-9]\d{8})$/.test(control.value) ? null : { invalidPhone: true };
}
function passwordMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const pw = group.get("password")?.value;
  const confirm = group.get("confirmPassword")?.value;
  return pw === confirm ? null : { passwordMismatch: true };
}

// FormGroup:
registerForm = this.fb.group(
  {
    name: ["", [Validators.required, Validators.minLength(2)]],
    phone: ["", [Validators.required, phoneValidator]],
    email: ["", [Validators.email]],
    address: [""],
    password: ["", [Validators.required, Validators.minLength(6)]],
    confirmPassword: ["", Validators.required],
  },
  { validators: passwordMatchValidator },
);
```

Template dùng `[formGroup]`, `formControlName`, hiển thị lỗi qua `form.get('field')?.errors`.

#### `frontend/src/app/features/account/account-page/account-page.component.ts`

Thêm form đổi mật khẩu Reactive:

```ts
// Custom validator:
function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value || '';
  if (v.length < 8) return { tooShort: true };
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[0-9]/.test(v)) return { noNumber: true };
  return null;
}

passwordForm = this.fb.group({
  currentPassword: ['', Validators.required],
  newPassword: ['', [Validators.required, strongPasswordValidator]],
  confirmNew: ['', Validators.required],
}, { validators: /* confirmMatch */ });
```

### TASK-8: ngSwitch Directive

**Files cần sửa:**

#### `frontend/src/app/features/orders/order-detail-page/order-detail-page.component.ts`

Dùng `@switch` cho order status badge:

```html
<span class="status-badge" [class]="'status-' + order.status">
  @switch (order.status) { @case ('pending') { 🕐 Chờ xác nhận } @case
  ('confirmed') { ✅ Đã xác nhận } @case ('shipping') { 🚚 Đang giao } @case
  ('delivered') { 📦 Đã giao } @case ('cancelled') { ❌ Đã hủy } @default { {{
  order.status }} } }
</span>
```

#### `frontend/src/app/features/products/product-detail/product-detail.component.ts`

Dùng `@switch` cho category icon/label:

```html
@switch (product.category) { @case ('veg') { 🥦 Rau củ } @case ('fruit') { 🍎
Trái cây } @case ('meat') { 🥩 Thịt cá } @case ('drink') { 🥤 Đồ uống } @case
('dry') { 🌾 Hàng khô } @default { 🛒 {{ product.category }} } }
```

#### `frontend/src/app/features/admin/admin-orders/admin-orders.component.ts`

Dùng `@switch` cho status filter + badge màu.

### TASK-9: Angular Services → HTTP Backend

**Files cần sửa:**

- `frontend/src/app/core/services/auth.service.ts` — thay localStorage bằng HTTP calls tới `/api/auth/*` với `withCredentials: true`
- `frontend/src/app/core/services/product.service.ts` — GET/POST/PUT/DELETE `/api/products`
- `frontend/src/app/core/services/order.service.ts` — POST/GET `/api/orders`
- `frontend/src/app/core/interceptors/credentials.interceptor.ts` — thêm `withCredentials: true` cho mọi request tới apiBase

### TASK-10: ML Recommender Proxy

**File cần tạo:** `backend/routes/recommend.routes.js`
**File cần sửa:** `frontend/src/app/core/services/recommender.service.ts`

Backend proxy:

```js
// GET/POST /api/recommend → fetch từ process.env.RECOMMENDER_API + lưu history MongoDB
```

---

## Cấu trúc thư mục mong đợi sau khi hoàn thành

```
VuaVuiVeUpdate/
  frontend/          ← Angular 17+ app
  backend/           ← Express MVC API
    server.js
    .env
    config/db.js
    models/
    controllers/
    routes/
    middleware/
    uploads/
  .github/
    copilot-instructions.md   ← file này
    ISSUE_TEMPLATE/
```
