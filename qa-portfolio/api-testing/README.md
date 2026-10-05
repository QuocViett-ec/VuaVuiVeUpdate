# API testing

Dùng Jest/fetch sẵn có trong `backend/tests/orders.integration.test.js` chạy HTTP vào Express app thật; MongoDB replica set thật và fixture độc lập. Không tạo collection chứa session/credential. API money/auth/permission/order create được gọi qua HTTP; lifecycle/refund/package cases còn gọi service thật để kiểm transaction/DB, chưa thay kiểm thử UI/admin xuyên suốt.

Endpoints đã kiểm: POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/orders`, GET `/api/orders/me`, PATCH `/api/orders/:id/paid`, GET `/api/products/:id`, POST `/api/recommend`. Unit payment dùng functions export thật của controller/service, không sao chép implementation.

Tiếp tục trên staging: status/return-review/refund routes theo role, Google/email reset, validation/pagination/filter/sort và sandbox IPN. Các request POST/PATCH test không được gửi production. Tài khoản/test secret inject hoặc tạo ngẫu nhiên; browser mock không chứng minh provider/network integration.
