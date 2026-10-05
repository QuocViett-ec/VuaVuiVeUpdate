# QA portfolio — Vựa Vui Vẻ

Một sản phẩm, một chuỗi truy vết: requirement → test case → execution → bug → release decision. Không tạo thêm backend hoặc framework giả để thay sản phẩm.

## Phạm vi và bằng chứng

- [Requirement và acceptance criteria](requirements/requirements.md).
- [Test plan và phân loại rủi ro](manual-testing/test-plan/plan.md).
- [Test cases](manual-testing/test-cases/cases.md).
- [Ma trận truy vết](reports/traceability.md).
- [Bugs đã xử lý và các gate tồn đọng](manual-testing/bug-reports/bugs.md).
- [Test summary của phiên local](reports/2026-10-04-summary.md).
- [API test hướng dẫn](api-testing/README.md), [database checks](database-testing/README.md), [automation](automation/README.md).

Automation thực thi ở `backend/tests` và `frontend/e2e`; không sao chép logic sản phẩm vào framework trong thư mục portfolio. Báo cáo chỉ ghi **Passed** cho kiểm tra thực tế đã chạy. Manual staging, provider sandbox, load theo traffic mục tiêu, hosting rollback và CI remote giữ **Not Run/Blocked**.

Chỉ fixture giả, mật khẩu sinh ngẫu nhiên trong test và MongoDB loopback DB ngẫu nhiên `_test`. Browser API mock không được tính là payment/provider integration. Artifact trình duyệt nằm trong `reports/artifacts` bị ignore; CI lưu khi failure 7 ngày, không lưu secrets/PII.
