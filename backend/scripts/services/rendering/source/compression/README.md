# rendering/source/compression

## Trách nhiệm

Tầng nén PDF. Chịu trách nhiệm nén ảnh, nén Ghostscript và phân tích trước khi nén.

## Lối vào công khai

- `image_pipeline.py`
- `ghostscript.py`
- `analysis.py`

## Không nên làm gì

- Không thay đổi nội dung trang.
- Không thực hiện redaction.
- Không tham gia quyết định OCR/dịch/dàn trang.
