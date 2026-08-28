# Tài liệu frontend

Nơi đây lưu trữ các ghi chép về tích hợp frontend, kiểm tra trạng thái và tối ưu hóa, không phải tài liệu sản phẩm nghiệp vụ.

- [Smoke trạng thái frontend](./status_smoke.md)
- [Ghi chép tối ưu hóa frontend](./optimization_notes.md)
- [Báo cáo Smoke trạng thái frontend mới nhất](../../ops/reports/frontend-status-smoke-latest.json)

Đầu vào mã chính:

- `frontend/src/js/`
- `frontend/src/styles/`
- `frontend/package.json`

Đồng bộ desktop:

- Sau khi sửa `frontend/src/**`, chạy `npm --prefix desktop run sync-frontend`, nó sẽ xây dựng lại frontend web và đồng bộ vào `desktop/app/frontend`.
- Trước khi commit, chạy `npm --prefix desktop run verify-frontend-sync`, nó sẽ đồng bộ frontend desktop trước, sau đó chạy smoke frontend desktop, tránh việc đóng gói Electron tiếp tục sử dụng trang cũ.
