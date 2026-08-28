# Mô tả vấn đề Layout-Fit xuyên trang/xuyên cột

## Hiện tượng vấn đề

Trong phần xem trước phủ PDF của `layout-fit/html/pretext.html`, một số vùng tuy khung đơn khớp gần đúng, nhưng khi gặp đoạn văn xuyên trang, xuyên cột thì xuất hiện lỗi rõ rệt:

- Đáy trang 3 và đầu trang 4 vốn là cùng một đoạn văn bản, lại bị coi là hai khối độc lập để dàn trang lại.
- Một số khối hiển thị văn bản tiếng Anh gốc thay vì bản dịch tiếng Trung.
- Kết quả tự động khớp chiều cao, số dòng, ngắt dòng trông "gần đúng", nhưng thực chất là sai lệch hệ thống.

## Nguyên nhân gốc rễ

Vấn đề này không do nguyên nhân đơn lẻ mà là nhiều lớp lỗi chồng chéo:

### 1. Nhầm lẫn đoạn nối xuyên trang thành block độc lập

Để thuận tiện xử lý, tầng dịch và Typst phía trên đã tách một đoạn xuyên trang thành hai item.

Ví dụ:

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

Trong Typst overlay, đây cũng là hai `pX_item_*` độc lập, không phải đối tượng liên tục tự nhiên.

Nhưng bản xem trước cũ vẫn xử lý theo "một sample = một khung văn bản độc lập", nên:

- Cuối trang trước chỉ dàn nửa đoạn đầu
- Đầu trang sau lại bắt đầu dàn từ văn bản riêng của mình

Điều này khiến đoạn xuyên trang không thể nối tiếp đúng.

### 2. Một số khối nối trong JSON dịch thiếu bản dịch

Ví dụ:

- `p003-b0005`
- `p004-b0000`

Trong `translated/page-003-deepseek.json` và `translated/page-004-deepseek.json`, `translated_text` của hai khối này là chuỗi rỗng.

Do đó logic cũ sẽ lùi về `source_text`, và trang hiển thị thành văn bản tiếng Anh gốc.

### 3. Đơn vị đo `pretext` và đơn vị tọa độ PDF bị trộn lẫn

Phép đo của `pretext` dựa trên pixel trình duyệt, trong khi khung đích PDF tính bằng `pt`. Cài đặt cũ đưa trực tiếp chiều rộng/cao `pt` của PDF vào `pretext`, rồi dùng kết quả như `pt` trở lại cho lớp phủ và chấm điểm, dẫn đến:

- Ngắt dòng không ổn định
- Sai lệch chiều cao dòng và chấm điểm
- Trông giống "khớp chưa chuẩn"

## Giải pháp

### 1. Khôi phục block xuyên trang thành flow group

Trong [extract_block_samples.py](/home/wxyhgk/tmp/Code/experiments/layout-fit/scripts/extract_block_samples.py) đã bổ sung phát hiện nối xuyên trang:

- Quét tuần tự OCR text block
- Nếu khối trước kết thúc giữa từ tiếng Anh, khối sau bắt đầu bằng chữ thường hoặc kiểu nối, và kề nhau xuyên trang
- Đánh dấu chúng thuộc cùng một `flow`

Sau đó ghi thông tin `flow` vào fixture:

- `group_id`
- `index`
- `count`
- `prev_block_id`
- `next_block_id`
- `block_ids`

Nhờ vậy frontend không còn coi các khối này là độc lập.

### 2. Frontend chuyển sang luồng đa khung thay vì khớp đơn khung độc lập

Trong [pretext.html](/home/wxyhgk/tmp/Code/experiments/layout-fit/html/pretext.html):

- Với nhiều box thuộc cùng `flow`, ghép văn bản thành một đoạn liên tục trước
- Dùng `pretext.layoutNextLine()` tiêu thụ dòng theo thứ tự box
- Nội dung dư không vừa khung trước sẽ chảy tiếp sang khung sau

Bước này sửa vấn đề cốt lõi xuyên trang, xuyên cột.

### 3. Khi thiếu bản dịch, lùi về văn bản markdown Typst

Trong cùng script trích xuất, bổ sung phân tích `*_md` trong Typst overlay.

Nếu một block:

- `translated_text` rỗng
- Nhưng `markdown_text` tương ứng trong Typst tồn tại

Thì lấy markdown tiếng Trung của Typst làm nguồn lùi cho `translated_text / fit_text`.

Bước này sửa vấn đề đáy trang 3, đầu trang 4 hiển thị tiếng Anh.

### 4. Thống nhất hệ đơn vị giữa `pretext` và PDF

Khi khớp ở frontend, đổi thành:

- Trước tiên đổi kích thước chữ, chiều rộng, chiều cao dòng sang pixel theo mật độ pixel ảnh trang PDF
- Dùng `pretext` dàn trang trong hệ tọa độ pixel đó
- Sau đó đổi kết quả về `pt` PDF để chấm điểm và vẽ lớp phủ

Nhờ vậy ngắt dòng và lớp phủ PDF cuối cùng nằm trong cùng hệ tọa độ.

## Hiệu quả hiện tại

Sau khi sửa:

- Đáy trang 3 và đầu trang 4 hiển thị tiếng Trung
- Hai phần không còn dàn lại từ đầu riêng biệt mà là cùng một đoạn chảy liên tục
- Lớp xem trước đã nhận diện và xử lý được nhiều nhóm nối xuyên trang

Các flow xuyên trang đã nhận diện bao gồm:

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

## Bài học kinh nghiệm

Loại vấn đề này không thể chỉ điều chỉnh từ "kích thước chữ, chiều cao dòng, căn đều hai bên".

Nếu tầng dịch/dàn trang phía trên vì thuận tiện kỹ thuật mà xé nhỏ đoạn văn, lớp xem trước phải khôi phục ngữ nghĩa "luồng đoạn văn"; nếu không, dù `pretext` tinh chỉnh thế nào cũng sẽ xuất hiện lỗi cấu trúc trong tình huống xuyên trang và xuyên cột.
