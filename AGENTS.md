# AGENTS.md — Hướng dẫn cho dự án QA Portfolio

## 1. Mục tiêu dự án

Dự án này được dùng làm một QA portfolio hoàn chỉnh trên cùng một sản phẩm, phát triển theo lộ trình:

`Manual Testing -> API Testing -> Database Testing -> Automation Testing -> CI/CD -> Test Report`

Ưu tiên chứng minh tư duy kiểm thử, khả năng truy vết yêu cầu, chất lượng bằng chứng và cách đánh giá rủi ro. Không tạo nhiều framework hoặc công cụ chỉ để làm portfolio trông phức tạp hơn.

## 2. Phạm vi áp dụng

- File này áp dụng cho toàn bộ repository kể từ thư mục gốc.
- Nếu thư mục con có `AGENTS.md` hoặc `AGENTS.override.md`, phải đọc và tuân thủ hướng dẫn gần file đang làm nhất.
- README, tài liệu kiến trúc, source code, migration và cấu hình được version control là nguồn thông tin chính.
- Không suy đoán công nghệ, chức năng, endpoint, bảng dữ liệu hoặc lệnh chạy khi chưa tìm thấy bằng chứng trong dự án.

## 3. Chế độ làm việc và quyền chỉnh sửa

### Khi người dùng yêu cầu đọc, phân tích, đánh giá hoặc lập kế hoạch

- Chỉ thực hiện thao tác đọc an toàn.
- Không tạo, sửa, đổi tên hoặc xóa file.
- Không cài dependency, build dự án, khởi động dịch vụ, chạy migration, seed dữ liệu hoặc sinh file báo cáo.
- Không thay đổi Git, database, tài nguyên cloud hay dịch vụ bên ngoài.
- Báo cáo kết quả và kế hoạch trước; chờ yêu cầu triển khai rõ ràng rồi mới chỉnh sửa.

### Khi người dùng yêu cầu triển khai

- Xác nhận phạm vi dựa trên yêu cầu hiện tại và kế hoạch đã thống nhất.
- Kiểm tra trạng thái Git trước khi sửa; bảo toàn mọi thay đổi sẵn có của người dùng.
- Chỉ sửa những file cần thiết và giữ thay đổi nhỏ, dễ review.
- Không dùng lệnh Git phá hủy như `git reset --hard`, `git clean -fd` hoặc ghi đè thay đổi của người dùng.
- Không thêm dependency production, thay đổi schema hoặc chạy migration nếu chưa nêu rõ lý do và được người dùng đồng ý.
- Sau khi sửa, chạy kiểm tra phù hợp và báo rõ phần nào đã xác minh, phần nào chưa thể xác minh.

## 4. Quy trình khảo sát repository ban đầu

Thực hiện theo thứ tự sau:

1. Xác định project root, trạng thái Git và cấu trúc thư mục cấp cao.
2. Đọc README, tài liệu setup và tài liệu kiến trúc nếu có.
3. Xác định manifest, lockfile, Docker/Compose, file cấu hình build và cấu hình test.
4. Xác định frontend, backend, API, database, worker, cache và dịch vụ bên ngoài.
5. Lần theo một số luồng nghiệp vụ từ UI đến API và database bằng bằng chứng trong code.
6. Xác định cách cài đặt, chạy, test, lint và build từ tài liệu hoặc script hiện có.
7. Lập danh sách chức năng nghiệp vụ và các khu vực rủi ro cao.
8. Đề xuất phạm vi Manual, API, Database và Automation Testing.
9. Ghi lại câu hỏi còn thiếu; không tự điền thông tin chưa được xác nhận.

Ưu tiên `rg --files` và `rg` để tìm file hoặc nội dung. Tránh quét thư mục dependency, build output, coverage, cache và file nhị phân.

## 5. Bảo mật thông tin nhạy cảm

