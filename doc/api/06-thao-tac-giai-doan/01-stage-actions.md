# stage-actions

## Giao diện

```http
GET /api/v1/jobs/{job_id}/stage-actions
```

Được sử dụng để truy vấn xem mỗi giai đoạn có thể thử lại chủ động hay không, và thử lại sẽ tái sử dụng và chạy lại những sản phẩm nào.

## Ví dụ phản hồi

```json
{
  "job_id": "xxx",
  "stages": [
    {
      "stage": "translation",
      "label": "Thử lại dịch",
      "can_retry": true,
      "disabled_reason": "",
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/xxx/retry-stage",
        "body": {
          "stage": "translation"
        }
      }
    }
  ]
}
```

## Nguyên tắc Frontend

- Dựa vào `can_retry` trả về từ backend để quyết định nút có thể nhấn hay không.
- Đừng để frontend tự đoán sản phẩm nào có thể tái sử dụng.
- `will_reuse` và `will_rerun` chỉ dùng để hiển thị và xác nhận.
- Thực thi thực tế dựa vào `action` và [retry-stage](02-retry-stage.md).
