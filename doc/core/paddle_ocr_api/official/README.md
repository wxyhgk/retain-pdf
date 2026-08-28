# Lưu trữ tài liệu chính thức PaddleOCR

Nơi đây chứa các đầu vào tài liệu chính thức PaddleOCR liên quan nhất đến việc tích hợp kho lưu trữ hiện tại, thống nhất đi vào từ `doc/`, không còn phân tán trong thư mục mã nguồn.

## Nguồn chính thức

- Tài liệu sử dụng chính thức PaddleOCR-VL:
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- Tài liệu trực tuyến chính thức PaddleOCR-VL:
  <https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html>

## Trọng tâm của kho lưu trữ hiện tại

Đối với dự án này, quan trọng nhất không phải là toàn bộ hướng dẫn triển khai, mà là những sự thật chính thức sau:

1. `layoutParsingResults[*].markdown.text` là văn bản Markdown chính thức trả về.
2. `layoutParsingResults[*].markdown.images` là ánh xạ hình ảnh được tham chiếu trong Markdown.
3. PDF nhiều trang có thể tái cấu trúc xuyên trang qua `restructurePages`.
4. `showFormulaNumber`, `prettifyMarkdown` ảnh hưởng trực tiếp đến hình thức đầu ra Markdown.

## Bản tổng hợp của kho lưu trữ này

- Trích đoán giao diện dịch vụ hóa và gọi không đồng bộ:
  [async_parse_official_excerpt.md](./async_parse_official_excerpt.md)

## Quy ước sử dụng

1. Nơi đây lưu trữ đầu vào và trích đoạn tổng hợp tài liệu chính thức trong kho lưu trữ.
2. Việc kết nối triển khai tuân theo ngữ nghĩa trường chính thức, không tuân theo logic tương thích lịch sử.
3. Nếu tài liệu chính thức cập nhật, sửa ở đây trước, sau đó sửa mã provider và tài liệu thích ứng nội bộ.
