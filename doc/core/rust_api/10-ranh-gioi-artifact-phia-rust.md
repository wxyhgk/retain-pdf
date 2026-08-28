# Ranh giới Artifact phía Rust

Tài liệu này trả lời một câu hỏi:

API Rust hiện tại nhìn nhận bốn ranh giới `provider raw / normalized / published artifact / download API` như thế nào?

## 1. Bốn ranh giới

```text
provider raw
  -> normalized
  -> published artifact
  -> download API
```

Trách nhiệm của bốn lớp phải được phân tách ổn định.

## 2. Provider Raw

Lớp này là kết quả gốc hoặc bản chụp thư mục gốc của chính provider.

Phía Rust chỉ coi nó như một sản phẩm provider "có thể đăng ký, tải xuống và gỡ lỗi"; không được xem như một hợp đồng tài liệu thống nhất.

Các key điển hình hiện tại:

- `provider_result_json`
- `provider_bundle_zip`
- `provider_raw_dir`
- `layout_json`

Lớp này cho phép:

- Bảo toàn cấu trúc gốc của provider
- Làm cơ sở cho việc gỡ lỗi và truy vết
- Đóng vai trò nguồn đầu vào trước khi chuẩn hóa

Lớp này không cho phép:

- Download API cam kết ngữ nghĩa trường đặc thù của provider
- Artifact registry hiểu các trường của provider như `layoutParsingResults`
- Luồng dịch/render hạ nguồn phụ thuộc ổn định trực tiếp vào cấu trúc provider raw

## 3. Normalized

Lớp này là điểm bàn giao chính thức từ giai đoạn OCR sang hạ nguồn.

Các tệp chính thức hiện tại:

- `normalized_document_json`
- `normalization_report_json`

Phía Rust nên xem đây là:

- Ranh giới cấu trúc ổn định từ OCR sang dịch/render
- Tài nguyên tài liệu chính thức có thể tải xuống từ bên ngoài

Phía Rust không được nhầm lẫn provider raw và normalized là cùng một khái niệm.

Cụ thể:

- Cổng tải xuống `normalized-document` chỉ tương ứng với `normalized_document_json`
- Cổng tải xuống `normalization-report` chỉ tương ứng với `normalization_report_json`

## 4. Published Artifact

Lớp này là artifact registry / published artifact của API Rust.

Trách nhiệm:

- Gán `artifact_key` ổn định cho các tệp trong thư mục tác vụ
- Tạo manifest thống nhất
- Cung cấp đường dẫn tài nguyên thống nhất
- Xử lý các tổ hợp xuất như bundle

Không chịu trách nhiệm:

- Hiểu các trường nội bộ của provider raw
- Định nghĩa ngữ nghĩa chuẩn hóa
- Suy luận ngữ nghĩa tài liệu như văn bản, cấu trúc, công thức

Nói cách khác:

- `provider raw` là "bản chụp đầu vào gốc"
- `normalized` là "hợp đồng tài liệu thống nhất"
- `published artifact` là "lớp đăng ký khi Rust công bố các tệp này ra bên ngoài"

Ba lớp này không phải là cùng một lớp.

## 5. Download API

Download API là lớp phơi bày HTTP ngoài cùng nhất.

Nó chỉ cam kết hai loại:

- Tải xuống tài nguyên ổn định
- Tải xuống artifact thống nhất theo `artifact_key`

Không cam kết:

- Cấu trúc trường đặc thù của provider
- Bố cục thư mục job vật lý
- Ngữ nghĩa JSON nội bộ của provider raw

Do đó:

- `/normalized-document` phơi bày ranh giới normalized
- `/normalization-report` phơi bày tài liệu bổ sung normalized
- `/artifacts/{artifact_key}` phơi bày ranh giới published artifact
- provider raw chỉ được phơi bày dưới dạng "tệp gốc" khi tải xuống artifact key tương ứng một cách tường minh, không phải dưới dạng "giao diện ngữ nghĩa thống nhất"

## 6. Vị trí mã phía Rust hiện tại

Các tệp phía Rust liên quan trực tiếp nhất đến bốn lớp này:

- `backend/rust_api/src/storage_paths.rs`
- `backend/rust_api/src/services/artifacts/mod.rs`
- `backend/rust_api/src/routes/jobs/download.rs`

Quy ước ranh giới tại ba vị trí này:

- `storage_paths.rs`
  Chịu trách nhiệm quy ước đường dẫn, artifact key, phân tích tệp và phát hiện published artifact
- `services/artifacts/*`
  Chịu trách nhiệm artifact registry, xây dựng bundle và ánh xạ đường dẫn tài nguyên
- `routes/jobs/download.rs`
  Chịu trách nhiệm thích ứng điểm vào tải xuống HTTP

Không vị trí nào trong số này được bắt đầu hiểu các trường nội bộ của provider raw.

## 7. Quy tắc phán đoán một câu

Nếu một thay đổi yêu cầu lớp tải xuống của Rust phải hiểu tên trường JSON của provider raw, thì thường là đã vượt qua ranh giới.

Hướng đúng thường là:

- Thay đổi provider: sửa adapter / chuẩn hóa
- Thay đổi published artifact: sửa `storage_paths.rs` / `services/artifacts/*`
- Thay đổi HTTP: sửa download route / facade
