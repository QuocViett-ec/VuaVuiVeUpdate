---
name: "Task 4+5 — Products & Orders API"
about: "CRUD Products với File Upload + Orders API"
title: "[Backend] Task 4+5: Products CRUD (multer) + Orders API (MongoDB)"
labels: backend, priority-medium
---

## Mục tiêu

API CRUD đầy đủ cho sản phẩm (kèm upload ảnh multer) và đơn hàng lưu MongoDB.

## Checklist

### Task 4 — Products CRUD + File Upload

- [ ] `backend/controllers/product.controller.js`:
  - [ ] `getAll` — list với filter category, search text, pagination (?page=&limit=&sort=)
  - [ ] `getOne` — by id hoặc slug
  - [ ] `create` — admin only + multer upload image → lưu imageUrl
  - [ ] `update` — admin only + optional image update
  - [ ] `remove` — soft delete (isActive = false), admin only
  - [ ] `getCategories` — distinct categories
- [ ] `backend/routes/product.routes.js`
- [ ] Static serve `GET /uploads/*` từ server.js

### Task 5 — Orders CRUD

- [ ] `backend/controllers/order.controller.js`:
  - [ ] `createOrder` — auth required, save to MongoDB, return orderId
  - [ ] `getMyOrders` — auth required, lịch sử của user hiện tại
  - [ ] `getOrderById` — auth, chỉ owner hoặc admin
  - [ ] `updateStatus` — admin only: pending→confirmed→shipping→delivered hoặc cancelled
  - [ ] `getAllOrders` — admin only với filter + pagination
- [ ] `backend/routes/order.routes.js`

## Tham khảo

Xem `/.github/copilot-instructions.md` phần TASK-4, TASK-5.

## Acceptance Criteria

- `POST /api/products` với form-data (image file) → lưu file vào `uploads/products/`, lưu imageUrl vào DB
- `GET /api/products?category=veg&page=1&limit=10` trả đúng kết quả phân trang
- `POST /api/orders` → tạo đơn mới, trả `{ success: true, data: { orderId } }`
- `GET /api/orders/me` → trả danh sách đơn của user đang login
