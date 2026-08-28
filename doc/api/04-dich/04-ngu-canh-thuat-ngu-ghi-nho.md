# Chế độ ngữ cảnh, thuật ngữ và bộ nhớ

Ba trường này kiểm soát phạm vi tiêm prompt, không nên tắt cơ chế đảm bảo chất lượng cuối cùng.

## context_mode

Các giá trị có thể chọn:

- `needed`: Mặc định. Chỉ tiêm ngữ cảnh trước/sau cho các mục cần ngữ cảnh như đoạn không hoàn chỉnh, đoạn tiếp nối, chú thích hình ảnh, v.v.
- `all`: Quay lại hành vi ngữ cảnh lân cận đầy đủ nặng hơn.
- `off`: Không tiêm ngữ cảnh.

## glossary_mode

Các giá trị có thể chọn:

- `matched`: Mặc định. Chỉ tiêm các thuật ngữ khớp với mục hoặc lô hiện tại.
- `all`: Tiêm toàn bộ bảng thuật ngữ.
- `off`: Không tiêm bảng thuật ngữ.

## memory_mode

Các giá trị có thể chọn:

- `matched`: Mặc định. Chỉ tiêm bộ nhớ tài liệu khớp với mục hoặc lô hiện tại.
- `broad`: Tiêm tóm tắt cấp tài liệu rộng hơn.
- `off`: Tắt tiêm bộ nhớ.

## Đảm bảo chất lượng

Các tùy chọn này chỉ ảnh hưởng đến ngân sách prompt. Các mục có `should_translate=true` không được trở thành bản dịch trống do các tùy chọn này. Bản dịch trống, sót tiếng Anh nghiêm trọng, lỗi placeholder vẫn phải được đưa vào luồng sửa chữa.
