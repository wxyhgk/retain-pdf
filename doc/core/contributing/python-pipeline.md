# Hướng dẫn đóng góp pipeline Python

## Hướng phân tầng

Phân tầng tổng thể:

```text
entrypoints -> runtime/pipeline -> services/* -> foundation
```

Quy tắc cơ bản:

- Raw payload của OCR provider trước tiên phải vào `document_schema`, tạo `document.v1`.
- Luồng chính dịch thuật chỉ tiêu thụ `document.v1` và stage spec dịch.
- Luồng chính kết xuất chỉ tiêu thụ PDF nguồn, translation manifest, payload dịch từng trang và render stage spec.
- `runtime/pipeline` chỉ chịu trách nhiệm điều phối, không hấp thụ chi tiết provider, LLM, Typst, redaction.
- `translation` không import `services.rendering`, cũng không tiêu thụ raw JSON của provider.
- `ocr_provider` không import `services.translation` hoặc `services.rendering`.

Quy tắc chi tiết hơn xem [Ranh giới kiến trúc backend Python](../python/architecture.md).

## Quy tắc sửa đổi

- Logic mới ưu tiên đặt trong thư mục phân tầng hiện có, tránh import xuyên tầng.
- Ranh giới dịch thuật, kết xuất, OCR provider thực hiện theo `doc/core/python/architecture.md`.
- Khi thêm logic kiểu quy tắc mới, ưu tiên bổ sung kiểm thử hồi quy tối thiểu, đặc biệt là công thức, thuật ngữ, bbox, biến đổi payload.
- Tính nhất quán dịch, bảng thuật ngữ, bảo vệ công thức, chiến lược kết xuất nên được truyền qua manifest/spec ổn định, không dựa vào đọc tệp tạm thời nội bộ xuyên module.
- Sửa đổi kết xuất và xử lý PDF cần nêu rõ có thay đổi nội dung PDF đầu ra, kích thước, trải nghiệm xem trước trang đầu hay văn bản có thể sao chép không.

## Kiểm tra thường dùng

Liên quan đến dịch thuật Python:

```bash
python3 -m compileall -q backend/scripts/services/translation
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Liên quan đến document schema / provider Python:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Liên quan đến kết xuất:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

## Mô tả PR

PR liên quan đến pipeline Python ít nhất nêu:

- Ảnh hưởng đến phần nào trong OCR, translation, rendering.
- Có thay đổi `document.v1`, translation manifest, render payload hoặc sự kiện giai đoạn không.
- Có ảnh hưởng đến kết xuất lại, khôi phục điểm dừng hoặc chẩn đoán của job cũ không.
- Đã sử dụng những mẫu nào để xác minh, có bao gồm công thức, chú thích hình, chú thích cuối trang, đoạn văn dài hoặc PDF nhiều trang không.
