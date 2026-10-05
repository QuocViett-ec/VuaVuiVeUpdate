# Render staging cho QA portfolio — 2026-10-05

## Đối chiếu hai file export được chủ sở hữu cho phép đọc

Chỉ ghi tên biến/kết quả kiểm tra, không sao chép secret vào tài liệu hoặc source. Hai export giữ nguyên nội dung và đã được ignore bằng `*.env`; không dùng chúng làm environment tự động cho test, build hoặc CI.

| File                 | Đã xác minh                                                                                                                                                      | Cần chỉnh trên Render staging                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| vuavuive-backend.env | NODE_ENV=production; PORT=10000; SESSION_SECRET có ít nhất32 ký tự; có Mongo URI, HTTPS ML endpoint; 6 exact HTTPS origins, hai portal bases nằm trong allowlist | DB trong URI không có hậu tố \_staging; thiếu APP_ENV, UPLOAD_DIR, UPLOAD_STORAGE_MODE, ML_API_TOKEN và payment enable flags |
| vuavuive-ml.env      | Python3.11.9; ENABLE_CF=false; VVV_DATA_DIR tuyệt đối trỏ vào đường dẫn repository trên Render                                                                   | Thiếu APP_ENV, ML_ENV và ML_API_TOKEN; cần đổi Start Command sang Gunicorn                                                   |

Session length không chứng minh secret mạnh/đã rotate. Paths trong export không chứng minh snapshot tồn tại trong deployment mới hay phù hợp Mongo staging. Chưa gọi cloud API hoặc kiểm tra settings Render thực tế. Chủ sở hữu đã xác nhận tắt auto-deploy; giữ Off.

## 1. Backend staging

Tạo service riêng nếu service hiện tại còn dữ liệu/traffic cần giữ. Không tự chuyển service đang phục vụ người dùng thành staging. Có thể dùng cùng Atlas Free cluster với **database và DB user riêng**; database đặt `vuavuive_staging`, cấp user chỉ trên DB này. Lưu URI mới vào secret store Render, không đưa vào commit/chat.

Runtime Node/Docker hiện có phải dùng Node24 theo backend/CI. Nếu dùng Docker: Root Directory `backend`, Dockerfile `./Dockerfile`, Docker context `.`. Health `/api/health`, Auto-Deploy Off. Không cần đổi runtime đang hoạt động chỉ để thêm staging nếu Node version/build command đã khớp.

| Biến                                     | Giá trị/cách điền trên service staging                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| NODE_ENV                                 | production — giữ secure cookies và runtime safeguards                                                  |
| APP_ENV                                  | staging                                                                                                |
| MONGO_URI                                | URI của DB riêng có tên kết thúc `_staging`; app từ chối kết nối nếu APP_ENV=staging và tên không đúng |
| SESSION_SECRET                           | Secret ngẫu nhiên riêng cho staging, ít nhất32 ký tự; không reuse cookie production                    |
| TRUST_PROXY                              | 1 — code đã chuyển chuỗi này thành số hop cho Express                                                  |
| CLIENT_ORIGINS                           | Chỉ hai HTTPS origins customer/admin staging, ngăn bằng dấu phẩy, không dấu `/` cuối                   |
| CUSTOMER_PORTAL_BASE / ADMIN_PORTAL_BASE | Origins của hai projects Vercel staging                                                                |
| BACKEND_PUBLIC_URL                       | Origin backend staging                                                                                 |
| RECOMMENDER_API                          | Origin ML staging                                                                                      |
| ML_API_TOKEN                             | Cùng token ngẫu nhiên ít nhất32 ký tự với service ML; nhập trong secret store                          |
| MOMO_ENABLED / VNPAY_ENABLED             | false                                                                                                  |
| UPLOAD_STORAGE_MODE | ephemeral — chỉ dành cho demo/staging Render Free |
| UPLOAD_DIR | /tmp/vuavuive-staging-uploads |
| ALLOW_TEST_DATA | false trên service đang chạy; tạo fixtures là bước operator riêng |
| PORT | Giữ biến PORT do Render cấp; không hard-code port trong command |

