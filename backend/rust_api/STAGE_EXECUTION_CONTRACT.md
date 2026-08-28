# Hợp đồng thực thi Stage

Tài liệu này chỉ trả lời một câu hỏi:

**`job_runner` hiện đang điều khiển các stage như thế nào, những ngữ nghĩa nào là hợp đồng ổn định.**

Tài liệu liên quan:

- Ranh giới kiến trúc tổng thể:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- Chuỗi chính đang chạy:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- Ranh giới OCR provider:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)

## 1. Mục tiêu

`job_runner` chịu trách nhiệm kết nối máy trạng thái job bên Rust và chuỗi thực thi worker Python.

Nó không chịu trách nhiệm:

- Phân tích yêu cầu HTTP
- Lắp ráp view job
- Định nghĩa chi tiết vận chuyển OCR provider

Nó chịu trách nhiệm:

- Chọn chuỗi thực thi
- Viết stage spec
- Khởi động worker Python
- Tiêu thụ stdout/stderr
- Cập nhật trạng thái runtime job
- Xử lý timeout / cancel / failure

## 2. Họ stage hiện tại

Chuỗi chạy hiện tại được chia thành 4 loại:

1. Vận chuyển OCR provider
2. `normalize`
3. `translate`
4. `render`

Spec chính thức tương ứng:

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`

`provider.stage.v1` vẫn được giữ cho wrapper `run_provider_case.py` legacy/local; vận chuyển OCR provider
trong chuỗi chính hiện tại được Rust `ocr_flow` điều phối trực tiếp, sau đó chỉ giao normalize cho worker Python.

## 3. Ánh xạ workflow sang chuỗi stage

### 3.1 `workflow=book`

Luồng:

```text
Job con OCR
  -> vận chuyển provider
  -> normalize
Job cha
  -> translate
  -> render
```

Vận chuyển provider ở đây là logic runtime Rust, không phải `run_provider_case.py`.

Mã điểm vào:

- [translation_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)

### 3.2 `workflow=translate`

Luồng:

```text
Job con OCR
  -> vận chuyển provider
  -> normalize
Job cha
  -> translate
```

Không đi vào render.

### 3.3 `workflow=render`

Luồng:

```text
Tái sử dụng source.artifact_job_id
  -> render
```

Mã điểm vào:

- [render_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/render_flow.rs)

### 3.4 `workflow=ocr`

Luồng:

```text
vận chuyển provider
  -> normalize