- Tuyệt đối không đọc, mở, sao chép hoặc hiển thị nội dung của `.env`, `.env.*`, file credentials, service-account, private key, certificate, token store hoặc secret store.
- Có thể đọc `.env.example`, `.env.sample` hoặc tài liệu cấu hình mẫu nếu chúng không chứa secret thật.
- Có thể nêu tên file cấu hình nhạy cảm và tên biến môi trường cần thiết, nhưng không hiển thị giá trị.
- Không chạy `env`, `printenv` hoặc lệnh tương tự để xuất toàn bộ biến môi trường.
- Khi log, request, response hoặc ảnh chụp có token, cookie, mật khẩu, thông tin cá nhân hay dữ liệu thanh toán, phải che bằng `[REDACTED]`.
- Không hard-code tài khoản, mật khẩu, API key, token, connection string hoặc dữ liệu cá nhân vào source code, test data, report hay CI.
- Không kết nối hoặc ghi dữ liệu vào production. Mặc định chỉ dùng môi trường local/test với dữ liệu giả lập.
- Không thực hiện request có tác dụng gửi email/SMS thật, thanh toán thật, xóa dữ liệu thật hoặc tạo tài nguyên bên ngoài khi chưa được phép rõ ràng.

## 6. Cách báo cáo kết quả phân tích

Báo cáo bằng tiếng Việt, ngắn gọn nhưng có bằng chứng, theo cấu trúc:

1. Tóm tắt dự án.
2. Cấu trúc thư mục và vai trò từng khu vực.
3. Công nghệ, framework và dependency chính.
4. Kiến trúc và luồng liên kết Frontend -> Backend/API -> Database.
5. Cách cài đặt, cấu hình và chạy dự án.
6. Chức năng nghiệp vụ chính và rủi ro tương ứng.
7. File cấu hình quan trọng và lưu ý bảo mật.
8. Ma trận phạm vi Manual, API, Database và Automation Testing.
9. Lộ trình xây dựng QA portfolio, khoảng trống thông tin và câu hỏi cần làm rõ.

Mỗi nhận định quan trọng phải được phân loại:

- **Đã xác minh:** có bằng chứng trực tiếp từ file hoặc cấu hình.
- **Suy luận:** kết luận hợp lý từ nhiều dấu hiệu, cần nêu rõ căn cứ.
- **Chưa xác định:** chưa đủ dữ liệu; không được tự bịa.

Khi trích dẫn bằng chứng, ghi đường dẫn file và tên script/section liên quan. Không trích secret hoặc nội dung file bị cấm.

## 7. Phạm vi QA cần ưu tiên

### Manual Testing

- Phân tích requirement, user story và acceptance criteria.
- Happy path, negative path, boundary, validation và error handling.
- Phân quyền, authentication, session và authorization.
- Luồng nghiệp vụ xuyên suốt, tính toán, trạng thái và tính nhất quán dữ liệu.
- Smoke, sanity, regression, exploratory, usability và compatibility.
- Responsive, accessibility cơ bản và thông báo lỗi cho người dùng.
- Ưu tiên theo rủi ro và mức ảnh hưởng nghiệp vụ.

### API Testing

- Endpoint, method, header, path/query parameter và request body.
- Authentication, authorization và phân quyền theo vai trò.
- Status code, response schema, dữ liệu trả về và thông báo lỗi.
- Dữ liệu hợp lệ, không hợp lệ, thiếu trường, sai kiểu và giá trị biên.
- Pagination, filter, sort, duplicate request, idempotency và concurrency nếu có.
- Đối chiếu kết quả giữa API, UI và database.
- Không gửi request thay đổi dữ liệu production.

### Database Testing

