# rendering/layout/model

## Trách nhiệm

Mô hình dữ liệu và helper bảo vệ văn bản dùng trong giai đoạn dàn trang bản dịch, ví dụ `RenderBlock`, `RenderLayoutBlock`, `RenderPageSpec`.

## Lối vào công khai

- `models.py`
- `render_text.py`

## Không nên làm gì

- Không thao tác PDF.
- Không sinh Typst.
- Không thực hiện redaction.
