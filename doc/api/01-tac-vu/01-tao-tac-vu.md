# Tạo Job

## Endpoint

```http
POST /api/v1/jobs
```

Được sử dụng để tạo các job `book`, `translate` hoặc `render`.

## Quy trình

- `book`: OCR -> Chuẩn hóa -> Dịch -> Kết xuất.
- `translate`: OCR -> Chuẩn hóa -> Dịch, không kết xuất PDF.
- `render`: tái sử dụng các sản phẩm hiện có và chỉ kết xuất lại.

Các job chỉ OCR sử dụng endpoint riêng; xem [Job chỉ OCR](../03-OCR/02-ocr-only.md).

## Ví dụ yêu cầu JSON

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "upload-xxx"
  },
  "ocr": {
    "provider": "paddle",
    "paddle_token": "secret",
    "options": {
      "paddle_model": "PaddleOCR-VL-1.6"
    }
  },
  "translation": {
    "api_key": "secret",
    "base_url": "https://api.deepseek.com/v1",
    "model": "deepseek-v4-flash",
    "workers": 100,
    "batch_size": 1
  },
  "render": {
    "render_mode": "auto",
    "source_cleanup_strategy": "pikepdf_text_strip"
  }
}
```

## Các trường chính

- `source.upload_id`: được trả về bởi endpoint tải lên.
- `source.source_url`: URL PDF từ xa, tùy thuộc vào việc nhà cung cấp có hỗ trợ nhập URL hay không.
- `ocr.provider`: `mineru`, `paddle`, `local`, hoặc nhà cung cấp lệnh đã cấu hình.
- `ocr.options`: các tham số cụ thể cho nhà cung cấp; ưu tiên cấu hình không chứa thông tin bí mật ở đây.
- `translation`: mô hình dịch, đồng thời, bảng thuật ngữ và cài đặt ngữ cảnh.
- `render`: các tham số kết xuất.

## Phản hồi

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260616120000-abcdef",
    "status": "queued"
  }
}
```

Sau khi nhận được `job_id`, frontend nên bắt đầu polling:

- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/events`
