# Quyết định phát hành

Cập nhật: 2026-10-05. **NO GO** cho production. CI và staging smoke đã đạt; CD GitHub, phục hồi cloud và các gate nghiệp vụ còn thiếu. [Bằng chứng mới](../qa-portfolio/reports/2026-10-05-devops.md).

| Gate | Trạng thái | Bằng chứng / bước còn thiếu |
|---|---|---|
| Server tính tiền, không nhận client paid | Passed local | order-rules + orders.integration |
| Stock/voucher/Order/Shipment transaction và retry | Passed local | Replica set QA; last unit, voucher capacity, rollback, duplicate key, cancel |
| Session revoke/CORS/CSRF | Passed local | security + integration; cross-domain cookie staging chưa chạy |
| Lifecycle/COD/refund evidence | Passed local | Integration; provider refund tự động chưa triển khai |
| Runtime JS dependency audit high/critical | Passed local | Backend omit-dev, frontend audit; dev backend braces còn high |
| Browser customer checkout + WCAG AA trong checkout | Passed local | 6 Playwright tests API mock; chưa audit toàn bộ site/admin |
| Customer/admin production build | Passed local | Build commands; có warning Account import không sử dụng |
| Mongo và uploads synthetic backup–restore | Passed local | 2 bản ghi, total 185000, unique index; 1 ảnh giả khôi phục từ tar.gz và SHA256 khớp |
| Thanh toán sandbox end-to-end | Blocked | Chưa có business/sandbox keys; MoMo/VNPay giữ tắt |
| Legacy data reconciliation và indexes | Passed một phần staging | Required Order/Shipment indexes đã tạo và startup đạt; đối soát dữ liệu legacy còn Not Run |
| Persistent images survive redeploy | Not Run | Mount storage và diễn tập staging |
| ML WSGI + trusted snapshot + mapping | Passed runtime; Blocked model/mapping | Render staging health adapter_ready đạt; snapshot nghiệp vụ/Mongo mapping chưa xác minh |
| Health monitor/alert delivery | Passed probe; Not Run delivery | Probe staging thật đạt; workflow định kỳ và drill cần chạy trên GitHub, chủ sở hữu xác nhận nhận cảnh báo |
| Staging restore DB + uploads và rollback | Not Run | Diễn tập thực tế, đo RPO/RTO |
| Tải đồng thời theo traffic mục tiêu | Not Run | Local race tests đã pass; chưa có mục tiêu tải/staging load test |
| CI trên GitHub | Passed | Quality gates run 37275268515, commit ffa504d |
| CD staging trên GitHub | Not Run | Fullstack release run 37275502546 Skipped; staging hiện tại được deploy bằng MCP/CLI |
| File key/config nhạy cảm được tracked | Blocked | Chưa đọc nội dung nên chưa xác định có key thật; chủ sở hữu xác minh, thu hồi/rotate nếu cần và bỏ tracking |

P0 chỉ đóng khi xác minh cả code lẫn cấu hình và dữ liệu staging. Không bật payment, không deploy production tự động trong workflow này. Người chịu trách nhiệm release ghi build/commit, kết quả gate, rủi ro được chấp nhận và quyết định duyệt phát hành sau khi tất cả điều kiện bắt buộc đã đạt.