```

Mã điểm vào:

- [ocr_flow/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)

Ràng buộc bổ sung hiện tại:

- `ocr_flow/mod.rs`
  là bộ điều phối duy nhất của luồng con OCR
- Chỉ nó có thể:
  - Chọn nhánh vận chuyển local upload / remote url
  - Lắp ráp client provider và phân phối đến helper vận chuyển cụ thể
  - Lắp ráp lệnh stage normalize
  - Giao luồng con OCR lại cho `process_runner` chung
- Các mô-đun con khác trong `ocr_flow/*` chỉ chịu trách nhiệm:
  - Vận chuyển provider
  - Chuẩn bị workspace/path
  - Xử lý kết quả/artifact thô provider
  - Khôi phục pdf nguồn
  - Các helper lá để xử lý tệp đã tải lên hoặc pdf nguồn từ xa

## 4. Mô-đun chính runtime

### 4.1 `lifecycle`

Tệp:

- [lifecycle.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)

Trách nhiệm:

- Nhiệm vụ vào hàng đợi
- Lấy vị trí thực thi
- Cancel ngắn mạch và lưu trữ queued
- Phân phối theo workflow đến:
  - `ocr_flow`
  - `translation_flow`
  - `render_flow`

Quy ước hiện tại:

- `lifecycle.rs` chỉ giữ điều phối tầng trên cùng của runner
- `should_skip_job_execution(...)`
  chịu trách nhiệm ngắn mạch cancel / canceled
- `persist_queued_job(...)`
  chịu trách nhiệm lưu trữ trạng thái queued
- `dispatch_workflow(...)`
  chịu trách nhiệm phân phối workflow -> runner flow
- `persist_failed_job(...)`
  chịu trách nhiệm kết thúc thất bại
- `clear_job_cancel_request(...)`
  chịu trách nhiệm dọn dẹp thống nhất cancel registry

### 4.2 Stage command factory

Tệp:

- [worker_command.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
- [worker_command/stage_specs.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command/stage_specs.rs)
- [worker_command/entrypoints.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command/entrypoints.rs)

Trách nhiệm:

- Viết stage spec
- Chọn điểm vào Python
- Tạo lệnh cuối cùng

### 4.3 `worker_process`

Tệp:

- [worker_process.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

Trách nhiệm:

- Khởi động worker Python
- Tiêm env
- Kết thúc cây tiến trình

### 4.4 `process_runner`

Tệp:

- [process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [process_runner/startup.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [process_runner/execution.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [process_runner/result_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/result_support.rs)
- [process_runner/timeout_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/timeout_support.rs)
- [process_runner/failure_ai_diagnosis.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/failure_ai_diagnosis.rs)
- [process_runner/io_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/io_support.rs)

Trách nhiệm:

- `process_runner.rs`
  chỉ giữ bộ điều phối
- `startup.rs`
  khởi động worker, ghi trạng thái running ban đầu
- `execution.rs`
  đọc stdout/stderr, chờ tiến trình kết thúc, xử lý nhánh timeout
- `result_support.rs`
  điền `ProcessResult`
- `timeout_support.rs`
  trạng thái và lưu trữ timeout
- `failure_ai_diagnosis.rs`
  chẩn đoán AI failure
- `io_support.rs`
  chiến lược tiêu thụ stdout/stderr; helper lá chỉ lấy `JobPersistDeps + canceled_jobs`

### 4.5 `runtime_state`

Tệp:

- [runtime_state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/runtime_state.rs)

Trách nhiệm:

- Duy trì các thay đổi runtime của artifacts/runtime/failure

## 5. Ngữ nghĩa trạng thái runtime

Trạng thái job hiện tại:

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Stage phổ biến hiện tại:

- `queued`
- `ocr_submitting`
- `ocr_upload`
- `mineru_processing`
- `normalizing`
- `translating`
- `rendering`
- `finished`
- `failed`
- `canceled`

Quy tắc:

- `status` là phân loại trạng thái cuối cùng
- `stage` là giai đoạn thực thi hiện tại
- `stage_detail` là mô tả runtime dành cho người đọc

Không nhồi nhét logic nghiệp vụ vào văn bản `stage`.

## 6. Hợp đồng stdout

Worker Python gửi lại thông tin chạy qua stdout.

Các nhãn quan trọng hiện tại trong:

- [stdout_parser/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/mod.rs)

Ví dụ:

- `job root`
- `source pdf`
- `layout json`
- `normalized document json`
- `normalization report json`
- `translations dir`
- `output pdf`
- `summary`

Quy tắc:

- Khi thêm sản phẩm worker mà Rust cần tiêu thụ, ưu tiên đi theo hợp đồng nhãn stdout
- Đừng để lớp route/service đoán trực tiếp thư mục đầu ra của Python

## 7. Hợp đồng timeout / cancel

### 7.1 cancel

Cancel hiện tại có hai tầng:

- cancel registry
- kết thúc tiến trình

Mô-đun:

- [cancel_registry.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/cancel_registry.rs)
- [worker_process.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

Ngữ nghĩa:

- Sau khi job được đánh dấu cancel, runner sẽ cố gắng kết thúc cây tiến trình
- Giai đoạn `normalizing` cho phép tiếp tục có giới hạn để kết thúc

### 7.2 timeout

Ngữ nghĩa:

- Số giây timeout đến từ `request_payload.runtime.timeout_seconds`
- Sau khi timeout, runner chịu trách nhiệm kill worker
- Sau đó đánh dấu job là `failed`

Chi tiết hiện tại:

- `normalizing` -> `normalization timeout`
- Các giai đoạn vận chuyển provider khác -> `provider timeout`

## 8. Xác định thành công và thất bại

`process_runner` hiện phân loại kết quả tiến trình thành 4 loại:

- `Canceled`
- `Succeeded`
- `SucceededWithShutdownNoise`
- `Failed`

Nghĩa là:

- Mã thoát tiến trình không phải tiêu chuẩn duy nhất
- Nếu artifacts đã được ghi đầy đủ, một số nhiễu shutdown Python sẽ được coi là thành công

Các quy tắc này tập trung ở:

- [process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)

## 9. Hợp đồng artifacts

Các trường artifacts cốt lõi mà `job_runner` hiện phụ thuộc bao gồm:

- `job_root`
- `source_pdf`
- `layout_json`
- `normalized_document_json`
- `normalization_report_json`
- `translations_dir`
- `output_pdf`
- `summary`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`

Quy tắc:

- Khi chuyển stage, cố gắng truyền đầu vào hạ lưu qua artifacts
- Đừng để hạ lưu đoán lại đường dẫn
- Việc kiểm tra readiness bên Rust tập trung ở:
  - [stage_contract.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stage_contract.rs)
  - [process_contract.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_contract.rs)
- `stage_contract.rs` quyết định có thể tiếp tục qua các stage không:
  - OCR -> translate cần `source_pdf`、`normalized_document_json`
  - translate -> render cần `source_pdf`、`translations_dir`、`translation-manifest.json`
- `process_contract.rs` quyết định worker Python thoát thành công có thực sự thành công không:
  - Worker normalize cần `normalized_document_json`、`normalization_report_json`
  - Worker translate cần `translations_dir`、`translation-manifest.json`、`summary`
  - Worker render cần `output_pdf`、`summary`
- API chi tiết job sẽ hiển thị các kiểm tra readiness này qua `data.contracts` để frontend hiển thị và gỡ lỗi.
- API sự kiện job sẽ đính kèm cấu trúc readiness tương tự trong `payload.contracts` của các sự kiện `failure_classified` / `job_terminal` ở trạng thái thất bại, tránh việc frontend phải yêu cầu thêm chi tiết khi hiển thị thất bại.
- Khi worker Python phát hành artifact, nên ưu tiên xuất JSON stdout có cấu trúc:
  `{"event_type":"artifact_published","payload":{"artifact_key":"...","path":"..."}}`.
  Rust `stdout_parser` sẽ tiêu thụ sự kiện có cấu trúc này và cập nhật `JobArtifacts`; các nhãn `xxx: path` cũ vẫn được giữ làm đường dẫn tương thích.

## 10. Ranh giới đỏ cho cộng tác nhóm

### Ranh giới đỏ 1

Khi thêm trường stage mới, trước tiên sửa:

- `commands/stage_specs.rs`

Đừng sửa tham số route trước.

### Ranh giới đỏ 2

Khi thêm điểm vào worker mới, trước tiên sửa:

- `commands/entrypoints.rs`

Đừng ghép lệnh tạm trong `process_runner`.

### Ranh giới đỏ 3

Khi thêm ngữ nghĩa cancel/timeout mới, ưu tiên sửa:

- `cancel_registry.rs`
- `worker_process.rs`
- `process_runner.rs`

Đừng tự bổ sung trong `translation_flow` / `render_flow`.

### Ranh giới đỏ 4

Khi thêm ngữ nghĩa đường dẫn artifacts mới:

- Đầu ra worker -> hợp đồng nhãn stdout
- Tiêu thụ Rust -> `stdout_parser` + `runtime_state`

Đừng phân tích trực tiếp cấu trúc thư mục Python ở tầng route/service.

## 11. Đường dẫn thay đổi được đề xuất

### Tình huống 1: Thêm một stage Python mới

Thứ tự:

1. `commands/stage_specs.rs`
2. `commands/entrypoints.rs`
3. Mô-đun flow tương ứng
4. `stdout_parser`
5. `runtime_state`

### Tình huống 2: Điều chỉnh trường bàn giao OCR child -> parent

Thứ tự:

1. `ocr_flow/mod.rs`
2. `translation_flow.rs`
3. `runtime_state.rs`

### Tình huống 3: Điều chỉnh nguồn đầu vào của render-only

Thứ tự:

1. `render_flow.rs`
2. `storage_paths`
3. Bổ sung presentation summary nếu cần

## 12. Ràng buộc một câu

Ranh giới ổn định của `job_runner` nên là:

- Thượng nguồn cung cấp `JobRuntimeState`
- Nó điều khiển worker Python qua spec
- Nó thu hồi kết quả chạy qua stdout/artifacts
- Nó cập nhật trạng thái job trở lại tầng lưu trữ Rust

Ngoài những trách nhiệm này, không nên tiếp tục chất thêm vào đây.
