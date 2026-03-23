## 4.6. Website Deployment

### 4.6.1. Deployment Architecture

He thong VuaVuiVe duoc trien khai theo mo hinh da dich vu (multi-service):

- Customer Frontend: Angular, chay tai cong `4200`
- Admin Frontend: Angular, chay tai cong `4201`
- Backend API: Node.js/Express, chay tai cong `3000`
- Database: MongoDB, chay tai cong `27017`
- Payment Demo Service: VNPay Node demo, chay tai cong `8888`
- Recommender Service: Flask API, chay tai cong `5001`

Luot trien khai:

1. Khoi dong MongoDB
2. Chay seed du lieu mau cho backend
3. Khoi dong backend API
4. Khoi dong customer portal va admin portal
5. Khoi dong payment service va ML recommender

### 4.6.2. Deployment Configuration

Cac bien moi truong quan trong:

- `MONGO_URI`: Chuoi ket noi MongoDB
- `PORT`: Cong backend
- `SESSION_SECRET`: Khoa ky session
- `CLIENT_ORIGIN`/`CLIENT_ORIGINS`: Danh sach origin frontend hop le
- `RECOMMENDER_API`: Dia chi dich vu goi y
- `VNP_*`, `MOMO_*`: Cau hinh payment gateway

Luu y trien khai:

- Backend su dung `connect-mongo` de luu session vao MongoDB.
- He thong su dung CORS, CSRF, rate limiting va RBAC de tang cuong bao mat.
- Frontend customer/admin duoc tach rieng de dam bao phan quyen ro rang.

### 4.6.3. Deployment Verification Checklist

- [ ] MongoDB ket noi thanh cong
- [ ] API health check `GET /api/health` tra ve HTTP 200
- [ ] Customer portal truy cap duoc tai `http://localhost:4200`
- [ ] Admin portal truy cap duoc tai `http://localhost:4201/auth/login`
- [ ] VNPay demo service hoat dong tai cong 8888
- [ ] ML service hoat dong tai cong 5001 (hoac backend fallback local recommendation)

---

## 4.7. Testing and Evaluation

### 4.7.1. Functional Testing

Muc tieu: Xac minh cac chuc nang nghiep vu chinh hoat dong dung theo yeu cau.

Phuong phap:

- Kiem thu theo use case
- Kiem thu manual ket hop API testing
- Doi chieu ket qua voi FR-01 -> FR-26

Bang test case mau:

| Test ID | Chuc nang | Input/Action | Ky vong | Ket qua |
|---|---|---|---|---|
| FT-01 | Dang ky tai khoan | Nhap thong tin hop le, submit register | Tao tai khoan thanh cong | Pass/Fail |
| FT-02 | Dang nhap customer | Email/password hop le | Dang nhap thanh cong, tao session | Pass/Fail |
| FT-03 | Duyet san pham | Mo trang products, loc danh muc | Danh sach san pham hien thi dung | Pass/Fail |
| FT-04 | Dat hang | Tao don voi gio hang hop le | Tao order, tru ton kho | Pass/Fail |
| FT-05 | Voucher | Nhap voucher hop le | Voucher duoc ap dung dung quy tac | Pass/Fail |
| FT-06 | Thanh toan VNPay/MoMo | Tao payment request | Nhan callback va cap nhat payment status | Pass/Fail |
| FT-07 | Goi y san pham | Goi endpoint recommend | Nhan danh sach goi y/fallback | Pass/Fail |
| FT-08 | Quan ly admin | Cap nhat trang thai don | Trang thai cap nhat dung transition | Pass/Fail |

### 4.7.2. Interface Testing

Muc tieu: Danh gia tinh dung dan va tinh than thien cua giao dien customer/admin.

Noi dung kiem thu:

- Responsive tren desktop/laptop
- Luong dieu huong chinh (home -> product -> cart -> checkout)
- Form validation (auth, profile, checkout)
- Hien thi thong bao loi/thanh cong
- Tinh nhat quan giao dien giua customer va admin

Bang danh gia giao dien:

