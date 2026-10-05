# Workflow execution — 2026-10-05

## Đã thực hiện

- Tạo nhánh `codex/fullstack-staging` trong worktree `.qa-data/fullstack-staging-worktree` từ main `124201fc8a2bf9dd9512376b720db4bfbc678bda`.
- Chọn 115 file triển khai backend, frontend, ML, CI/CD và QA; kiểm tra SHA-256 từng file khớp workspace đã kiểm thử. Không đưa các deletions tài liệu và output C# ngoài phạm vi vào commit.
- Chạy lại 9 test release trên worktree: Passed. Actionlint hai workflow và kiểm tra whitespace: Passed.
- Hai export Render không được đưa vào worktree/commit; quy tắc ignore đã xác minh.
- Kết quả kiểm thử ứng dụng trước khi tạo worktree: xem `2026-10-05-render-staging.md` và báo cáo ngày 2026-10-04. Không coi các lần chạy local là GitHub CI hoặc cloud execution.

## Blocked

| Bước | Bằng chứng / điều kiện tiếp tục |
|---|---|
| Push và mở PR | `git push --dry-run origin HEAD:refs/heads/codex/fullstack-staging` bị GitHub 403: tài khoản Git `QuocViett-69` chưa có quyền ghi repo `QuocViett-ec/VuaVuiVeUpdate`. GitHub connector cũng chỉ có quyền đọc. Đăng nhập tài khoản chủ repo hoặc cấp Write cho tài khoản Git hiện tại. |
| GitHub Quality gates | Not Run: nhánh/workflow chưa publish được. |
| Deploy staging | Not Run: chưa xác minh dịch vụ staging và chưa có quyền Render/Vercel trong phiên; cần cấu hình GitHub Environment theo `ops/render-staging.md`. |
| Smoke / rollback cloud | Not Run: phụ thuộc staging deployment thành công. |
| Production | Chưa mở; không thay đổi release gates để vượt blocker. |

## Tiếp tục

1. Sửa quyền GitHub, push nhánh `codex/fullstack-staging` từ worktree; mở PR vào main và đợi Quality gates đạt.
2. Cấu hình môi trường staging bằng runbook. Không gửi token/mật khẩu vào chat hoặc commit; không sử dụng URI database cũ trong export để bootstrap staging.
3. Sau khi PR merge và Quality gates trên main đạt, dùng run ID đó chạy Fullstack release với environment staging/action deploy.
4. Xác minh dữ liệu test, phiên đăng nhập, customer/admin, COD, recommendation và upload trên staging; lưu bằng chứng đã che dữ liệu nhạy cảm.
5. Tạo baseline khỏe, deploy bản kế tiếp và diễn tập rollback; chỉ bật CD_ENABLED sau khi manual deployment đạt.

Repo hiện đã track một số file key/config cũ; không mở hoặc sao chép nội dung trong phiên này. Không đánh dấu CREDENTIALS_REVIEWED từ việc kiểm tra ignore. Chủ repo cần xác định tính nhạy cảm và xử lý/rotate nếu cần trước production.
