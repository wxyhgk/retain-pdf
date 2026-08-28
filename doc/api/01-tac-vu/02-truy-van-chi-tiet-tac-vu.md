# Truy vấn chi tiết Job

## Endpoint

```http
GET /api/v1/jobs/{job_id}
```

Được sử dụng để lấy ảnh chụp hiện tại của tác vụ. Trang nên đọc endpoint này trước, sau đó đăng ký nhận sự kiện.

## Các trường được khuyến nghị

```json
{
  "job_id": "20260616120000-abcdef",
  "status": "running",
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main",
  "stage_detail": "Đang dịch lô thứ 789 / 5216",
  "progress": {
    "unit": "batch",
    "current": 789,
    "total": 5216,
    "percent": 15.1
  },
  "background_stages": [
    {
      "display_stage": "render",
      "stage": "rendering",
      "substage": "render_prewarm",
      "lane": "background",
      "progress": {
        "unit": "step",
        "current": 2,
        "total": 3
      }
    }
  ]
}
```

Mô tả các trường:

- `status`: trạng thái job, ví dụ `queued`, `running`, `succeeded`, `failed`, hoặc `canceled`.
- `display_stage`: giai đoạn chính hiển thị trên frontend; chỉ diễn giải là `ocr | translation | render | done`.
- `stage`: tên giai đoạn nội bộ của backend.
- `substage`: giai đoạn phụ đọc được bằng máy.
- `lane`: `main` hoặc `background`.
- `progress`: ảnh chụp tiến độ hiện tại đáng tin cậy nhất.
- `stage_detail`: văn bản cho con người; không sử dụng cho logic.
- `background_stages`: các giai đoạn nền chạy đồng thời như render prewarm.

## Nguyên tắc Frontend

- Thẻ trạng thái nên đọc giai đoạn chính từ `display_stage + lane=main`.
- Thanh tiến độ nên đọc `progress.unit/current/total/percent`.
- Chỉ hiển thị `stage_detail`; không sử dụng cho việc ra quyết định.
- Sau khi làm mới trang, không chỉ dựa vào phát lại sự kiện; khôi phục trạng thái từ ảnh chụp chi tiết trước.
