# 0002 Sử dụng Typst làm công cụ kết xuất lớp phủ văn bản dịch

## Bối cảnh

RetainPDF cần chồng văn bản dịch lên PDF gốc, đồng thời cố gắng giữ lại công thức, hình ảnh, bảng biểu và cấu trúc trực quan của trang. Khả năng viết chữ của PyMuPDF thuần túy có hạn, không đủ sức biểu đạt cho markdown phức tạp, công thức và tự động điều chỉnh.

## Quyết định

Đường dẫn kết xuất chính sử dụng Typst để tạo lớp phủ, sau đó tổng hợp với nền PDF đã được làm sạch.

PyMuPDF tiếp tục đảm nhiệm:

- Đọc và lưu PDF.
- Sao chép dấu trang.
- Redaction trang / làm sạch nền.
- Hợp nhất và nén PDF cuối cùng.

Typst đảm nhiệm:

- Sắp chữ văn bản dịch.
- Kết xuất markdown / công thức.
- Biên dịch trang lớp phủ.

## Hậu quả

- Lớp kết xuất phải duy trì luồng rõ ràng `layout -> RenderBlock -> mã nguồn Typst -> PDF lớp phủ`.
- Lớp Typst không nên trực tiếp hiểu nhà cung cấp OCR hoặc chiến lược dịch.
- Các lỗi redaction và layout sẽ phản ánh vào kết quả trực quan của lớp phủ Typst, nhưng trách nhiệm không được trộn lẫn.

## Phương án thay thế

- Chỉ dùng PyMuPDF viết chữ trực tiếp. Triển khai đơn giản, nhưng không đủ khả năng cho công thức phức tạp, markdown và fit.
- Chuyển toàn bộ trang PDF sang hình ảnh rồi chồng chữ. Ổn định về mặt hình ảnh, nhưng tệp đầu ra sẽ lớn hơn đáng kể và mất cấu trúc PDF như văn bản có thể sao chép và dấu trang.
