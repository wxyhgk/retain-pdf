# Danh sách OCR Provider

## Giao diện

```http
GET /api/v1/providers/ocr
```

Được sử dụng để khám phá các OCR provider hiện được backend hỗ trợ, cùng với các trường thông tin xác thực, tùy chọn cấu hình, khả năng và bố cục sản phẩm.

## Ví dụ phản hồi

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "key": "paddle",
      "display_name": "PaddleOCR",
      "provider_kind": "remote",
      "credential": {
        "field": "paddle_token",
        "env": "RETAIN_PADDLE_API_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "paddle_model": {
          "type": "string",
          "default": "PaddleOCR-VL-1.6",
          "aliases": {
            "paddleocr-vl": "PaddleOCR-VL-1.6"
          }
        }
      },
      "capabilities": {
        "supports_remote_url_submit": true,
        "supports_local_file_upload": true,
        "supports_polling": true,
        "supports_download_bundle": true,
        "supports_extra_formats": false,
        "supports_formula_toggle": false,
        "supports_table_toggle": false
      },
      "artifact_layout": {
        "provider_result_json": "paddle_result.json",
        "provider_bundle_zip": "paddle_bundle.zip",
        "provider_raw_dir": "paddle_raw",
        "layout_json": "paddle_result.json"
      }
    }
  ]
}
```

## provider_kind

- `remote`: nhà cung cấp từ xa được xây dựng trong backend, như MinerU hoặc Paddle.
- `local_command`: nhà cung cấp lệnh cục bộ đã cấu hình.
- `remote_command`: nhà cung cấp lệnh từ xa đã cấu hình.

## Nguyên tắc Frontend

- Không mã hóa cứng bảng tham số provider.
- Tạo các trường biểu mẫu từ `credential` và `options`.
- Không hiển thị đầu vào thông tin xác thực khi `credential` là `null`.
- Ghi các tham số không bí mật cụ thể cho provider vào `ocr.options`.
