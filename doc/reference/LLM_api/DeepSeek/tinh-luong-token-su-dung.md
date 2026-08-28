Token là đơn vị cơ bản mà mô hình sử dụng để biểu diễn văn bản ngôn ngữ tự nhiên, cũng là đơn vị tính phí của chúng tôi, có thể hiểu trực quan là "chữ" hoặc "từ"; thông thường 1 từ tiếng Trung, 1 từ tiếng Anh, 1 số hoặc 1 ký hiệu được tính là 1 token.

Trong điều kiện thông thường, tỷ lệ quy đổi giữa token và số ký tự trong mô hình xấp xỉ như sau:

1 ký tự tiếng Anh ≈ 0.3 token.
1 ký tự tiếng Trung ≈ 0.6 token.
Tuy nhiên, vì cách phân đoạn từ của các mô hình khác nhau nên tỷ lệ quy đổi cũng có sự khác biệt. Số token thực tế xử lý trong mỗi lần gọi sẽ dựa trên kết quả trả về của mô hình, bạn có thể xem trong trường usage của kết quả trả về.