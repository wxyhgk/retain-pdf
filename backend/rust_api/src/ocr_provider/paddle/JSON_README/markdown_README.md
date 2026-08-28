# Mô tả tầng Markdown

## 1. Định nghĩa tầng

`layoutParsingResults[*].markdown` là chuỗi Markdown/HTML dễ đọc được sinh thêm trên cơ sở `prunedResult`, dùng để con người nhanh chóng xem trước văn bản OCR, cấu trúc đoạn và tài nguyên nhúng. Mỗi mục `layoutParsingResults` đều có thể kèm theo `markdown.text` (nội dung Markdown toàn trang) và `markdown.images` (tài sản ảnh được thẻ `<img>` tham chiếu), nên nó không phải schema OCR mới mà là biểu diễn "làm phẳng, dễ đọc" của thông tin trong `prunedResult`.

## 2. Cấu trúc trường

- `text`: Một script Markdown/HTML hoàn chỉnh. Nội dung thực tế tự mang tiêu đề (như `## 1. JSON Split Profile`), đoạn văn, trộn Anh/Trung, công thức nội dòng (`$ \lambda = 1.5 $`, `$ E = mc^{2} $`) cùng thẻ `<div>`/`<img>`, gần như là văn bản liền mạch ghép từ các đoạn văn bản trang. Chuỗi này không chứa bất kỳ tọa độ hay đánh dấu loại nào, tất cả thông tin bố cục/phân loại đều bị bỏ, chỉ còn thứ tự và định dạng.
- `images`: Từ điển, khóa là đường dẫn tương đối dùng trong Markdown (ví dụ `imgs/img_in_image_box_256_840_937_1091.jpg`), giá trị là URL HTTP truy cập trực tiếp (thường kèm chữ ký ủy quyền). Có thể coi nó là bảng tham chiếu cho thẻ `<img>` trong `text`: mỗi khi Markdown xuất hiện `src="imgs/...jpg"`, `images[key]` sẽ lấy được vị trí tệp ảnh thực tế, thuận tiện nhúng ảnh xem trước ở tầng render.

## 3. Quan hệ với `prunedResult`

`markdown` không phải đầu ra cấu trúc của OCR gốc, nó là khung nhìn "định dạng mềm" phái sinh từ `prunedResult`. `prunedResult` vẫn là cấu trúc canonical mà giao diện thượng/hạ nguồn nên tin tưởng, giữ lại page size, `parsing_res_list` (kèm `block_bbox`, `block_label`, `block_order`), trừu tượng bố cục/đoạn và metadata khác, còn `markdown` chỉ nối nội dung văn bản và tham chiếu ảnh thành tài liệu dễ đọc. Sự khác biệt giữa hai bên có nghĩa: nếu cần định vị block, khôi phục X/Y, phán đoán tiêu đề hay bảng, bắt buộc phải xem `prunedResult`, không thể dựa vào `markdown`.

## 4. Phù hợp và cấm kỵ

- **Phù hợp**: Nhanh chóng xác nhận bằng mắt đầu ra OCR khi gỡ lỗi; hiển thị tổng quan trang cho frontend hoặc công cụ tài liệu; dùng tầng Markdown/HTML trong `text` (tiêu đề, `<img>`, công thức) thay thế đơn giản ảnh chụp màn hình; xác minh asset tham chiếu trong `images` có truy cập được.
- **Không phù hợp**: Làm đầu vào chính cho adapter; làm schema hạ nguồn (như `document.v1`, normalized document); dùng để phán đoán tag/type cấu trúc, ranh giới đoạn hay quan hệ bảng/ảnh minh họa — những thông tin này trong `markdown` chỉ còn thứ tự, không còn loại gốc và tọa độ.
- **Thận trọng**: `markdown.images` chỉ là ánh xạ URL, không chứa thông tin định vị như `block_bbox`. Nếu muốn tái tạo vùng ảnh ở đâu đó, vẫn phải kết hợp metadata của `prunedResult` + `outputImages`.

## 5. Khuyến nghị kết nối adapter sau này

Adapter hoặc cài đặt provider mới nên coi `prunedResult` (hoặc `normalized_document`) làm đầu vào chuỗi chính, `markdown.text`/`markdown.images` chỉ làm khung nhìn gỡ lỗi phụ trợ. Luồng phổ biến là:

1. Dùng các trường `parsing_res_list`, `block_label`, `block_bbox` trong `prunedResult` để hoàn thiện sắp xếp cấu trúc.
2. Nếu cần xác nhận thủ công kết quả trích xuất, đọc thêm `markdown.text` trong script gỡ lỗi để nhanh chóng xem tiêu đề, thân văn bản, công thức có liền mạch.
3. `markdown.images` có thể dùng để render preview hoặc xuất ảnh dưới dạng `![alt](URL)` trong markdown, nhưng đừng dùng nó để quyết định quy thuộc hay tọa độ ảnh.

Giữ tuyến này giúp kiểm soát chuỗi chính schema không lệch chuẩn vì một Markdown "trông giống tài liệu".
