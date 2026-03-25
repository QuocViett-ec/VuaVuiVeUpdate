## HƯỚNG DẪN KHỞI ĐỘNG DỰ ÁN VuaVuiVe

Tài liệu này đã đối chiếu với script thực tế trong `backend`, `frontend`, `payment/vnpay_nodejs`, `ml/VuaVuiVe_Recommender`.

Giả định bạn đang mở terminal tại thư mục gốc dự án (nơi chứa `backend`, `frontend`, `ml`, `payment`).

### 1) Tổng quan service và port

- Backend API: `http://localhost:3000`
- Customer Portal: `http://localhost:4200`
- Admin Portal: `http://localhost:4201`
- VNPay demo app: `http://localhost:8888`
- ML Recommender API: `http://localhost:5001`
- MongoDB: local `localhost:27017` hoặc MongoDB Atlas

Lưu ý quan trọng:

- Frontend khóa cứng port: customer `4200`, admin `4201`.
- Nếu port bị bận, `npm run start:customer` / `npm run start:admin` sẽ dừng ngay (không nhảy port).

---

### 2) Yêu cầu môi trường

- Node.js + npm
- Python 3.x + pip
- MongoDB (local hoặc Atlas)

Khuyến nghị: dùng cùng 1 bản Node cho backend/frontend/vnpay để tránh lỗi dependency.

---

### 3) Cài đặt dependency

Backend:

```powershell
cd .\backend
npm install
```

Frontend:

```powershell
cd .\frontend
npm install
```

VNPay demo:

```powershell
cd .\payment\vnpay_nodejs
npm install
```

ML recommender:

```powershell
cd .\ml\VuaVuiVe_Recommender\src
pip install -r ..\requirements.txt
```

---

### 4) Cấu hình environment

Backend cần file `.env`.

Nếu chưa có:

```powershell
cd .\backend
Copy-Item .env.example .env
```

Những biến cần kiểm tra tối thiểu trong `backend/.env`:

- `MONGO_URI` (local hoặc Atlas)
- `PORT=3000`
- `CLIENT_ORIGINS=http://localhost:4200,http://localhost:4201`
- `RECOMMENDER_API=http://localhost:5001`
- `SESSION_SECRET=...`

Ghi chú:

- Nếu dùng Mongo local, `MONGO_URI` có thể đặt: `mongodb://localhost:27017/vuavuive`.
- Backend sẽ không chạy được nếu `MONGO_URI` sai hoặc MongoDB chưa sẵn sàng.

---

### 5) Seed dữ liệu mẫu

```powershell
cd .\backend
npm run seed
```

Lệnh này chạy cả:

- `scripts/seed.js`
- `scripts/seed-orders.js`

---

### 6) Khởi động hệ thống (5 terminal)

Terminal 1 - Backend:

```powershell
cd .\backend
npm run dev
```

Nếu lỗi `nodemon`, dùng fallback:

```powershell
cd .\backend
npm run dev:plain
```

Terminal 2 - Customer portal:

```powershell
cd .\frontend
npm run start:customer
```

Terminal 3 - Admin portal:

```powershell
cd .\frontend
npm run start:admin
```

Terminal 4 - VNPay demo:

```powershell
cd .\payment\vnpay_nodejs
npm start
```

Terminal 5 - ML recommender API:

```powershell
cd .\ml\VuaVuiVe_Recommender\src
python api.py
```

Thứ tự khuyến nghị:

1. MongoDB
2. ML
3. Backend
4. Frontend customer/admin
5. VNPay

---

### 7) Link truy cập nhanh

- Customer login: `http://localhost:4200/auth/login`
- Admin login: `http://localhost:4201/auth/login`
- Backend health: `http://localhost:3000/api/health`
- ML health: `http://localhost:5001/health`
- VNPay demo: `http://localhost:8888`

---

### 8) Tài khoản mặc định sau seed

Admin:

- Email: `admin@vuavuive.vn`
- Password: `Admin@123`

Customer test chính:

- Email: `user.test@vuavuive.vn`
- Password: `User@123`

Thêm tài khoản staff/audit:

- `staff@vuavuive.vn` / `Staff@123`
- `audit@vuavuive.vn` / `Audit@123`

Lưu ý:

- Seed tạo thêm nhiều customer demo trong `backend/scripts/seed.js`.
- Customer demo dùng mật khẩu mặc định `User@123`.

---

### 9) Kiểm tra nhanh sau khi chạy

Kiểm tra health backend:

```powershell
Invoke-WebRequest http://localhost:3000/api/health | Select-Object -ExpandProperty Content
```

Kiểm tra health ML:

```powershell
Invoke-WebRequest http://localhost:5001/health | Select-Object -ExpandProperty Content
```

Smoke test recommender (yêu cầu backend + ML + Mongo đang chạy):

```powershell
cd .\backend
npm run smoke:recommender
```

Test payment:

```powershell
cd .\backend
npm run test:payment
```

---

### 10) Lỗi thường gặp và cách xử lý

1. Frontend báo port 4200/4201 đang bận

- Đóng process đang chiếm port rồi chạy lại.
- Frontend không auto nhảy sang port khác.

2. Backend lỗi kết nối MongoDB

- Kiểm tra `MONGO_URI` trong `.env`.
- Nếu dùng local, đảm bảo service MongoDB đang chạy.

3. Trang gợi ý sản phẩm không có kết quả ML

- Kiểm tra ML API tại `http://localhost:5001/health`.
- Kiểm tra `RECOMMENDER_API=http://localhost:5001` trong `backend/.env`.
- Khi ML down, backend có fallback local (`method: local_fallback`).

---

### 11) Logistics mới (Order - Shipment - Customer)

Backend đã được nâng cấp để tách phần logistics ra collection `Shipment` và liên kết:

- `Order.userId` -> `User._id`
- `Order.shipmentIds[]` -> `Shipment._id`
- `Shipment.orderId` -> `Order._id`
- `Shipment.customerId` -> `User._id`

Các API mới:

- `GET /api/shipments/me` - customer xem shipment của mình
- `GET /api/shipments/:id` - xem chi tiết shipment theo `_id` hoặc `trackingNumber`
- `GET /api/shipments` - backoffice list shipment
- `POST /api/shipments` - backoffice tạo shipment mới cho order (hỗ trợ split package)
- `PATCH /api/shipments/:id` - backoffice cập nhật trạng thái/tracking/ETA

Lưu ý:

- Cập nhật shipment có thể đồng bộ ngược trạng thái order (ví dụ tất cả shipment delivered -> order delivered).
- `trackingNumber` được normalize uppercase và chỉ unique khi có giá trị thực.

Migration dữ liệu cũ:

```powershell
cd .\backend
npm run migrate:order-logistics:dry
```

Khi dry-run ổn, chạy migrate thật:

```powershell
cd .\backend
npm run migrate:order-logistics
```

Chạy từng phần để kiểm tra an toàn:

```powershell
cd .\backend
node scripts/migrate-order-logistics.js --dry-run --limit=200
```

4. VNPay không tạo được link thanh toán

- Kiểm tra biến `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL` trong `backend/.env`.
- Kiểm tra app VNPay demo đang chạy ở port `8888`.
- Dữ liệu test card xem thêm trong `test_banking.md`.

---
