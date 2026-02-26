---
name: "Task 7+8 — Angular Reactive Forms + ngSwitch"
about: "Migration sang Reactive Forms và thêm ngSwitch directive"
title: "[Frontend] Task 7+8: Reactive Forms + Custom Validators + @switch directive"
labels: frontend, angular, priority-high
---

## Mục tiêu

Bổ sung 2 tiêu chí còn thiếu của môn học: Reactive Forms và ngSwitch directive.

## Checklist

### Task 7 — Reactive Forms + Custom Validators

- [ ] `register-page.component.ts`: Migrate từ Template-Driven sang Reactive Forms
  - [ ] Import `ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors`
  - [ ] Custom validator `phoneValidator` — regex `/^(0[3-9]\d{8})$/`
  - [ ] Custom validator `passwordMatchValidator` — group validator so sánh password và confirmPassword
  - [ ] FormGroup với fields: name, phone, email, address, password, confirmPassword
  - [ ] Template cập nhật: `[formGroup]`, `formControlName`, hiển thị error messages
- [ ] `account-page.component.ts`: Thêm form đổi mật khẩu Reactive
  - [ ] Custom validator `strongPasswordValidator` — length≥8, có uppercase, có số
  - [ ] Custom validator `confirmMatchValidator` — group validator
  - [ ] FormGroup: currentPassword, newPassword, confirmNew
  - [ ] Template: hiển thị error message real-time

### Task 8 — @switch Directive (ngSwitch)

- [ ] `order-detail-page.component.ts`: `@switch(order.status)` cho 5 trạng thái đơn hàng
  - [ ] pending: "🕐 Chờ xác nhận"
  - [ ] confirmed: "✅ Đã xác nhận"
  - [ ] shipping: "🚚 Đang giao hàng"
  - [ ] delivered: "📦 Đã giao"
  - [ ] cancelled: "❌ Đã hủy"
  - [ ] @default: hiển thị raw status
- [ ] `product-detail.component.ts`: `@switch(product.category)` cho icon danh mục
  - [ ] veg, fruit, meat, drink, dry, sweet, spice, household, frozen
- [ ] `admin-orders.component.ts`: `@switch` cho màu badge theo status

## Tham khảo

Xem `/.github/copilot-instructions.md` phần TASK-7, TASK-8.

## Acceptance Criteria

- Register form validation hiển thị lỗi real-time khi blur
- "Mật khẩu không khớp" hiện khi confirmPassword sai
- "Mật khẩu yếu" hiện nếu thiếu uppercase hoặc số (account form)
- Order detail hiển thị đúng label theo từng status
- KHÔNG có lỗi TypeScript/lint
