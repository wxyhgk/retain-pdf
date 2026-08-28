# Cấu trúc prunedResult và ánh xạ giá trị với normalized_document_v1

Tài liệu README này được viết cho đầu ra `layoutParsingResults[*].prunedResult` trong `rust_api/src/ocr_provider/paddle/json_full.json`, nhằm giúp người triển khai adapter nhanh chóng xác định các trường chính, hiểu ngữ nghĩa và tư duy ánh xạ khi chuẩn hóa; đồng thời chỉ rõ những trường nào phù hợp để giữ lại làm trace/debug.

## Cấp bậc JSON

- `layoutParsingResults` là nhiều bộ kết quả layout mà Paddle OCR có thể tạo ra trên cùng một đầu vào (thường sẽ có một số phiên bản `split`/`merge`)
- Mỗi mục đều chứa `prunedResult` (điểm khởi đầu chuẩn hóa mà chúng ta quan tâm) cùng các đoạn gỡ lỗi từ mã nguồn như `markdown`/`outputImages`/`inputImage`
- `prunedResult` trực tiếp bao gồm:
  - `page_count` (tổng số trang)
  - `width`, `height` (kích thước canvas tương ứng với kết quả phân tích layout hiện tại, đơn vị px)
  - `model_settings` (các thiết lập được sử dụng trong lượt suy luận này, dùng để tái hiện/gỡ lỗi)
  - `parsing_res_list` (danh sách cấu trúc block gốc của Paddle)
  - `layout_det_res` (đầu ra box của bộ phát hiện layout tầng dưới, thuận tiện cho việc trace đến kết quả phát hiện cụ thể)

## Mô tả trường chính

### `page_count` / `width` / `height`
- Cung cấp trực tiếp số trang và kích thước canvas ở cấp độ tài liệu, khuyến nghị ánh xạ đến `document.page_count` cũng như `page.width/page.height` mặc định của mỗi trang trong tài liệu đã chuẩn hóa, dùng để đánh giá tràn/co giãn.

### `model_settings`
- Chứa các trường thiết lập cho lần phân tích này, tên trường và giá trị thực tế như sau:
  - `use_doc_preprocessor`: Có sử dụng tiền xử lý tài liệu không
  - `use_layout_detection`: Có bật bộ phát hiện layout không
  - `use_chart_recognition`: Có thử nhận diện biểu đồ không
  - `use_seal_recognition`: Có bật nhận diện dấu đóng không
  - `use_ocr_for_image_block`: Có thực hiện OCR lại trên image block không
  - `format_block_content`: Có thực hiện định dạng nội dung văn bản không (như trim)
  - `merge_layout_blocks`: Có hợp nhất các block liền kề trong layout không
  - `markdown_ignore_labels`: Nhãn block sẽ bị bỏ qua khi tạo markdown, ví dụ `number/footnote/header/...`
  - `return_layout_polygon_points`: Có đính kèm thông tin polygon trong mỗi block không
- Khuyến nghị coi cấu trúc này là metadata trace của adapter (ghi vào trường `meta.ocr_settings` của tài liệu đã chuẩn hóa hoặc trường tương tự), để thuận tiện cho việc theo dõi vấn đề sau này hoặc đồng bộ với `normalization_report` của lớp Rust.

### `parsing_res_list`
- Danh sách block cốt lõi, là đầu vào trực tiếp của normalized_document. Mỗi mục có các trường:
  - `block_label`: Nhãn do Paddle dự đoán (như `header/paragraph_title/text/table/figure_title/footer`), có thể ánh xạ đến `type`/`sub_type` hoặc `tags` của block đã chuẩn hóa
  - `block_content`: Nội dung văn bản, điền trực tiếp vào trường `text_content` hoặc `lines` của block đã chuẩn hóa
  - `block_bbox`: `[x0,y0,x1,y1]`, tương ứng với axis-aligned bounding box của block
  - `block_polygon_points`: Tương tự `block_bbox`, nhưng hỗ trợ polygon (mỗi điểm là `[x,y]`), phù hợp để đưa vào trường `polygon` của block đã chuẩn hóa
  - `block_id`, `group_id`: ID block/nhóm cục bộ, có thể dùng để tạo `provider_id` hoặc `group_id` cho block đã chuẩn hóa
  - `global_block_id`, `global_group_id`: ID chứa offset toàn cục, duy trì tính duy nhất giữa các phiên bản layout/trang, khuyến nghị theo dõi như `meta.global_id` trong tài liệu đã chuẩn hóa
  - `block_order`: Thứ tự đọc do Paddle suy luận (một số giá trị trong ví dụ này là `null`), có thể dùng để điền vào `normalized_document.pages[].items[].order`
