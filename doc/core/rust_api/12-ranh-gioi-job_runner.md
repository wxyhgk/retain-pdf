# Ranh giới Job Runner

Tài liệu này chỉ trả lời một câu hỏi:

**Khi sửa `backend/rust_api/src/job_runner`, logic nên được đặt ở đâu.**

`job_runner` là lớp thực thi runtime, không phải lớp HTTP API, cũng không phải lớp view/presentation. Nó chịu trách nhiệm chạy các job đã được tạo: xếp hàng, phân phối workflow, khởi động Python worker, tiêu thụ stdout/stderr, đồng bộ trạng thái runtime, xử lý transport OCR provider, xử lý thất bại/hủy/timeout.

## Quy tắc tổng thể

`job_runner` chỉ thực hiện thực thi runtime, không làm những việc sau:

- Không phân tích HTTP request.
- Không lắp ráp API view cho bên ngoài.
- Không phụ thuộc trực tiếp vào `AppState`.
- Không hiểu chi tiết hiển thị frontend.
- Không để lộ cấu trúc private raw của provider thành published artifact.
- Không nhận toàn bộ `ProcessRuntimeDeps` trong leaf helper một cách tùy tiện.

Hướng phụ thuộc được giữ là:

```text
services/jobs -> job_runner -> worker_command / ocr_provider / db facade
```

Bên trong `job_runner`, cố gắng phân biệt theo hai loại phụ thuộc:

- `ProcessRuntimeDeps`
  Sử dụng ở tầng orchestrator, ví dụ phân phối workflow, OCR flow, điểm vào chính của process runner.
- `JobPersistDeps`
  Sử dụng ở leaf helper, khi chỉ cần `db + data_root + output_root` thì không nên lấy toàn bộ runtime deps.

## Các mô-đun cấp cao

### `mod.rs`

Vai trò:

- Facade của `job_runner`.
- Xuất điểm vào runner và một số helper runtime.
- Gắn các mô-đun con bên trong.

Không đặt:

- Logic nghiệp vụ workflow.
- Chi tiết nhánh provider.
- Quy tắc stdout.
- Triển khai tải xuống/giải nén tệp.

### `lifecycle.rs`

Vai trò:

- Xếp hàng job.
- Kiểm soát vị trí thực thi.
- Ngắn mạch cancel.
- Phân phối theo workflow tới OCR / translation / render / process runner.

Không đặt:

- Logic OCR provider cụ thể.
- Quy tắc phân tích stdout Python.
- Chi tiết trạng thái hoàn thành của từng worker.

## process runner

Điểm vào:

- `process_runner.rs`

Ranh giới:

- `process_runner.rs`
  Chỉ giữ orchestrator thực thi worker: khởi động, thu thập kết quả thực thi, phân phối timeout/completion.
- `process_runner/startup.rs`
  Khởi động worker, lưu pid, kiểm tra cancel trước khi khởi động.
- `process_runner/execution.rs`
  Chờ tiến trình, thu thập stdout/stderr, phân biệt completed/timed out.
- `process_runner/completion.rs`
  Phân loại trạng thái hoàn thành, xác định shutdown noise, áp dụng trạng thái cuối.
- `process_runner/completion_pipeline.rs`
  Tổng kết sau khi hoàn thành: gắn stdout/stderr, kiểm tra hợp đồng đầu ra worker, áp dụng trạng thái hoàn thành, chẩn đoán AI thất bại.
- `process_runner/timeout_support.rs`
  Lưu trạng thái thất bại do timeout.
- `process_runner/io_support.rs`
  Tiêu thụ stdout/stderr.
- `process_runner/result_support.rs`
  Ghi kết quả process trở lại job.
- `process_runner/failure_ai_diagnosis.rs`
  Chẩn đoán AI thất bại.

Quy tắc:

- Khi thêm kiểm tra sản phẩm bắt buộc sau khi worker thành công, đặt vào `process_contract.rs`, được gọi bởi `completion_pipeline.rs`.
- Khi thêm phân tích nhãn stdout mới, không đặt vào process runner, đặt vào `stdout_parser/*`.
- Khi thêm tham số lệnh Python worker, không đặt vào process runner, đặt vào `worker_command/*`.

## workflow flow

### `translation_flow.rs` + `translation_flow_*.rs`

Vai trò:

