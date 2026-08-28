# Hướng dẫn đóng góp cơ sở dữ liệu và lưu trữ

## Vị trí khi chạy

Rust API hiện tại sử dụng SQLite, vị trí mặc định là `DATA_ROOT/db/jobs.db`. Các đường dẫn thường gặp trong phát triển cục bộ:

- `data/db/jobs.db`: Cơ sở dữ liệu SQLite, mặc định không commit.
- `data/jobs/**`: Thư mục chạy tác vụ và sản phẩm trung gian, mặc định không commit.
- `data/uploads/**`: Tệp tải lên, mặc định không commit.
- `data/downloads/**`: Sản phẩm tải xuống, mặc định không commit.

Cấu trúc lưu trữ xem [Cấu trúc lưu trữ khi chạy](../api/storage.md).

## Ranh giới mã

Truy cập cơ sở dữ liệu được tập trung trong `backend/rust_api/src/db.rs` và các module con:

- `src/db.rs`: Facade `Db`, cung cấp khả năng lưu trữ job, artifact, event, glossary ra ngoài.
- `src/db/schema.rs`: Tạo bảng, kiểm tra schema và khởi tạo tương thích.
- `src/db/rows.rs`: Giải mã dòng cơ sở dữ liệu thành mô hình nội bộ.

Quy tắc cơ bản:

- Khi liên quan đến cơ sở dữ liệu, ưu tiên mở rộng qua facade `Db` và các module row/schema hiện có, không viết SQL trực tiếp trong tầng route hoặc presentation.
- Khi thêm trường lưu trữ mới, xác định nó thuộc bản ghi cơ sở dữ liệu, file manifest hay trạng thái tạm thời khi chạy; đừng nhét trạng thái tạm thời vào cơ sở dữ liệu một cách tùy tiện.
- Cố gắng lưu đường dẫn tương đối, artifact key, job_id và siêu dữ liệu ổn định trong cơ sở dữ liệu; đường dẫn tệp thực khi chạy được phân giải qua storage path resolver.
- Trường trả về API ưu tiên xuất từ tầng view/projection, không để frontend phụ thuộc trực tiếp vào tên cột cơ sở dữ liệu hoặc trường nội bộ `JobSnapshot`.
- Dữ liệu có thể được frontend tiêu thụ lâu dài như bảng thuật ngữ, thư viện, artifact manifest, reader metadata nên được thiết kế thành bảng/view ổn định.

## Yêu cầu tương thích

Khi sửa schema, cần xem xét:

- `jobs.db` cũ có khởi động được không.
- Job cũ có thể liệt kê, xem chi tiết, xóa không.
- Artifact cũ có thể tải xuống không.
- Glossary cũ có còn đọc hoặc di chuyển được không.
- Có ảnh hưởng đến kết xuất lại, khôi phục điểm dừng hoặc chẩn đoán thất bại không.

Không commit `data/db/jobs.db` cục bộ. Khi cần tái hiện vấn đề cơ sở dữ liệu, ưu tiên cung cấp SQL tối thiểu, fixture đã làm ẩn, job_id, phiên bản schema và các bước tái hiện.

## Kiểm tra thường dùng

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

Khi thêm hành vi cơ sở dữ liệu mới, ưu tiên bổ sung kiểm thử đơn vị tối thiểu trong `backend/rust_api/src/db.rs` hoặc service liên quan.

## Mô tả PR

PR liên quan đến cơ sở dữ liệu ít nhất nêu:

- Đã thêm hoặc sửa đổi bảng, cột, chỉ mục hay trường JSON nào.
- Có tương thích với job cũ, artifact cũ, glossary cũ không.
- Có cần di chuyển, điền lại, dọn dẹp hoặc script sửa một lần không.
- Đã bao phủ những kiểm thử cơ sở dữ liệu nào, đã xác minh bằng mẫu dữ liệu cũ chưa.