Ảnh upload staging sẽ mất khi service restart/redeploy/sleep; đánh dấu giới hạn này trong portfolio. Để kiểm persistent storage thật cần storage bền vững; production không chấp nhận ephemeral mode. Không đặt `STORAGE_PASSED=true` bằng kết quả thử lưu ảnh tạm.

Database mới cần required indexes trước readiness; chạy dry-run `backend/scripts/check-production-indexes.js` đối với staging URI qua cấu hình local được bảo vệ. Script hiện có cần quyền operator và cờ explicit để apply, không có migration/seed tự động trong pipeline. Không chạy nó bằng URI trong export cũ.

Khi operator đã cho phép tạo indexes trên staging, đặt `ALLOW_INDEX_CHANGES=true` riêng trên service Docker staging rồi deploy. Container chạy `node scripts/check-production-indexes.js --apply --staging-only` trước server; chỉ chấp nhận `APP_ENV=staging` và DB có hậu tố `_staging`, kiểm tra duplicate payment rồi tạo indexes Order/Shipment đã khai báo. Nếu script thất bại, server không khởi động. Sau khi xác nhận indexes và health đạt, đặt lại `ALLOW_INDEX_CHANGES=false` rồi redeploy để kết thúc quyền sửa indexes. Mặc định container chỉ chạy server.

Đã xác minh trên Render ngày 2026-10-05 sau khi chủ sở hữu phê duyệt: `vuavuive-backend-staging`, commit `0705c56c2f7b63891e50b28aaf6ba9efd0767f10`, log `duplicatePaymentGroups=0`, `Declared order/shipment indexes created` và `server.ready`. Đã đặt lại `ALLOW_INDEX_CHANGES=false`; deploy `dep-db1j0ee0tbcc73b2l4e0` đạt `live`. GET `https://vuavuive-backend-staging.onrender.com/api/health` đạt HTTP 200, `status=ok`, `environment=staging`, `db.ready=true` và đúng revision. Xác minh này chỉ bao gồm indexes, startup và health; các luồng nghiệp vụ end-to-end chưa được chạy trong lần xử lý này.

Các secrets Google/mail có trong export chưa được dùng để gửi email/request trong phiên. Đối với staging, chủ sở hữu chọn tài khoản test và authorized origins tương ứng; không copy API/mail credentials production để chạy test gây tác dụng thật. Gateway credential variables cũ có thể để ngoài staging vì hai flags đều false; không xóa callback/source code.

### Dữ liệu Flash Sale dùng thử

Khi operator yêu cầu thêm sản phẩm mẫu, bật `SEED_STAGING_FLASH_SALE=true` trên backend staging và deploy.
Container chạy `scripts/seed-staging-flash-sale.js` trước server, chỉ chấp nhận `APP_ENV=staging` và database `*_staging`.
Script thêm 3 sản phẩm có tên `[Staging]`, giá gốc lớn hơn giá bán, tồn kho và ảnh tĩnh trên client.
ID cố định và `$setOnInsert` tránh tạo trùng hoặc ghi đè chỉnh sửa của admin khi chạy lại; không xóa dữ liệu.
Sau khi xác minh API/client hiển thị đủ 3 sản phẩm, đặt lại `SEED_STAGING_FLASH_SALE=false` rồi deploy.

## 2. ML staging

Root Directory: `ml/VuaVuiVe_Recommender`; Language Python3. Health `/health`; Auto-Deploy Off.

Build Command:

```text
pip install -r requirements.txt
```

Start Command:

```text
gunicorn --config gunicorn.conf.py src.wsgi:app
```

