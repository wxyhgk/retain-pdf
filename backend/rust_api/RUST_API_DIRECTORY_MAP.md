# Rust API Directory Map

Tài liệu này chỉ trả lời một câu hỏi:

**Hiện tại khi muốn sửa `rust_api`, nên vào thư mục nào trước.**

## Các điểm vào phổ biến nhất

- Sửa HTTP interface:
  [`src/routes`](src/routes)
- Sửa điều phối use case jobs:
  [`src/services/jobs`](src/services/jobs)
- Sửa domain thư viện (tài liệu / yêu thích / truy xuất / tài sản / hội thoại / bộ sưu tập):
  [`src/services/library_api.rs`](src/services/library_api.rs) +
  [`src/services/library`](src/services/library)
- Sửa chuỗi chạy worker:
  [`src/job_runner`](src/job_runner)
- Sửa phân phối và điều chỉnh OCR provider:
  [`src/ocr_provider`](src/ocr_provider)
- Sửa tham số chạy backend, provider timeout/retry, đường dẫn và cấu hình xác thực:
  [`src/config`](src/config)
- Sửa lệnh vào Python worker hoặc stage spec:
  [`src/worker_command`](src/worker_command)

## Bản đồ thư mục

### `src/app`

- Vai trò:
  Khởi động ứng dụng, lắp ráp `AppState`, gắn router, khởi động dịch vụ.
- Điều kiện vào:
  Chỉ vào đây khi sửa tài nguyên toàn cục, logic khởi động, gắn route.
