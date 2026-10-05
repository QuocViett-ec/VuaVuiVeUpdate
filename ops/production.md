# Triển khai và vận hành

Trạng thái hiện tại: **NO GO** cho production. Thay đổi đã kiểm tra ở local; chưa deploy, chưa chạy migration/index trên DB đang sử dụng. Checklist phát hành nằm ở [release-gates.md](release-gates.md). Đây là hướng dẫn dựa trên cấu hình trong repository; cấu hình tài khoản hosting chưa được xác nhận.

## Môi trường

| Thành phần | Local QA | Staging | Production |
|---|---|---|---|
| MongoDB | `ops/compose.qa.yml`, replica set disposable, cổng 27019 loopback | DB/tài khoản riêng, tên kết thúc `_staging` | Replica set/Atlas, tài khoản riêng, không seed |
| Customer/admin | Angular build, API giả cho browser smoke | Hai hostname HTTPS riêng, proxy `/api` và `/uploads` | Hai hostname chính thức, proxy cùng backend |
| Ảnh upload | Thư mục local bỏ qua Git | Volume bền vững riêng | Volume bền vững, được backup cùng DB |
| ML | Có thể fallback danh mục | Service nội bộ, snapshot kiểm soát | WSGI, token nội bộ, snapshot được duyệt |
| Payments | MoMo/VNPay tắt | Chỉ bật sandbox khi đủ key | Giữ tắt đến khi đạt gate |

Không dùng dữ liệu, session cookie hoặc tài khoản production làm fixture. Các script seed/demo yêu cầu `ALLOW_TEST_DATA=true`, `NODE_ENV` khác production và DB `_test`/`_staging`. Không chạy seed từ pipeline phát hành.

## Cấu hình backend

Inject từ secret store của hosting: `MONGO_URI`, `SESSION_SECRET` ngẫu nhiên ít nhất 32 ký tự, email provider/Google/Gemini credentials nếu sử dụng. Không ghi giá trị vào CI, Git hoặc report. Mẫu chỉ chứa tên biến tại `backend/.env.example`.

Các biến không phải secret:

- `NODE_ENV=production`, `PORT` do platform cung cấp.
- `CLIENT_ORIGINS`: danh sách **origin HTTPS chính xác** customer và admin, phân tách dấu phẩy; không wildcard, không đường dẫn, không localhost/LAN ở production.
- `CUSTOMER_PORTAL_BASE`, `ADMIN_PORTAL_BASE`, `BACKEND_PUBLIC_URL`: URL chính thức. Kiểm tra `frontend/src/environments/environment.prod.ts` và hai `vercel.json` trước deploy; URL hosting hiện tại chưa được đổi tự động.
- `UPLOAD_DIR`: đường dẫn tuyệt đối đến mount bền vững. Trên Linux có thể dùng `/var/data/uploads`; cấp quyền ghi cho UID chạy Node. Backend fail readiness nếu thiếu đường dẫn trong production. Đường dẫn tuyệt đối không tự chứng minh hosting có persistent disk: phải kiểm thử upload → restart/redeploy → tải lại ảnh trên staging.
- `VNPAY_ENABLED=false`, `MOMO_ENABLED=false`, hai biến `*_DEV_ALLOW_RETURN_SIG_BYPASS=false`.
- `ORDER_PAYMENT_TTL_MINUTES=30`: đơn online pending được quét mỗi phút, tối đa 100 đơn/lượt. COD không tự hết hạn. Theo dõi backlog khi tăng lưu lượng; không chỉnh TTL index để xóa đơn.
- `RECOMMENDER_API`: địa chỉ service nội bộ; `ML_API_TOKEN` cùng secret ở backend và ML. Backend timeout/fallback có log `ml.fallback`.

Cookie customer/admin tách biệt, HttpOnly/Secure ở production; cần giữ proxy và hostname nhất quán. Backend dùng MongoStore, không phục vụ API bằng MemoryStore khi khởi động production chưa sẵn sàng. Role, active và sessionVersion được kiểm tra mỗi request; đổi mật khẩu, khóa hoặc đổi role làm session cũ mất hiệu lực. SSE kiểm tra lại tối đa 25 giây.

## Cài đặt, build, kiểm tra

Các lệnh npm sau đã chạy local:

```powershell
cd backend
npm ci
npm test -- --runInBand --silent
npm audit --omit=dev --audit-level=high
cd ../frontend
npm ci
npm run build:customer
npm run build:admin
npm run test:e2e
```

