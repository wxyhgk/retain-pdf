# Cộng tác và ranh giới

Bài viết này nói về cách phát triển phối hợp backend không làm rối cấu trúc.

## Trách nhiệm module

- `routes/*`
  - Chỉ làm HTTP adapter
- `services/jobs/*`
  - Làm truy vấn, hiển thị, tạo, khôi phục, điều khiển nhiệm vụ
- `job_runner/*`
  - Làm chuỗi thực thi thực tế
- `models/*`
  - Chỉ chứa DTO và mô hình lưu trữ

## Hướng phụ thuộc

Hướng mặc định:

- `routes -> services -> job_snapshot_factory / job_launcher / runtime_gateway / db`
- `job_runner -> db / config / runtime state`
- `models` không phụ thuộc ngược vào `routes` hoặc `services`

## Quy ước AppState

`AppState` chỉ được đặt ở những nơi thực sự cần sự phối hợp thời gian chạy:

- Cổng vào route
- Cổng vào vòng đời
- Lớp thực thi thời gian chạy

Nếu chỉ cần:

- `&Db`
- `&AppConfig`
- `&Path`
- `&RwLock<HashSet<String>>`
- `&Arc<Semaphore>`

thì không truyền `AppState` nữa.

## Các mô hình phản phổ biến

- Ghép view nghiệp vụ trong route
- Đọc hệ thống tệp trong models
- Tiếp tục truyền `AppState` lung tung trong job_runner
- Coi file layout là hợp đồng API công khai

## Ranh giới ổn định

- `provider raw`, `normalized`, `published artifact`, `download API` là bốn ranh giới khác nhau
- `failure` là nguồn thất bại chính thức
- `runtime.stage_history` là nguồn dòng thời gian chính
- `failure_diagnostic` chỉ giữ phép chiếu tương thích

## Quy ước quyền của mô hình lớn

Mô hình lớn có thể tham gia sửa chữa tầng ngữ nghĩa, nhưng không được tiếp quản tầng cấu trúc, bố cục hoặc tầng sản phẩm.

### Những việc được phép

- Chuẩn hóa ngữ nghĩa nhiễu OCR
  - Ví dụ sửa lỗi nhận dạng LaTeX rõ ràng
  - Ví dụ đưa nhiễu ổn định có thể quy tắc hóa như `\\langlen` thành kết quả xác định
- Bản thảo dịch và ứng viên tiêu đề
- Phân loại nhẹ
  - Phán đoán ngữ nghĩa tiêu đề / chú thích cuối trang / nội dung
  - Phán đoán ứng viên có cần quy tắc dịch đặc biệt không

### Chỉ được đề xuất, không được áp dụng trực tiếp

- Có thụt lề không
- Có điều chỉnh khoảng cách dòng không
- Có điều chỉnh cỡ chữ không
- Có thay đổi bố cục đoạn văn không
- Có sửa chiến lược che / xóa không

### Những việc bị cấm rõ ràng

- Sửa bbox
- Sửa phân trang
- Sửa cấu trúc gốc
- Sửa trạng thái nhiệm vụ
- Sửa đường dẫn sản phẩm
- Viết lại đầu vào kết xuất trực tiếp mà không qua quy tắc xác định

### Nguyên tắc áp dụng

- Mô hình lớn xuất "bản sửa chữa đề xuất"
- T��ng quy tắc xác định cuối cùng có hiệu lực
- Miễn là có thể quy tắc hóa ổn định, ưu tiên đưa vào tầng tiền xử lý hoặc chuẩn hóa, không phụ thuộc vào dự đoán tạm thời của mô hình
- Tầng cấu trúc, bố cục, sản phẩm phải có thể kiểm thử, tái phát, tái hiện

## Kiểm tra trước khi commit

Khi sửa `rust_api`, ít nhất thực hiện kiểm tra tương ứng:

- `cargo check --quiet`
- Nếu sửa presentation / query, bổ sung kiểm thử
- Nếu sửa runner / lifecycle, bổ sung kiểm thử
