# Tham số dịch thuật

Các tham số dịch thuật nằm trong đối tượng `translation` của yêu cầu tạo job.

## Các trường phổ biến

```json
{
  "translation": {
    "api_key": "secret",
    "base_url": "https://api.deepseek.com/v1",
    "model": "deepseek-v4-flash",
    "workers": 100,
    "batch_size": 1,
    "mode": "sci",
    "math_mode": "direct_typst",
    "context_mode": "needed",
    "glossary_mode": "matched",
    "memory_mode": "matched"
  }
}
```

Mô tả các trường:

- `api_key`: Khóa API LLM hạ nguồn; không được phản hồi trong các phản hồi.
- `base_url`: URL cơ sở tương thích OpenAI của mô hình hạ nguồn.
- `model`: Tên mô hình.
- `workers`: Độ đồng thời dịch thuật.
- `batch_size`: Số lượng mục dịch thuật mỗi yêu cầu.
- `mode`: Chế độ dịch thuật.
- `math_mode`: Chế độ xử lý công thức, hiện mặc định là `direct_typst`.
- `context_mode`: Chiến lược tiêm ngữ cảnh.
- `glossary_mode`: Chiến lược tiêm bảng thuật ngữ.
- `memory_mode`: Chiến lược tiêm bộ nhớ dịch thuật.

## Nguyên tắc Frontend

- Giao diện người dùng tiêu chuẩn chỉ hiển thị các tùy chọn cốt lõi như mô hình, độ đồng thời và bảng thuật ngữ.
- `context_mode`, `glossary_mode` và `memory_mode` phù hợp hơn như các tùy chọn nâng cao.
- Không lưu `api_key` trong nhật ký hoặc sự kiện hiển thị.
