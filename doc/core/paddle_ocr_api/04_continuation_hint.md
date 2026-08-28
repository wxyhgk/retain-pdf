# 04 Gợi ý tiếp tục

## Mục tiêu

Nếu bản thân Paddle đã biết block nào thuộc cùng một đoạn, adapter nên ánh xạ thông tin này thành một hợp đồng thống nhất:

- `continuation_hint`

Đừng để tầng translation đọc trực tiếp `group_id`, `global_group_id`, `block_order` của Paddle.

## Trường hiện tại

Cấu trúc hiện tại của `continuation_hint`:

```json
{
  "source": "provider",
  "group_id": "provider-paddle-global-xxx",
  "role": "head",
  "scope": "cross_page",
  "reading_order": 0,
  "confidence": 0.98
}
```

Giải thích trường:

- `source`
  Khi provider ghi, cố định là `provider`
- `group_id`
  ID ổn định của nhóm liên tục
- `role`
  `single/head/middle/tail`
- `scope`
  `intra_page` hoặc `cross_page`
- `reading_order`
  Thứ tự trong nhóm
- `confidence`
  Mức độ tin cậy của provider đối với nhóm này

## Quy tắc ánh xạ Paddle hiện tại

Mã hiện tại trong:

- `backend/scripts/services/document_schema/provider_adapters/paddle/continuation.py`

Quy tắc hiện tại:

1. Ưu tiên dùng `raw_global_group_id`
2. Không có nhóm toàn cục, dự phòng về `page_index + raw_group_id`
3. Nếu nhóm nhiều block không có `raw_block_order` đáng tin cậy, thì không tạo continuation hint
4. Nhóm cùng trang đánh dấu `intra_page`
5. Nhóm xuyên trang đánh dấu `cross_page`

## Quy ước tiêu thụ hạ nguồn

translation hiện sử dụng provider-first:

1. Hint `intra_page` cùng trang ưu tiên tiêu thụ trực tiếp
2. Hint `cross_page` xuyên trang chỉ tiêu thụ có kiểm soát khi đáp ứng điều kiện an toàn
3. Khi không đáp ứng điều kiện an toàn, hint được giữ lại nhưng không kích hoạt nối ghép

Nghĩa là:

- adapter chịu trách nhiệm "thể hiện chính xác những gì provider biết"
- translation chịu trách nhiệm "quyết định khi nào tin tưởng provider một cách an toàn"

## Người thích ứng cần lưu ý

1. `group_id` chỉ yêu cầu ổn định trong nhóm, không yêu cầu không đổi qua các phiên bản.
2. `reading_order` phải là duy nhất và đơn điệu trong nhóm.
3. Nếu thông tin nhóm của một phiên bản Paddle không ổn định, thà không viết `continuation_hint` còn hơn viết sai.
4. Đừng giả tạo quan hệ liên tục xuyên trang chỉ để cho một mẫu vượt qua.
