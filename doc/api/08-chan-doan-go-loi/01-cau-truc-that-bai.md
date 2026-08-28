# Cấu trúc thất bại

Khi một job thất bại, ưu tiên đọc trường `failure` trong chi tiết job và các endpoint chẩn đoán.

## Chẩn đoán Job

```http
GET /api/v1/jobs/{job_id}/diagnostics
```

## Ví dụ trường Failure

```json
{
  "failed_stage": "translation",
  "failure_code": "python_unhandled_exception",
  "failure_category": "translation",
  "summary": "Job thất bại, nhưng nguyên nhân gốc chưa được xác định rõ ràng",
  "detail": "cổng đánh giá dịch bị chặn",
  "retryable": true,
  "provider": "translation",
  "raw_exception_type": "RuntimeError"
}
```

## Nguyên tắc Frontend

- Ưu tiên `summary` cho tiêu đề lỗi.
- Sử dụng `detail` cho chi tiết mở rộng.
- Tham khảo `retryable` và `stage-actions` để xác định có hiển thị nút thử lại hay không.
- Không hiển thị toàn bộ traceback cho người dùng thông thường theo mặc định.
- `raw_excerpt`, `traceback` và các payload chẩn đoán có thể đã được làm sạch.

## Gỡ lỗi dịch thuật

```http
GET /api/v1/jobs/{job_id}/translation/diagnostics
GET /api/v1/jobs/{job_id}/translation/items
GET /api/v1/jobs/{job_id}/translation/items/{item_id}
POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay
```

Các endpoint này được sử dụng để khắc phục sự cố thiếu bản dịch, đầu ra mô hình bất thường, lỗi lô và phát lại; chúng không nên là phụ thuộc cho luồng người dùng chính.
