# Mô tả Orchestration

`scripts/services/translation/core/orchestration` chịu trách nhiệm bổ sung "metadata điều phối" cho OCR payload.

Nó không trực tiếp dịch, cũng không trực tiếp render, mà đưa các khối OCR thô về trạng thái trung gian phù hợp hơn cho dịch và dàn trang.

## Tệp chính

- `zones.py`
  Phân tích bố cục trang, nhận diện đơn/hai cột và vùng bố cục.
- `units.py`
  Sinh và sắp xếp các trường chuẩn như `translation_unit_id`, `skip_reason`.
Review continuation xuyên trang đã chuyển sang `services/continuation/orchestrator.py`. Tầng này chỉ giữ lại việc sắp xếp bố cục và metadata thuần túy.

## Vị trí trong luồng tổng thể

`ocr payload -> orchestration -> translation policy / continuation / translation unit -> dịch`
