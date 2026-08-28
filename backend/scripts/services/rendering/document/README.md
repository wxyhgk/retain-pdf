# rendering/document

## Trách nhiệm

Khả năng hỗ trợ cấp độ tài liệu PDF trong giai đoạn render, bao gồm chuẩn bị PDF nguồn, ánh xạ số trang và sao chép mục lục/bookmark.

## Lối vào công khai

- `source_pdf.py`
- `page_map.py`
- `metadata.py`

## Không nên làm gì

- Không thực hiện redaction trang.
- Không sinh Typst.
- Không phán đoán OCR/dịch.
