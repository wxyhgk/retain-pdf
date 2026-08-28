# 02 Ánh xạ trường

## Nguyên tắc cốt lõi

Khi ánh xạ, chỉ cần hỏi một điều:

- Trường Paddle này nên rơi vào tầng nào của `document.v1`

Các tầng định vị hiện cho phép:

1. Tầng cấu trúc lõi: `type/sub_type/bbox/text/lines/segments/tags/derived`
2. Tầng trace chung: `metadata` có thể được nhiều provider dùng chung
3. Tầng trace thô provider: trường riêng của Paddle, giữ trong `metadata/source`

## Ánh xạ tầng trên cùng

| Trường Paddle | Trường `document.v1` | Giải thích |
| --- | --- | --- |
| Giá trị cố định provider | `source.provider` | Hiện cố định là `paddle` |
| Đường dẫn tệp đầu vào | `source.raw_files.source_json` | Do adapter bên ngoài tiêm vào |
| Số trang | `page_count` | Xác định bởi số lượng pages |

## Ánh xạ trang

| Trường Paddle | Trường `document.v1` | Giải thích |
| --- | --- | --- |
| `dataInfo.pages[i].width` | `pages[i].width` | Ưu tiên |
| `dataInfo.pages[i].height` | `pages[i].height` | Ưu tiên |
| `prunedResult.width` | `pages[i].width` | Dự phòng |
| `prunedResult.height` | `pages[i].height` | Dự phòng |
| Số thứ tự trang | `pages[i].page_index` | Bắt đầu từ 0 |
| Giá trị cố định | `pages[i].unit` | Hiện cố định `pt` |

## Ánh xạ block

| Trường Paddle | Trường `document.v1` | Giải thích |
| --- | --- | --- |
| `block_bbox` | `bbox` | bbox đã chuẩn hóa |
| `block_content` | `text` | Văn bản đã chuẩn hóa |
| `block_label` | `type/sub_type/tags` | Đi qua `block_labels.py` |
| Kết quả tách dòng/đoạn | `lines/segments` | Đi qua `content_extract.py` |
| `block_id` | `source.raw_block_id` | Giữ nguồn gốc |
| `block_label` | `source.raw_type` | Giữ kiểu gốc |
| `block_bbox` | `source.raw_bbox` | Giữ bbox gốc |
| `block_content[:200]` | `source.raw_text_excerpt` | Dùng để gỡ lỗi |
| Đường dẫn gốc | `source.raw_path` | Trỏ đến đường dẫn JSON gốc |

## Ánh xạ label hiện tại

Quy tắc chính hiện tại xem:

- `backend/scripts/services/document_schema/provider_adapters/paddle/block_labels.py`

Ví dụ ánh xạ đã triển khai:

| `block_label` | `type` | `sub_type` | `tags` |
| --- | --- | --- | --- |
| `doc_title` | `text` | `title` | `title` |
| `abstract` | `text` | `abstract` | `abstract` |
| `text` | `text` | `body` | Trống |
| `paragraph_title` | `text` | `heading` | `heading` |
| `reference_content` | `text` | `reference_entry` | `reference_entry, reference_zone, skip_translation` |
| `formula_number` | `text` | `formula_number` | `formula_number, skip_translation` |
| `table` | `table` | `table_html` | `table` |
| `image` | `image` | `image_body` | `image, skip_translation` |
| `algorithm` | `code` | `code_block` | `code` |
| `display_formula` | `formula` | `display_formula` | `formula` |

## Ánh xạ `derived`

`derived` hiện được tạo chủ yếu bởi quy tắc provider, xem:

- `backend/scripts/services/document_schema/provider_adapters/paddle/trace.py`

Quy tắc điển hình:

- `doc_title -> derived.role = title`
- `abstract -> derived.role = abstract`
- `reference_content -> derived.role = reference_entry`
- `formula_number -> derived.role = formula_number`
- `header/footer -> derived.role = header/footer`

## Đừng làm điều này

1. Đừng nhét trường riêng của Paddle trực tiếp thành trường hợp đồng chính mới.
2. Đừng giải thích lại `block_label` ở tầng translation.
3. Đừng tạm thời thay đổi ngữ nghĩa `type/sub_type` chỉ cho một fixture duy nhất.
