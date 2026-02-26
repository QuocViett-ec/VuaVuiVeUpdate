---
name: "Task 6 — Admin + Audit Logs"
about: "API quản trị users và audit logs"
title: "[Backend] Task 6: Admin Users + Audit Logs + Dashboard Stats"
labels: backend, admin, priority-medium
---

## Mục tiêu
API quản trị người dùng, audit logs, và dashboard statistics.

## Checklist

- [ ] `backend/controllers/user.controller.js`:
  - [ ] `listUsers` — GET /api/admin/users?search=&role=&page=
  - [ ] `getUserById` — GET /api/admin/users/:id (kèm orders count)
  - [ ] `updateUser` — PUT /api/admin/users/:id (role, isActive)
  - [ ] `deleteUser` — DELETE /api/admin/users/:id (soft delete)
  - [ ] `listAuditLogs` — GET /api/admin/audit-logs?page=&limit=
  - [ ] `createAuditLog` — POST /api/admin/audit-logs (internal)
  - [ ] `getDashboardStats` — GET /api/admin/dashboard/stats → { totalUsers, totalOrders, totalRevenue, pendingOrders, recentOrders }
- [ ] `backend/routes/user.routes.js`
- [ ] Gọi `createAuditLog` trong auth.controller sau mỗi login/logout của admin

## Tham khảo
Xem `/.github/copilot-instructions.md` phần TASK-6.

## Acceptance Criteria
- GET /api/admin/dashboard/stats trả JSON có đủ 5 fields
- Mọi admin endpoint trả 403 nếu không phải admin
- Audit log được tạo tự động sau mỗi hành động admin
