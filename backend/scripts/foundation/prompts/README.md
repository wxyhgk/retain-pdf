# Tệp prompt

Thư mục này lưu trữ văn bản prompt có thể chỉnh sửa mà luồng chính sử dụng.

- `translation_system.txt`
  System prompt dùng cho yêu cầu dịch.
- `translation_task.txt`
  Mô tả nhiệm vụ ghép vào user payload dịch.
- `classification_system.txt`
  System prompt dùng cho phân loại toàn trang ở chế độ `precise`.

Nếu muốn điều chỉnh hành vi mô hình, ưu tiên sửa ở đây, không hardcode prompt trực tiếp vào Python.
