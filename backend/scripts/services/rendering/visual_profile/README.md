# Hồ sơ thị giác render

`visual_profile` là tầng lấy mẫu thị giác chung trước khi render, trách nhiệm lấy màu nền và màu chữ tiền cảnh của mỗi OCR item từ pixel trang.

Nó không phán đoán PDF có chỉnh sửa được hay không, cũng không quyết định xóa vật lý văn bản gốc. Chiến lược render sau đó chỉ tiêu thụ hợp đồng ổn định mà nó xuất ra:

- `background_rgb`: Màu nền cục bộ nên dùng khi che phủ văn bản gốc.
- `text_rgb`: Màu chữ nên dùng khi Typst vẽ lại bản dịch.
- `confidence`: Độ tin cậy của phán đoán màu hiện tại.
- `method`: Nguồn lấy mẫu, ví dụ `background_pixels+span_color` hoặc `background_pixels+foreground_pixels`.
- `warnings`: Thông tin chẩn đoán như không nhận diện được tiền cảnh.

Ranh giới thiết kế:

- Tầng thị giác luôn chạy được, áp dụng cho PDF chỉnh sửa được, PDF giả chỉnh sửa, PDF dạng ảnh.
- Tầng xóa chỉ là tối ưu hóa, khi thất bại thì lớp phủ thị giác vẫn đảm bảo hiệu quả cuối cùng.
- Gói này chỉ sinh hồ sơ, không sửa PDF, không viết chiến lược render.

Giai đoạn prewarm sẽ lưu hồ sơ đầy đủ vào `render_prewarm/visual_profile.v1.json`. Manifest prewarm chính chỉ lưu đường dẫn tương đối và `colors_by_item_id` nhẹ, nhờ đó lấy màu, xóa, render Typst có thể đọc cùng một JSON cục bộ ở các thời điểm khác nhau thay vì phụ thuộc đối tượng tạm trong bộ nhớ.