Integration tests sẽ **Skipped** nếu thiếu `MONGO_TEST_URI`; không coi đó là pass toàn bộ. Để chạy toàn bộ trên dữ liệu giả:

```powershell
# Từ repository root; yêu cầu Docker hoạt động
docker compose -p vuavuive-qa -f ops/compose.qa.yml up -d --wait
$env:MONGO_TEST_URI='mongodb://127.0.0.1:27019/vuavuive_test?replicaSet=rs0&directConnection=true'
cd backend
npm test -- --runInBand --silent
cd ..
node ops/restore-drill.cjs
docker compose -p vuavuive-qa -f ops/compose.qa.yml down
```

Browser tests chạy build customer thật với API mock local và chặn các request Internet; không chứng minh một hệ thống staging xuyên suốt. Chromium cần cài bằng `npx playwright install chromium` trong frontend (đã chạy local). CI Linux dùng `--with-deps`.

Backend Dockerfile là phương án triển khai thêm; **chưa build/deploy image**. Container cần mount ảnh và inject config nêu trên. Start backend theo script sẵn có `npm start`. Để production chạy được, unique indexes và replica set là bắt buộc.

## Chuẩn bị indexes và dữ liệu cũ

Production tắt `autoIndex`; startup kiểm tra hai unique index order. Không chạy `syncIndexes` vì có thể xóa index.

1. Snapshot DB và ảnh; ghi commit/build chuẩn bị phát hành.
2. Chạy `node scripts/check-production-indexes.js` từ backend với URI được inject bởi operator. Mặc định chỉ đọc; không in transaction reference hay customer data.
3. Đối soát duplicate payment groups nếu có, rà soát các đơn/stock/voucher dữ liệu cũ và index shipment `carrier_1_trackingNumber_1`. Đổi partial index trên DB cũ có thể cần quy trình thay index riêng; script không tự drop.
4. Chỉ sau khi operator duyệt trên staging, inject `ALLOW_INDEX_CHANGES=true` và chạy `node scripts/check-production-indexes.js --apply`. Lệnh này **chưa chạy trong phiên này**. Không tự chạy trên production.
5. Với DB có sẵn, cần kiểm tra tất cả indexes declared của User, Product, Review và các model khác; script mới chỉ tạo Order/Shipment. Backfill `paymentExpiresAt` cho đơn online cũ và kiểm tra `stockRestocked` phải được duyệt riêng. Đơn cũ thiếu expiry không bị tự hủy.

Fields mới có default/optional; không có migration xóa dữ liệu. Không tự hoàn kho, đổi tổng tiền hoặc đánh dấu hoàn tiền cho đơn lịch sử chỉ dựa trên trạng thái cũ.

## Thanh toán và đối soát

MoMo/VNPay bị chặn cả UI và create API, code callback được giữ để xử lý giao dịch đã phát sinh. Khi có key: bật trên **staging** trước, kiểm thử chữ ký, amount, retry, callback trễ, callback trùng và provider reference dùng lại ở đơn khác. Sau đó đổi hai feature flags frontend và rebuild; backend cần flags cùng credentials chính thức. Không bật trên production bằng key sandbox.

`delivered` không tự đồng nghĩa `paid`. COD cần admin/staff nhập biên nhận đã thu; online chỉ callback đã kiểm chứng được commit. Callback tới đơn đã hủy ghi nhận paid để đối soát, không mở lại đơn hay trừ kho lần nữa.

Nếu khách đã yêu cầu/được duyệt/hoàn thành trả hàng trước khi nhập COD, vẫn có thể ghi nhận biên nhận cho đơn có `deliveredAt`; việc đối soát tiền giữ nguyên trạng thái trả hàng. Đơn giao thất bại chưa từng delivered không được ghi nhận COD theo cách này.

Hoàn tiền hiện là **ghi nhận bằng chứng tiền đã hoàn**, không gọi API chuyển tiền/refund của provider. Chỉ admin được ghi nhận với reference, ghi chú và số tiền bằng total; đơn phải returned/cancelled và paid. Thực hiện hoàn tiền ở ngân hàng/provider trước, kiểm tra settlement, rồi ghi nhận trong admin. Không dùng nút này làm bằng chứng tiền đã được chuyển tự động.

