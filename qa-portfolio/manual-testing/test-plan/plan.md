# Test plan

Mục tiêu: ưu tiên correctness/bảo mật và khả năng phục hồi trước làm đẹp report. Local scope gồm quy tắc giá, auth/CORS, transaction/payment/lifecycle, dependency audit và checkout. Staging scope gồm toàn bộ customer/admin flow, email/Google, persistent images, provider sandbox, ML, load, backup và rollback.

| Mức | Rủi ro | Kiểu kiểm thử |
|---|---|---|
| P0 | Total/client paid, bán quá kho/voucher, đơn trùng, callback giả/trùng, session vẫn truy cập sau revoke | API + DB replica-set + unit security; sandbox bổ sung |
| P1 | Trạng thái shipment, trả/hoàn, TTL, giá/review giả, ảnh mất, ML identity, backup | Integration + manual staging + restore drill |
| P2 | Responsive, labels/contrast, usability, compatibility, reports | Browser smoke + exploratory nhiều browser |

Entry: DB test riêng, fixture kiểm soát, flags online tắt, versions từ lockfile. Exit local: tests/build phù hợp Passed; blocker ghi rõ. Exit production: toàn bộ gate bắt buộc ở `ops/release-gates.md` đạt và owner ký quyết định.

Manual execution dùng tài khoản user/staff/audit/admin giả ở staging. Không dùng retry để giấu flaky test, không chờ cố định; locator role/label. Browser smoke dùng Chromium và API mock; chưa bao phủ Safari/Firefox, keyboard/focus toàn site hoặc toàn admin. Mọi ảnh/log evidence cần redact trước chia sẻ.

Environment đã chạy: Windows, Node 24.11.0, MongoDB 7.0 replica set trong container QA, Chromium Playwright; không kết nối production. Scope ngoại vi chưa chạy phải ghi Not Run/Blocked.