- Tệp chính:
  - [`src/app/state.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/state.rs)
    `AppState` và khởi tạo tài nguyên toàn cục.
  - [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
    Điểm gắn tổng hợp router axum.
  - [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
    Gốc tổ hợp jobs facade. Nơi này chịu trách nhiệm biến `AppState` thành `JobsFacade`, `routes` không còn trực tiếp chạm `job_runner`.

### `src/config.rs` + `src/config/*`

- Vai trò:
  Điểm vào cấu hình runtime. `config.rs` là facade tương thích, tiếp tục lộ các trường `AppConfig` cũ; `src/config/*` là phân nhóm cấu hình thực tế.
- Điều kiện vào:
  Vào đây khi sửa env, tham số triển khai, provider timeout/retry, đường dẫn, auth, giới hạn upload, tham số runtime worker.
- Các ranh giới con hiện tại:
  - `config.rs`
    Lớp tương thích `AppConfig`; `from_env()` / `from_desktop()` chỉ phân tích nguồn, thống nhất lắp ráp qua `AppConfigParts` nội bộ. Không tiếp tục chất phân tích env cụ thể vào đây.
  - `config/env_vars.rs`
    Helper đọc env; xử lý thống nhất chuỗi rỗng và fallback số nguyên dương.
  - `config/paths.rs`
    Project root, rust_api root, data root, scripts, đường dẫn jobs/uploads/downloads và tạo thư mục runtime.
  - `config/auth.rs`
    `auth.local.json`, `RUST_API_KEYS`, `RUST_API_MAX_RUNNING_JOBS`, `RUST_API_SIMPLE_PORT`.
  - `config/server.rs`
    `PYTHON_BIN`, `RUST_API_BIND_HOST`, `RUST_API_PORT`.
  - `config/upload.rs`
    `RUST_API_UPLOAD_MAX_BYTES`, `RUST_API_UPLOAD_MAX_PAGES`.
  - `config/provider.rs`
    Base URL, HTTP timeout, retry, ngưỡng upload provider và giới hạn input image Paddle cho MinerU / Paddle / DeepSeek.
  - `config/job_runner.rs`
    Poll queue, worker terminate grace, AI failure diagnosis timeout, khoảng chờ đồng bộ bundle.
- Quy tắc:
  Khi thêm tham số có thể điều chỉnh theo triển khai, ưu tiên đưa vào các mô-đun con trên; chỉ khi cần giữ tương thích với caller hiện có mới lộ trường trên `AppConfig`.
  Các hằng số giao thức như tên stage, artifact key, API path, schema version, stdout label không được cấu hình hóa.

### `src/routes`

- Vai trò:
  Trích xuất tham số HTTP, chuyển tiếp yêu cầu, đóng gói phản hồi thống nhất.
- Không nên làm:
  Không trực tiếp chạm `job_runner`, không tự ghép logic nghiệp vụ cấp thấp, không `state.db` / service nội bộ,
  models chỉ qua `models::api` / `domain` / `request`.

#### `src/routes/jobs`

- `json_response/`
  Cổng ra phản hồi cho truy vấn JSON jobs / detail / cancel / retry, chỉ gọi `JobsFacade`
  và đóng gói `ApiResponse`.
- `create.rs` / `download.rs` / `query.rs` / `control.rs` / `translation_debug.rs`
  Điểm vào axum route thực tế.

#### Mặt `src/routes` library

- `library.rs`
  API chiếu books; chỉ gọi `library_api`; cover/thumbnail đi qua `download_response`.
- `library_data.rs`
  documents / media / translate-from-library / favorites / search; chỉ gọi `library_api`.
- `library_extras.rs`
  assets / conversations; giải nén multipart giữ ở route, nghiệp vụ vào `library_api`.
- `collections.rs`
  CRUD bộ sưu tập và quan hệ thành viên; chỉ gọi `library_api`.
- deps: `routes/common.rs::build_library_route_deps` (`LibraryDeps` + `JobsFacade`).

#### `src/routes/download_response`

- Vai trò:
  Cổng ra phản hồi cho tải xuống tệp, markdown, preview, cover, thumbnail.
- Người dùng:
  `routes/jobs/*` và `routes/library.rs` đều có thể gọi nó; các mô-đun route không được tái sử dụng helper private lẫn nhau.

### `src/services`

- Vai trò:
  Điểm vào application service và triển khai nghiệp vụ nội bộ.

#### `src/services/jobs/facade`

- Vai trò:
  Cung cấp điểm vào jobs thống nhất cho route.
- `command/*`
  Các khả năng dạng lệnh như tạo, hủy, bundle đồng bộ.
- `query/*`
  Các khả năng dạng truy vấn như danh sách, chi tiết, tải xuống, artifacts, translation debug.

#### `src/services/library_api.rs` + `src/services/library/*`

- Vai trò:
  Cung cấp điểm vào **Library** thống nhất cho route (ngang hàng với `JobsFacade` / `glossary_api`).
- Điều kiện vào:
  Vào đây khi sửa tài liệu, điểm vào dịch từ thư viện, yêu thích, tìm kiếm toàn văn, tài sản, hội thoại, nghiệp vụ bộ sưu tập;
  **không** viết logic trở lại `routes/library_*`.
- Mô-đun con:
  - `books.rs` — danh sách/chi tiết/xóa library books (ủy quyền chiếu cho `book_projection`)
  - `documents.rs` / `media.rs` — CRUD tài liệu và source.pdf/cover/thumbnail
  - `translate.rs` — gắn upload tài liệu rồi gọi `JobsFacade::create_submission`
  - `favorites.rs` / `search.rs` — yêu thích anchor và FTS blocks
  - `assets.rs` / `conversations.rs` / `collections.rs` — tài sản, hội thoại, bộ sưu tập
- Quy tắc:
  route chỉ import `library_api::`; `derived_artifacts` chỉ được phép dùng trong service nội bộ.

#### `src/services/jobs/creation`

- `submit.rs`
  Tạo và khởi động tác vụ.
- `bundle.rs`
  Chạy đồng bộ toàn bộ chuỗi và tạo bundle.
- `prepare.rs`
  Phân tích đầu vào, kiểm tra tồn tại, tiền xác thực, chỉ tạo đầu vào `Prepared*`, không tạo `JobSnapshot`.
- `job_builders.rs`
  Điều phối snapshot cấp workflow; chỉ tiêu thụ đầu vào `Prepared*` và gọi snapshot factory, không tự làm tiền xác thực.
- `upload.rs`
  Lưu trữ upload và đọc bản ghi upload.
- `context.rs`
  deps rõ ràng phía creation.

#### `src/services/jobs/presentation`

- Vai trò:
  Lắp ráp view bên ngoài, đọc tóm tắt, chiếu phản hồi.
- Điều kiện vào:
  Vào đây khi sửa cấu trúc trả về API, trường tóm tắt, hiển thị làm sạch.

#### Các điểm vào service khác

- [`src/services/upload_api.rs`](src/services/upload_api.rs)
  Điểm vào interface upload.
- [`src/services/glossary_api.rs`](src/services/glossary_api.rs)
  Điểm vào interface bảng thuật ngữ.
- [`src/services/library_api.rs`](src/services/library_api.rs)
  Điểm vào interface thư viện (xem trên).
- [`src/services/job_snapshot_factory.rs`](src/services/job_snapshot_factory.rs)
  Ranh giới xây dựng job snapshot/command.
- [`src/services/job_launcher.rs`](src/services/job_launcher.rs)
  Ranh giới lưu trữ và khởi động job.
- [`src/services/runtime_gateway.rs`](src/services/runtime_gateway.rs)
  Lớp thu gọn cho services truy cập khả năng runtime.

### `src/worker_command.rs` + `src/worker_command/*`

- Vai trò:
  Lệnh Python worker, script vào worker và xây dựng tệp stage spec.
- Điều kiện vào:
  Vào đây khi sửa trường spec `normalize/translate/render/provider`, entrypoint Python, tham số dòng lệnh.
- Ranh giới:
  Đây là lớp hợp đồng trung lập mà `services` và `job_runner` cùng phụ thuộc, không thuộc `services`, tránh phụ thuộc ngược `job_runner -> services`.
- Các ranh giới con hiện tại:
  - `worker_command.rs`
    Facade bên ngoài `build_ocr_command` / `build_translate_only_command` / `build_render_only_command` / `build_normalize_ocr_command`.
  - `worker_command/stage_specs.rs`
    Viết JSON stage spec.
  - `worker_command/entrypoints.rs`
    Chọn script vào Python và ghép tham số vào.
  - `worker_command/command_builder.rs`
    Chi tiết ghép dòng lệnh.

### `src/job_runner`

- Vai trò:
  Xếp hàng tác vụ, khởi động worker, tiêu thụ stdout/stderr, gán nguyên nhân thất bại, hủy, timeout.
- Nhận định nhanh:
  Vào đây khi sửa thứ tự thực thi stage, vị trí đồng thời, điều khiển tiến trình, đồng bộ trạng thái runtime.
- Ranh giới chi tiết:
   [`doc/core/rust_api/12-ranh-gioi-job-runner.md`](/home/wxyhgk/tmp/Code/doc/core/rust_api/12-ranh-gioi-job-runner.md)
- Bản đồ thư mục hiện tại:
  - `mod.rs`
    Facade runner, deps công khai, xuất bên ngoài; `ProcessRuntimeDeps` ở đây chỉ dùng cho orchestrator, `JobPersistDeps` là ranh giới tài nguyên lưu trữ cho helper lá.
  - `lifecycle.rs`
    Xếp hàng tác vụ, vị trí thực thi, phân phối workflow.
  - `process_runner.rs` + `process_runner/*`
    Bộ thực thi worker thực tế; `process_runner.rs` chỉ giữ orchestrator và truyền phụ thuộc xuống qua accessor hẹp của `ProcessRuntimeDeps`. `startup.rs` chịu trách nhiệm khởi động worker và lưu pid, `execution.rs` chịu trách nhiệm chờ tiến trình và phân luồng timeout, `completion.rs` chịu trách nhiệm phân loại trạng thái hoàn thành và xác định shutdown-noise, `timeout_support.rs` chịu trách nhiệm lưu trạng thái timeout, `failure_ai_diagnosis.rs` chịu trách nhiệm chẩn đoán AI thất bại, `io_support.rs` chịu trách nhiệm tiêu thụ stdout/stderr. Helper lá chỉ nhận `JobPersistDeps`, cancel handle hoặc `WorkerProcessRuntimeConfig` dạng phụ thuộc hẹp.
  - `translation_flow.rs` + `translation_flow_*.rs`
    Điều phối tác vụ cha dịch/kết xuất sau OCR; `translation_flow.rs` giữ orchestrator, `translation_flow_child.rs` chịu trách nhiệm đọc upload source, đưa tác vụ cha vào `ocr_submitting`, tạo OCR child, `translation_flow_stage.rs` chịu trách nhiệm chuẩn bị stage translate/render và sự kiện `ocr_child_finished`, `translation_flow_support.rs` chịu trách nhiệm xác định trạng thái cuối OCR và trích xuất đầu vào dịch.
  - `ocr_flow/*`
    Chuỗi thực thi job con OCR, provider polling/tải xuống/materialize markdown; trong đó `ocr_flow/mod.rs` là orchestrator, `ocr_flow/support.rs` chịu trách nhiệm lưu job OCR, phản chiếu trạng thái OCR parent, xử lý thất bại transport/source-pdf và `sync_parent_with_ocr_child(...)`, `workspace.rs` chỉ quản lý đường dẫn và thư mục, `polling.rs` chỉ quản lý chờ poll và kiểm tra cancel.
  - `stdout_parser/*`
    Phân tích quy tắc dòng stdout; `mod.rs` là facade, `labels.rs` quản lý hằng số nhãn stdout, `state.rs` quản lý trạng thái chia sẻ phân tích, `stage_rules.rs` / `artifact_rules.rs` quản lý quy tắc dòng, `failure.rs` quản lý gán nguyên nhân failure provider.
  - `runtime_state.rs`
    Công cụ cập nhật thống nhất cho runtime snapshot / failure / artifact.
  - `worker_process.rs`
    Khởi động tiến trình con, tiêm env, kết thúc cây tiến trình; hiện chỉ nhận `WorkerProcessRuntimeConfig + job`, không còn phụ thuộc toàn bộ deps runtime.

### `src/ocr_provider`

- Vai trò:
  Phân phối OCR provider, chuyển đổi giao thức provider cụ thể, thu gọn đầu ra provider.
- Nhận định nhanh:
  Vào đây khi sửa chi tiết tích hợp MinerU / Paddle.

### `src/storage_paths.rs` + `src/storage_paths/*`

- Vai trò:
  Artifact key, chuẩn hóa đường dẫn, phân giải đường dẫn, thu thập registry artifact.
- Các ranh giới con hiện tại:
  - `constants.rs`
    Hằng số artifact key / group / kind.
  - `job_paths.rs`
    `JobPaths` và tạo thư mục tác vụ.
  - `path_ops.rs`
    Chuẩn hóa đường dẫn tương đối, chuẩn hóa lưu trữ, xác định legacy.
  - `resolvers.rs`
    Phân giải đường dẫn cho các published artifact khác nhau.
  - `registry.rs`
    Chiếu các tệp tác vụ thành danh sách artifact entry.

### `src/db.rs` + `src/db/*`

- Vai trò:
  Điểm vào lưu trữ SQLite.
- Các ranh giới con hiện tại:
  - `rows.rs`
    Giải mã SQLite row -> domain model.
  - `schema.rs`
    Kiểm tra schema và bảo vệ migration khi khởi động.
  - `db.rs`
    Facade `Db` chính và các use case đọc/ghi cụ thể.

## Ba nhận định nhanh

- "Đây có phải thay đổi hành vi HTTP không?"
  Xem `src/routes` trước.
- "Đây có phải thay đổi điều phối use case jobs không?"
  Xem `src/services/jobs/facade` và `src/services/jobs/creation` trước.
- "Đây có phải thay đổi worker / thực thi Python không?"
  Xem `src/job_runner` trước.

## Bản đồ thư mục trực quan hơn

Hiện tại khuyến nghị hiểu backend theo dòng này:

1. `src/routes`
   Lớp thích ứng HTTP, chỉ làm trích xuất tham số và đóng gói phản hồi.
2. `src/services/jobs/facade`
   Tổng điểm vào use case jobs, route chỉ giao tiếp với facade.
3. `src/services/jobs/creation` / `src/services/jobs/presentation`
   Cái trước chịu trách nhiệm tạo và gửi, cái sau chịu trách nhiệm chiếu ngoài detail/list/events.
4. `src/job_runner`
   Điều phối runtime, tiến trình con, OCR flow, translation/render flow.
5. `src/ocr_provider`
   Giao thức provider và chuẩn hóa đầu ra provider.

Người mới nếu chỉ muốn nhanh chóng xác định điểm vào sửa, có thể tự hỏi mình đang sửa:

- Thích ứng HTTP
- Điều phối use case
- Chiếu hiển thị
- Thực thi runtime
- Giao thức provider

Rồi mới vào thư mục tương ứng, không nên sửa đồng thời nhiều lớp `routes -> services -> job_runner` ngay từ đầu.

## Thứ tự đọc cho người mới

Nếu lần đầu vào backend này, khuyến nghị xem theo thứ tự:

1. [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
   Biết có những HTTP entry nào trước.
2. [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
   Xem các phụ thuộc liên quan đến jobs được lắp ráp thế nào.
3. [`src/routes/jobs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs)
   Xem route chỉ chuyển tiếp thế nào.
4. [`src/services/jobs/facade`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade)
   Xem điểm vào use case command/query.
5. [`src/services/jobs/creation`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)
   Xem chuỗi tạo: chuẩn bị, snapshot, gửi, bundle.
6. [`src/job_runner`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)
   Cuối cùng mới vào lớp thực thi runtime.