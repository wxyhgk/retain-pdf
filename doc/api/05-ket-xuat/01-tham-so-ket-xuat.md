# Tham số kết xuất

Tham số kết xuất nằm trong đối tượng `render` của yêu cầu tạo tác vụ.

## Các trường thường dùng

```json
{
  "render": {
    "render_mode": "auto",
    "compile_workers": 0,
    "typst_font_family": "Source Han Serif SC",
    "pdf_compress_dpi": 0,
    "translated_pdf_name": "book-translated.pdf",
    "body_font_size_factor": 0.95,
    "body_leading_factor": 1.08,
    "font_unify_mode": "role_min",
    "source_cleanup_strategy": "pikepdf_text_strip"
  }
}
```

Giải thích các trường:

- `render_mode`: Chế độ kết xuất.
- `compile_workers`: Số lượng biên dịch Typst đồng thời, `0` có nghĩa sử dụng chiến lược mặc định.
- `typst_font_family`: Phông chữ Typst sử dụng.
- `pdf_compress_dpi`: DPI nén hình ảnh PDF, `0` có nghĩa không nén thêm.
- `translated_pdf_name`: Tên tệp PDF đầu ra.
- `body_font_size_factor`: Tỷ lệ toàn cục của cỡ chữ chính.
- `body_leading_factor`: Tỷ lệ toàn cục của khoảng cách dòng chính.
- `font_unify_mode`: Chiến lược thống nhất phông chữ, thường dùng `role_min` hoặc `off`.
- `source_cleanup_strategy`: Chiến lược xử lý văn bản gốc.

Xem đặc tả đầy đủ tại `backend/rust_api/RENDER_OPTIONS_CONTRACT.md`.
