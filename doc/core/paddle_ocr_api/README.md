# Tài liệu kết nối Paddle OCR

Đây là giải thích adapter OCR của RetainPDF, không phải tài liệu chính thức của Paddle.
Nếu bạn muốn sửa "JSON thô Paddle đi vào `document.v1` như thế nào", hãy xem ở đây trước.

Bộ tài liệu này chỉ phục vụ một việc:

- Ổn định và hội tụ kết quả trả về gốc của Paddle OCR thành `normalized_document_v1`

Đừng viết tài liệu quy tắc dịch ở đây, cũng đừng nhét chiến lược kết xuất vào.

## Ranh giới kết nối

Người thích ứng Paddle OCR chỉ phụ trách:

1. Hiểu cấu trúc API và JSON gốc của Paddle
2. Triển khai phát hiện provider và adapter
3. Ánh xạ trường riêng của Paddle vào `document.v1`
4. Bổ sung fixture, kiểm thử hồi quy và tài liệu

Không phụ trách rõ ràng:

1. Không sửa tầng dịch `services/translation/*`
2. Không sửa tầng kết xuất `services/rendering/*`
3. Không viết đặc trưng riêng Paddle trong `runtime/pipeline/*`
4. Không để hạ nguồn đọc trực tiếp raw JSON của Paddle

## Đầu vào mã hiện tại

- Đầu vào đăng ký provider:
  `backend/scripts/services/document_schema/adapters.py`
- Hằng provider:
  `backend/scripts/services/document_schema/providers.py`
- Đầu vào adapter Paddle:
  `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- Page reader Paddle:
  `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`
- Block reader Paddle:
  `backend/scripts/services/document_schema/provider_adapters/paddle/block_reader.py`
- Giải thích hợp đồng chung:
  `backend/scripts/services/document_schema/README.md`

## Thứ tự đọc

1. [00_overview.md](./00_overview.md)
2. [01_response_shape.md](./01_response_shape.md)
3. [02_field_mapping.md](./02_field_mapping.md)
4. [03_semantics_rules.md](./03_semantics_rules.md)
5. [04_continuation_hint.md](./04_continuation_hint.md)
6. [05_adapter_checklist.md](./05_adapter_checklist.md)
7. [06_job_artifact_boundary.md](./06_job_artifact_boundary.md)
8. [official/README.md](./official/README.md)

## Nguyên tắc kết nối

1. Trường riêng của Paddle chỉ được phép ở tầng adapter và tầng trace.
2. Luồng chính hạ nguồn chỉ tiêu thụ `document.v1.json`.
3. Nếu Paddle đã nhận dạng nhóm đoạn liên tục, ghi vào `continuation_hint`, đừng để lộ trường riêng như `group_id` trực tiếp cho translation.
4. Đảm bảo schema đúng trước, sau đó mới tăng cường ngữ nghĩa; đừng chất đống quy tắc ngay từ đầu.
5. `provider raw -> normalized_document -> artifact export -> download API` là bốn tầng ranh giới, đừng trộn lẫn.
