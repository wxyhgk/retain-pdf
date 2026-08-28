# Giao diện luồng sự kiện

Bài viết này là cổng vào tương thích cho liên kết cũ, không còn duy trì giao thức sự kiện thứ hai.

Hiện tại luồng sự kiện có hai cổng vào để đọc:

- Dành cho frontend và bên thứ ba: xem [02-chi-tiet-tac-vu-va-su-kien.md](./02-chi-tiet-tac-vu-va-su-kien.md)
- Dành cho giao thức nội bộ Rust/Python: xem [11-su-kien-giai-doan-va-giao-thuc-that-bai.md](./11-su-kien-giai-doan-va-giao-thuc-that-bai.md)

## Địa chỉ giao diện

Luồng sự kiện nhiệm vụ chính:

`GET /api/v1/jobs/{job_id}/events?limit=50&offset=0`

Luồng sự kiện nhiệm vụ con OCR:

`GET /api/v1/ocr/jobs/{job_id}/events?limit=50&offset=0`

Đóng gói trả về cố định:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [],
    "limit": 50,
    "offset": 0
  }
}
```

Đường dẫn đọc của frontend là `data.items`, không phải `items` ở tầng trên cùng.

## Đường hướng hiện tại

`/events` trả về sự kiện chính tắc Rust:

- `stage`: giai đoạn chung, hiển thị cho frontend.
- `substage`: giai đoạn con có thể đọc bằng máy.
- `lane`: `main | background | artifact | diagnostic`.
- `event_type`: `progress | artifact | terminal | error | diagnostic`.
- `progress`: đối tượng tiến độ chung.
- `message`: nhật ký có thể đọc bằng người, không được dùng làm căn cứ phán đoán máy.

`progress_current` / `progress_total` / `progress_unit` được đề cập trong tài liệu cũ là các trường nguồn nội bộ. Frontend mới ưu tiên đọc `progress`.
