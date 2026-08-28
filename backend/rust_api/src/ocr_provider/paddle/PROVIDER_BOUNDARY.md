# Ranh giới Provider Paddle

Tài liệu này chỉ nói về một điều:

Ranh giới API của provider Paddle OCR và ranh giới tài liệu thống nhất `document.v1` phải được tách biệt.

Tài liệu liên quan:

- Tóm tắt API:
  [`API_SUMMARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/API_SUMMARY.md)
- Ví dụ giao diện bất đồng bộ chính thức:
  [`AsyncParse.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md)

## 1. Ranh giới API Provider Paddle theo ba giai đoạn

Theo [AsyncParse.md](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md), giao diện bất đồng bộ của Paddle tự nhiên được chia thành ba giai đoạn:

### `submit`

- `POST /api/v2/ocr/jobs`
- Đầu vào:
  - `fileUrl` hoặc multipart `file`
  - `model`
  - `optionalPayload`
- Đầu ra:
  - `jobId`

### `poll`

- `GET /api/v2/ocr/jobs/{jobId}`
- Trạng thái:
  - `pending`
  - `running`
  - `done`
  - `failed`
- Trong quá trình chạy có thể lấy được:
  - `extractProgress.totalPages`
  - `extractProgress.extractedPages`
- Sau khi hoàn thành có thể lấy được:
  - `resultUrl.jsonUrl`

### `download_result`

- Tải xuống `jsonUrl`
- Trả về `jsonl`
- Sau khi giải nén từng dòng, mới nhận được:
  - `result.layoutParsingResults`
  - `result.dataInfo`

## 2. Những gì thuộc về lớp Provider API

Các nội dung sau đây thuộc về lớp Paddle provider client / OCR service:

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- Tham số gửi:
  - `model`
  - `optionalPayload`
  - `fileUrl`
  - multipart `file`

Các thông tin này được sử dụng để:

- Gửi tác vụ
- Thăm dò tác vụ
- Tải kết quả
- Gỡ lỗi khi thất bại

Chúng không thuộc về `document.v1`.

## 3. Những gì mới được đưa vào `document.v1`

Chỉ sau khi `download_result`, nội dung trang OCR thực tế được giải nén từ `jsonl` mới được đưa vào lớp tài liệu thống nhất:

- `layoutParsingResults`
- `dataInfo`

Sau đó adapter mới thực hiện:

1. provider raw JSON
2. Chuẩn hóa adapter
3. Tạo `document.v1.json`

Nói cách khác:

- Lớp API provider Paddle giải quyết "tác vụ chạy như thế nào"
- Lớp `document.v1` giải quyết "tài liệu cuối cùng trông ra sao"

Hai lớp này không được trộn lẫn.

## 4. Khuyến nghị triển khai hiện tại

Nếu sau này tiếp tục kết nối Paddle trong Rust hoặc Python:

- provider client chỉ chịu trách nhiệm:
  - submit
  - poll
  - download
  - giải nén jsonl
- adapter chỉ chịu trách nhiệm:
  - `layoutParsingResults/dataInfo -> document.v1`
- Luồng chính dịch/render chỉ chấp nhận:
  - `document.v1.json`

Không đưa:

- `jobId`
- `state`
- `resultUrl`
- `extractProgress`

Các trường trạng thái chạy của API provider vào `document.v1`.
