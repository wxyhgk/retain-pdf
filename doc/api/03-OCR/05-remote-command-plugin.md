# Plugin `remote_command`

`remote_command` được sử dụng để tích hợp dịch vụ OCR từ xa mới mà không cần nhúng máy trạng thái submit / poll / download của bên thứ ba vào luồng chính Rust.

## Nguyên tắc thiết kế

- Backend chỉ chịu trách nhiệm khởi động lệnh plugin và truyền nguồn, tùy chọn, thông tin xác thực và đường dẫn sản phẩm.
- Lệnh plugin chịu trách nhiệm gửi API từ xa, polling, tải xuống và thử lại.
- Luồng công việc chính chỉ tiêu thụ PDF nguồn và `document.v1.json`.

## Ví dụ cấu hình

```json
{
  "providers": {
    "my_remote_ocr": {
      "display_name": "My Remote OCR",
      "kind": "remote_command",
      "credential": {
        "field": "credential",
        "env": "RETAIN_MY_REMOTE_OCR_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "command": {
          "type": "string",
          "default": "python /path/to/my_remote_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

## Thông tin xác thực

Thông tin xác thực cho các nhà cung cấp lệnh dựa trên cấu hình có thể đến từ:

- `ocr.options.credential`
- `ocr.options.token`
- `ocr.options.api_key`
- `credential.env` trong cấu hình nhà cung cấp

Worker sẽ ghi khóa đã phân tích vào:

```text
RETAIN_OCR_CREDENTIAL
```

Nếu `credential.env` được cấu hình, plugin cũng có thể đọc các biến môi trường của riêng nó.

## Hợp đồng đầu vào URL

Khi job sử dụng `source.file_url`:

- `RETAIN_OCR_SOURCE_URL` sẽ chứa URL gốc.
- `RETAIN_OCR_SOURCE_PDF` có thể trống.
- Plugin phải ghi PDF nguồn cuối cùng vào `RETAIN_OCR_SOURCE_DIR`.

Nếu plugin không lưu PDF nguồn, job sẽ thất bại vì các giai đoạn dịch và kết xuất sau đó phải sử dụng sản phẩm nguồn cục bộ.
