# 00 Tổng quan

## Mục tiêu

Mục tiêu của tầng kết nối Paddle OCR là:

- Đầu vào: JSON thô Paddle OCR
- Đầu ra: `normalized_document_v1` phù hợp với hợp đồng chính hiện tại

Cụ thể:

`Raw payload Paddle -> provider adapter -> document.v1 -> translation/rendering`

## Tiêu chí nhận dạng hiện tại

Mã hiện tại nhận dạng payload sau là Paddle:

- Tầng trên cùng là `dict`
- Tồn tại `layoutParsingResults`
- Tồn tại `dataInfo`

Vị trí mã:

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- `backend/scripts/services/document_schema/adapters.py`

## Trách nhiệm thư mục hiện tại

`provider_adapters/paddle/` hiện được chia theo trách nhiệm thành các phần sau:

- `adapter.py`
  Đầu vào tổng của Paddle provider
- `payload_reader.py`
  Đọc payload tầng trên cùng và xây dựng page spec theo trang
- `page_reader.py`
  Xây dựng page context/page spec
- `block_reader.py`
  Xây dựng block context/block spec
- `block_labels.py`
  Ánh xạ `block_label -> type/sub_type/tags`
- `trace.py`
  Xây dựng `metadata/source/derived`
- `continuation.py`
  Ánh xạ thông tin nhóm của Paddle thành `continuation_hint`
- `page_trace.py`
  Trace cấp trang và khớp layout_det
- `rich_content.py` và các tệp liên quan
  Tổng hợp trace nội dung phong phú

## Ranh giới nhiệm vụ của người thích ứng

Người thích ứng Paddle chỉ cần phụ trách các tầng sau:

1. Giải thích trường thô Paddle
2. Quy tắc định vị trường
3. Ánh xạ ngữ nghĩa `block_label`
4. Ánh xạ `continuation_hint`
5. Fixture và hồi quy

Đừng trộn những việc này vào nhiệm vụ:

1. Prompt dịch
2. Ghi đè bố cục
3. Ghi lại PDF
4. Logic hiển thị frontend

## Tiêu chuẩn bàn giao

Ít nhất đáp ứng:

1. `adapt_path_to_document_v1()` có thể chuyển JSON thô Paddle thành `document.v1`
2. Vượt qua `validate_document_payload()`
3. Vượt qua smoke `extract_text_items()`
4. Fixture đã được đăng ký vào hồi quy
5. Tài liệu đã được cập nhật
