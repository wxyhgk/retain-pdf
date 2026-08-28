# Hợp đồng cơ bản

Bài viết này chỉ đề cập đến cách đọc cơ bản nhất.

## Đóng gói phản hồi

Tất cả các giao diện nghiệp vụ đều thống nhất là:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Thứ tự đọc:

1. Xem HTTP có `2xx` không
2. Xem `code`
3. `code === 0` mới đọc `data`

Không đọc trực tiếp các trường `items`, `stage` hay `failure` ở cấp cao nhất.

## Giao diện danh sách

Giao diện chính của trang danh sách:

- `GET /api/v1/jobs`
- `GET /api/v1/ocr/jobs`

Các trường thường dùng:

- `job_id`
- `display_name`
- `workflow`
- `status`
- `stage`
- `created_at`
- `updated_at`
- `detail_url`
- `invocation`

Khuyến nghị chỉ coi đây là "cổng vào nhiệm vụ gần đây", không nhồi nhét logic trang chi tiết vào danh sách.

## Xác thực Provider

Xác thực Token MinerU:

- `POST /api/v1/providers/mineru/validate-token`

Mục đích:

- Xác thực token có khả dụng trước khi gửi OCR
- Phát hiện sớm hết hạn, không hợp lệ hoặc sự cố mạng

Trạng thái trả về khuyến nghị:

- `valid`
- `unauthorized`
- `expired`
- `network_error`
- `provider_error`

## Cách đọc cơ bản

- Xem `status` để biết trạng thái nhiệm vụ
- Xem `stage` để biết giai đoạn hiện tại
- Xem `actions` để biết có thể nhấn nút không
- Xem `artifacts` / `artifacts-manifest` để biết có thể tải xuống không
- Xem `status === succeeded` để xác định nhiệm vụ thực sự hoàn thành
