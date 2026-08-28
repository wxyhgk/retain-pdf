# Tổng quan dịch vụ

## Cổng và đầu vào

- `40001`: Trang frontend phân phối Docker.
- `41000`: API Rust đầy đủ, bao gồm các giao diện tải lên, tác vụ, artifact, xác thực Provider, v.v.
- `42000`: API gửi multipart không đồng bộ, cung cấp chủ yếu `POST /api/v1/translate/bundle`.
- `GET /health`: Kiểm tra sức khỏe, không yêu cầu `X-API-Key`.
- `/api/v1`: Tiền tố API nghiệp vụ, yêu cầu `X-API-Key`.

Docker Web mặc định `FRONT_API_BASE=` để trống, frontend đi qua proxy `/api/` cùng nguồn gốc đến backend; khi phát triển cục bộ, frontend dự phòng về `41000` của host hiện tại.

## Luồng chính

Luồng chính không đồng bộ hiện tại:

1. `POST /api/v1/uploads` tải lên PDF.
2. `POST /api/v1/jobs` tạo tác vụ chính.
3. Tác vụ chính tạo tác vụ con OCR `{job_id}-ocr`.
4. Sau khi OCR hoàn tất, tạo `document.v1` chuẩn hóa.
5. Tiến hành dịch thuật và kết xuất.
6. Tải artifact thông qua chi tiết tác vụ, actions, artifacts hoặc manifest.

JSON tác vụ chính thức chỉ sử dụng cấu trúc nhóm:

- `workflow`
- `source`
- `ocr`
- `translation`
- `render`
- `runtime`

`workflow` hiện hỗ trợ:

- `book`: OCR -> Chuẩn hóa -> Dịch -> Kết xuất.
- `translate`: OCR -> Chuẩn hóa -> Dịch, không kết xuất.
- `render`: Chạy lại kết xuất dựa trên artifact của tác vụ hiện có.

OCR-only sử dụng đầu vào riêng `POST /api/v1/ocr/jobs`, hỗ trợ tải lên tệp multipart, cũng như tái sử dụng source / artifact hiện có theo trường body yêu cầu.

## Đối tượng bao bọc trả về

Phản hồi thành công:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Phản hồi lỗi:

```json
{
  "code": 40000,
  "message": "bad request"
}
```

Mã lỗi nghiệp vụ thường gặp:

- `40000`: Lỗi yêu cầu.
- `40100`: Xác thực thất bại.
- `40400`: Tài nguyên không tồn tại.
- `40900`: Xung đột trạng thái.
- `50000`: Lỗi nội bộ dịch vụ.

Frontend tự động giải bao bọc `{code, message, data}`; tài liệu giao diện mới nên tiếp tục giữ định dạng bao bọc này.

## Trọng tâm phụ thuộc frontend

Trang chi tiết tác vụ không chỉ phụ thuộc vào `status`, mà còn đọc:

- `stage` / `stage_detail` / `progress`
- `runtime.current_stage` / `runtime.stage_history`
- `actions.download_pdf` / `actions.open_markdown` / `actions.open_markdown_raw` / `actions.download_bundle` / `actions.cancel`
- `artifacts.pdf` / `artifacts.markdown` / `artifacts.bundle`
- `failure` / `failure_diagnostic` / `log_tail`

Trạng thái tải xuống và nút nên dựa vào `actions.*.enabled`, `artifacts.*.ready`, `artifacts-manifest.items[].ready`.

## Provider

Docker mặc định frontend OCR provider là `paddle`, nhưng backend đồng thời hỗ trợ:

- `mineru`
- `paddle`
- Xác thực thông tin xác thực `deepseek`

Đừng viết cố định một Provider nào là luồng chính duy nhất trong tài liệu API.
