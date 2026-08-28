# rendering/analysis

## Trách nhiệm

Tầng phân tích trang và tài liệu. Trả lời "trang này có tình trạng gì" và "trang này nên đi tuyến render nào".

## Lối vào công khai

- `classifier.py`
- `profile/`
- `route/`

## Không nên làm gì

- Không thao tác nội dung PDF.
- Không sinh Typst.
- Không thực hiện redaction.
- Không dàn trang bbox bản dịch.
