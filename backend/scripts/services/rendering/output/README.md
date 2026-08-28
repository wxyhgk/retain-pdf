# rendering/output

## Trách nhiệm

Tầng sinh đầu ra cuối cùng. Chứa ghi đầu ra ngoài Typst, tổng hợp overlay và khả năng hỗ trợ ghi PDF.

## Lối vào công khai

- `pdf_writer.py`
- `typst/` sẽ dần chuyển vào đây.

## Không nên làm gì

- Không phán đoán OCR/dịch.
- Không làm chiến lược redaction trang.
- Không thích ứng font bbox.
