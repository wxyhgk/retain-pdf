# Đề xuất tích hợp Retain

Dựa trên tài liệu hiện tại trong thư mục `doc/reference/LLM_api/DeepSeek` và thông số mô hình mới nhất từ phía DeepSeek, các khả năng mà dự án hiện tại có thể tận dụng trực tiếp nhất như sau.

## 1. Mô hình mặc định

- Mô hình mặc định nên chuyển sang `deepseek-v4-flash`
- `deepseek-chat` / `deepseek-reasoner` hiện vẫn tương thích, nhưng tài liệu chính thức đã đánh dấu sẽ bị loại bỏ trong tương lai, không nên dùng làm giá trị mặc định mới

## 2. Các khả năng hữu ích nhất cho dự án hiện tại

- `JSON Output`
  Phù hợp với các tình huống phân loại dịch, chẩn đoán lỗi, trả về có cấu trúc của chúng ta
- `1M context`
  Có lợi cho tài liệu dài, ngữ cảnh dài và bảng thuật ngữ
- `Context Cache / KV Cache`
  Giá trị tối ưu chi phí cao cho các prompt system lặp lại, quy tắc dài, bảng thuật ngữ dài trong dịch hàng loạt
- `Tool Calls`
  Hiện không bắt buộc trong luồng chính, nhưng có giá trị tiềm năng cho chẩn đoán lỗi, lựa chọn quy tắc, tra cứu thuật ngữ bên ngoài
- `Mã lỗi`
  401 / 402 / 422 / 429 / 500 / 503 đáng để ánh xạ vào phân loại lỗi và chiến lược thử lại hiện có của chúng ta

## 3. Những việc nên ưu tiên làm cho backend

- Thống nhất mô hình mặc định là `deepseek-v4-flash`
- Giữ khả năng trả về có cấu trúc `response_format={\"type\":\"json_object\"}`
- Tiếp tục tăng cường thử lại và backoff trên DeepSeek 429 / 503
- Đánh giá việc đưa system prompt dài, văn bản quy tắc, bảng thuật ngữ vào context cache
- Không viết `deepseek-chat` vào các ví dụ mới, giá trị mặc định và công cụ gỡ lỗi

## 4. Tài liệu liên quan

- [Mô hình & Giá](./mo-hinh-va-gia.md)
- [JSON Output](./JSON_output.md)
- [Tool Calls](./Tool%20Calls.md)
- [Mã lỗi](./ma-loi.md)
- [Tính lượng token sử dụng](./tinh-luong-token-su-dung.md)
