---
name: "Task 9 — Angular → Backend HTTP"
about: "Cập nhật Services gọi backend Express thay vì localStorage"
title: "[Frontend] Task 9: Angular Services dùng HttpClient + withCredentials"
labels: frontend, integration, priority-medium
---

## Mục tiêu

Kết nối Angular frontend với Express backend: AuthService, ProductService, OrderService dùng HTTP thay localStorage.

## Prerequisites

- Task 1+2+3 phải DONE (backend đang chạy tại http://localhost:3000)

## Checklist

### credentials.interceptor.ts

- [ ] Đảm bảo `withCredentials: true` được set cho MỌI request đến `environment.apiBase`

### auth.service.ts

- [ ] `login()` → `POST /api/auth/login` với `{ credential, password }` — KHÔNG dùng localStorage nữa
- [ ] `register()` → `POST /api/auth/register`
- [ ] `logout()` → `POST /api/auth/logout`
- [ ] `me()` → `GET /api/auth/me` — gọi khi app khởi động để restore session
- [ ] `updateProfile()` → `PUT /api/auth/profile`
- [ ] `changePassword()` → `PUT /api/auth/password`
- [ ] Dùng `signal<User | null>` cho currentUser, cập nhật sau mỗi HTTP call

### product.service.ts

- [ ] `getProducts(params)` → `GET /api/products?...`
- [ ] `getProductById(id)` → `GET /api/products/:id`
- [ ] `createProduct(fd: FormData)` → `POST /api/products`
- [ ] `updateProduct(id, fd: FormData)` → `PUT /api/products/:id`
- [ ] `deleteProduct(id)` → `DELETE /api/products/:id`

### order.service.ts

- [ ] `createOrder(payload)` → `POST /api/orders`
- [ ] `getMyOrders()` → `GET /api/orders/me`
- [ ] `getOrderById(id)` → `GET /api/orders/:id`

### environment.ts

- [ ] `apiBase: 'http://localhost:3000'`
- [ ] `environment.prod.ts`: `apiBase: 'https://your-production-url.com'`

## Tham khảo

Xem `/.github/copilot-instructions.md` phần TASK-9.

## Acceptance Criteria

- Đăng nhập frontend → backend set cookie → Angular nhận session
- Refresh trang → session vẫn còn (gọi GET /api/auth/me khi app init)
- Checkout → đơn hàng lưu được vào MongoDB
