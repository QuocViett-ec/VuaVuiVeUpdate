# CI/CD fullstack — Vercel + Render

## Trạng thái và phạm vi

**Đã triển khai trong repository:** quality CI cho backend, ML HTTP guards, customer, admin; đóng gói frontend đã kiểm thử; CD staging; production có reviewer và release gates; rollback ứng dụng theo bản ghi phát hành; smoke chỉ đọc sau deploy/rollback.

**Đã xác minh trên cloud ngày 2026-10-05:** Quality gates run [37275268515](https://github.com/QuocViett-ec/VuaVuiVeUpdate/actions/runs/37275268515) đạt; backend, ML, customer và admin staging cùng revision `ffa504dfcd874f1be31e7841831f2818b45ca606`, smoke đạt. Các deployment này được thực hiện bằng MCP/CLI. Fullstack release run [37275502546](https://github.com/QuocViett-ec/VuaVuiVeUpdate/actions/runs/37275502546) **Skipped**; chưa có bằng chứng CD GitHub hoặc rollback cloud thành công. GitHub Environment secrets/variables và bảo vệ phát hành còn cần cấu hình/xác minh. [Execution hiện tại](../qa-portfolio/reports/2026-10-05-devops.md).

MoMo/VNPay giữ tắt ở frontend và backend. Chưa có sandbox keys thì `PAYMENT_SANDBOX_PASSED` chưa được đặt `true`; production tiếp tục NO GO theo yêu cầu phát hành đã thống nhất.

## Luồng phát hành

1. PR/push `main` hoặc `master` chạy `.github/workflows/quality.yml`: actionlint, npm ci/audit, Docker backend build, Node deployment tests, Mongo replica-set integration, synthetic restore, Python HTTP guards, build cả hai Angular app và Playwright Chromium. Required status check là job `verify` của workflow `Quality gates`; chọn đúng tên check GitHub hiển thị sau lần chạy đầu.
2. Chỉ push đạt toàn bộ kiểm tra mới xuất `fullstack-release` (30 ngày): `customer/`, `admin/`, manifest SHA commit và SHA256 từng file. `synthetic-quality-evidence` giữ kết quả backend/Node/browser 7 ngày. Backend/ML trên Render build từ đúng `commitId` này; Docker image trong CI kiểm tra khả năng build, chưa được publish lên registry.
3. Khi repository variable `CD_ENABLED=true`, workflow `Fullstack release` tự deploy staging từ CI push thành công. Có thể chạy thủ công với environment `staging`, action `deploy`, `source_run_id` là ID của run Quality gates đã đạt. Mặc định chưa có biến này thì automatic staging bị bỏ qua.
4. CD xác minh run cùng repo, nhánh release, loại sự kiện và workflow; kiểm checksum; lưu baseline trước khi đổi hosting; deploy ML rồi backend, đợi trạng thái `live` và đối chiếu SHA. Tạo hai deployment Vercel bằng `--prebuilt --prod --skip-domain`, smoke candidate rồi `promote` và smoke domain ổn định. Staging có project riêng, nên `--prod` tại đây chỉ đổi domain project staging.
5. Production chỉ chạy thủ công. Nhập CI `source_run_id`, staging `staging_run_id` cho cùng SHA và chọn environment `production`. Job dừng ở required reviewer GitHub. Script kiểm reviewer được cấu hình, SHA được duyệt, bằng chứng staging và mọi gate trước hosting mutation.
6. Hai workflow dùng concurrency; CD không hủy deployment đang chạy khi có commit mới. Preflight upload `release-baseline` **trước hosting mutation**, nên vẫn có recovery targets khi deploy timeout hoặc runner mất kết nối. `release-result` ghi outcome sau deploy; không có tuyên bố rollback tự động/atomic giữa bốn dịch vụ. Operator kiểm tra hosting và chạy action `rollback` với ID run release lỗi.

## Cấu hình GitHub một lần

Tạo hai **GitHub Environments** `staging` và `production`, giới hạn deployment branches cho cả hai về nhánh release được bảo vệ. Production phải có Required reviewers, bật Prevent self-review nếu nền tảng hỗ trợ. Bảo vệ nhánh `main`: require PR review và check quality; kiểm soát quyền sửa workflow/release variables. Nếu gói GitHub/repo không hỗ trợ reviewer thì pipeline production dừng, không tự bỏ gate. [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

Điền **Environment secrets**, không gửi giá trị qua chat hoặc commit:

| Secret | Mục đích |
|---|---|
| `RENDER_API_KEY` | Deploy/read/rollback Render services thuộc environment |
| `VERCEL_TOKEN` | Deploy/promote/rollback hai Vercel projects thuộc environment |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Tùy chọn: truy cập deployment Vercel được protection bảo vệ; script gửi header, không log giá trị |
| `GH_ENVIRONMENT_READ_TOKEN` | Production: read-only fine-grained token với repository Environments read nếu `GITHUB_TOKEN` không đọc được protection rules; không cấp quyền ghi |

Điền **Environment variables**:

| Variable | Yêu cầu |
|---|---|
| `RENDER_BACKEND_SERVICE_ID`, `RENDER_ML_SERVICE_ID` | Hai service Git-backed riêng, định dạng `srv-...` |
| `BACKEND_ORIGIN`, `ML_ORIGIN` | HTTPS origin Render, không path/query/credential |
| `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN` | HTTPS origin ổn định, không dấu `/` cuối; hai portal riêng |
| `VERCEL_ORG_ID` | Team/account scope ID |
| `VERCEL_CUSTOMER_PROJECT_ID`, `VERCEL_ADMIN_PROJECT_ID` | Hai project IDs khác nhau |
| `GOOGLE_CLIENT_ID` | Tùy chọn, client ID công khai; OAuth authorized origins phải có các domain tương ứng |

Staging và production dùng **bốn service/project IDs khác nhau và bốn origins khác nhau**. Production so sánh targets với artifact staging để chặn dùng nhầm tài nguyên. Atlas database/user/credentials và disks cũng phải riêng; CI không đọc hoặc ghi Atlas.

Production thêm `APPROVED_RELEASE_SHA` bằng SHA 40 ký tự của bản đang duyệt; tất cả các biến sau chỉ đặt `true` khi có evidence gắn với release đó:

`P0_CLOSED`, `PAYMENT_SANDBOX_PASSED`, `LOAD_PASSED`, `RESTORE_PASSED`, `CREDENTIALS_REVIEWED`, `STORAGE_PASSED`, `ML_PASSED`, `ROLLBACK_PASSED`.

Đây là quyết định của operator; workflow không tự chứng minh load/backup/payment chỉ bằng một biến. Đặt lại gates khi evidence không còn áp dụng. Pipeline tự xác minh staging artifact cùng SHA, health/revision và inactive gateways.

## Render và dữ liệu

Backend: repo hiện tại, root directory `backend`, Docker runtime dùng `backend/Dockerfile`, health check `/api/health`, **Auto-Deploy Off**. Image chạy user `node`; persistent upload mount cần quyền ghi UID 1000. Đặt các cấu hình theo `backend/.env.example` trong Render secret store: Mongo replica set, session secret, exact customer/admin origins, `UPLOAD_DIR` tuyệt đối, ML endpoint/token; `MOMO_ENABLED=false`, `VNPAY_ENABLED=false`. Dùng `RENDER_GIT_COMMIT` tự động để health trả revision. Không chạy seed/migration trong build/start/CD.

ML: root `ml/VuaVuiVe_Recommender`, health `/health`, **Auto-Deploy Off**, `ML_ENV=production`, strong `ML_API_TOKEN`, absolute `VVV_DATA_DIR` với snapshot tin cậy và mapping đã kiểm chứng. Gunicorn26.2.0 đã được chủ sở hữu phê duyệt và thêm vào requirements. Start Command: `gunicorn --config gunicorn.conf.py src.wsgi:app`. WSGI Linux synthetic và deployment/health staging trên Render đã đạt. Snapshot nghiệp vụ và mapping Mongo sang legacy IDs chưa xác minh; gate `ML_PASSED` chưa đóng. [Cấu hình staging](render-staging.md).

Tắt Auto-Deploy trước khi đưa workflow lên remote. Render API deploy đúng commit và rollback không tự tắt auto-deploy; script kiểm service metadata trước deploy. [Render deploy](https://api-docs.render.com/reference/create-deploy), [Render rollback](https://api-docs.render.com/reference/rollback-deploy).

Trước staging: đối soát dữ liệu cũ/index bằng runbook `ops/production.md`; kiểm tra tracked key/config bằng tên file, chủ sở hữu xác minh/thu hồi nếu cần. Không sao chép dữ liệu khách hàng vào QA. Restore local synthetic không thay thế restore Atlas + uploads thực trên staging.

## Vercel

Tạo hai projects riêng cho mỗi environment, đặt domains theo variables. Workflow chuẩn bị Build Output API v3, rewrite `/api/*` và `/uploads/*` về backend **của environment đó**, filesystem trước SPA fallback. Không `vercel pull`, không tạo `.env` trên runner. Runtime `release-config.json` chỉ chứa portal origins, release SHA và Google client ID công khai; không chứa secrets hoặc cho bật payment. Cùng bản JS đã qua CI được dùng cho staging/production. [Vercel prebuilt deployment](https://vercel.com/docs/cli/deploy), [Build Output API](https://vercel.com/docs/build-output-api/configuration).

`vercel.json` root và frontend đã thêm `git.deploymentEnabled=false` để Git integration không tự deploy vượt CI; kiểm tra setting này có hiệu lực trên tất cả projects. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

Smoke chỉ GET: backend readiness/commit/payment flags, products schema, guest orders 401, ML adapter ready/commit, portal config/HTML và API rewrite từ cả hai portal. Không đăng nhập, tạo đơn, thanh toán, gửi email hay sửa DB. Browser tests CI dùng API mocks; login/cookie/cart/admin thật trên staging vẫn cần execution riêng.

## Rollback và lần phát hành đầu

Actions → Fullstack release → Run workflow từ nhánh `main` → đúng environment → action `rollback` → `source_run_id` là run Fullstack release đã upload `release-baseline`. Production vẫn yêu cầu reviewer; không yêu cầu gates của bản mới cho thao tác phục hồi. Không lấy run CI làm nguồn rollback.

Script chặn nhầm environment/service/project và baseline backend/ML/frontend khác SHA. Restore Render bằng deploy ID cũ, Vercel bằng deployment URL cũ, rồi smoke domain ổn định theo SHA cũ. `rollback-result` lưu bằng chứng 90 ngày. Render/Vercel phải còn giữ bản cũ; rollback Vercel tùy giới hạn plan. [Vercel rollback](https://vercel.com/docs/cli/rollback).

Production yêu cầu baseline rollback đầy đủ trước mutation. Hệ thống legacy chưa có revision/config hoặc lần đầu chưa có deployment cũ cần operator lập và thử baseline trong onboarding; pipeline production sẽ chặn trước khi đổi hosting. Staging cho phép bootstrap lần đầu; khi baseline trống, rollback tự động của lần đó không khả dụng. Từ hai lần staging thành công có thể diễn tập restore bản trước.

Rollback code không đảo ngược giao dịch đã ghi, không restore database/ảnh/model, không hoàn tiền. Nếu lỗi dữ liệu cần runbook backup/restore được duyệt riêng. Deploy Render và promote hai Vercel projects diễn ra tuần tự nên có khoảng chạy các phiên bản khác nhau; chỉ phát hành thay đổi tương thích ngược, migration destructive không nằm trong pipeline này.

## Kiểm tra local đã chạy

Tại root: `node --test ops/tests/*.test.cjs`; `docker build --tag vuavuive-backend:ci backend`; `docker compose -p vuavuive-qa -f ops/compose.qa.yml up -d --wait`; `node ops/restore-drill.cjs`. Backend: `npm test -- --runInBand --silent` với explicit loopback `MONGO_TEST_URI`. Frontend: `npm run build:customer`, `npm run build:admin`, `npm run test:e2e`. Python: `python -m unittest discover -s ml/VuaVuiVe_Recommender/tests -v` trong environment Flask test.

Các lệnh local trên đã chạy. Report `qa-portfolio/reports/2026-10-04-cicd.md` giữ nguyên kết quả lịch sử; kết quả cloud và các kiểm tra mới nằm trong [report ngày 2026-10-05](../qa-portfolio/reports/2026-10-05-devops.md).

## Health staging và cảnh báo

`staging-health.yml` dùng `node ops/monitor-staging.cjs`, tái sử dụng smoke release: readiness, cùng SHA trên bốn thành phần, payment tắt, API rewrites và guest orders bị từ chối. Chỉ GET, không cần hosting secrets. Ba lượt kiểm tra cách nhau 15 giây hỗ trợ dịch vụ staging đang ngủ; sau đó job thất bại thật nếu hệ thống chưa khỏe. JSON kết quả giữ 7 ngày, không ghi response hay credentials.

Sau khi điền bốn origin trong Environment `staging`, chạy workflow thủ công bình thường. Chạy thêm với `alert_drill=true`: health phải đạt trước, rồi một step cố ý thất bại để kiểm thông báo GitHub Actions; không làm gián đoạn ứng dụng. Chủ sở hữu bật thông báo Actions thất bại trong GitHub notification settings và xác nhận đã nhận thông báo. Job đỏ chỉ chứng minh phát hiện lỗi, chưa chứng minh email đã đến.

Sau khi kiểm chứng, đặt repository variable `STAGING_MONITOR_ENABLED=true` để chạy mỗi 6 giờ. Đây là kiểm tra staging định kỳ, không phải giám sát realtime/SLA hoặc cơ chế giữ Render Free luôn thức. Workflow dùng chung concurrency `fullstack-staging` với release để tránh kiểm giữa lúc deploy.
