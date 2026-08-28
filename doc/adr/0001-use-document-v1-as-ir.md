# 0001 Sử dụng document.v1 làm biểu diễn trung gian từ OCR đến hạ lưu

## Bối cảnh

RetainPDF hỗ trợ PaddleOCR, MinerU và các nhà cung cấp OCR mới có thể thêm sau. Các trường JSON thô, cấu trúc tệp, nhãn ngữ nghĩa của các nhà cung cấp khác nhau đều khác nhau. Nếu dịch và kết xuất đọc trực tiếp tải trọng thô của nhà cung cấp, thì mỗi khi thêm một nhà cung cấp mới, các trường riêng tư sẽ lan truyền ra toàn bộ chuỗi.

## Quyết định

Sau khi giai đoạn OCR kết thúc, thống nhất tạo ra `ocr/normalized/document.v1.json`.

Chuỗi chính dịch và kết xuất chỉ tiêu thụ các trường ổn định của `document.v1`, không tiêu thụ trực tiếp JSON thô của nhà cung cấp.

Các tệp thô của nhà cung cấp chỉ được phép giữ lại ở lớp nhà cung cấp, bộ điều hợp, gỡ lỗi và truy vết.

## Hậu quả

- Nhà cung cấp OCR mới trước tiên phải viết bộ điều hợp, chuyển đổi tải trọng thô thành `document.v1`.
- Dịch và kết xuất không thể đọc các trường thô vì một nhà cung cấp cụ thể.
- Nếu khả năng biểu diễn của `document.v1` không đủ, cần nâng cấp schema, không để hạ lưu bỏ qua schema.

## Phương án thay thế

- Cho phép dịch và kết xuất tương thích trực tiếp với JSON thô của từng nhà cung cấp. Phương án này nhanh trong ngắn hạn, nhưng sẽ làm ô nhiễm vĩnh viễn chuỗi chính với các trường riêng tư của nhà cung cấp.
- Mỗi nhà cung cấp duy trì một đường ống hoàn chỉnh riêng. Phương án này dẫn đến việc triển khai trùng lặp các khả năng dịch, kết xuất và chẩn đoán.