- Điều phối workflow book / translate-only.
- Tạo job con OCR và đồng bộ trạng thái task cha.
- Sau OCR hoàn thành, chuyển sang translation.
- Sau translation hoàn thành, theo `PipelinePlan` quyết định có chuyển sang render hay không.

Ranh giới:

- `translation_flow.rs`
  Orchestrator.
- `translation_flow_child.rs`
  Đọc upload source, đưa task cha vào OCR submitting, tạo OCR child.
- `translation_flow_artifacts.rs`
  Chuẩn bị đầu vào dịch từ các OCR artifacts hiện có.
- `translation_flow_stage.rs`
  Gọi stage translation/render và sự kiện `ocr_child_finished`.
- `translation_flow_executor.rs`
  Thực thi plan sau translation.
- `translation_flow_support.rs`
  Xác định trạng thái cuối của OCR child và thu gọn task cha.

Quy tắc:

- Không đọc/ghi trực tiếp artifact details trong `translation_flow.rs`; việc tái sử dụng artifacts đặt vào `translation_flow_artifacts.rs`.
- Không ghép lệnh Python tại đây; việc xây dựng lệnh đặt trong `worker_command/*`.

### `render_flow.rs` + `render_flow_artifacts.rs`

Vai trò:

- Điều phối workflow render-only.
- Chuẩn bị đầu vào render từ các translation artifacts hiện có.

Quy tắc:

- `render_flow.rs` chỉ chịu trách nhiệm xây dựng lệnh render, thiết lập trạng thái running/rendering, gọi process runner.
- Đọc job nguồn, sao chép translation inputs, kiểm tra translations dir/source pdf đặt vào `render_flow_artifacts.rs`.

## OCR flow

Điểm vào:

- `ocr_flow/mod.rs`

Ranh giới:

- `ocr_flow/mod.rs`
  Orchestrator job con OCR: khởi tạo trạng thái, chuẩn bị workspace, thực thi provider transport, chuyển vào worker normalize.
- `ocr_flow/provider_transport.rs`
  Phân phối tải lên cục bộ/URL từ xa, MinerU/Paddle provider.
- `ocr_flow/workspace.rs`
  Chuẩn bị đường dẫn và thư mục OCR job.
- `ocr_flow/transport.rs`
  Chuẩn bị source pdf và phục hồi source từ xa.
- `ocr_flow/support.rs`
  Lưu OCR job, phản chiếu trạng thái OCR của task cha, xử lý thất bại transport/source-pdf.
- `ocr_flow/status.rs`
  Ánh xạ trạng thái provider sang stage/detail/progress của job.
- `ocr_flow/polling.rs`
  Chờ poll chung, timeout, kiểm tra cancel.

### MinerU

- `ocr_flow/mineru.rs`
  Điểm vào gửi MinerU, gọi provider cho cả batch local và task từ xa.
- `ocr_flow/mineru_polling.rs`
  Vòng lặp poll batch/task MinerU.
- `ocr_flow/mineru_status_handlers.rs`
  Xử lý trạng thái batch/task MinerU, sau khi done thì lưu provider result và chuyển sang tải bundle.
- `ocr_flow/mineru_retry.rs`
  Chiến lược retry query MinerU, nhận diện lỗi có thể retry.
- `ocr_flow/bundle_download.rs`
  Tổng điều phối sau khi bundle MinerU thành công: chờ readiness, retry tải xuống, giải nén, xuất markdown.
- `ocr_flow/bundle_ready_wait.rs`
  Chờ probe readiness bundle và fallback degraded.
- `ocr_flow/bundle_download_retry.rs`
  Retry tải xuống bundle thực tế.
- `ocr_flow/bundle_events.rs`
  Sự kiện retry/degraded bundle và đánh dấu trạng thái `ocr_result_ready`.
- `ocr_flow/bundle_retry_policy.rs`
  Chiến lược thuần túy cho bundle retry/fallback/timeout.
- `ocr_flow/markdown_bundle.rs`
  Xuất markdown raw provider.

Quy tắc:

- Các trường giao thức API provider ưu tiên đặt trong `ocr_provider/mineru/*`.
- Cập nhật trạng thái job đặt trong `ocr_flow/status.rs` hoặc status handler.
- Xác định retry đặt trong retry/policy module, không nhét vào polling loop.
- Sự kiện tải bundle thống nhất qua `bundle_events.rs`.

