# Hướng dẫn API OCR-only

Tài liệu này chỉ giải thích về giao diện microservice OCR-only.

Lưu ý:

- Đây là hướng dẫn chuyên biệt cho OCR-only, điểm vào API chính thức tổng thể xem [RetainPDF Backend API Entry](/home/wxyhgk/tmp/Code/doc/core/api/index.md), chuỗi chạy chính xem [CURRENT_API_MAP](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- Cách chọn provider hiện tại xem `provider` / `ocr.provider` trong yêu cầu, tập provider thực tế được hỗ trợ dựa trên kiểm tra sức khỏe và `OCR_PROVIDER_CONTRACT.md`

Mục tiêu rất rõ ràng:

- Chỉ thực hiện phân tích OCR
- Chỉ chuẩn hóa raw OCR -> `document.v1.json` / `document.v1.report.json`
- Không dịch
- Không Typst
- Không kết xuất PDF

Hiện tại, các giao diện này đã được gắn vào dịch vụ `rust_api` hiện có, nhưng về mặt logic chúng là một nhóm giao diện microservice OCR độc lập:

- `/api/v1/ocr/jobs`
- `/api/v1/ocr/jobs/{job_id}`
- `/api/v1/ocr/jobs/{job_id}/artifacts`
- `/api/v1/ocr/jobs/{job_id}/normalized-document`
- `/api/v1/ocr/jobs/{job_id}/normalization-report`
- `/api/v1/ocr/jobs/{job_id}/cancel`

Ví dụ hiện tại vẫn dùng `mineru` làm chính, nhưng đó chỉ là ví dụ provider, không có nghĩa giao thức OCR-only mặc định bị ràng buộc với MinerU.

Vị trí của luồng OCR-only này trong toàn bộ hệ thống:

1. OCR API chịu trách nhiệm thu gọn kết quả raw của provider thành `document.v1`
2. Luồng dịch đầy đủ sẽ tiếp tục được tiêu thụ bởi luồng chính `normalize -> translate -> render` ở tầng trên
3. OCR API không phải là script kiểm thử, cũng không phải điểm vào dịch/kết xuất; nó là nửa đầu của normalize trong luồng sản xuất chính thức

Quy tắc tiêu thụ chính thức của `document.v1` khi chuyển xuống hạ lưu hiện tại:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Các trường tương thích `type/sub_type/bbox/text/lines/segments` có thể giữ lại, nhưng không nên được coi là điểm vào ngữ nghĩa chính cho hạ lưu.

Giải thích về triển khai nội bộ:

- `app/router.rs` chịu trách nhiệm gắn các route `/api/v1/ocr/jobs*`
- `routes/jobs/create.rs` chịu trách nhiệm điểm vào `multipart/form-data` của OCR
- `routes/jobs/query.rs` / `routes/jobs/control.rs` / `routes/jobs/download.rs` chịu trách nhiệm truy vấn, hủy và tải xuống sản phẩm
- `routes/job_requests.rs` chịu trách nhiệm phân tích biểu mẫu OCR
- `routes/common.rs` / `routes/download_response/**` / `routes/job_helpers.rs` chịu trách nhiệm phản hồi công khai và logic hỗ trợ tải xuống cho OCR / job chung
- `services/jobs/facade.rs` chịu trách nhiệm điểm vào dịch vụ ổn định
- `services/jobs/creation.rs` và `services/jobs/creation/bundle.rs` chịu trách nhiệm xây dựng job OCR
- `services/job_validation.rs` chịu trách nhiệm kiểm tra tham số provider
- `services/job_snapshot_factory.rs` chịu trách nhiệm lắp ráp snapshot / command
- `services/job_launcher.rs` chịu trách nhiệm khởi chạy thực thi

Nếu bạn đang kiểm tra hành vi giao diện, hãy dựa trên trách nhiệm của các mô-đun đã được tách này, không phải cấu trúc tệp tập trung cũ.

## 1. Thông tin cơ bản

- Cổng dịch vụ: `41000`
- Tiền tố cơ sở: `/api/v1`
- Kiểm tra sức khỏe: `GET /health`
- Phương thức xác thực: Header `X-API-Key`
- Định dạng phản hồi: Ngoại trừ các giao diện tải xuống, mặc định trả về JSON

Ví dụ header yêu cầu:

```http
X-API-Key: your-rust-api-key
```

Gói phản hồi thống nhất:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Giải thích:

- `code=0` nghĩa là thành công
- Khác `0` nghĩa là thất bại
- `message` có thể hiển thị trực tiếp cho frontend

## 2. Trạng thái tác vụ OCR

Trạng thái tổng thể:

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Các giai đoạn phổ biến:

- `queued`
- `mineru_upload`
- `mineru_processing`
- `normalizing`
- `finished`
- `failed`
- `canceled`

Giải thích bổ sung:

- `queued`: Đã xếp hàng, chờ vị trí thực thi
- `mineru_upload`: Tệp đã được tải lên MinerU, đang chờ xử lý
- `mineru_processing`: MinerU đang phân tích
- `normalizing`: Đang tạo `document.v1`
- `finished`: OCR + chuẩn hóa hoàn tất

## 3. Kiểm tra sức khỏe

`GET /health`

Ví dụ phản hồi:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "up",
    "db": "ok",
    "queue_depth": 0,
    "running_jobs": 0,
    "provider_backends": ["mineru", "paddle"],
    "time": "2026-03-31T03:33:44Z"
  }
}
```

Mô tả các trường:

- `status`: `up` hoặc `degraded`
- `db`: SQLite có khả dụng không
- `queue_depth`: Số lượng tác vụ đang xếp hàng
- `running_jobs`: Số lượng tác vụ đang chạy
- `provider_backends`: Các OCR provider hiện đã được tích hợp

## 4. Tạo tác vụ OCR

`POST /api/v1/ocr/jobs`

Đây là giao diện `multipart/form-data`.

Bổ sung triển khai:

- Phân tích trường biểu mẫu trong `routes/job_requests.rs`
- Điểm vào tạo trong `routes/jobs/create.rs`
- Thu gọn facade trong `services/jobs/facade.rs`
- Kiểm tra provider / token / URL / timeout trước khi tạo trong `services/job_validation.rs`
- Xây dựng snapshot và khởi động job OCR do `services/jobs/creation.rs`, `services/job_snapshot_factory.rs` và `services/job_launcher.rs` phối hợp thực hiện

Hỗ trợ hai cách gửi, chọn một trong hai:

- Tải lên PDF cục bộ: `file`
- Gửi PDF từ xa: `source_url`

### Trường bắt buộc

- `provider`
  Giá trị thường dùng hiện tại: `mineru`; các provider khác tùy thuộc vào triển khai hiện tại
- `mineru_token`
  Bắt buộc khi `provider=mineru`
- `timeout_seconds`
  Tổng thời gian chờ tối đa của tác vụ OCR

### Các trường tùy chọn thường dùng

- `file`
- `source_url`
- `model_version`
- `is_ocr`
- `disable_formula`
- `disable_table`
- `language`
- `page_ranges`
- `data_id`
- `no_cache`
- `cache_tolerance`
- `extra_formats`
- `poll_interval`
- `poll_timeout`
- `job_id`

### Ví dụ với tệp cục bộ

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "model_version=vlm" \
  -F "file=@/path/to/paper.pdf"
```

