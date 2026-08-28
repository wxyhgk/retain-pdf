# Tổng quan sự kiện

## Endpoint

```http
GET /api/v1/jobs/{job_id}/events
GET /api/v1/ocr/jobs/{job_id}/events
```

Luồng sự kiện được sử dụng để hiển thị lịch sử tác vụ, giai đoạn hiện tại và tiến độ chi tiết.

## Cấu trúc sự kiện

```json
{
  "created_at": "2026-06-16T12:00:00Z",
  "seq": 1234,
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main",
  "event_type": "progress",
  "stage_detail": "Đang dịch lô 789 / 5216",
  "message": "tiến độ lô dịch",
  "progress": {
    "unit": "batch",
    "current": 789,
    "total": 5216,
    "percent": 15.1
  }
}
```

## Mô tả các trường

- `seq`: số thứ tự sự kiện tăng dần toàn cục; frontend sử dụng để phân biệt sự kiện mới và cũ.
- `display_stage`: giai đoạn chính hiển thị cho người dùng.
- `stage`: giai đoạn nội bộ của backend.
- `substage`: giai đoạn phụ đọc được bằng máy.
- `lane`: `main` hoặc `background`.
- `event_type`: `progress`, `stage_transition`, `artifact_published`, v.v.
- `progress`: đối tượng tiến độ chính thức duy nhất.
- `message` / `stage_detail`: văn bản đọc được cho con người.

## Nguyên tắc Frontend

- Sắp xếp theo `seq`.
- Trong cùng `display_stage + substage + progress.unit`, ưu tiên sự kiện mới nhất.
- Sử dụng `lane=main` cho trạng thái chính.
- Hiển thị tiền xử lý nền trong khu vực phụ; không thay thế giai đoạn chính.
- Không suy ra giai đoạn từ từ khóa trong `message`.
