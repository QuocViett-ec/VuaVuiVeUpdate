# Bug ledger

Môi trường/build: source workspace ngày 2026-10-04; không commit/deploy trong phiên. Evidence là source trước/sau và test regression local, không có ảnh/token/dữ liệu thật. “Fixed local” không nghĩa đã sửa deployment đang chạy.

| ID / title | Prerequisite / fake data | Steps | Actual trước sửa | Expected / fix | Severity / priority | Evidence / status |
|---|---|---|---|---|---|---|
| B01 Client điều khiển tổng tiền/payment | User login,price1/paid payload | POST order với total/paid giả | Controller dùng client subtotal/payment fields | Server price/fee/voucher,force pending | Critical/P0 | TC01–02; Fixed local |
| B02 Tạo/hủy đơn không atomic và retry trùng | Stock1; hai request | Đặt đồng thời/gửi lại/hủy; làm shipment error | Stock/order/shipment/voucher thay riêng; thiếu unique retry key | Transaction + conditional stock + unique key,rollback | Critical/P0 | TC03–07,TC14; Fixed local |
| B03 Session sau khóa/đổi role và CORS quá rộng | Cookie cũ; origin không chính thức | Khóa rồi GET; mutation origin khác | Cache session role còn hiệu lực; origin inference rộng | DB version/active/role mỗi request,exact allowlist | High/P0 | TC08–09; Fixed local |
| B04 Online payment chưa có key vẫn xuất hiện | Flags chưa cấu hình | Chọn MoMo/VNPay,tạo payment | Người dùng gặp gateway chưa dùng được | UI/API disabled mặc định,giữ code callback | High/P0 | TC10; Fixed local; sandbox Blocked |
| B05 Shipment giao xong tự paid/trả hoàn nhiều lần | COD order,2packages | Giao package hoặc hoàn trả lặp | Status/payment/stock side effects thiếu lifecycle chung | Package aggregation,COD receipt,refund evidence,one restock | High/P0 | TC12–15; Fixed local |
| B06 Rating/lượt bán/oldPrice và stock giả | Product chưa review; ML score | Mở catalog/recommend | Fallback4.5,generated counts/discount,stock999,score→rating | Mongo stats/stock/price; chưa review hiện đúng; chỉ ưu đãi có dữ liệu | High/P1 | TC16; Fixed local |
| B07 Checkout thiếu label/contrast | Browser fixture | Axe checkout | Labels không gắn input; quantity text contrast3.54 | Label association,decorative icons hidden,color#666 | Medium/P1 | TC17; 6 Playwright Passed |
| B08 Admin build thiếu index.html cho SPA deploy | Angular production admin build; local source workspace 2026-10-04 | npm run build:admin; chạy fullstack package | Package báo Missing admin production build; build chỉ có index.admin.html | Angular index input giữ src/index.admin.html, output index.html để Vercel/static SPA phục vụ đúng | High/P1 | TC25; build/package + admin browser; Fixed local |
| B09 Admin form điền sẵn thông tin đăng nhập mẫu | Built admin portal; API mocked401; không dùng tài khoản thật | Mở /auth/login; quan sát hai input | Credential/password literals xuất hiện trong form/bundle | Fields trống; thiếu input không gửi login request | High/P0 | TC26; 2 admin browser tests; Fixed local; owner kiểm lịch sử/rotate nếu thông tin từng được dùng thật |

Open release risks: tracked key/config chưa được chủ sở hữu xác nhận rotate; backend dev dependencies có advisory braces; ML identity mapping/WSGI chưa verified; index/dữ liệu cũ, persistent mount, monitoring, provider sandbox, staging restore/rollback/load và CI remote chưa chạy. Xem `ops/release-gates.md`, không tự tạo số liệu/bug execution trên staging.