Command/entrypoint đã kiểm tra bằng real Gunicorn trên Linux với synthetic artifacts; deployment Render/snapshot thực còn Not Run. Render hỗ trợ Flask phục vụ qua Gunicorn. [Render Flask setup](https://render.com/docs/deploy-flask).

| Biến                                   | Giá trị/cách điền                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| PYTHON_VERSION                         | Có thể giữ 3.11.9 hiện có; bộ Linux QA dùng Python3.11; CI dùng3.12                                            |
| ML_ENV                                 | production — đây là chế độ bảo mật của API, kể cả deployment là staging                                        |
| APP_ENV                                | staging — nhãn deployment để CD đối chiếu                                                                      |
| ML_API_TOKEN                           | Cùng token riêng với backend staging, ít nhất32 ký tự                                                          |
| ENABLE_CF                              | false — giữ cấu hình ít RAM từ export                                                                          |
| VVV_DATA_DIR                           | Absolute path đã kiểm tra chứa products.json/orders.json/users.json là dữ liệu giả, không chứa khách hàng thật |
| OMP_NUM_THREADS / OPENBLAS_NUM_THREADS | 1                                                                                                              |

Không đổi VVV_DATA_DIR chỉ dựa trên Root Directory: cần kiểm snapshot thực sự có ở đường dẫn trong deployment. App từ chối startup khi snapshot production thiếu. Không tự fallback dữ liệu demo nếu ML_ENV=production. Gunicorn dùng1 sync worker để tránh nhân bộ nhớ model và tránh concurrent reload adapter trong cùng process; vẫn cần đo RAM của artifact thật trên Free.

Snapshot sản phẩm/mapping hiện dùng legacy numeric IDs; backend lấy Product Mongo và có fallback. WSGI đạt không chứng minh personalized mapping Mongo→snapshot đúng. Kiểm tra recommendation thực với dữ liệu staging; không claim gate ML/model accuracy Passed từ fixture test.

## 3. Hai projects Vercel staging

Customer và admin riêng, dùng domain miễn phí của project nếu không cần domain riêng. Giữ git.deploymentEnabled=false; không đưa backend/ML tokens vào frontend. Google client ID là public config; thêm origins staging vào OAuth provider khi test Google login.

## 4. GitHub sau khi hosting đã cấu hình

Settings → Environments → staging; deployment branch main. Environment secrets: RENDER_API_KEY, VERCEL_TOKEN; VERCEL_AUTOMATION_BYPASS_SECRET nếu candidates được bảo vệ. Không dùng Render export file làm GitHub artifact hoặc commit.

Environment variables bắt buộc:

```text
RENDER_BACKEND_SERVICE_ID
RENDER_ML_SERVICE_ID
BACKEND_ORIGIN
ML_ORIGIN
CUSTOMER_ORIGIN
ADMIN_ORIGIN
VERCEL_ORG_ID
VERCEL_CUSTOMER_PROJECT_ID
VERCEL_ADMIN_PROJECT_ID
```

Origins đúng services/projects staging, HTTPS không trailing slash/path/query. GOOGLE_CLIENT_ID tùy chọn. Chưa cần tạo toàn bộ tài nguyên production trả phí cho portfolio.

Review changes và publish phần triển khai lên main qua PR; không dùng `git add .` khi workspace còn deletions/build artifacts ngoài phạm vi. Hai export đã ignored, nhưng các key/config được tracked từ trước cần owner kiểm tra trước publish; ignore không xóa chúng khỏi Git/history.

Actions → Quality gates: chờ pass, lấy run ID từ `/actions/runs/<ID>` và kiểm fullstack-release artifact. Actions → Fullstack release → Run workflow từ main → environment staging → action deploy → source_run_id là Quality gates ID. Lần staging đầu baseline có thể trống nên chưa rollback được; deploy thêm một bản sau khi bản đầu khỏe rồi diễn tập rollback.

Để tự deploy staging sau CI đạt, thêm **repository variable** CD_ENABLED=true sau khi chạy manual thành công. Không sửa production gates để vượt blocker. Nếu muốn mở COD-only production sau này, cần quyết định release policy và baseline riêng.

Smoke mới kiểm thêm backend/ML health.environment=staging; phát hiện đúng commit nhưng cấu hình nhầm production sẽ fail. Test đầy đủ login/cookie/customer/admin/checkout/COD, recommendation và ảnh phải execution bằng fixture staging thật; CI browser hiện dùng mocks. Lưu requirement→case→execution→bug với kết quả thực tế.