- Khuyến nghị adapter áp dụng tư duy sau:
  1. Phân chia `parsing_res_list` theo trang dựa trên `block_order` hoặc `block_id` (nếu có `group_id`, có thể dùng làm chiều `group` của `Page.blocks`)
  2. Sử dụng `block_label` để phân biệt loại (như `header`/`paragraph_title`/`text`), xác định `type/sub_type` của block đã chuẩn hóa (ví dụ `text` là nội dung chính, `paragraph_title` có thể coi là loại `title`)
  3. Gán `block_content` trực tiếp cho trường `text` của block đã chuẩn hóa, và giữ lại `block_polygon_points` làm `geometry.polygon`
  4. Đồng bộ `block_bbox` vào `bounding_box` của block đã chuẩn hóa, để frontend/render có thể tái sử dụng

### `layout_det_res`
- Chứa box gốc của bộ phát hiện layout, cấu trúc hiện tại là:
  - `boxes`: danh sách các đối tượng
  - Mỗi box có `cls_id` (ID phân loại), `label` (tên loại), `score` (độ tin cậy), `coordinate` (`[x0,y0,x1,y1]`), `order` (thứ tự đọc dự đoán, có thể là `null`), `polygon_points`
- Khuyến nghị adapter coi `layout_det_res` là trace phát hiện gốc:
  - Có thể giữ lại `boxes` trong `meta.raw_traces.layout_det_res` của tài liệu đã chuẩn hóa, thuận tiện cho việc truy vết label và score
  - `coordinate` / `polygon_points` tương ứng với geometry của `parsing_res_list`, có thể dùng để kiểm tra tính nhất quán giữa hai bên (ví dụ khi bật `merge_layout_blocks` sẽ tạo ra sự khác biệt)
  - `score` phù hợp để ghi vào trace thay vì trường cốt lõi của block đã chuẩn hóa, duy trì `document.normalization_trace` để phục vụ việc kiểm tra bỏ sót/nhận diện sai

## Khuyến nghị triển khai

1. Adapter trước tiên đọc `page_count`/`width`/`height` làm thông tin trang cơ bản của tài liệu đã chuẩn hóa; `layout_det_res.boxes` có thể đồng thời cung cấp kiểm tra tính nhất quán đầu cuối cho `page_count`.
2. Mỗi mục trong `parsing_res_list` tạo ra một block đã chuẩn hóa, `block_label` quyết định `type` (như `table`, `image`, `text`), `block_content` trở thành nội dung văn bản chính, `block_order`/`group_id` dùng để xây dựng thứ tự đọc/phân nhóm cho block.
3. Tất cả các trường liên quan đến polygon/bbox/cursor (`block_bbox` + `block_polygon_points` + `layout_det_res.boxes coordinate/polygon_points`) đều nên được đồng bộ vào geometry và trace của block đã chuẩn hóa, tránh việc hiểu sai tọa độ từ các đầu vào khác nhau.
4. `model_settings` và `layout_det_res` ghi trực tiếp vào trace gỡ lỗi (ví dụ `normalized_document.meta.provider_trace.paddle.pruned_result`), để thuận tiện tái hiện trường này trong `normalization_report`; chỉ có `block_content`/`label`/`geometry` của `parsing_res_list` mới thực sự cần ánh xạ vào luồng chính của tài liệu đã chuẩn hóa.
5. Nếu sau này sử dụng schema `normalized_document_v1`, khuyến nghị lưu các giá trị gốc `block_id/global_block_id` và `group_id/global_group_id` trong `blocks[].meta`, để thuận tiện đồng bộ ID với các provider khác.

## Các trường cần giữ lại cho trace

- `model_settings`: Lưu giữ đầy đủ, thuận tiện cho việc đồng bộ tham số thí nghiệm với `normalization_summary`
- `layout_det_res.boxes`: Dùng làm `debug.traces.layout_detector`, giữ lại `label/score/coordinate/order`
- `block_polygon_points` và `block_id` trong `parsing_res_list` là cơ sở để định vị block khi gỡ lỗi sau này
- Các trường còn lại như `global_block_id/global_group_id` có thể ghi trực tiếp vào `blocks[].meta.source_ids`

Tuân thủ các quy ước trên sẽ giúp adapter khi tạo tài liệu đã chuẩn hóa vừa không làm mất đi ngữ nghĩa chi tiết do Paddle cung cấp, vừa có thể tái hiện đầy đủ quá trình detection trong trace, thuận tiện cho việc render, gỡ lỗi và hồi quy schema sau này.
