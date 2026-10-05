# Database testing

MongoDB/Mongoose, không tạo SQL giả. Integration kiểm data correctness, unique idempotency/payment indexes, last-unit/voucher races, rollback Order/Shipment/stock/voucher, restock và package aggregation. DB tên ngẫu nhiên `vvv_qa_<random>_test`, cleanup chỉ chấp nhận pattern này. MONGO_TEST_URI chỉ loopback và port rõ ràng.

Read-only nghiệp vụ dùng `backend/scripts/reconcile-orders.js` và `check-production-indexes.js` (mặc định). Cả hai chưa chạy với DB nghiệp vụ. Chỉ xuất aggregates/counts/index names, không transaction/customer data.

Staging cần kiểm orphan reference Product/User/Order/Shipment/Review, legacy money/stock/voucher invariants, timezone/soft-delete/audit và indexes các model khác. Không tự chạy migration hoặc sửa dữ liệu cũ. Restore synthetic đã chạy; restore DB+ảnh nghiệp vụ vẫn Not Run.
