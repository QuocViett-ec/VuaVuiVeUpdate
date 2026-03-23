# Bug Fix Implementation Plan

## Scope

- Fix critical auth bugs first (change password, Google login token handling, forgot password OTP)
- Then continue with My Orders correctness and production hardening

## Current Status

- [x] P0.1 Implement forgot password OTP flow end-to-end (Email channel)
- [x] P0.2 Implement reset password API and frontend integration
- [x] P0.3 Improve Google login token error handling (expired vs invalid)
- [x] P0.4 Add production Google client ID to frontend prod env
- [x] P0.5 Add provider-aware change password guard for non-local password accounts
- [x] P1.1 My Orders API pagination + product enrich
- [x] P1.2 Cart persistence sync strategy (server-side)
- [x] P1.3 Return/refund state machine
- [x] P1.4 Production payment/cors/cookie final hardening

## 1) Change Password does not persist

### Root cause

- Local account flow works, but account without local password (e.g. Google-only) fails with generic behavior.
- No explicit branch for provider/password state.

### Fix implemented

- `PUT /api/auth/password` now returns explicit code `NEED_SET_LOCAL_PASSWORD` when user has no local password.
- Added `POST /api/auth/set-local-password` for authenticated users to set first local password.
- Account page now handles `NEED_SET_LOCAL_PASSWORD` and automatically switches to first-time local password setup flow.

### Files

- `backend/controllers/auth.controller.js`
- `backend/routes/auth.routes.js`
- `frontend/src/app/features/account/account-page/account-page.component.ts`

## 2) Google Login token issue

### Root cause

- Backend returned one generic message for both invalid and expired Google tokens.
- Production frontend environment missed `googleClientId`, causing button disabled in production build/runtime.

### Fix implemented

- Backend now returns:
  - `GOOGLE_TOKEN_EXPIRED`
  - `GOOGLE_TOKEN_INVALID`
- Frontend auth service now propagates backend `code` for proper fallback handling.
- Added `googleClientId` to production environment.

### Files

- `backend/controllers/auth.controller.js`
- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/environments/environment.prod.ts`

## 3) Forgot Password OTP not sent

### Root cause

- Frontend verify/reset logic was mocked by `setTimeout`, no backend call.
- Backend only generated reset token in DB but did not implement OTP verify/reset APIs.
- No email integration service configured.

### Fix implemented

- Added SMTP email service with `nodemailer`.
- Added OTP fields on user model.
- Implemented APIs:
  - `POST /api/auth/forgot-password` (generate OTP + send email)
  - `POST /api/auth/verify-otp` (validate OTP, issue reset token)
  - `POST /api/auth/reset-password` (set new password via reset token)
- Frontend forgot-password page now calls real APIs for verify/reset.

### Files

- `backend/models/User.model.js`
- `backend/services/mail.service.js`
- `backend/controllers/auth.controller.js`
- `backend/routes/auth.routes.js`
- `backend/middleware/csrf.middleware.js`
- `backend/package.json`
- `backend/.env.example`
- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/app/features/auth/forgot-password-page/forgot-password-page.component.ts`

## 4) Build and validation results

- Frontend customer build: PASS
- Backend updated files syntax check: PASS
- Validation marker: `BACKEND_SYNTAX_OK`

## 5) Required env setup before runtime test

Set in backend `.env`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `PASSWORD_RESET_OTP_TTL_MINUTES`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `RESEND_API_KEY` (recommended primary provider)
- `RESEND_FROM_EMAIL` (or `MAIL_FROM`)

## 6) Completed implementation batch (P1.2-P1.4)

1. Added server-side cart persistence APIs and auth-protected routes (`/api/cart/me`, sync/merge/clear).
2. Frontend cart now merges local cart on login and debounced-syncs mutations to backend.
3. Added return/refund states in order model and lifecycle handlers (`requestReturn`, review, mark refunded).
4. Frontend customer pages now allow return request action (within return window) and display return/refund statuses.
5. Hardened production server behavior for CORS/origin config and payment callback URL validation.

## 7) Newly completed (P1.1)

- Backend `GET /api/orders/me` supports `page`, `limit`, `status` query params.
- Response contract now includes pagination metadata: `data.items` + `data.pagination`.
- Order items are enriched from product source with fallback `productName` and `imageUrl`.
- Frontend order service now supports both old array response and new paginated response.
