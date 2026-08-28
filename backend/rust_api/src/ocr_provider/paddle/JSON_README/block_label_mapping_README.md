# Bảng ánh xạ block_label phiên bản đầu của Paddle

Tài liệu này được tổng hợp dựa trên kết quả liệt kê thực tế của `layoutParsingResults[*].prunedResult.parsing_res_list[*].block_label` từ [json_full.json](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/json_full.json), nhằm cung cấp ánh xạ ổn định phiên bản đầu cho bộ chuyển đổi `Paddle -> document.v1` sau này.

## 1. Các block_label quan sát được trong mẫu hiện tại

Từ mẫu ba trang hiện tại, các label liệt kê được như sau:

| block_label | Số lần | Mô tả |
| --- | ---: | --- |
| `text` | 25 | Đoạn văn bản thông thường |
| `paragraph_title` | 12 | Tiêu đề đoạn/tiêu đề tiểu mục |
| `header` | 6 | Tiêu đề trang |
| `footer` | 6 | Chân trang |
| `figure_title` | 4 | Tiêu đề hình ảnh hoặc tiêu đề bảng |
| `table` | 2 | Phần thân bảng, nội dung là bảng HTML |
| `image` | 1 | Phần thân hình ảnh, nội dung thường là `<img>` HTML |
| `algorithm` | 1 | Khối mã/thuật toán |
| `display_formula` | 1 | Công thức giữa dòng |
| `vision_footnote` | 1 | Chú thích hình ảnh/chú thích bảng/chú thích |

## 2. Trích dẫn ví dụ thực tế

### `text`
- Trang 1 / block 4
  Đoạn văn bản lớn pha trộn tiếng Trung và Anh
- Trang 1 / block 6
  Văn bản thông thường có công thức nội dòng và chữ giải thích

Gợi ý:
- Sử dụng trực tiếp làm điểm nhập chính cho khối văn bản đã chuẩn hóa.

### `paragraph_title`
- Trang 1 / block 3
  `## 1. JSON Split Profile`
- Trang 1 / block 5
  `### 1.1. Cấu trúc tổng quan`

Gợi ý:
- Dùng làm khối loại tiêu đề, không gộp vào `text` thông thường.

### `header`
- `PaddleOCR JSON Split Research`
- `March 31, 2026 · Nhà cung cấp: Paddle`

Gợi ý:
- Mặc định giữ lại như khối cấu trúc, nhưng thường bỏ qua trong luồng dịch chính.

### `footer`
- `Confidential Draft`
- `Trang page.number / pages.count`

Gợi ý:
- Mặc định giữ lại như khối cấu trúc, luồng dịch chính thường cũng nên bỏ qua.

### `figure_title`
- Figure caption
- Table caption

Lưu ý:
- Nhãn này trong mẫu Paddle đồng thời bao gồm cả "tiêu đề hình ảnh" và "tiêu đề bảng", không thể đơn giản coi là `image_caption`.

### `table`
- Nội dung là chuỗi HTML table hoàn chỉnh

Gợi ý:
- Trước tiên giữ lại nội dung HTML gốc
- Sau này mới quyết định có tách các ô thành lược đồ bảng có cấu trúc hay không

### `image`
- Nội dung thường là đoạn `<img src=...>`

Gợi ý:
- Coi là khối chính vùng ảnh, không lấy `block_content` làm văn bản thân văn bản

### `algorithm`
- Trong mẫu hiện tại là khối mã/dòng lệnh

Gợi ý:
- Trước tiên ánh xạ thống nhất sang `code`
- Sau này nếu Paddle còn pseudocode thuật toán thực sự, mới quyết định có chia nhỏ `algorithm_block` hay không

### `display_formula`
- Nội dung là `$$ ... $$`

Gợi ý:
- Ánh xạ trực tiếp sang `formula`
- Giữ nguyên chuỗi LaTeX/Math gốc

### `vision_footnote`
- Mẫu hiện tại là `Ghi chú bảng: số liệu chỉ mang tính minh họa, không đại diện cho kết quả benchmark thực tế.`

Gợi ý:
- Trước tiên thống nhất coi là loại footnote/caption_note
- Loại trường này thường xuất hiện gần biểu đồ/hình ảnh, nên giữ manh mối kề cận

## 3. Gợi ý ánh xạ normalized_document_v1 phiên bản đầu

Ở đây đưa ra ánh xạ "bảo thủ, ổn định" trước, không đòi hỏi hoàn hảo ngay.

| Paddle block_label | normalized type | normalized sub_type | Ghi chú |
| --- | --- | --- | --- |
| `text` | `text` | `body` | Văn bản chính |
| `paragraph_title` | `text` | `heading` | Sau này có thể chia nhỏ theo số/thứ bậc |
| `header` | `text` | `header` | Thường bỏ qua dịch |
| `footer` | `text` | `footer` | Thường bỏ qua dịch |
| `figure_title` | `text` | `caption` | Thống nhất caption trước, sau đó phán đoán tiêu đề hình/bảng qua khối kề |
| `table` | `table` | `table_html` | Giữ nguyên HTML |
| `image` | `image` | `image_body` | Không xử lý theo logic văn bản |
| `algorithm` | `code` | `code_block` | Thống nhất vào khối mã trước |
| `display_formula` | `formula` | `display_formula` | Công thức giữa dòng |
| `vision_footnote` | `text` | `footnote` | Chú thích hình/bảng/chân trang thống nhất vào loại này trước |

## 4. Những trường nào cần giữ thêm vào raw trace

Gợi ý mỗi normalized block đều giữ provider trace sau:

- `provider = "paddle"`
- `source_page_index`
- `source_block_index`
- `source_block_label`
- `source_block_id` (nếu có)
- `source_group_id` (nếu có)
- `source_bbox`
- `source_polygon`

Lý do:
- `figure_title` cần dựa vào quan hệ kề cận để phân biệt tiêu đề hình hay tiêu đề bảng
- `vision_footnote` sau này có thể cần chia thành `table_footnote` / `image_footnote`
- `table` hiện là chuỗi HTML, sau này nếu tách bảng có cấu trúc thì cần truy ngược về khối gốc

## 5. Ba việc đáng làm nhất hiện tại

1. Viết hàm ánh xạ thuần `block_label -> normalized type/sub_type` trước
2. Đưa `figure_title` và `vision_footnote` bảo thủ vào `caption/footnote` trước
3. Không vội tách sâu `table` và `image`, giữ chúng như khối ổn định trước

## 6. Một số kết luận kỹ thuật từ mẫu hiện tại

- `figure_title` của Paddle rõ ràng là nhãn hỗn hợp, sau này phải kết hợp quan hệ khối trước/sau để phán đoán "tiêu đề hình/tiêu đề bảng".
- `block_content` của `table` và `image` giống "đoạn văn bản giàu định dạng hoặc nhúng", không thể đi thẳng vào logic trích xuất văn bản thông thường.
- `algorithm` hiện giống khối mã hơn, không mở riêng nhánh phức tạp.
- `display_formula` có nhãn riêng, trực tiếp hơn MinerU, nên ưu tiên tận dụng.

## 7. Tệp gợi ý tiếp theo

Nếu bước tiếp theo bắt đầu viết adapter, gợi ý thêm trực tiếp:

- `paddle/block_labels.py`
  Chỉ lo ánh xạ label và phán đoán nhãn
- `paddle/adapter.py`
  Chỉ lo `json_full -> document.v1`
- `paddle/trace.py`
  Chỉ lo điểm lưu provider raw trace

Như vậy sau này gặp label mới, chỉ sửa `block_labels.py`, không làm nhiễm adapter chính.
