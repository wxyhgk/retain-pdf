# Quy ước hợp tác phát triển

Tài liệu này không phải là tài liệu giao diện, mà là quy ước ranh giới dành cho phát triển phối hợp backend.

Mục tiêu duy nhất:

- Khi nhiều người cùng phát triển `rust_api`, cố gắng mỗi người sửa phần của mình, không chồng chéo trách nhiệm, không làm rối cấu trúc thêm

## 1. Trách nhiệm module

Hiện tại mặc định hợp tác theo ranh giới dưới đây:

- `routes/*`
  - Chỉ làm HTTP adapter
  - Chịu trách nhiệm phân tích yêu cầu, cổng vào sau xác thực, đóng gói phản hồi
  - Không chịu trách nhiệm tổng hợp nghiệp vụ, không trực tiếp ghép job command
- `services/jobs/*`
  - Chịu trách nhiệm logic nghiệp vụ trong miền nhiệm vụ
  - Bao gồm query, presentation, creation, control
  - Đây là nơi ưu tiên cho hầu hết các "thay đổi nghiệp vụ"
- `services/job_snapshot_factory.rs`
  - Chịu trách nhiệm lắp ráp job snapshot / command
- `services/job_launcher.rs`
  - Chịu trách nhiệm lưu trữ và khởi chạy job
- `services/runtime_gateway.rs`
  - Chịu trách nhiệm cung cấp khả năng truy cập runtime cho services
- `job_runner/*`
  - Chịu trách nhiệm thực thi thời gian chạy
  - Bao gồm xếp hàng, hủy, khởi tạo tiến trình, kết nối nhiệm vụ con OCR, chuỗi thực thi render/translate
- `models/*`
  - Chỉ chứa DTO, mô hình đầu vào/đầu ra, mô hình lưu trữ
  - Không thêm logic điều phối nghiệp vụ hoặc đ��c hệ thống tệp

## 2. Quy tắc phụ thuộc

Hướng phụ thuộc mặc định:

- `routes -> services -> job_snapshot_factory / job_launcher / runtime_gateway / db`
- `job_runner -> db / config / runtime state`
- `models` không phụ thuộc ngược vào `routes` hoặc `services`

Mặc định cấm:

- `routes` trực tiếp viết logic nghiệp vụ phức tạp
- `models/view.rs` tái phát sinh logic đọc tệp, tổng hợp chẩn đoán thất bại, v.v.
- Helper lắp ráp thuần túy tiếp tục trực tiếp nhận `AppState`

## 3. Quy ước sử dụng AppState

Những nơi cho phép `AppState` xuất hiện:

- Cổng vào route
- Cổng vào vòng đời
- Module thời gian chạy thực sự cần phối hợp hủy, vị trí thực thi, khởi tạo tiến trình

Ưu tiên chuyển sang phụ thuộc hẹp:

- Xây dựng command
- Lắp ráp snapshot
- Xác thực và lưu trữ tải lên
- Tổng hợp view chỉ đọc
- Helper chỉ làm lưu xuống cơ sở dữ liệu / sự kiện

Nếu một hàm chỉ cần các tài nguyên sau, đừng truyền `AppState`:

- `&Db`
- `&AppConfig`
- `&Path`
- `&RwLock<HashSet<String>>`
- `&Arc<Semaphore>`

## 4. Quy tắc vị trí cho yêu cầu mới

Khi nhiều người hợp tác, trước tiên xác định yêu cầu thuộc loại nào, rồi đặt code:

- Thêm trường truy vấn, hiển thị chi tiết, chế độ xem sản phẩm
  - Ưu tiên sửa `services/jobs/presentation` hoặc `services/jobs/query`
- Thêm tham số tạo, quy trình gửi, logic bundle
  - Ưu tiên sửa `services/jobs/creation`
- Thêm giai đoạn thực thi, kết nối nhiệm vụ con, ngữ nghĩa hủy
  - Ưu tiên sửa `job_runner/*`
- Thêm trường phản hồi công khai hoặc trường đầu vào
  - Sửa `models/*`
- Chỉ có thay đổi tham số đầu vào/đầu ra HTTP
  - Sửa `routes/*`, nhưng cố gắng đừng để lại phán đoán nghiệp vụ trong route

## 5. Các mô hình phản phổ biến

Dưới đây là những cách dễ làm hỏng cấu trúc nhất trong hợp tác:

- Trong route, tiện tay đọc DB, ghép view, ghép command, đánh giá hệ thống tệp
- Trong `services` trực tiếp viết ngữ nghĩa HTTP
  - Ví dụ trực tiếp lo lắng về Header, Multipart, Response
- Trong module con `job_runner` thêm helper truyền `AppState` mới
- Trong `models` thêm logic tổng hợp "tiện tay đọc tệp đĩa"
- Để tiện lợi mà nhồi nhiều trách nhiệm vào một hàm hộp đen

## 6. Kiểm tra tối thiểu trước khi commit

Nếu sửa đến `rust_api`, mặc định ít nhất làm các mục liên quan dưới đây:

- `cargo check --quiet`
- Nếu sửa creation / job_snapshot_factory / job_launcher: bổ sung kiểm thử service tương ứng
- Nếu sửa process runner / lifecycle: bổ sung kiểm thử runner tương ứng
- Nếu sửa query / presentation: bổ sung kiểm thử query hoặc presentation tương ứng

Nếu một sửa đổi khiến helper tầng dưới lại bắt đầu trực tiếp phụ thuộc vào `AppState`, mặc định nên giải thích trong đánh giá tại sao phải làm vậy.