### Ví dụ với URL từ xa

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "source_url=https://example.com/paper.pdf"
```

### Ví dụ phản hồi

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260331033736-c2bcda",
    "status": "queued",
    "workflow": "ocr",
    "links": {
      "self_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
      "self_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda",
      "artifacts_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "cancel_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
    }
  }
}
```

### Quy tắc kiểm tra

- `provider` phải là OCR provider được hỗ trợ bởi dịch vụ hiện tại
- Khi `provider=mineru`, `mineru_token` không được để trống
- Khi truyền `mineru_token`, nó không được là URL
- `source_url` nếu có phải bắt đầu bằng `http://` hoặc `https://`
- `timeout_seconds` phải lớn hơn `0`

## 5. Danh sách tác vụ OCR

`GET /api/v1/ocr/jobs`

Hỗ trợ tham số:

- `limit`
- `offset`
- `status`
- `provider`

Ví dụ:

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs?limit=20&offset=0&status=failed&provider=mineru"
```

Ví dụ phản hồi:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260331033736-c2bcda",
        "workflow": "ocr",
        "status": "succeeded",
        "trace_id": "ocr-20260331033736-c2bcda",
        "stage": "finished",
        "created_at": "2026-03-31T03:37:36Z",
        "updated_at": "2026-03-31T03:37:41Z",
        "detail_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
        "detail_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
      }
    ]
  }
}
```

## 6. Chi tiết tác vụ OCR

`GET /api/v1/ocr/jobs/{job_id}`

Ví dụ:

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
```

Trong chi tiết, chú ý các trường sau:

- `status`
- `stage`
- `stage_detail`
- `trace_id`
- `provider_trace_id`
- `ocr_provider_diagnostics`
- `artifacts`

Giải thích:

- `trace_id` là ID liên kết nội bộ của microservice OCR
- `provider_trace_id` là ID liên kết do provider trả về
- `ocr_provider_diagnostics` dùng để gỡ lỗi
- `ocr_provider_diagnostics.artifacts` chỉ chứa tóm tắt đường dẫn sản phẩm transport/raw provider và normalize, không mở rộng các trường nội bộ của `document.v1`

Quy ước ranh giới:

- Trạng thái raw của provider, lỗi, thông tin raw bundle được giữ trong `ocr_provider_diagnostics`
- `document.v1.json` / `document.v1.report.json` vẫn là hợp đồng chính cho hạ lưu
- Không đưa các trường private của provider trực tiếp vào `document.v1`

## 7. Lấy chỉ mục sản phẩm

`GET /api/v1/ocr/jobs/{job_id}/artifacts`

Đây là một trong những giao diện quan trọng nhất của microservice OCR.

Nó trả về chỉ mục sản phẩm mà hạ lưu thực sự quan tâm.

Các điểm chính trong phản hồi:

- `schema_version`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`
- `normalized_document`
- `normalization_report`

