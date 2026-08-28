# 03 Quy tắc ngữ nghĩa

## Tổng nguyên tắc

Khi thích ứng Paddle, trước tiên xác định trường thuộc loại nào:

1. Cấu trúc ổn định
2. Ngữ nghĩa ổn định
3. Trace thô chỉ dùng để gỡ lỗi

## Những gì vào tầng cấu trúc lõi

Chỉ những nội dung có khả năng ổn định trên nhiều provider mới được phép vào tầng cấu trúc lõi:

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

## Những gì vào `tags`

`tags` phù hợp để chứa các gợi ý cấu trúc nhẹ, có thể kết hợp và có thể được hạ nguồn sử dụng.

Ví dụ hiện tại Paddle đang sử dụng:

- `title`
- `abstract`
- `heading`
- `caption`
- `image_caption`
- `table_caption`
- `reference_zone`
- `skip_translation`
- `image`
- `table`
- `formula`

## Những gì vào `derived`

`derived` phù hợp để chứa các kết luận ngữ nghĩa mạnh hơn và nêu rõ ai đưa ra kết luận.

Định dạng hiện tại:

```json
{
  "role": "title",
  "by": "provider_rule",
  "confidence": 0.98
}
```

Ví dụ phù hợp cho `derived`:

- title
- abstract
- reference_entry
- formula_number
- header/footer
- caption/footnote – các vai trò provider đã xác định rõ

## Những gì chỉ giữ lại ở `metadata/source`

Các trường riêng của Paddle mặc định nên giữ ở tầng trace:

- `raw_group_id`
- `raw_global_group_id`
- `raw_global_block_id`
- `raw_block_order`
- `raw_polygon`
- `layout_det_*`
- `model_settings`
- `markdown.images`

Chỉ khi nhiều provider đều tạo ra ổn định và hạ nguồn thực sự cần, mới xem xét nâng lên.

## Phân tầng trace hiện tại

Phân tầng trace Paddle hiện tại:

1. Tầng cấu trúc lõi
2. Tầng trace chung
3. Tầng trace thô provider

Trong đó:

- `content_format / asset_* / markdown_match_*` nghiêng về "tầng trace chung"
- `layout_det_* / model_settings / group id gốc` nghiêng về "tầng trace thô provider"

## Yêu cầu thay đổi quy tắc

Nếu thay đổi `block_label -> type/sub_type/tags/derived`, phải đồng thời cập nhật:

1. Tài liệu trong thư mục này
2. Fixture liên quan
3. Regression check
4. Nếu cần, translation extractor smoke
