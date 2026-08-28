# Khởi động và cấu hình cục bộ

## Backend

Khởi động từ thư mục gốc của kho lưu trữ:

```bash
cd /path/to/retain-pdf/backend/rust_api
RUST_API_BIND_HOST=0.0.0.0 \
RUST_API_DATA_ROOT=../../data \
RUST_API_SCRIPTS_DIR=../scripts \
cargo run
```

Lắng nghe mặc định:

- API đầy đủ: `http://127.0.0.1:41000`
- API gửi multipart không đồng bộ: `http://127.0.0.1:42000`

## Frontend

```bash
cd /path/to/retain-pdf/frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

Quy tắc cơ sở API frontend:

- Ưu tiên đọc `window.__FRONT_RUNTIME_CONFIG__.apiBase`.
- Nếu không có cấu hình, dự phòng về `41000` của host hiện tại.
- Docker mặc định `FRONT_API_BASE=` để trống, Nginx proxy `/api/` cùng nguồn gốc đến backend.

## Xác thực

Ngoại trừ `GET /health`, các API còn lại mặc định yêu cầu:

```http
X-API-Key: your-rust-api-key
```

`X-API-Key` là khóa danh sách trắng backend để truy cập Rust API, không phải khóa model hay OCR của DeepSeek / MinerU / Paddle.

Nguồn khóa cục bộ:

- `backend/rust_api/auth.local.json`
- Biến môi trường `RUST_API_KEYS`

Trong Docker, `api_keys` của `docker/delivery/docker/auth.local.json` phải khớp với `FRONT_X_API_KEY` trong `docker/delivery/docker/web.env`.

## Biến môi trường thường dùng

- `RUST_API_ROOT`: Thư mục gốc Rust API.
- `RUST_API_PROJECT_ROOT`: Thư mục gốc dự án.
- `RUST_API_BIND_HOST`: Địa chỉ lắng nghe, mặc định `0.0.0.0`.
- `RUST_API_PORT`: Cổng API đầy đủ, mặc định `41000`.
- `RUST_API_SIMPLE_PORT`: Cổng gửi multipart không đồng bộ, mặc định `42000`.
- `RUST_API_DATA_ROOT`: Thư mục gốc dữ liệu khi chạy.
- `RUST_API_DATA_DIR`: Bí danh cũ, chỉ sử dụng khi `RUST_API_DATA_ROOT` không được thiết lập.
- `RUST_API_SCRIPTS_DIR`: Thư mục script Python.
- `PYTHON_BIN`: Tệp thực thi Python.
- `RUST_API_UPLOAD_MAX_BYTES`: Giới hạn kích thước tải lên thông thường, `0` có nghĩa không giới hạn.
- `RUST_API_UPLOAD_MAX_PAGES`: Giới hạn số trang tải lên thông thường, `0` có nghĩa không giới hạn.
- `RUST_API_MAX_RUNNING_JOBS`: Số lượng tác vụ đồng thời tối đa.

## Vị trí cấu hình Docker

Compose thực sự đọc:

- `docker/delivery/docker/app.env`
- `docker/delivery/docker/web.env`
- `docker/delivery/docker/auth.local.json`

Không phải `docker/*.env` ở thư mục gốc kho lưu trữ.
