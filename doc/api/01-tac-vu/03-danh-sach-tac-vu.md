# Danh sách Job

## Endpoint

```http
GET /api/v1/jobs
```

Được sử dụng để hiển thị các job gần đây, điểm truy cập thư viện và danh sách thẻ job.

## Tham số truy vấn

Khả năng lọc và phân trang được định nghĩa bởi phản hồi API trong triển khai hiện tại. Frontend nên tránh dựa vào bộ nhớ cache cục bộ như nguồn sự thật.

## Các trường phản hồi chính

Mục danh sách nên bao gồm:

- `job_id`
- `status`
- `display_stage`
- `stage`
- `substage`
- `lane`
- `progress`
- `display_name`
- `page_count`
- `source_file_name`
- `cover_url`
- `thumbnail_url`
- `output_pdf_ready`
- `markdown_ready`
- `bundle_ready`

## Nguyên tắc Frontend

- Thẻ danh sách có thể sử dụng các ảnh chụp được trả về bởi endpoint danh sách; không cần phải lấy ngay chi tiết từng job.
- Sử dụng `cover_url` / `thumbnail_url` cho hình ảnh; nếu trống, để frontend hiển thị placeholder.
- Không quét hệ thống tệp cục bộ hoặc xây dựng thư mục job bằng cách nối chuỗi.
