---
name: "Task 10 — ML Recommender Proxy"
about: "Tích hợp Flask ML API qua Express backend"
title: "[Backend+Frontend] Task 10: ML Recommender Proxy + MongoDB History"
labels: backend, ml, priority-low
---

## Mục tiêu

Proxy Flask ML API qua Express, lưu lịch sử gợi ý vào MongoDB, Angular gọi qua backend.

## Prerequisites

- Task 1+2+3 DONE
- Python Flask Recommender đang chạy tại http://localhost:5000

## Checklist

### Backend

- [ ] `backend/models/RecommendHistory.model.js` — fields: userId, recommendations[{productId, score, reason}], createdAt
- [ ] `backend/routes/recommend.routes.js`:
  - [ ] `POST /api/recommend` — proxy tới `RECOMMENDER_API/api/recommend`, lưu history nếu user đã login
  - [ ] `GET /api/recommend/history` — lịch sử gợi ý của user (auth)
- [ ] Register route trong `server.js`

### Frontend

- [ ] `recommender.service.ts`:
  - [ ] Đổi base URL từ `http://localhost:5000` → `environment.apiBase + '/api/recommend'`
  - [ ] Thêm `withCredentials: true`

## Tham khảo

Xem `/.github/copilot-instructions.md` phần TASK-10.

## Acceptance Criteria

- Angular gọi đúng qua `/api/recommend` (KHÔNG gọi trực tiếp :5000)
- Recommendations hiển thị bình thường trên trang /recommended
- Lịch sử gợi ý được lưu vào MongoDB collection `recommendhistories`
