## HUONG DAN KHOI DONG DU AN VuaVuiVe

### QUICK START

1. Dam bao MongoDB dang chay o `localhost:27017`.
2. Chay seed du lieu:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm run seed
```

3. Mo 5 terminal va chay lan luot:

```powershell
# Terminal 1
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm run dev

# Terminal 2
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\frontend
npm run start:customer

# Terminal 3
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\frontend
npm run start:admin

# Terminal 4
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\payment\vnpay_nodejs
npm start

# Terminal 5
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\ml\VuaVuiVe_Recommender\src
python api.py
```

4. Truy cap nhanh:

- Customer portal: `http://localhost:4200`
- Admin portal: `http://localhost:4201/auth/login`

Luu y ve port co dinh:

- Customer bat buoc dung `4200`, Admin bat buoc dung `4201`.
- Neu mot trong 2 port dang ban, lenh `npm run start:customer` / `npm run start:admin` se dung ngay (khong tu nhay sang port khac).
- Giai phong port roi chay lai de dung dung link portal.

### Cac service va port

- Backend API: `http://localhost:3000`
- Customer Portal: `http://localhost:4200`
- Admin Portal: `http://localhost:4201`
- VNPay demo: `http://localhost:8888`
- ML Recommender: `http://localhost:5001`
- MongoDB: `localhost:27017`

### Buoc 0: Cai dat

Backend:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm install
```

Frontend:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\frontend
npm install
```

VNPay:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\payment\vnpay_nodejs
npm install
```

ML:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\ml\VuaVuiVe_Recommender\src
pip install -r ..\requirements.txt
```

### Buoc 1: Dam bao MongoDB dang chay

Backend se loi ngay neu MongoDB chua mo. Can co service MongoDB o `localhost:27017` truoc khi chay backend.

### Buoc 2: Seed du lieu mau

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm run seed
```

### Tai khoan mac dinh sau khi seed

Admin:

- Email: `admin@vuavuive.vn`
- Mat khau: `Admin@123`

Customer test chinh:

- Email: `user.test@vuavuive.vn`
- Mat khau: `User@123`

Dang nhap khuyen nghi:

- Customer dang nhap tai: `http://localhost:4200/auth/login`
- Admin dang nhap tai: `http://localhost:4201/auth/login`

Luu y:

- Script seed tao them nhieu tai khoan customer demo trong `backend/scripts/seed.js`.
- Tat ca customer demo deu dung mat khau mac dinh: `User@123`.

### Buoc 3: Khoi dong 5 terminal rieng

Terminal 1 - Backend:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm run dev
```

Neu `nodemon` bi loi moi truong, dung ban fallback:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\backend
npm run dev:plain
```

Terminal 2 - Customer Portal:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\frontend
npm run start:customer
```

Terminal 3 - Admin Portal:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\frontend
npm run start:admin
```

Sau khi lenh chay, mo thu cong trang admin login: `http://localhost:4201/auth/login`.

Terminal 4 - VNPay:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\payment\vnpay_nodejs
npm start
```

Terminal 5 - ML:

```powershell
cd e:\Nam3\TailLieuHocKi7\WEB2\VuaVuiVeNC\VuaVuiVeUpdate\ml\VuaVuiVe_Recommender\src
python api.py
```

### Ghi chu

- Khoi dong backend truoc customer/admin portal.
- `backend/.env` can co `RECOMMENDER_API=http://localhost:5001` (ML api.py chay port 5001, KHONG phai 5000).
- Customer portal mo tai `http://localhost:4200`.
- Admin portal mo tai `http://localhost:4201` (man hinh login: `/auth/login`).
- Frontend da khoa port khi chay dev: customer `4200`, admin `4201`; neu ban se fail-fast de tranh sai URL.
- Phan goi y san pham tren home/recommended page da duoc sua de goi dung endpoint `/api/recommend`.

staff@vuavuive.vn
/ Pass: Staff@123
audit@vuavuive.vn
/ Pass: Audit@123
