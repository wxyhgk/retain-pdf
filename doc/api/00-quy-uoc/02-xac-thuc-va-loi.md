# Xác thực và Lỗi

## Xác thực

Ngoại trừ `GET /health`, các giao diện yêu cầu tiêu đề yêu cầu sau:

```http
X-API-Key: your-api-key
```

Các lỗi xác thực thường trả về `401` hoặc `403`.

## Trường thông tin xác thực

Yêu cầu job có thể bao gồm thông tin xác thực cho các nhà cung cấp hạ nguồn, ví dụ:

- `ocr.mineru_token`
- `ocr.paddle_token`
- `translation.api_key`
- `ocr.options.credential` cho các nhà cung cấp lệnh

Phản hồi từ backend không trả về các giá trị plaintext này. Frontend chỉ nên suy ra cấu hình từ các trường boolean như `*_configured`.

## Nguyên tắc xử lý lỗi

- Trạng thái HTTP đại diện cho các lỗi ở cấp độ yêu cầu như lỗi xác thực, tham số không hợp lệ hoặc tài nguyên không tồn tại.
- Job với `status=failed` có nghĩa là tác vụ chạy thất bại.
- Đọc lý do thất bại của tác vụ từ `failure` hoặc chẩn đoán trước; không suy ra từ `stage_detail`.

Các trạng thái phổ biến:

- `400`: tham số yêu cầu không hợp lệ.
- `401`: thiếu hoặc API key không hợp lệ.
- `404`: job hoặc sản phẩm không tồn tại.
- `409`: trạng thái hiện tại không cho phép thực hiện thao tác.
- `500`: lỗi nội bộ backend.
