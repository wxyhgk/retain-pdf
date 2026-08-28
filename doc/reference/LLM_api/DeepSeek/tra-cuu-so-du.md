# Truy vấn số dư DeepSeek

API truy vấn số dư chính thức của DeepSeek dùng để kiểm tra tài khoản API hiện tại còn số dư có thể sử dụng hay không. Nếu RetainPDF muốn kiểm tra DeepSeek Key ở phía frontend hoặc backend, có thể sử dụng API này để bổ sung cho việc xử lý lỗi `402 Insufficient Balance`.

## API

```http
GET https://api.deepseek.com/user/balance
Authorization: Bearer <DEEPSEEK_API_KEY>
Accept: application/json
```

Lưu ý: API này không có `/v1`. Trong dự án, API chat mặc định có `base_url` là `https://api.deepseek.com/v1`, nhưng API số dư phải gọi `https://api.deepseek.com/user/balance`, không được ghép thành `https://api.deepseek.com/v1/user/balance`.

## Ví dụ curl

```bash
curl -L -X GET "https://api.deepseek.com/user/balance" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}"
```

## Phản hồi thành công

```json
{
  "is_available": true,
  "balance_infos": [
    {
      "currency": "CNY",
      "total_balance": "110.00",
      "granted_balance": "10.00",
      "topped_up_balance": "100.00"
    }
  ]
}
```

Mô tả trường:

| Trường | Loại | Mô tả |
| --- | --- | --- |
| `is_available` | `boolean` | Tài khoản hiện tại có số dư để gọi API không |
| `balance_infos` | `object[]` | Danh sách số dư theo từng loại tiền tệ |
| `balance_infos[].currency` | `string` | Loại tiền tệ, có thể là `CNY` hoặc `USD` |
| `balance_infos[].total_balance` | `string` | Tổng số dư khả dụng, bao gồm số dư được tặng và số dư nạp |
| `balance_infos[].granted_balance` | `string` | Số dư được tặng chưa hết hạn |
| `balance_infos[].topped_up_balance` | `string` | Số dư đã nạp |

## Đề xuất tích hợp cho RetainPDF

- Kiểm tra kết nối Token có thể gọi `/v1/models` trước để xác định Key có hợp lệ không, sau đó gọi `/user/balance` để kiểm tra số dư.
- Nếu `is_available=false` hoặc API trả về `402`, frontend nên hiển thị "DeepSeek không đủ số dư", không chỉ hiển thị "Key không hợp lệ".
- API số dư chỉ áp dụng cho DeepSeek chính thức; nếu người dùng cấu hình OpenRouter, SiliconeFlow hoặc các dịch vụ tương thích khác, không nên gọi API này.

Tham khảo: Tài liệu chính thức của DeepSeek `Get User Balance`.