Ví dụ thực tế về hình dạng trường:

```json
{
  "schema_version": "document.v1",
  "provider_raw_dir": "output/20260331033736-c2bcda/ocr/unpacked",
  "provider_zip": "output/20260331033736-c2bcda/ocr/mineru_bundle.zip",
  "provider_summary_json": "output/20260331033736-c2bcda/ocr/mineru_result.json",
  "normalized_document": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalized-document"
  },
  "normalization_report": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalization-report"
  }
}
```

Ngữ nghĩa các trường:

- `provider_raw_dir`
  Thư mục raw đã giải nén của provider
- `provider_zip`
  Zip raw của provider
- `provider_summary_json`
  Kết quả trả về raw của provider
- `normalized_document`
  `document.v1.json` đã chuẩn hóa
- `normalization_report`
  Báo cáo chuẩn hóa `document.v1.report.json`

Giải thích bổ sung:

- `provider_summary_json` / `provider_zip` / `provider_raw_dir` thuộc về artifacts raw provider
- `normalized_document` / `normalization_report` thuộc về artifacts đã chuẩn hóa
- Cần giữ cả hai lớp này, lớp trước dùng để gỡ lỗi provider OCR, lớp sau dùng để gỡ lỗi `document_schema`

## 8. Tải xuống kết quả OCR đã chuẩn hóa

### Tải xuống `document.v1.json`

`GET /api/v1/ocr/jobs/{job_id}/normalized-document`

### Tải xuống `document.v1.report.json`

`GET /api/v1/ocr/jobs/{job_id}/normalization-report`

Mục đích:

- `document.v1.json` cung cấp cho luồng dịch chính để tiêu thụ trực tiếp
- `document.v1.report.json` dùng để gỡ lỗi, chẩn đoán frontend, kiểm tra schema

## 9. Hủy tác vụ OCR

`POST /api/v1/ocr/jobs/{job_id}/cancel`

Ví dụ:

```bash
curl -X POST \
  -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
```

Quy tắc hủy hiện tại:

- Nếu tác vụ vẫn đang xếp hàng, hủy ngay
- Nếu tác vụ đang ở giai đoạn provider, dừng polling/thực thi tiếp theo
- Nếu tác vụ đã vào `normalizing`, sẽ hoàn thành normalize hiện tại, sau đó loại bỏ sản phẩm chuẩn hóa và đánh dấu `canceled`

## 10. Quy ước lưu trữ thư mục hiện tại

Với tác vụ `20260331033736-c2bcda` làm ví dụ:

```text
output/20260331033736-c2bcda/
├── source/
│   └── font_test.pdf
└── ocr/
    ├── mineru_result.json
    ├── mineru_bundle.zip
    ├── unpacked/
    └── normalized/
        ├── document.v1.json
        └── document.v1.report.json
```

Giải thích:

- `source/`: PDF gốc
- `ocr/unpacked/`: Nội dung raw đã giải nén của provider
- `ocr/normalized/`: Kết quả chuẩn hóa cho luồng chính tiêu thụ

## 11. Giới hạn và ranh giới hiện tại

Hiện tại, các giao diện microservice OCR này đã có thể chạy từ `provider raw -> document.v1`.

Tuy nhiên, cần lưu ý:

- Hiện tại provider không chỉ có `mineru`, nhưng tập provider được kích hoạt ở các triển khai khác nhau có thể khác nhau
- Phía Rust đã chịu trách nhiệm về việc gửi transport, polling, tải xuống kết quả hoặc lưu raw artifacts cho MinerU / Paddle provider
- Phía Python vẫn chịu trách nhiệm chuẩn hóa raw OCR -> `document.v1.json`, và các worker translate / render sau đó
- Phía Rust còn chịu trách nhiệm:
  - HTTP API
  - Trạng thái tác vụ
  - Danh sách phân trang
  - trace_id
  - Hủy/Timeout
  - Chỉ mục artifacts

## 12. Cách tích hợp được khuyến nghị

Nếu sau này bạn muốn hệ thống chính kết nối với bộ giao diện OCR này, nên cố định theo thứ tự sau:

1. `POST /api/v1/ocr/jobs`
2. `GET /api/v1/ocr/jobs/{job_id}`
3. `GET /api/v1/ocr/jobs/{job_id}/artifacts`
4. Tải xuống:
   - `/normalized-document`
   - `/normalization-report`

Hệ thống chính không nên đọc trực tiếp JSON raw của provider.

Hệ thống chính nên ưu tiên tiêu thụ:

- `document.v1.json`
- `document.v1.report.json`
- `schema_version`
- `trace_id`
- `provider_trace_id`

Như vậy, sau này khi thay đổi OCR provider, luồng dịch và kết xuất không cần sửa cùng lúc.