# rendering/source/dev_overlay

Đường dẫn vẽ trực tiếp bản dịch bằng PyMuPDF cũ, chỉ dùng cho direct overlay, PDF debug đơn trang và tương thích với lời gọi
`services.rendering.legacy.pdf_overlay` cũ.

Đây không phải đường dẫn render chính. Logic render sách/trang chính thức mới nên đi qua Typst overlay và
`source.redaction` / `source.render_source`, không tiếp tục mở rộng quy tắc dàn trang văn bản tại đây.

## Ranh giới

- Có thể gọi primitive/facade tầng source, ví dụ `source.redaction`, `source.items`,
  `source.background.fill`.
- Không phụ thuộc trực tiếp `source.cleanup.redaction`; khi cần dọn văn bản gốc thì đi qua facade tầng source.
- Không thêm logic sinh Typst, phân tích OCR provider hoặc chiến lược dịch.
