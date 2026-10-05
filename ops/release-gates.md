# Quyết định phát hành

Ngày chạy local: 2026-10-04. **NO GO** cho production. Local code/test hoàn thành không đồng nghĩa đã cấu hình hosting, thanh toán business hoặc khôi phục DB nghiệp vụ.

| Gate | Trạng thái | Bằng chứng / bước còn thiếu |
|---|---|---|
| Server tính tiền, không nhận client paid | Passed local | order-rules + orders.integration |
| Stock/voucher/Order/Shipment transaction và retry | Passed local | Replica set QA; last unit, voucher capacity, rollback, duplicate key, cancel |
| Session revoke/CORS/CSRF | Passed local | security + integration; cross-domain cookie staging chưa chạy |
| Lifecycle/COD/refund evidence | Passed local | Integration; provider refund tự động chưa triển khai |
| Runtime JS dependency audit high/critical | Passed local | Backend omit-dev, frontend audit; dev backend braces còn high |
| Browser customer checkout + WCAG AA trong checkout | Passed local | 6 Playwright tests API mock; chưa audit toàn bộ site/admin |
| Customer/admin production build | Passed local | Build commands; có warning Account import không sử dụng |
| Mongo synthetic backup–restore | Passed local | 2 bản ghi, total 185000, unique index preserved |
| Thanh toán sandbox end-to-end | Blocked | Chưa có business/sandbox keys; MoMo/VNPay giữ tắt |
| Legacy data reconciliation và indexes | Not Run | Operator dry-run/staging trước; không tự sửa DB cũ |
| Persistent images survive redeploy | Not Run | Mount storage và diễn tập staging |
| ML WSGI + trusted snapshot + mapping | Blocked cho cloud/model | Update2026-10-05: Gunicorn approved + real WSGI Linux synthetic Passed; trusted snapshot/Mongo mapping/cloud chưa xác minh |
| Health monitor/alert delivery | Not Run | Cấu hình tài khoản vận hành và test cảnh báo |
| Staging restore DB + uploads và rollback | Not Run | Diễn tập thực tế, đo RPO/RTO |
| Tải đồng thời theo traffic mục tiêu | Not Run | Local race tests đã pass; chưa có mục tiêu tải/staging load test |
| CI trên GitHub | Not Run | Workflow đã thêm; chỉ các bước tương ứng chạy local |
| File key/config nhạy cảm được tracked | Blocked | Chưa đọc nội dung nên chưa xác định có key thật; chủ sở hữu xác minh, thu hồi/rotate nếu cần và bỏ tracking |

P0 chỉ đóng khi xác minh cả code lẫn cấu hình và dữ liệu staging. Không bật payment, không deploy production tự động trong workflow này. Người chịu trách nhiệm release ghi build/commit, kết quả gate, rủi ro được chấp nhận và quyết định duyệt phát hành sau khi tất cả điều kiện bắt buộc đã đạt.
