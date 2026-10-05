# Render configuration execution — 2026-10-05

Người dùng cho phép thêm Gunicorn và đọc hai named Render export files để điều chỉnh staging. Secret values không hiển thị/copy vào source/report; exports không thay đổi, không được dùng để chạy test hoặc connect production, đã gitignored. Git deletions/build artifacts có sẵn giữ nguyên.

Đã xác minh export: backend Node production/port10000, session đủ length, 6 HTTPS allowlisted origins và portal bases khớp; Mongo DB chưa có hậu tố staging. Thiếu APP_ENV/upload path/mode/internal ML token. ML Python3.11.9, CF disabled, snapshot path absolute trong repo; thiếu ML_ENV/APP_ENV/token. Nội dung export không chứng minh settings/cloud runtime hiện tại đã được cập nhật.

Thay đổi: Gunicorn26.2 + bind PORT/single sync worker/no access query log; CI cài actual ML requirements; real Linux WSGI test với source thật và tiny synthetic artifacts; staging DB guard trước connect; ephemeral uploads opt-in chỉ staging với absolute path; numeric TRUST_PROXY parsing; smoke đối chiếu backend/ML environment; safe examples và operator guide.

| Execution | Result / evidence |
|---|---|
| Backend full Jest + Mongo QA replica set | Passed — 64 tests / 7 suites; gồm20 Mongo integration và6 deployment config tests |
| Node deployment tests | Passed — 9 tests, có rejection environment mismatch |
| ML Linux Docker dependency install/build | Passed — requirements thực, Python3.11/Gunicorn26.2 |
| Python tests trên Linux | Passed — 7 tests; real Gunicorn starts src.wsgi:app, health ready, token401/validation400; synthetic features/mapping/snapshot only |
| Backend production Docker build | Passed |
| Workflow syntax | Passed — actionlint1.7.12, shellcheck disabled |
| Export ignore check | Passed — git check-ignore cả hai named files |
| Render/Vercel changes / Atlas writes / provider/email requests | Not Run — không gọi cloud deploy hoặc tạo tài nguyên trong phiên |
| Real recommendation mapping / real model RAM on Render Free | Not Run — actual WSGI smoke không chứng minh model accuracy/identity mapping |
| Frontend browser/build | Không chạy lại trong phiên — frontend không thay đổi; kết quả 2026-10-04 giữ nguyên như evidence lịch sử |

APP_ENV=staging vẫn dùng NODE_ENV/ML_ENV=production để giữ safeguards. Staging ảnh tạm có thể mất khi restart/redeploy, không đóng production persistent-storage gate. Gunicorn approval đã giải quyết dependency/WSGI blocker; model/mapping và staging cloud cần execution riêng. Pipeline production gates giữ nguyên.

Hướng dẫn operator: [ops/render-staging.md](../../ops/render-staging.md). CI cloud và staging release chưa được publish/executed; không tạo số liệu production Passed từ kết quả local.
