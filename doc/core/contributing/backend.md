# Hướng dẫn đóng góp Rust API

## Hướng phân tầng

Hướng phụ thuộc mặc định:

```text
routes -> services -> job_snapshot_factory / job_launcher / runtime_gateway / db
job_runner -> db / config / runtime state
models không phụ thuộc ngược vào routes hoặc services
```

Quy tắc cơ bản:

- `routes/*` chỉ làm HTTP adapter, phân tích yêu cầu, đầu vào sau xác thực và bao bọc phản hồi.
- `services/jobs/*` chứa logic nghiệp vụ miền tác vụ, bao gồm truy vấn, trình bày, tạo, điều khiển.
- `job_runner/*` chứa thực thi trạng thái chạy, khởi động tiến trình, hủy, kết nối tác vụ con OCR và đẩy giai đoạn.
- `models/*` chỉ chứa DTO, mô hình đầu vào/đầu ra, mô hình lưu trữ, không chứa điều phối nghiệp vụ hoặc đọc hệ thống tệp.
- Đừng vì tiện mà truyền `AppState` vào helper chỉ cần `Db`, `AppConfig`, `Path` hoặc semaphore.

Quy tắc chi tiết hơn xem [Quy ước hợp tác phát triển Rust API](../rust_api/09-quy-uoc-hop-tac-phat-trien.md).

## Thay đổi API

- Khi thêm trường API công khai, sử dụng view/model ổn định, không để lộ trường nội bộ `JobSnapshot` trực tiếp.
- Khi thêm hoặc thay đổi giao diện, sự kiện, artifact manifest, reader metadata, diagnostics, hành vi resume, cập nhật [Tài liệu API](../api/index.md) hoặc tài liệu rust_api tương ứng.
- Trường trả về API ưu tiên xuất từ tầng view/projection, không ghép JSON tạm thời trong route.
- Các giao diện frontend phụ thuộc mạnh như tải xuống, xem trước, Range, ETag, reader regions cần giữ trường ổn định và tương thích ngược.

## Kiểm tra thường dùng

```bash
cargo fmt --manifest-path backend/rust_api/Cargo.toml --check
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

## Mô tả PR

PR liên quan đến Rust API ít nhất nêu:

- Ảnh hưởng đến endpoint hoặc service nội bộ nào.
- Có thay đổi hợp đồng job, artifact, reader, library, resume, diagnostics không.
- Có cần cập nhật frontend, desktop hoặc tài liệu API không.
- Đã chạy những kiểm tra Rust nào; nếu chưa chạy, nêu lý do.