### Paddle

- `ocr_flow/paddle.rs`
  Luồng chính submit/poll/download của Paddle.
- `ocr_flow/paddle_payload.rs`
  Xây dựng optional payload của Paddle.
- `ocr_flow/paddle_errors.rs`
  Gắn lỗi provider Paddle vào job.
- `ocr_flow/paddle_markdown.rs`
  Materialize artifact markdown Paddle.

Quy tắc:

- Tham số yêu cầu Paddle không được viết rải rác ngoài transport orchestrator, thống nhất trong `paddle_payload.rs`.
- Ánh xạ lỗi Paddle không được phân tán trong polling, thống nhất qua `paddle_errors.rs`.

## stdout parser

Điểm vào:

- `stdout_parser/mod.rs`

Ranh giới:

- `labels.rs`
  Hằng số nhãn stdout.
- `state.rs`
  Helper trạng thái chia sẻ của stdout parser.
- `artifact_fields.rs`
  Ánh xạ nhãn stdout / key artifact có cấu trúc sang trường artifact nội bộ.
- `artifact_rules.rs`
  Ghi các dòng artifact và sự kiện JSON `artifact_published` vào job artifacts.
- `metric_rules.rs`
  `pages processed`, `translated items`, các chỉ số thời gian.
- `stage_rules.rs`
  Thay đổi stage do dòng stdout kích hoạt.
- `failure.rs`
  Quy kết thất bại provider.

Quy tắc:

- Module artifact chỉ ghi artifact, không thúc đẩy stage.
- Thúc đẩy stage chỉ đặt trong `stage_rules.rs`.
- Metric không nhét vào artifact.
- Nhãn stdout mới phải xem xét thuộc về artifact, metric, stage hay failure.

## Các mô-đun hợp đồng

### `process_contract.rs`

Vai trò:

- Xác định loại worker dựa trên worker command.
- Kiểm tra các sản phẩm bắt buộc phải có sau khi worker thoát thành công.

Quy tắc:

- Worker Python thoát thành công nhưng thiếu sản phẩm chính thì phải thất bại tại đây.
- Không viết tay kiểm tra sản phẩm cho từng stage trong luồng chính process runner.

### `stage_contract.rs`

Vai trò:

- Phân tích từ các job artifacts hiện có để lấy đầu vào cần thiết cho OCR -> translation, translation -> render.
- Kiểm tra các điều kiện sẵn sàng stage như source pdf, normalized document, translations manifest.

Quy tắc:

- Workflow retry, resume, from-artifacts phải tái sử dụng phân tích ready input ở đây.
- Không phân tích đường dẫn artifact trong các flow một cách rời rạc.

### `artifact_requirements.rs`

Vai trò:

- Phân tích đường dẫn artifact chia sẻ và kiểm tra sự tồn tại của file/dir.

Quy tắc:

- Chỉ làm kiểm tra đường dẫn và tồn tại.
- Không hiểu workflow cụ thể.

## Khi nào không nên tiếp tục tách

Không tách vì số dòng trong các trường hợp:

- Module đã có một nhiệm vụ thuần túy, ví dụ phân tích page range, chiến lược retry.
- Sau khi tách, chuỗi gọi trở nên khó đọc hơn trước.
- Cần phải đưa trait/generic vào chỉ để loại bỏ một chút trùng lặp.
- Hai vòng poll trông giống nhau nhưng tham số, thông báo lỗi, xử lý trạng thái khác nhau.

Ưu tiên tách khi:

- Cùng một file chứa cả orchestration và chi tiết giao thức provider.
- Cùng một hàm làm đồng thời kiểm tra trạng thái, ghi sự kiện, phân tích đường dẫn, điều khiển tiến trình.
- Một leaf helper nhận toàn bộ `ProcessRuntimeDeps` chỉ để lấy một đường dẫn hoặc ghi db.
- Artifact, stage, metric, failure rules bị trộn lẫn.

## Kiểm tra tối thiểu

Sau khi sửa `job_runner`, ít nhất chạy:

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml ocr_flow -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml stdout_parser -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml process_runner -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml
```

Nếu chỉ sửa một module nhỏ, có thể chạy test với filter tương ứng, nhưng trước khi kết thúc nên chạy toàn bộ test Rust API.