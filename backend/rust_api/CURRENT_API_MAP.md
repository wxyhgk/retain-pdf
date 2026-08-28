# Bản đồ API hiện tại

Tài liệu này chỉ trả lời một câu hỏi:

**API Rust + Python worker này thực sự chạy như thế nào.**

Nó không đề cập đến lịch sử hay chi tiết tương thích; chỉ tập trung vào chuỗi sản xuất chính hiện tại.

## Điều hướng nhanh

- Tài liệu giới thiệu:
  [`README.md`](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- Chỉ chuỗi chính hiện tại:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- Chỉ ranh giới module Rust:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- Chỉ ranh giới provider OCR:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- Chỉ hợp đồng runtime stage:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- Chỉ giao thức API bên ngoài:
  [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)
- Chỉ thông số kỹ thuật tham số render:
  [`RENDER_OPTIONS_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RENDER_OPTIONS_CONTRACT.md)

## 1. Các lớp hệ thống hiện tại

Backend hiện được chia thành hai lớp:

### Lớp Rust

Trách nhiệm:

- API HTTP bên ngoài
- Xác thực
- Tạo / xếp hàng / máy trạng thái tác vụ
- Lưu trữ SQLite
- Truy vấn artifact / sự kiện
- Khởi động worker Python

Điểm vào mã chính:

- [`src/routes/jobs/mod.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/mod.rs)
- [`src/services/jobs/*`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs)
- [`src/job_runner/*`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)

### Lớp Python

Trách nhiệm:

- Gọi provider OCR
- OCR thô -> chuẩn hóa `document.v1.json`
- Dịch
- Kết xuất
- Hợp nhất PDF / hậu xử lý

Điểm vào mã chính:

- [`backend/scripts/entrypoints/run_provider_case.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_case.py)
- [`backend/scripts/entrypoints/run_provider_ocr.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_ocr.py)
- [`backend/scripts/entrypoints/run_normalize_ocr.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_normalize_ocr.py)
- [`backend/scripts/entrypoints/run_translate_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_translate_only.py)
- [`backend/scripts/entrypoints/run_render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_render_only.py)

## 2. Luồng công việc chính thức hiện tại

Các luồng công việc hiện được coi là ổn định cho bên ngoài chỉ là:

- `book`
  Ý nghĩa: đường ống đầy đủ dựa trên provider
  Chuỗi: OCR -> Chuẩn hóa -> Dịch -> Kết xuất

- `translate`
  Ý nghĩa: OCR -> Chuẩn hóa -> Dịch
  Không thực hiện kết xuất

- `render`
  Ý nghĩa: tái sử dụng artifact dịch hiện có, chỉ thực hiện kết xuất

- `ocr`
  Ý nghĩa: luồng phụ chỉ OCR / chỉ provider

Lưu ý:

- `book` là định danh API chính thức cho toàn bộ chuỗi chính
- **Không** phải `mineru`
- Việc chọn provider OCR không dựa trên workflow, mà dựa trên `ocr.provider`

## 3. Phương thức chọn provider hiện tại

Phân phối provider hiện tại:

- `workflow = book`
- `ocr.provider = mineru | paddle | local | <provider local_command đã cấu hình>`

Tức là:

- `workflow` quyết định đường ống chính nào sẽ chạy
- `ocr.provider` quyết định provider OCR nào được sử dụng
- `GET /api/v1/providers/ocr` là điểm vào để frontend và tích hợp bên ngoài khám phá thông tin xác thực/tùy chọn/khả năng của provider
- Các tham số không bí mật dành riêng cho provider được đặt trong `ocr.options`; trình trợ giúp multipart sử dụng trường chuỗi JSON `ocr_options`

Mã chính:

- Rust ghi spec:
  - [`src/worker_command.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
- Python phân phối theo provider:
  - [`backend/scripts/services/ocr_provider/provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)

Lưu ý: Tác vụ `book` chuỗi chính sản xuất không còn sử dụng `run_provider_case.py` làm lệnh ban đầu. Khi tạo, tác vụ `book` chỉ lưu lệnh giữ chỗ `book-workflow-rust-orchestrated`; việc thực thi thực tế được điều phối bởi `job_runner` Rust với chuỗi các stage OCR con, chuẩn hóa, dịch và kết xuất.

## 4. Giao thức chính thức hiện tại: Stage Spec

Giao thức chính thức giữa worker Rust và Python không còn là tham số CLI dài, mà là:

```bash
python -u <entrypoint> --spec <job_root>/specs/<stage>.spec.json
```

Các stage chính thức hiện tại:

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`

Stage trình trợ giúp cũ / cục bộ:

- `provider.stage.v1`
- `book.stage.v1`

Trình tải Python tương ứng:

- [`backend/scripts/foundation/shared/stage_specs.py`](/home/wxyhgk/tmp/Code/backend/scripts/foundation/shared/stage_specs.py)

## 5. Chuỗi thực thi Rust‑to‑Python thực tế

Lấy ví dụ quan trọng nhất `book`:

### Bước 1: Frontend / người gọi gửi yêu cầu

Điểm vào điển hình:

- `POST /api/v1/jobs`

Các route Rust:

- [`src/routes/jobs/create.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/create.rs)
- [`src/services/jobs/facade.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade.rs)

### Bước 2: Rust tạo tác vụ

Chịu trách nhiệm:

- Xác thực yêu cầu
- Tạo snapshot tác vụ
- Lưu vào DB
- Đưa vào hàng đợi

Mã chính:

- [`src/services/jobs/creation`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)
- [`src/services/job_snapshot_factory.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_snapshot_factory.rs)
- [`src/services/job_launcher.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_launcher.rs)

Lưu ý:

- Lớp route hiện chỉ thực hiện chuyển đổi HTTP
- Các trường hợp sử dụng liên quan đến `jobs` đã được thống nhất qua `JobsFacade`
- `uploads` / `glossaries` cũng đi qua `upload_api` / `glossary_api` tương ứng

### Bước 3: Rust tập hợp kế hoạch workflow

Rust chọn kế hoạch thực thi theo workflow:

- `book` -> Rust điều phối `OCR con -> chuẩn hóa -> dịch -> kết xuất`
- `translate` -> Rust điều phối `OCR con -> chuẩn hóa -> dịch`
- `render` -> Rust tái sử dụng artifact rồi bắt đầu `render`
- `ocr` -> Rust điều phối `provider transport -> chuẩn hóa`

Mã chính:

- [`src/job_runner/lifecycle.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)
- [`src/job_runner/translation_flow.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)
- [`src/job_runner/ocr_flow/mod.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)
- [`src/job_runner/render_flow.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/render_flow.rs)

### Bước 4: Rust ghi stage specs và khởi động worker

Chuỗi chính `book` ghi theo stage:

- OCR con / provider transport: Rust sử dụng transport nội bộ, không qua `provider.stage.v1`
- `DATA_ROOT/jobs/<job_id>/specs/normalize.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/translate.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/render.spec.json`

`provider.spec.json` / `provider.stage.v1` chỉ được sử dụng cho worker provider chỉ OCR và trình trợ giúp provider-case/local cũ. Bộ điều phối `book` hiện tại vẫn đi qua transport OCR con nội bộ của Rust, sau đó vào các stage chuẩn hóa/dịch/kết xuất.

Chiến lược kết xuất cũng được cấu hình tập trung trong `render`. Mặc định hiện tại:

- `render.source_cleanup_strategy = "pikepdf_text_strip"`
- Ý nghĩa: theo mặc định, sử dụng pikepdf để loại bỏ các thao tác văn bản trong luồng nội dung PDF gốc theo bbox, sau đó các khối dịch Typst với lớp phủ màu nền để che phủ trực quan
- Các tùy chọn: `typst_fill | pikepdf_text_strip | bbox_text_strip | legacy | redact_restore_formulas`
- `pikepdf_text_strip` có nghĩa là trước khi kết xuất, sử dụng pikepdf để xóa các thao tác văn bản trong luồng nội dung ở cấp độ path, sau đó các khối nền Typst để phủ trực quan; `bbox_text_strip`, `legacy` và `redact_restore_formulas` hiện là bí danh tương thích, hành vi giống `pikepdf_text_strip`

### Bước 5: job_runner vào chuỗi chính runtime

Điểm vào thực tế hiện tại:

- [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
  Nén `AppState` thành `ProcessRuntimeDeps`
- [`src/job_runner/lifecycle.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)
  Chịu trách nhiệm về hàng đợi, vị trí thực thi, điều phối workflow

### Bước 6: Rust khởi động worker Python

Tại đây, các biến môi trường cần thiết được tiêm:

- `RETAIN_TRANSLATION_API_KEY`
- `RETAIN_MINERU_API_TOKEN`
- `RETAIN_PADDLE_API_TOKEN`

Mã chính:

- [`src/job_runner/process_runner.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [`src/job_runner/process_runner/startup.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [`src/job_runner/process_runner/execution.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [`src/job_runner/worker_process.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

### Bước 7: Worker stage Python thực thi

Chuỗi chính sản xuất hiện tại sử dụng các worker stage này:

- `run_normalize_ocr.py --spec specs/normalize.spec.json`
- `run_translate_only.py --spec specs/translate.spec.json`
- `run_render_only.py --spec specs/render.spec.json`

`run_provider_case.py` vẫn được giữ lại như một wrapper cũ/cục bộ để xác thực một lần cục bộ cho đường ống đầy đủ dựa trên provider; không coi đây là điểm vào chuỗi chính sản xuất cho Rust API.

## 6. Các thư mục artifact quan trọng nhất

Các thư mục chuẩn cho mỗi tác vụ:

- `DATA_ROOT/jobs/<job_id>/source`
- `DATA_ROOT/jobs/<job_id>/ocr`
- `DATA_ROOT/jobs/<job_id>/translated`
- `DATA_ROOT/jobs/<job_id>/rendered`
- `DATA_ROOT/jobs/<job_id>/artifacts`
- `DATA_ROOT/jobs/<job_id>/logs`
- `DATA_ROOT/jobs/<job_id>/specs`

Các tệp quan trọng nhất:

- `specs/normalize.spec.json`
- `specs/translate.spec.json`
- `specs/render.spec.json`
- `ocr/result.json`
- `ocr/normalized/document.v1.json`
- `ocr/normalized/document.v1.report.json`
- `translated/translation-manifest.json`
- `artifacts/render_config.json`
- `artifacts/pipeline_summary.json`
- `rendered/*.pdf`

## 7. Hợp đồng dữ liệu quan trọng nhất

Chuỗi dịch / kết xuất chính hiện thực sự phụ thuộc vào tài liệu đã chuẩn hóa.

Tập trường chính thức:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Các trường tương thích vẫn có thể tồn tại:

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`

Nhưng chúng không còn là hợp đồng chính được khuyến nghị.

## 8. Điểm vào hiện tại

Điểm vào chuỗi chính sản xuất:

- Rust job_runner điều phối theo workflow
- Worker stage Python chỉ thực thi một stage duy nhất

Các wrapper cục bộ / cũ được giữ lại:

- `run_provider_case.py`
- `run_document_flow.py`

Nguyên tắc hiện tại:

- Điểm vào chính là Rust `job_runner`
- Các giao thức chính là `normalize.stage.v1`, `translate.stage.v1`, `render.stage.v1`
- `provider.stage.v1` chỉ là hợp đồng provider-case/local helper cũ
- Tệp tóm tắt chính là `pipeline_summary.json`

## 9. Sự kiện hiện tại và hợp nhất lỗi

Luồng sự kiện chính thức hiện tại đã là:

- Worker Python ghi `DATA_ROOT/jobs/<job_id>/logs/pipeline_events.jsonl`
- Lớp truy vấn Rust hợp nhất sự kiện DB và `pipeline_events.jsonl`
- Đối với các tác vụ chính tạo OCR con như `book` / `translate`, `GET /api/v1/jobs/<job_id>/events` cũng hợp nhất sự kiện của tác vụ OCR con từ `{job_id}-ocr`
- Các sự kiện tác vụ OCR con được ánh xạ đến `job_id` của tác vụ chính; nguồn gốc được giữ trong `payload.source_job_id` và `payload.source_event`
- Rust detail/list ưu tiên snapshot stage trực tiếp hơn `job.stage` trong DB cũ

Điểm vào hiển thị tiến trình đề xuất cho frontend:

- Trạng thái hiện tại chỉ đọc từ `GET /api/v1/jobs/<job_id>` hoặc `stage_snapshot` trong `GET /api/v1/jobs`
- `events` chỉ dành cho lịch sử, dòng thời gian và khắc phục sự cố, không dùng để đánh giá stage hiện tại
- Không cần poll riêng `{job_id}-ocr`
- Các sự kiện lịch sử OCR / dịch / kết xuất vẫn được thống nhất qua các trường sự kiện:
  - `display_stage`
  - `stage`
  - `substage`
  - `lane`
  - `stage_detail`
  - `event_type`
  - `progress.unit`
  - `progress.current`
  - `progress.total`

Các đơn vị tiến trình được đề xuất hiện tại:

- Tiến trình trang provider OCR: `display_stage=ocr`, `stage=ocr_processing`, `progress.unit=page`
- Tiến trình batch dịch: `display_stage=translation`, `stage=translating`, `progress.unit=batch`
- Các stage phụ cấp trang dịch: `continuation_review`, `page_policies`, `domain_inference`, `garbled_repair`, `progress.unit=page`
- Tiến trình trang kết xuất: `display_stage=render`, `stage=rendering`, `progress.unit=page`
- Biên dịch / phủ / lưu Typst: khi không báo cáo theo trang, sử dụng `progress.unit=step`

Trường lỗi chính thức hiện tại là:

- `data.failure`

Các trường tương thích vẫn được giữ, nhưng vai trò được cố định:

- `data.failure_diagnostic`
  Chỉ là hình chiếu tương thích của `failure`
- `events[*].event`
  Tương thích cho client cũ; client mới nên ưu tiên `event_type`
- `events[*].message`
  Văn bản gỡ lỗi / tương thích; ngữ nghĩa chính thức ưu tiên `stage_detail` + `event_type`
- `events[*].raw`
  Lưu thông tin nguồn từ DB / pipeline jsonl / OCR con; hiển thị frontend không nên dựa vào đó để đánh giá stage

Các quy tắc phân lớp stage cũng được cố định:

- Stage hiển thị frontend được đặt trong `stage_snapshot.display_stage`
- Stage máy được đặt trong `stage`
- `stage_snapshot` là nguồn sự thật duy nhất cho stage và tiến trình hiện tại
- `background_snapshots` chỉ hiển thị tiến trình phụ trợ, ví dụ: `render_prewarm` trong quá trình dịch
- Trạng thái riêng của provider được đặt trong `provider_stage`
- `message` / `stage_detail` chỉ là bản sao, không được sử dụng cho logic stage

## 10. Ba điểm rút ra quan trọng nhất

1. `workflow=book` là đường ống đầy đủ dựa trên provider, không còn `mineru`
2. Việc chọn provider OCR phụ thuộc vào `ocr.provider`, không phải tên workflow
3. Ranh giới ổn định giữa Rust và Python là `--spec <stage>.spec.json`

## 11. Khắc phục sự cố: Các tệp nên xem trước

Nếu bạn chỉ muốn nhanh chóng xác định vị trí vấn đề, hãy xem theo thứ tự này:

### Xem yêu cầu API trông như thế nào

- [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)

### Xem script Python nào Rust thực sự khởi động

- [`src/worker_command.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)

### Xem cách điểm vào provider Python phân phối

- [`backend/scripts/services/ocr_provider/provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)

### Xem stage spec trông như thế nào

- [`backend/scripts/foundation/shared/stage_specs.py`](/home/wxyhgk/tmp/Code/backend/scripts/foundation/shared/stage_specs.py)

### Xem kết quả cuối cùng của chuỗi chính

- `DATA_ROOT/jobs/<job_id>/artifacts/pipeline_summary.json`