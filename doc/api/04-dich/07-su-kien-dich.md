# Sự kiện dịch thuật

Sự kiện dịch thuật được hiển thị thông qua job events thống nhất:

```http
GET /api/v1/jobs/{job_id}/events
```

## Các substage phổ biến

- `translation_prepare`
- `domain_inference`
- `page_policies`
- `continuation_review`
- `translation_batches`
- `garbled_repair`
- `translation_review`

## Ví dụ sự kiện

```json
{
  "seq": 120,
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main",
  "event_type": "progress",
  "progress": {
    "unit": "batch",
    "current": 789,
    "total": 5216,
    "percent": 15.1
  },
  "stage_detail": "Đang dịch lô thứ 789 / 5216"
}
```

## Nguyên tắc Frontend

- Tiến độ dịch chính đọc từ `display_stage=translation` và `lane=main`.
- `progress.unit` có thể là `batch`, `page`, `item` hoặc `step`, hiển thị theo giá trị trả về.
- `stage_detail` chỉ dùng cho văn bản dành cho con người.
- Sự kiện làm nóng trước kết xuất nền sẽ có `display_stage=render`, `lane=background`, không làm phủ trạng thái chính của dịch.
