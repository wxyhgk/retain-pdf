# Tài liệu LLM Provider

Nơi đây lưu trữ tài liệu liên quan đến tích hợp Provider dịch và LLM.  
Nó không phải là tài liệu giao thức luồng chính của RetainPDF, mà là thư mục tham khảo "nếu cần tích hợp dịch vụ model, nên xem gì trước".

## Phạm vi áp dụng

- Xem ở đây khi muốn tham khảo tích hợp dịch vụ model
- Để xem luồng dịch thuật của RetainPDF, vui lòng xem [Tài liệu Python](../../core/python/README.md) và [Tài liệu Rust API](../../core/rust_api/README.md)

## DeepSeek

Đề xuất đọc theo thứ tự:

1. [Đề xuất tích hợp RetainPDF](./DeepSeek/Retain_de-xuat-tich-hop.md)
2. [Gọi API lần đầu](./DeepSeek/goi-api-lan-dau.md)
3. [Mô hình và giá](./DeepSeek/mo-hinh-va-gia.md)
4. [Tính lượng token sử dụng](./DeepSeek/tinh-luong-token-su-dung.md)
5. [JSON output](./DeepSeek/JSON_output.md)
6. [Mã lỗi](./DeepSeek/ma-loi.md)

Tài liệu bổ sung:

- [Hội thoại nhiều lượt](./DeepSeek/hoi-thoai-nhieu-luot.md)
- [Chế độ suy luận](./DeepSeek/che-do-suy-luan.md)
- [Tool Calls](./DeepSeek/Tool%20Calls.md)
- [Tích hợp Coding Agents](./DeepSeek/tich-hop-coding-agents.md)
- [Tra cứu số dư](./DeepSeek/tra-cuu-so-du.md)

## Đầu vào triển khai trong dự án

- [Giải thích module Translation](../../backend/scripts/services/translation/README.md)
- [Nguồn duy nhất phụ thuộc Python](../python/dependency_source_of_truth.md)
