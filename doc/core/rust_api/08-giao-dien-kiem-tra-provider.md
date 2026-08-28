# Giao diện kiểm tra Provider

## 1. Kiểm tra Token MinerU

Giao diện:

`POST /api/v1/providers/mineru/validate-token`

Mục đích:

- Frontend kiểm tra `mineru_token` có khả dụng trước khi người dùng lưu hoặc gửi cấu hình OCR
- Tránh để đến khi thực sự tạo nhiệm vụ OCR mới phát hiện Token không hợp lệ hoặc đã hết hạn

## 2. Nội dung yêu cầu

```json
{
  "mineru_token": "mineru-xxxx",
  "base_url": "https://mineru.net",
  "model_version": "vlm"
}
```

Giải thích trường:

- `mineru_token`
  - Bắt buộc, Token MinerU cần kiểm tra
- `base_url`
  - Tùy chọn, mặc định `https://mineru.net`
- `model_version`
  - Tùy chọn, mặc định `vlm`

## 3. Cấu trúc trả về

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ok": false,
    "status": "expired",
    "summary": "Token MinerU đã hết hạn",
    "retryable": false,
    "provider_code": "A0211",
    "provider_message": "token expired",
    "operator_hint": "Thay Token mới",
    "trace_id": "trace-1",
    "base_url": "https://mineru.net",
    "checked_at": "2026-04-06T08:30:00Z"
  }
}
```

## 4. Giá trị cố định của `status`

- `valid`
  - Token khả dụng
- `unauthorized`
  - Token không hợp lệ
- `expired`
  - Token đã hết hạn
- `network_error`
  - Phát hiện kết nối từ máy hiện tại đến MinerU thất bại
- `provider_error`
  - MinerU trả về lỗi khác, không thuộc các loại trên

## 5. Frontend sử dụng như thế nào

Quy trình khuyến nghị:

1. Người dùng nhập hoặc cập nhật Token MinerU
2. Frontend gọi giao diện này
3. Dựa theo `data.status` đưa ra gợi ý tức thời
4. Chỉ khi `status=valid` mới tiếp tục gửi OCR hoặc nhiệm vụ dịch

Hiển thị khuyến nghị:

- Thành công: `summary`
- Thất bại: `summary + operator_hint`
- Chế độ gỡ lỗi: bổ sung `provider_code / provider_message / trace_id`

## 6. Quy ước triển khai

- Giao diện này sẽ gọi yêu cầu phát hiện nhẹ của MinerU để kiểm tra Authorization
- Không thực sự tạo nhiệm vụ OCR
- Không tải lên PDF
- Mục tiêu của nó chỉ là phát hiện sớm:
  - token không hợp lệ
  - token hết hạn
  - mạng hiện tại không kết nối được MinerU

## 7. Quan hệ với chẩn đoán thất bại trong thời gian chạy

Giao diện này là "kiểm tra trước".

Nếu trong thời gian chạy vẫn xảy ra sự cố xác thực MinerU, chẩn đoán thất bại nhiệm vụ backend vẫn tiếp tục nhận diện:

- `A0202` -> Token không hợp lệ
- `A0211` -> Token hết hạn

Vì vậy hai lớp là quan hệ bổ sung:

- Trước khi gửi: dùng giao diện này chặn trước
- Trong khi chạy: dựa vào chẩn đoán thất bại để quy nguyên nhân dự phòng