| Tieu chi | Mo ta | Danh gia |
|---|---|---|
| Navigation | Chuyen trang ro rang, de tim chuc nang | Dat/Khong dat |
| Form UX | Validate truong bat buoc, thong bao loi de hieu | Dat/Khong dat |
| Readability | Font, mau sac, bo cuc de doc | Dat/Khong dat |
| Responsiveness | Hien thi on tren nhieu kich thuoc man hinh | Dat/Khong dat |
| Consistency | Thanh phan UI thong nhat | Dat/Khong dat |

### 4.7.3. API Testing

Muc tieu: Kiem tra tinh dung dan cua backend endpoint (status code, payload, auth, validation, error handling).

Tra loi cau hoi cua ban: **Dung, Postman la cong cu phu hop nhat de test API** trong do an nay.

Cong cu de xuat:

- Postman: test thu cong, tao collection, environment
- Newman: chay tu dong collection Postman (neu can)
- (Tuy chon) curl/Insomnia cho test nhanh

Nhom endpoint can test:

- `auth`: register/login/logout/me/profile/password
- `products`: list/detail/categories + CRUD admin
- `orders`: create/list/detail/cancel/status/reviews
- `payment`: vnpay create/return/ipn, momo create/ipn
- `recommend`: recommend/history/event/telemetry
- `admin`/`users`: dashboard, users, vouchers, reports/export

Bang API testing mau:

| API ID | Endpoint | Method | Test case | Ky vong | Ket qua |
|---|---|---|---|---|---|
| API-01 | `/api/auth/login` | POST | Credentials hop le | 200 + session cookie | Pass/Fail |
| API-02 | `/api/products` | GET | Khong can auth | 200 + danh sach san pham | Pass/Fail |
| API-03 | `/api/orders` | POST | User da login + payload hop le | 201 + tao order | Pass/Fail |
| API-04 | `/api/orders` | POST | Chua login | 401 Unauthorized | Pass/Fail |
| API-05 | `/api/payment/vnpay/create` | POST | orderId hop le | 200 + paymentUrl | Pass/Fail |
| API-06 | `/api/recommend` | POST | user_id hop le | 200 + recommendations | Pass/Fail |
| API-07 | `/api/admin/orders` | GET | Staff/Admin co quyen | 200 + order list | Pass/Fail |
| API-08 | `/api/admin/orders` | GET | User thuong | 403 Forbidden | Pass/Fail |

Goi y to chuc Postman:

1. Tao `Environment` (baseUrl, session/cookies)
2. Chia `Collections` theo module (`Auth`, `Products`, `Orders`, `Payment`, `Admin`, `Recommend`)
3. Viet pre-request/script de luu token/cookie neu can
4. Gan test assertion cho status code va field quan trong

### 4.7.4. System Evaluation

Muc tieu: Danh gia tong the he thong ve do dung, on dinh, bao mat va kha nang mo rong.

Tieu chi danh gia de xuat:

- Functional completeness: muc do dat FR
- Reliability: kha nang chay on dinh khi luong user tang vua phai
- Security baseline: session, RBAC, CSRF, CORS, rate limit
- Performance baseline: do tre API va toc do tai trang
- Maintainability: cau truc module ro rang, de mo rong

Bang tong hop danh gia he thong:

| Nhom tieu chi | Mo ta | Muc danh gia |
|---|---|---|
| Functional completeness | Hoan thanh cac use case chinh | Tot/Dat/Can cai thien |
| Reliability | Chay on dinh trong test local va user flow lien tuc | Tot/Dat/Can cai thien |
| Security baseline | Dat cac co che bao mat co ban | Tot/Dat/Can cai thien |
| Performance baseline | API response va thao tac UI o muc chap nhan duoc | Tot/Dat/Can cai thien |
| Maintainability | Code co tinh module, de bao tri | Tot/Dat/Can cai thien |

Ket luan danh gia (mau de dien vao report):

- He thong dat duoc muc tieu nghiep vu cot loi cua san TMDT mini-grocery.
- Luong customer (browse -> checkout -> payment -> tracking) va luong backoffice (quan ly don/san pham/voucher/report) hoat dong theo thiet ke.
- He thong san sang cho cac buoc nang cap tiep theo: test tu dong (CI), monitoring production, va toi uu hieu nang khi scale.
