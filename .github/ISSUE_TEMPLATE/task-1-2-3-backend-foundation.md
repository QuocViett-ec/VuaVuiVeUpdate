---
name: "Task 1+2+3 — Backend Foundation"
about: "Express MVC + MongoDB + Auth API"
title: "[Backend] Task 1+2+3: Express MVC + MongoDB + Auth (Session/Cookie)"
labels: backend, priority-high
---

## Mục tiêu

Tạo toàn bộ nền tảng backend theo kiến trúc MVC với MongoDB và Authentication.

## Checklist

### Task 1 — Cấu trúc Express MVC

- [ ] `backend/config/db.js` — mongoose.connect() + retry logic
- [ ] `backend/middleware/error.middleware.js` — global error handler
- [ ] `backend/middleware/auth.middleware.js` — requireAuth, requireAdmin
- [ ] `backend/middleware/upload.middleware.js` — multer cho ảnh sản phẩm
- [ ] `uploads/products/.gitkeep` — tạo thư mục upload

### Task 2 — MongoDB Models (Mongoose)

- [ ] `backend/models/User.model.js` — schema + bcrypt pre-save hook
- [ ] `backend/models/Product.model.js` — schema với slug auto-gen, category enum
- [ ] `backend/models/Order.model.js` — schema với items[], delivery, payment, status
- [ ] `backend/models/AuditLog.model.js` — schema cho admin logs
- [ ] `backend/scripts/seed.js` — seed 1 admin user + sample products từ backoffice/data/products.json

### Task 3 — Auth API

- [ ] `backend/controllers/auth.controller.js` — register, login, logout, me, updateProfile, changePassword, forgotPassword
- [ ] `backend/routes/auth.routes.js` — map endpoints tới controller
- [ ] Test: POST /api/auth/register tạo user mới
- [ ] Test: POST /api/auth/login trả session cookie `vvv.sid`
- [ ] Test: GET /api/auth/me trả thông tin user đang đăng nhập
- [ ] Test: POST /api/auth/logout xóa session

## Tham khảo

Xem `/.github/copilot-instructions.md` phần TASK-1, TASK-2, TASK-3 để biết chi tiết schema và endpoints.

## Acceptance Criteria

- `npm start` trong `backend/` chạy không lỗi
- Kết nối được MongoDB (local hoặc Atlas)
- Login trả `Set-Cookie: vvv.sid=...`
- `/api/auth/me` trả 401 khi chưa login, 200 + user khi đã login