- Schema, kiểu dữ liệu, primary key, foreign key, unique và check constraint.
- CRUD, transaction, rollback, dữ liệu mồ côi và tính toàn vẹn tham chiếu.
- Tính đúng của mapping UI/API/DB, trạng thái nghiệp vụ, tổng tiền và tồn kho nếu áp dụng.
- Migration, audit field, timezone và soft delete nếu có.
- Truy vấn database ở chế độ read-only theo mặc định.
- Không chạy `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, migration hoặc seed khi chưa được người dùng cho phép.

### Automation Testing

- Chỉ tự động hóa các luồng ổn định, quan trọng và chạy lặp lại thường xuyên.
- Ưu tiên smoke và regression có giá trị cao; không tự động hóa mọi test case.
- Dùng framework và ngôn ngữ đã có trong repository. Chỉ đề xuất Playwright + TypeScript khi dự án chưa có chuẩn automation và stack phù hợp.
- Locator phải ổn định và phản ánh hành vi người dùng; ưu tiên role, label hoặc test id được phê duyệt.
- Không dùng thời gian chờ cố định để che lỗi đồng bộ; tận dụng cơ chế wait và assertion của framework.
- Test phải độc lập, có dữ liệu kiểm soát được, dọn dữ liệu an toàn và không phụ thuộc thứ tự chạy.
- Không che flaky test bằng retry quá mức. Phải phân loại lỗi sản phẩm, lỗi script, lỗi dữ liệu và lỗi môi trường.
- Lưu screenshot, video, trace hoặc log khi thất bại nếu phù hợp, nhưng phải loại bỏ dữ liệu nhạy cảm.
- CI phải dùng secret store của nền tảng, không chứa secret trong repository.

## 8. Chuẩn tài liệu QA portfolio

Sau khi người dùng duyệt kế hoạch, có thể đề xuất cấu trúc sau trong cùng repository; không tự tạo trước khi được yêu cầu:

```text
qa-portfolio/
├── requirements/
├── manual-testing/
│   ├── test-plan/
│   ├── test-cases/
│   ├── checklists/
│   └── bug-reports/
├── api-testing/
│   ├── collections/
│   ├── environments/
│   └── test-data/
├── database-testing/
│   └── sql-queries/
├── automation/
│   ├── tests/
│   ├── pages-or-components/
│   ├── fixtures/
│   └── test-data/
├── reports/
└── README.md
```

Không tạo dự án tách rời cho từng loại kiểm thử nếu cùng một sản phẩm có thể hỗ trợ toàn bộ luồng QA.

### Test case

Mỗi test case cần có tối thiểu: ID, module, mục tiêu, mức ưu tiên, điều kiện tiên quyết, dữ liệu test, bước thực hiện, kết quả mong đợi và kết quả thực tế khi execution.

### Bug report

Mỗi bug report cần có tối thiểu: tiêu đề, môi trường/build, điều kiện ban đầu, dữ liệu test, bước tái hiện, kết quả thực tế, kết quả mong đợi, severity, priority và bằng chứng đã loại bỏ dữ liệu nhạy cảm.

### Truy vết và báo cáo

- Liên kết requirement -> test scenario/test case -> kết quả chạy -> bug.
- Phân biệt rõ Passed, Failed, Blocked, Not Run và Not Applicable.
- Không dùng số liệu giả. Nếu chưa chạy test, ghi `Not Run` thay vì tự tạo kết quả.
- Test Summary Report phải nêu phạm vi, môi trường, kết quả, defect, rủi ro tồn đọng và khuyến nghị phát hành.

## 9. Nguyên tắc chất lượng khi triển khai

- Tuân theo coding style, naming, formatter, linter và framework sẵn có.
- Không refactor ngoài phạm vi chỉ để thêm automation.
- Không sửa hành vi sản phẩm để làm test pass, trừ khi người dùng yêu cầu sửa bug sản phẩm.
- Tách test data khỏi test logic khi hợp lý.
- Cấu hình base URL, tài khoản test và timeout qua biến môi trường hoặc file mẫu an toàn.
- Mọi command được ghi vào README phải được lấy từ dự án hoặc đã được chạy xác minh; nếu chưa chạy được, đánh dấu rõ.
- Khi phát hiện mâu thuẫn giữa tài liệu và code, báo cả hai nguồn và không tự chọn một bên làm đúng nếu chưa có bằng chứng.

## 10. Definition of Done

### Với nhiệm vụ phân tích

- Không có file nào bị thay đổi ngoài file mà người dùng yêu cầu tạo trước phiên phân tích.
- Đã mô tả kiến trúc, cách chạy, chức năng, rủi ro và phạm vi QA bằng bằng chứng.
- Đã liệt kê rõ thông tin chưa xác định và bước xác minh tiếp theo.
- Không để lộ secret hoặc dữ liệu nhạy cảm.

### Với nhiệm vụ triển khai được phê duyệt

- Thay đổi đúng phạm vi và không làm mất thay đổi sẵn có.
- Test/lint/build phù hợp đã chạy thành công, hoặc blocker được báo rõ.
- Tài liệu hướng dẫn chạy được cập nhật khi cần.
- Không chứa secret, dữ liệu thật hoặc artefact không cần thiết.
- Báo cáo cuối nêu file đã thay đổi, kiểm tra đã chạy, kết quả và rủi ro còn lại.

## 11. Cập nhật file hướng dẫn

Chỉ cập nhật `AGENTS.md` khi người dùng yêu cầu hoặc khi có quy tắc repository ổn định đã được xác nhận. Không ghi các giả định tạm thời, secret, thông tin cá nhân hoặc chi tiết chỉ đúng cho một lần chạy vào file này.
