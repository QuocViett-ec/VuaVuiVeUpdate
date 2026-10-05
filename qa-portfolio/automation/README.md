# Automation và CI

Backend Jest có unit security/business rule và Mongo replica-set integration. Frontend Playwright chạy bundle production customer/admin, role/label locators, API mock, responsive390px và axe WCAG AA trong checkout. Không retry, không fixed sleep; trace/screenshot khi thất bại chứa fixture giả. Source ở `backend/tests` và `frontend/e2e`. Bộ browser hiện 10 tests; admin kiểm empty credentials, runtime staging links và guest redirect, không gọi backend/cloud thật.

Lệnh đã xác minh trong `ops/production.md`. Workflow `.github/workflows/quality.yml` cài từ lockfiles, audit runtime backend/all frontend, actionlint, Docker backend build, 9 Node deployment tests, full backend với Mongo QA, restore drill, build customer/admin và browser smoke; dọn container luôn. Quality workflow xuất verified frontend artifact; `.github/workflows/release.yml` phụ trách CD staging/production/rollback riêng. CI/CD remote Not Run; setup/gates ở `ops/cicd.md`.

ML hiện có7 Python tests: HTTP safeguards với model/adapter mock, Gunicorn config và real WSGI subprocess dùng source/model loader thật với tiny synthetic artifacts. CI cài requirements thực rồi chạy `python -m unittest discover -s ml/VuaVuiVe_Recommender/tests -v`. Gunicorn runtime test chạy Linux; Windows skip test này, đã kiểm riêng qua Docker Linux. Chưa nạp trusted production snapshot/model hoặc deploy cloud.

Backend dev advisory braces chưa có bản vá phù hợp đã xác minh; không dùng npm audit fix --force để downgrade framework. CI không install dev dependencies vào runtime backend image. Giữ risk open và kiểm lại trước release; frontend audit hiện không high/critical.
