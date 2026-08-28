# Cấu trúc lưu trữ

Thư mục gốc khi chạy được xác định bởi `RUST_API_DATA_ROOT`; dưới đây dùng `DATA_ROOT` để chỉ thư mục đã được phân giải này.

## Các đường dẫn chính

- `DATA_ROOT/uploads/`: Tệp tải lên.
- `DATA_ROOT/jobs/{job_id}/`: Thư mục làm việc của tác vụ.
- `DATA_ROOT/downloads/`: Bộ nhớ cache tải xuống.
- `DATA_ROOT/db/jobs.db`: Cơ sở dữ liệu SQLite.

## Thư mục tác vụ

Thư mục tác vụ chuẩn:

```text
jobs/{job_id}/
├── source/
├── ocr/
├── translated/
├── rendered/
├── artifacts/
└── logs/
```

Sản phẩm thường gặp:

- `ocr/`: Kết quả thô của Provider, kết quả giải nén, đầu vào chuẩn hóa.
- `translated/`: Sản phẩm trung gian dịch và `translation-manifest.json`.
- `rendered/`: Đầu ra kết xuất.
- `artifacts/`: Sản phẩm ổn định phát hành ra ngoài, tệp chẩn đoán và chỉ mục.
- `logs/pipeline_events.jsonl`: Tệp chính ghi sự kiện hiện tại.

Tương thích lịch sử:

- Tác vụ cũ có thể chỉ có `logs/events.jsonl`.
- Logic đọc hiện tại ưu tiên đọc `pipeline_events.jsonl`, sau đó dự phòng về tên tệp cũ.

## SQLite

SQLite đảm nhiệm chính:

- `uploads`: Tên tệp nguồn, đường dẫn lưu trữ, kích thước PDF, số trang và thời gian tải lên.
- `jobs`: Trạng thái tác vụ, giai đoạn, tiến độ, trạng thái yêu cầu/runtime, thông tin thất bại và cuối nhật ký.
- `artifacts`: Chỉ mục artifact JSON cho mỗi tác vụ.
- `job_artifact_entries`: Danh sách artifact đã chuẩn hóa, dùng cho tải xuống và hiển thị danh sách.
- `events`: Luồng sự kiện có cấu trúc.
- `glossaries`: Tài nguyên bảng thuật ngữ được đặt tên.

Phản hồi API và bản ghi cơ sở dữ liệu cố gắng sử dụng đường dẫn tương đối, khi chạy mới phân giải thành tệp thực, tránh lộ đường dẫn máy cho frontend.

## Quy ước ranh giới

- Rust chịu trách nhiệm phân bổ thư mục tác vụ và đăng ký artifacts.
- Python worker chỉ tiêu thụ đường dẫn do Rust truyền vào.
- Frontend và bên gọi ngoài không nên phụ thuộc vào bố cục nội bộ thư mục tác vụ.
- Đầu vào phát hiện sản phẩm chính thức là `GET /api/v1/jobs/{job_id}/artifacts-manifest`.
