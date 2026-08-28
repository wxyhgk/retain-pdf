# 01 Hình dạng phản hồi

## Cấu trúc tầng trên cùng

Các trường tầng trên cùng mà Paddle adapter hiện tại phụ thuộc bao gồm:

- `layoutParsingResults`
  Danh sách kết quả phân tích theo trang
- `dataInfo`
  Siêu dữ liệu như kích thước trang
- `preprocessedImages`
  Danh sách hình ảnh tiền xử lý, tùy chọn

Điều kiện nhận dạng tối thiểu hiện tại xem:

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`

## Cấu trúc cấp trang

Đối với mỗi trang, adapter hiện tại đọc chủ yếu:

- `prunedResult`
- `prunedResult.parsing_res_list`
- `prunedResult.layout_det_res.boxes`
- `markdown.text`
- `markdown.images`

Thứ tự ưu tiên kích thước trang:

1. `dataInfo.pages[i].width / height`
2. `prunedResult.width / height`
3. Mặc định là `0`

## Cấu trúc cấp block

Block reader hiện tại đọc chủ yếu các trường sau:

- `block_label`
- `block_bbox`
- `block_content`
- `block_polygon_points`
- `block_id`
- `group_id`
- `global_block_id`
- `global_group_id`
- `block_order`

Giải thích:

- `block_label` quyết định ánh xạ cấu trúc chính
- `block_content` là nguồn văn bản chính
- `group_id / global_group_id / block_order` hiện chủ yếu phục vụ `continuation_hint`

## Quy trình xây dựng trang hiện tại

Quy trình page adapter hiện tại:

1. Đọc payload một trang từ `layoutParsingResults[page_index]`
2. Xây dựng `PaddlePageContext`
3. Xây dựng block spec từ `prunedResult.parsing_res_list` theo từng block
4. Bổ sung `metadata` cấp trang
5. Giao cho common builder để tạo `document.v1`

Đầu vào mã:

- `backend/scripts/services/document_schema/provider_adapters/paddle/payload_reader.py`
- `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`

## Đề xuất bảo trì tài liệu

Nếu cấu trúc API Paddle sau này thay đổi, tệp này cần được cập nhật ưu tiên:

1. Trường tầng trên cùng có thay đổi không
2. Đường dẫn trường cấp trang có thay đổi không
3. Đường dẫn trường cấp block có thay đổi không
4. Trường nào đã không còn đáng tin cậy