`node scripts/reconcile-orders.js` xuất tổng hợp read-only theo trạng thái và các backlog COD chưa thu, đơn hủy đã paid, online quá hạn. Lệnh **chưa chạy với DB nghiệp vụ**. Operator đối chiếu provider statement trong công cụ bảo mật, không đưa statement/PII vào repo.

## ML

Entry point `src.wsgi:app`; `ML_ENV=production` từ chối Flask development server. Gunicorn26.2 đã được duyệt/thêm; Start Command `gunicorn --config gunicorn.conf.py src.wsgi:app` đã kiểm bằng real Linux WSGI smoke với synthetic artifacts. Snapshot/model/mapping thật và deploy Render còn Not Run; cấu hình staging riêng ở [render-staging.md](render-staging.md).

Production yêu cầu `ML_API_TOKEN` tối thiểu 32 ký tự và `VVV_DATA_DIR` tuyệt đối, chứa `products.json`, `orders.json`, `users.json` từ snapshot được kiểm soát. Không fallback sang dữ liệu demo committed khi thiếu snapshot. Chỉ nạp model/pickle do pipeline tin cậy tạo, không nhận upload model từ người dùng. Giới hạn POST 64KB, `n` 1–20, batch tối đa 50, không bật browser CORS trực tiếp.

Backend loại identity do client tự gửi; hiện Mongo user ID chưa có mapping tin cậy tới ID số trong adapter snapshot cũ. Recommendation có thể cold-start thay vì cá nhân hóa. Đây là gap cần xử lý snapshot/mapping trước khi xác nhận ML production đạt. Giá, stock và rating hiển thị được đối chiếu lại MongoDB; ML score không được dùng làm review rating.

## Quan sát và phản ứng

Log JSON có timestamp, event, requestId, status, duration; không log body/query/cookie và redact trường nhạy cảm. Health `/api/health` trả 503 khi config/DB không sẵn sàng. Graceful shutdown đóng SSE/HTTP và DB trong giới hạn 10 giây.

Operator cấu hình monitor ngoài ứng dụng (chưa kết nối tài khoản monitoring): probe health mỗi phút; cảnh báo 3 lần 503 liên tiếp, 5xx >1%/5 phút, p95 >2s/5 phút, `server.startup_failed`, `orders.expiry_failed`, backlog đối soát >0 và `ml.fallback` kéo dài. Ngưỡng là đề xuất ban đầu cần hiệu chỉnh theo traffic. Runbook: dùng requestId, xác định dependency lỗi, giữ payment flags tắt nếu lỗi callback, cân nhắc rollback theo mục dưới.

Rate-limit hiện theo process; SSE event bus cũng theo process. Bản triển khai ban đầu nên dùng một backend instance. Scale nhiều instance cần kiểm chứng distributed rate limiting và event delivery; không tuyên bố multi-instance đã sẵn sàng.

## Backup, restore và rollback

Thiết lập backup DB và persistent upload volume cùng mốc thời gian; mã hóa, phân quyền, retention theo yêu cầu nghiệp vụ. RPO 24 giờ/RTO 60 phút là **đề xuất**, chưa có SLA được chủ dự án duyệt. Atlas PITR nếu được bật theo gói/tài khoản phải kiểm tra thực tế, không giả định đã có.

Restore drill local `node ops/restore-drill.cjs` đã chạy: hai document giả, tổng tiền 185000 và unique index được khôi phục. Script chỉ truy cập container QA định danh; tên DB ngẫu nhiên `_test`, dọn đúng DB đã tạo. Đây không thay thế restore staging có order/shipment/session/uploads.

Trước phát hành: operator phục hồi snapshot staging vào **DB và volume mới**, không ghi đè production; kiểm tra số document, totals, FK/reference, indexes và ảnh; thử đăng nhập/đặt hàng; ghi thời gian thực tế, dấu mốc backup và RPO/RTO đạt. Các lệnh mongodump/mongorestore production và truy cập secret config phải thực hiện trong phiên operator bảo mật, không đưa URI lên command log.

Rollback: lưu artifact và commit bản đã đạt trước; tạm dừng checkout khi tính nhất quán chưa xác định; đổi traffic về artifact trước; smoke health/login/orders/images và đối soát order nhận trong khoảng phát hành. Không rollback DB mù bằng snapshot vì sẽ mất đơn mới. Không quay về backend cũ tin client total/payment status sau khi đóng P0; dùng forward fix hoặc bản hardened đã xác minh. Quy trình rollback hosting **Not Run**, cần kiểm thử staging trước production.
