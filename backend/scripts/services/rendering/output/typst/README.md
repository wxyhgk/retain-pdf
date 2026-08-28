# rendering/output/typst

## Trách nhiệm

Tầng cài đặt đầu ra Typst. Chịu trách nhiệm sinh mã nguồn Typst, gọi biên dịch Typst, xử lý logic hỗ trợ Typst/PDF cần thiết cho tổng hợp overlay.

## Lối vào công khai

- `book_renderer.py`
- `book_support.py`
- `compiler.py`
- `source_builder.py`
- `overlay_ops.py`
- `source_page_overlay.py`

## Không nên làm gì

- Không thực hiện OCR hoặc dịch.
- Không làm chiến lược dọn PDF gốc.
- Không tính toán thích ứng font bbox bản dịch.
