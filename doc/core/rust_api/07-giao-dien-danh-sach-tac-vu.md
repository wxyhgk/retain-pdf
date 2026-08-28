# Giao diện danh sách nhiệm vụ

## 1. Giao diện chính

Danh sách nhiệm vụ chính:

`GET /api/v1/jobs`

Danh sách nhiệm vụ con OCR:

`GET /api/v1/ocr/jobs`

Cả hai giao diện đều phù hợp để làm:

- "Nhiệm vụ gần đây" trên trang chủ
- Danh sách lịch sử nhiệm vụ
- Bảng nhiệm vụ sau khi lọc đơn giản

## 2. Tham số truy vấn

Hiện hỗ trợ:

- `limit`
- `offset`
- `status`
- `workflow`
- `provider`

Giải thích:

- `limit`
  - Tùy chọn, mặc định s�� dụng giá trị mặc định tích hợp trong backend
- `offset`
  - Tùy chọn, mặc định `0`
- `status`
  - Tùy chọn
  - Giá trị hiện tại: `queued` / `running` / `succeeded` / `failed` / `canceled`
- `workflow`
  - Tùy chọn
  - Giá trị hiện tại: `book` / `ocr`
- `provider`
  - Tùy chọn
  - Hiện chủ yếu dùng để lọc theo thông tin chẩn đoán OCR provider, ví dụ `mineru`

## 3. Quy tắc sắp xếp

Quy tắc cố định hiện tại:

- Theo `updated_at DESC`

Nghĩa là:

- Nhiệm vụ có thay đổi gần đây nhất xếp trước
- Phù hợp hơn cho bảng "nhiệm vụ gần đây"
- Không bằng "tạo gần đây nhất"

## 4. Cấu trúc trả về

Đóng gói trả về:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260406063244-2176e4",
        "display_name": "paper.pdf",
        "workflow": "book",
        "status": "running",
        "trace_id": "trace-abc",
        "display_stage": "translation",
        "stage": "translating",
        "substage": "translation_batches",
        "lane": "main",
        "stage_detail": "Đang dịch, lô thứ 3/12",
        "progress": {
          "unit": "batch",
          "current": 3,
          "total": 12,
          "percent": 25.0
        },
        "invocation": {
          "stage": "provider",
          "input_protocol": "stage_spec",
          "stage_spec_schema_version": "provider.stage.v1"
        },
        "created_at": "2026-04-06T06:32:44Z",
        "updated_at": "2026-04-06T06:33:00Z",
        "detail_path": "/api/v1/jobs/20260406063244-2176e4",
        "detail_url": "http://127.0.0.1:41000/api/v1/jobs/20260406063244-2176e4"
      }
    ],
    "invocation_summary": {
      "stage_spec_count": 1,
      "unknown_count": 0
    }
  }
}
```

Mỗi item cố định chứa:

- `job_id`
- `display_name`
- `workflow`
- `status`
- `trace_id`
- `stage`
- `created_at`
- `updated_at`
- `detail_path`
- `detail_url`
- `invocation`

Phản hồi danh sách còn có thêm một trường tổng hợp:

- `data.invocation_summary`

## 5. Hiểu các trường như thế nào

- `job_id`
  - Định danh duy nhất của nhiệm vụ
- `display_name`
  - Tên nhiệm vụ hiển thị cho người dùng
  - Thứ tự ưu tiên lấy giá trị:
    1. Tên file PDF tải lên
    2. Tên file cuối cùng của URL từ xa
    3. Cuối cùng dùng `job_id` làm dự phòng
- `workflow`
  - Nhiệm vụ chính thường là `book`
  - Nhiệm vụ con OCR thường là `ocr`
- `status`
  - Trạng thái hiện tại hoặc trạng thái cuối
- `trace_id`
  - Trace id của nhiệm vụ hiện tại gắn trên artifacts, có thể rỗng
- `stage`
  - Giai đoạn thô hiện tại
  - Phù hợp làm nhãn danh sách, không phù hợp để thay thế `stage_detail` trong chi tiết
- `detail_url`
  - Cổng vào chính để frontend tiếp tục yêu cầu sau khi mở chi tiết
- `invocation`
  - Tóm tắt giao thức thực thi cấp danh sách
  - Nhiệm vụ mới nên hiển thị `input_protocol=stage_spec`
  - Phù hợp làm nhãn gỡ lỗi, không khuyến nghị thay thế phán đoán đầy đủ trong chi tiết
- `invocation_summary`
  - Thống kê tổng hợp giao thức trong kết quả phân trang hiện tại
  - Phù hợp để frontend làm các gợi ý nhẹ như "trang này đã chuyển sang giao thức mới chưa"

## 6. Cách đọc khuyến nghị cho frontend

Danh sách nhiệm vụ gần đây:

`GET /api/v1/jobs?limit=20&offset=0`

Chỉ xem nhiệm vụ thất bại:

`GET /api/v1/jobs?status=failed&limit=20&offset=0`

Chỉ xem nhiệm vụ con OCR:

`GET /api/v1/ocr/jobs?limit=20&offset=0`

Hiển thị khuyến nghị:

- Tiêu đề: `display_name`
- Trạng thái: `status`
- Giai đoạn hiện tại: `display_stage`
- Giai đoạn con hiện tại: `substage`
- Tiến độ hiện tại: `progress`
- Nhãn giao thức: `invocation.input_protocol`
- Thời gian cập nhật gần nhất: `updated_at`
- Nhấp để vào: `detail_url`

## 7. Đừng trông đợi giao diện danh sách trả về gì

Giao diện danh sách hiện tại không trả về trực tiếp:

- `runtime`
- `runtime.stage_history`
- `failure.summary`
- `artifacts`

Vì vậy nếu frontend muốn hiển thị:

- Tóm tắt thất bại
- Tổng thời gian
- Nút tải xuống
- Dòng thời gian quá trình

Thì nên sau khi nhấp vào mục danh sách, tiếp tục yêu cầu giao diện chi tiết, thay vì yêu cầu giao diện danh sách chứa tất cả thông tin.

## 8. Quan hệ giữa danh sách OCR và danh sách chính

`GET /api/v1/ocr/jobs` về bản chất chỉ là:

- Tái sử dụng cùng một bộ logic danh sách
- Thêm cố định `workflow=ocr`

Vì vậy:

- Cấu trúc trả về nhất quán
- Chỉ khác phạm vi dữ liệu

## 9. Tại sao thiết kế như vậy

Mục đích của việc này rất trực tiếp:

- Giao diện danh sách giữ nhẹ
- Giao diện chi tiết chứa trạng thái đầy đủ
- Trang chủ frontend nhanh trước, sau đó kéo dữ liệu đầy đủ trong trang chi tiết

Điều này ổn định hơn so với việc nhồi hết `runtime`, `failure`, `artifacts` vào danh sách ngay từ đầu, và cũng dễ bảo trì lâu dài hơn.
