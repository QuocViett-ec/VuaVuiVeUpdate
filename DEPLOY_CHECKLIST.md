# VuaVuiVe Deploy Checklist

Checklist nay dung de quyet dinh da san sang deploy chua.

## 1) Muc san sang

- [ ] **Muc Demo Noi Bo**: Chay on dinh tren may khac may dev, luong chinh khong bi chan.
- [ ] **Muc Bao Ve/Cham Diem**: Freeze tinh nang 3-5 ngay, chi sua bug, test full luong pass.
- [ ] **Muc Production Nho**: Co domain + HTTPS + monitor + backup + rollback.

## 2) Khoi dong dich vu

- [x] MongoDB dang chay tai `localhost:27017`.
- [x] Backend chay duoc (`npm run dev`) va health check OK: `http://localhost:3000/api/health`.
- [x] Customer portal chay duoc: `http://localhost:4200`.
- [x] Admin portal chay duoc: `http://localhost:4201/auth/login`.
- [x] VNPay demo chay duoc (route `/order`): `http://localhost:8888`.
- [ ] ML API chay duoc o port 5001.

## 3) Bien moi truong bat buoc

- [x] `backend/.env` co `MONGO_URI` hop le.
- [x] `backend/.env` co `SESSION_SECRET` manh.
- [x] `backend/.env` co `CLIENT_ORIGINS` dung domain/port frontend.
- [x] `backend/.env` co `RECOMMENDER_API=http://localhost:5001` (hoac URL production tuong ung).
- [ ] Khong hardcode secret trong source code.

## 4) Chuc nang customer (must pass)

- [ ] Dang ky, dang nhap, dang xuat khong loi.
- [ ] Trang san pham load day du (khong bi gioi han 12 san pham do sai limit).
- [ ] Tim kiem, loc danh muc, sap xep hoat dong dung.
- [ ] Them gio hang, cap nhat so luong, xoa khoi gio.
- [ ] Dat hang thanh cong va tao order tren backend.
- [ ] Trang cong thuc co the them nguyen lieu vao gio.

## 5) Chuc nang admin (must pass)

- [ ] Dang nhap admin thanh cong.
- [ ] CRUD san pham hoat dong dung.
- [ ] Don hang hien thi va cap nhat trang thai duoc.
- [ ] Xuat CSV san pham hoat dong neu tinh nang dang duoc dung.
- [ ] Quyen admin/staff phan tach dung.

## 6) Payment + ML

- [ ] VNPay callback ve backend dung endpoint va dung trang thai don.
- [ ] Test thanh toan thanh cong va truong hop that bai/deferred.
- [ ] Endpoint goi y (`/api/recommend`) phan hoi du lieu hop le.
- [ ] Neu ML tam dung, he thong van fallback an toan (khong crash trang).

## 7) Bao mat can ban

- [x] CORS chi mo cho origin can thiet.
- [x] Session cookie cau hinh dung moi truong (`secure`, `sameSite`, `httpOnly`).
- [x] CSRF middleware khong pha vo luong submit form/API hop le.
- [x] Route admin duoc bao ve bang auth + permission.

## 8) Build va smoke test

- [x] Frontend customer build pass: `npm run build:customer`.
- [x] Frontend admin build pass: `npm run build:admin`.
- [x] Backend khoi dong khong loi startup.
- [ ] Khong con loi `401` sai luong tren customer pages.
- [ ] Console frontend khong co loi blocking (warning nhe co the chap nhan).

## 9) Van hanh va rollback

- [x] Co file huong dan deploy nhanh (lenh start/stop/restart).
- [x] Co log runtime de tra loi khi loi phat sinh.
- [ ] Co backup MongoDB truoc khi deploy.
- [ ] Co ke hoach rollback: quay lai ban build truoc trong <= 10 phut.

## Ket qua check tu dong (2026-03-21)

- Da pass: MongoDB port 27017, Backend port 3000, health check `/api/health` tra ve HTTP 200.
- Da pass: Build frontend customer va admin deu thanh cong.
- Chua chay trong phien test nay: port 4200, 4201, 5001, 8888.
- Can test tay them: full luong customer/admin, thanh toan, ML fallback, va console khong loi blocking.

## Cap nhat setup them (2026-03-21)

- Da cai dat dependencies cho `frontend`, `backend`, `payment/vnpay_nodejs`.
- Da tao `backend/.env` cho local dev voi `MONGO_URI`, `SESSION_SECRET`, `CLIENT_ORIGINS`, `RECOMMENDER_API`.
- Da xac nhan online:
	- `http://localhost:3000/api/health` -> 200
	- `http://localhost:4200` -> 200
	- `http://localhost:4201/auth/login` -> 200
	- `http://localhost:8888/order` -> 200
- Blocker ML: `http://localhost:5001/health` chua len do thieu model `ml/VuaVuiVe_Recommender/models/nmf_model.pkl`.
	Can train model bang notebook `03_train_model.ipynb` truoc khi chay `python api.py`.

## 10) Quyet dinh deploy

Chi deploy khi tat ca muc 2, 3, 4, 5, 8 da tick xong.

Neu thieu muc 6 hoac 9: duoc phep deploy noi bo de demo, khong nen deploy production.
