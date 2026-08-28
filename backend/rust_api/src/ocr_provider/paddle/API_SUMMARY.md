# Tổng quan API Paddle OCR

Tài liệu này chỉ trả lời một câu hỏi:

**Giao thức thực tế của API Paddle OCR bất đồng bộ mà chúng ta hiện đang tích hợp là gì.**

Không đề cập đến `document.v1`, cũng không đề cập đến render/dịch, chỉ nói về lớp provider transport.

Tài liệu liên quan:

- Ví dụ giao diện bất đồng bộ chính thức Paddle:
  [`AsyncParse.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md)
- Rust client:
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python client:
  [`backend/scripts/services/ocr_provider/paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)
- Ranh giới provider:
  [`PROVIDER_BOUNDARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/PROVIDER_BOUNDARY.md)

## 1. Bộ giao diện chúng ta hiện đang sử dụng

Hiện tại chúng ta đang kết nối chính đến giao diện tác vụ bất đồng bộ của Paddle OCR:

- `POST /api/v2/ocr/jobs`
- `GET /api/v2/ocr/jobs/{jobId}`
- Tải xuống `resultUrl.jsonUrl`

Địa chỉ cơ sở mặc định:

- `https://paddleocr.aistudio-app.com`

Điểm vào mã hiện tại:

- Rust:
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python:
  [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 2. Phương thức xác thực

Header yêu cầu:

```http
Authorization: bearer <token>
Accept: application/json
```

Phạm vi mã hiện tại:

- Biến môi trường: `RETAIN_PADDLE_API_TOKEN`
- Tệp env cục bộ: `backend/scripts/.env/paddle.env`

Lối đọc Python:

- [`get_paddle_token(...)`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 3. Giao thức ba giai đoạn

### 3.1 Gửi tác vụ

Giao diện:

- `POST /api/v2/ocr/jobs`

Hai phương thức gửi:

1. Tải lên tệp cục bộ
2. Gửi URL từ xa

Hai phương thức gọi mà chúng ta hiện đang hỗ trợ thực tế:

- Python:
  - `submit_local_file(...)`
  - `submit_remote_url(...)`
- Rust:
  - `submit_local_file(...)`
  - `submit_remote_url(...)`

Tham số đầu vào chính:

- `model`
- `optionalPayload`
- Khi dùng tệp cục bộ thì multipart `file`
- Khi dùng tệp từ xa thì JSON `fileUrl`

Trường trả về quan trọng nhất sau khi thành công:

- `data.jobId`

### 3.2 Thăm dò trạng thái

Giao diện:

- `GET /api/v2/ocr/jobs/{jobId}`

Các trường trả về mà chúng ta hiện đang quan tâm:

- `data.state`
- `data.extractProgress.totalPages`
- `data.extractProgress.extractedPages`
- `data.resultUrl.jsonUrl`
- `data.errorMsg`

Ánh xạ trạng thái thống nhất trong hệ thống hiện tại:

- `pending` -> queued
- `running` -> processing
- `done` -> succeeded
- `failed` -> failed

Triển khai tương ứng:

- [`status.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/status.rs)

### 3.3 Tải kết quả

Sau khi hoàn thành không trực tiếp lấy JSON cấu trúc, mà đi tải xuống:

- `resultUrl.jsonUrl`

URL này trả về `jsonl`, không phải một JSON đơn lẻ.

Logic giải nén hiện tại sẽ lấy từ mỗi dòng:

- `result.layoutParsingResults`
- `result.dataInfo`

Tổng hợp thành provider raw payload mà adapter sau này có thể tiêu thụ.

Triển khai tương ứng:

- Rust:
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python:
  [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 4. Các tham số chính chúng ta hiện đang truyền

### `model`

Tên mô hình mặc định hiện tại:

- `PaddleOCR-VL-1.6`

Giá trị mặc định đến từ cấu hình chung:

- [`backend/config/ocr_providers.json`](/home/wxyhgk/tmp/Code/backend/config/ocr_providers.json)

Chuẩn hóa tương thích:

- `paddleocr-vl`
- `paddle-ocr-vl`
- `paddleocr-vl-1.6`
- `paddle-ocr-vl-1.6`
- `paddleocr-vl-1.5`
- `paddle-ocr-vl-1.5`

### `optionalPayload`

Mã hiện tại sẽ xây dựng payload khác nhau dựa trên tên mô hình:

- `PaddleOCR-VL(-1.6/-1.5)` đi một bộ tham số rich-content mặc định
- `PP-StructureV3` đi một bộ tham số cấu trúc khác

Triển khai tương ứng:

- [`build_optional_payload(...)`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 5. Xử lý lỗi

Lớp transport hiện tại chủ yếu xử lý các loại lỗi sau:

- Lỗi trạng thái HTTP
- Provider trả về `errorCode != 0`
- Cấu trúc trả về không đầy đủ
- Thiếu `jobId`
- Thiếu `resultUrl.jsonUrl`
- Thăm dò quá thời gian
- Giải nén JSONL thất bại

Ánh xạ lỗi thống nhất trong Rust:

- [`errors.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/errors.rs)

## 6. Ranh giới với `document.v1`

Các trường sau đây vẫn chỉ thuộc về lớp provider transport:

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- `errorCode`
- `errorMsg`

Chỉ sau khi tải xuống và giải nén xong `jsonl`, chúng ta mới nhận được:

- `layoutParsingResults`
- `dataInfo`

Mới tiếp tục vào adapter, cuối cùng thành:

- `document.v1.json`

Không đưa trực tiếp các trường trạng thái tác vụ của provider vào lớp tài liệu thống nhất.

## 7. Phạm vi đã chạy thành công thực tế hiện tại

Hiện tại, đường dẫn thực tế trên máy cục bộ đã được xác minh:

- `workflow = book`
- `ocr.provider = paddle`
- `translation.base_url = https://api.deepseek.com/v1`
- `translation.model = deepseek-v4-flash`

Có thể chạy thành công:

- Tải lên
- Paddle OCR submit
- poll
- result download
- normalize
- translate
- render

Điều này cho thấy việc tích hợp API Paddle trong kho hiện tại không phải là giao thức trên giấy, mà đã được kết nối với luồng chính.
