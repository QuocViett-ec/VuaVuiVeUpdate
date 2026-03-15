## HUONG DAN KHOI DONG DU AN VuaVuiVe

### Cac service va port

- Backend API: `http://localhost:3000`
- Frontend Angular: `http://localhost:4200`
- VNPay demo: `http://localhost:8888`
- ML Recommender: `http://localhost:5001`
- MongoDB: `localhost:27017`

### Buoc 0: Cai dat

Backend:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\backend
npm install
```

Frontend:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\frontend
npm install
```

VNPay:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\payment\vnpay_nodejs
npm install
```

ML:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\ml\VuaVuiVe_Recommender\src
pip install -r ..\requirements.txt
```

### Buoc 1: Dam bao MongoDB dang chay

Backend se loi ngay neu MongoDB chua mo. Can co service MongoDB o `localhost:27017` truoc khi chay backend.

### Buoc 2: Seed du lieu mau

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\backend
npm run seed
```

### Buoc 3: Khoi dong 4 terminal rieng

Terminal 1 - Backend:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\backend
npm run dev
```

Neu `nodemon` bi loi moi truong, dung ban fallback:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\backend
npm run dev:plain
```

Terminal 2 - Frontend:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\frontend
npm start
```

Terminal 3 - VNPay:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\payment\vnpay_nodejs
npm start
```

Terminal 4 - ML:

```powershell
cd d:\VUAVUIVE\VuaVuiVeUpdate\ml\VuaVuiVe_Recommender\src
python api.py
```

### Ghi chu

- Khoi dong backend truoc frontend.
- `backend/.env` can co `RECOMMENDER_API=http://localhost:5001` (ML api.py chay port 5001, KHONG phai 5000).
- Giao dien chinh mo tai `http://localhost:4200`.
- Phan goi y san pham tren home/recommended page da duoc sua de goi dung endpoint `/api/recommend`.
