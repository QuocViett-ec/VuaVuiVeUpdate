# Requirement baseline

Đã xác minh từ source sau thay đổi; acceptance criteria sau đây mô tả hành vi cần giữ. Owner cần duyệt các quyết định shipping fee, return window, TTL và SLA trước phát hành; source hiện hành là bằng chứng hành vi, không tự thay thế hợp đồng nghiệp vụ.

| ID | Requirement / acceptance criteria | Source |
|---|---|---|
| R01 | Server dùng Product.price, group item trùng, quantity integer 1–1000; tính subtotal/shipping/voucher; không nhận total/client paid | backend/services/order-rules.js; order-lifecycle.js |
| R02 | Idempotency-Key 16–128 ký tự; cùng user/key/body replay cùng order, khác body 409 | order-lifecycle.js; Order.model.js |
| R03 | Trừ stock, dùng voucher, order và shipment cùng transaction; thất bại rollback; last unit/voucher không bán quá | order-lifecycle.js |
| R04 | Origin allowlist chính xác; mutation có custom header, webhook ký số được miễn header | config/origins.js; middleware/csrf.middleware.js |
| R05 | Login regenerate session; khóa/role/password thay đổi revoke; staff/audit đăng nhập đúng portal | auth.controller.js; auth.middleware.js; User.model.js |
| R06 | MoMo/VNPay disabled mặc định, UI ẩn và server từ chối tạo; callback code giữ nguyên khả năng xử lý giao dịch cũ | config/payment.js; payment.routes.js; environment files |
| R07 | Online paid chỉ sau chữ ký, đúng amount/gateway/transaction; duplicate callback không ghi đè transaction | payment.controller.js; payment-state.js |
| R08 | Order transitions hợp lệ; online chưa paid không shipping; package riêng không giao các package còn lại | order-rules.js; shipment-lifecycle.js |
| R09 | Hủy/nhận hàng trả hoàn kho một lần; giao thất bại chưa nhận lại không hoàn kho | order-lifecycle.js; shipment-lifecycle.js |
| R10 | Online pending hết TTL được hủy và giải phóng kho/voucher; COD không hết hạn; callback trễ không mở lại đơn đã hủy | expireUnpaidOrders; payment-state.js |
| R11 | COD delivered vẫn pending cho đến khi có biên nhận thu tiền; paid không thể giả từ customer | recordCodPayment; order.routes.js |
| R12 | Refund chỉ ghi nhận bằng chứng đã hoàn cho returned/cancelled paid; amount đúng total; admin-only; không chuyển tiền tự động | refund; order.routes.js |
| R13 | Review/rating/soldCount từ DB; chưa có review hiển thị chưa đánh giá; không sinh oldPrice/lượt bán giả | product.controller.js; product-card/product-list |
| R14 | ML không tin identity client; hiển thị price/stock/reviews từ Mongo; token, input limits và snapshot riêng ở production | recommend.routes.js; src/api.py |
| R15 | Upload chỉ signature JPEG/PNG/WebP, ≤5MB; production mount tuyệt đối; dữ liệu tồn tại sau redeploy | upload.middleware.js; uploads.js; gate staging |
| R16 | DB QA tách biệt, seed có guard; log redact; readiness đúng; shutdown an toàn | test-data-guard.js; logger.js; server.js |
| R17 | Backup restore khôi phục dữ liệu/index/ảnh; rollback không mất đơn mới; cần diễn tập staging | ops/production.md; restore-drill.cjs |
| R18 | CI kiểm tra code thật, Mongo replica set, browser, audit và build cả portal; chỉ mở production khi gate bắt buộc Passed | .github/workflows/quality.yml; release-gates.md |
| R19 | CD chỉ dùng artifact của CI push thành công cùng repo/nhánh release; checksum/commit đúng; staging và production tách targets; production cần reviewer, approval SHA và evidence staging; rollback xác minh baseline | ops/release.cjs; validate-release-run.cjs; .github/workflows/release.yml |
| R20 | Cùng JS build dùng được trên staging/production qua public runtime config; origins HTTPS hợp lệ; không cho runtime bật payment; admin xuất index.html | src/load-runtime-config.ts; frontend/angular.json |
| R21 | APP_ENV=staging dùng URI DB *_staging; staging có thể opt-in upload ephemeral tuyệt đối, production từ chối mode này; Render proxy hop count đúng kiểu số; ML phục vụ bằng single-worker Gunicorn với token guard | config/db.js; config/uploads.js; config/proxy.js; gunicorn.conf.py |

Chưa xác định: hosting/storage thực tế, owner vận hành, traffic mục tiêu, SLA, key provider, snapshot ML và lịch sử credentials. Không điền bằng dữ liệu giả.
