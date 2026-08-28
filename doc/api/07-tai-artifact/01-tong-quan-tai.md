# Tổng quan tải xuống

## Giao diện sản phẩm

```http
GET /api/v1/jobs/{job_id}/artifacts
GET /api/v1/jobs/{job_id}/artifacts-manifest
GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}
```

Frontend nên ưu tiên sử dụng key và URL được hiển thị trong artifact manifest, không trực tiếp ghép đường dẫn tệp.

## PDF

```http
GET /api/v1/jobs/{job_id}/pdf
GET /api/v1/jobs/{job_id}/pdf/side-by-side
```

- `/pdf`: PDF sau dịch.
- `/pdf/side-by-side`: PDF tổng hợp đối chiếu trái-phải giữa văn bản gốc và bản dịch.

## Hình ảnh và xem trước

```http
GET /api/v1/jobs/{job_id}/cover
GET /api/v1/jobs/{job_id}/thumbnail
GET /api/v1/jobs/{job_id}/preview/pages/{page}
```

## Markdown

```http
GET /api/v1/jobs/{job_id}/markdown
GET /api/v1/jobs/{job_id}/markdown?raw=true
GET /api/v1/jobs/{job_id}/markdown/document
GET /api/v1/jobs/{job_id}/markdown/images/{path}
```

- `/markdown`: Mặc định có thể trả về chế độ xem tài liệu với URL hình ảnh hoặc phản hồi tải xuống.
- `?raw=true`: Trả về luồng tệp Markdown gốc.
- `/markdown/document`: Trả về cấu trúc JSON, phù hợp cho hiển thị frontend và hỏi đáp AI.
- `/markdown/images/{path}`: Lấy hình ảnh được tham chiếu trong Markdown.

## Gói

```http
GET /api/v1/jobs/{job_id}/download
```

Dùng để tải gói sản phẩm liên quan đến tác vụ.
