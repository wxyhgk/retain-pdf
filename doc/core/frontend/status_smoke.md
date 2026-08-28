# Kiểm tra Smoke trạng thái frontend

Mục tiêu của bộ kiểm tra này không phải là "chụp ảnh màn hình trang frontend", mà là tự động xác minh:

- Tải lên có thành công không
- `/api/v1/jobs` có được gửi thành công không
- Trong quá trình polling chi tiết tác vụ, các nhãn trạng thái frontend hiển thị có tiến triển theo dự kiến không

Vị trí script hiện tại:

- `frontend/scripts/frontend-status-smoke.mjs`

Đầu vào npm hiện tại:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

Đầu vào cố định cấp kho lưu trữ:

```bash
./.github/scripts/smoke_frontend_status.sh
```

Mặc định sẽ ghi kết quả mới nhất vào:

```text
doc/ops/reports/frontend-status-smoke-latest.json
```

## Hành vi mặc định

Script sẽ tự động lấy cấu hình theo thứ tự sau:

1. Tham số dòng lệnh
2. Biến môi trường
3. `frontend/runtime-config.local.js`
4. `backend/scripts/.env/*.env`

Mặc định đọc:

- API Base: `frontend/runtime-config.local.js` / `frontend/runtime-config.js`
- `X-API-Key`: `frontend/runtime-config.local.js`
- Token Paddle: `backend/scripts/.env/paddle.env`
- Token MinerU: `backend/scripts/.env/mineru.env`
- API key dịch: `backend/scripts/.env/deepseek.env`

## Ví dụ thường dùng

Chạy toàn bộ quy trình `book`:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

Chỉ định Paddle:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --ocr-provider paddle
```

Chạy trực tiếp từ thư mục gốc kho lưu trữ:

```bash
./.github/scripts/smoke_frontend_status.sh data/temPDF/test1.pdf --ocr-provider paddle
```

Chỉ chạy dịch không kết xuất:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --workflow translate \
  --expect-labels "Đang OCR,Đang dịch,Hoàn tất"
```

Chỉ định địa chỉ API và thời gian chờ:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --api-base http://127.0.0.1:41000 \
  --max-wait-ms 3600000
```

Xuất JSON:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --json
```

## Trọng tâm đầu ra

Script sẽ in mỗi lần thay đổi trạng thái, ví dụ:

```text
2026-04-25T14:00:00.000Z | running | Đang OCR | Đã hoàn thành OCR trang 3/12
2026-04-25T14:00:20.000Z | running | Đang dịch | Đã hoàn thành lô dịch 5/18
2026-04-25T14:01:10.000Z | running | Đang kết xuất | Đã hoàn thành kết xuất trang 9/12
2026-04-25T14:01:30.000Z | succeeded | Hoàn tất | Hoàn tất xử lý
```

Cuối cùng sẽ tổng hợp:

- `job_id`
- `final_status`
- `observed_labels`
- `missing_labels`
- `event_count`

Nếu thiếu nhãn dự kiến, hoặc tác vụ cuối cùng không phải `succeeded`, script sẽ trả về mã thoát khác 0.

## Báo cáo cố định

Script cấp kho lưu trữ sẽ ghi cố định:

- `doc/ops/reports/frontend-status-smoke-latest.json`

Báo cáo bao gồm:

- `jobId`
- `finalStatus`
- `observedLabels`
- `missingLabels`
- `observations`
- `eventSamples`

## Phạm vi áp dụng

Bộ smoke này chủ yếu xác minh "chuỗi ánh xạ trạng thái frontend":

- Backend có tạo ra chi tiết job không
- Logic chuẩn hóa trạng thái frontend sẽ thu được nhãn gì
- Trong quy trình thực tế, các nhãn này có thực sự xuất hiện không

Nó không xác minh các chi tiết UI thuần túy như bố cục trình duyệt, hoạt ảnh thành phần, hiển thị/ẩn nút. Phần đó nếu sau này cần bổ sung, sẽ dùng Playwright riêng.
