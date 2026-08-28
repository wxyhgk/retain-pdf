# Sự kiện giai đoạn và Giao thức thất bại

Tài liệu này định nghĩa ranh giới cho sự kiện giai đoạn, sự kiện tiến độ và đối tượng thất bại giữa API Rust và Python worker.

Mục tiêu là frontend không còn phải đoán trạng thái dựa trên `message`, `log_tail` hoặc văn bản stdout.

## 1. Ba lớp nguồn sự kiện

Backend hiện tại có ba lớp sự kiện:

1. Sự kiện pipeline gốc của Python
   - Tệp: `DATA_ROOT/jobs/{job_id}/logs/pipeline_events.jsonl`
   - Người ghi: Python OCR / translation / render worker
   - Mục đích: tiến độ chi tiết trong giai đoạn, phát hành artifact, ngữ cảnh thất bại

2. Sự kiện DB của Rust
   - Bảng: SQLite `events`
   - Người ghi: Rust job runner
   - Mục đích: tạo job, thay đổi trạng thái, trạng thái cuối, tương thích sự kiện cũ

3. Sự kiện chuẩn tắc của Rust API
   - Giao diện: `GET /api/v1/jobs/{job_id}/events`
   - Người lắp ráp: `services/jobs/presentation/live_stage`
   - Mục đích: luồng sự kiện công khai duy nhất mà frontend và bên thứ ba nên tiêu thụ

Frontend chỉ tiêu thụ lớp thứ ba. Lớp thứ nhất và thứ hai là nguồn nội bộ của backend.

## 2. Hợp ��ồng sự kiện gốc Python

Khi Python ghi `pipeline_events.jsonl`, phải mang ổn định các trường sau:

```json
{
  "job_id": "job-123",
  "seq": 12,
  "ts": "2026-05-28T10:12:33Z",
  "created_at": "2026-05-28T10:12:33Z",
  "level": "info",
  "user_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "stage_detail": "Đã hoàn thành lô dịch thứ 18/55",
  "event_type": "stage_progress",
  "semantic_event_type": "progress",
  "message": "Đã hoàn thành lô dịch thứ 18/55",
  "progress_current": 18,
  "progress_total": 55,
  "progress_unit": "batch",
  "provider": "",
  "provider_stage": "",
  "elapsed_ms": 193822,
  "payload": {}
}
```

Quy tắc trường:

- `user_stage`
  Giai đoạn thô phía Python, chỉ cho phép: `ocr | translation | render | done`.
- `stage`
  Giai đoạn máy nội bộ Python, ví dụ `translating`, `render_preprocess`.
- `substage`
  Giai đoạn con đọc được bằng máy, là trường cốt lõi của ngữ nghĩa trạng thái frontend.
- `stage_detail`
  Văn bản ngắn cho người dùng.
- `message`
  Văn bản nhật ký, chỉ dành cho người; không mang ngữ nghĩa máy.
- `progress_current` / `progress_total` / `progress_unit`
  Phải khớp với `user_stage + substage` hiện tại.
- `semantic_event_type`
  Python chuẩn hóa ngữ nghĩa cho các sự kiện cũ như `stage_progress` / `artifact_published`, Rust vẫn sẽ chuẩn tắc hóa lần nữa.
- `payload`
  Chỉ dành cho dữ liệu mở rộng, không chứa ngữ nghĩa chính.

Cấm xuất hiện sự kiện như:

```json
{
  "user_stage": "translation",
  "stage": "translating",
  "message": "render payload prewarm: ready"
}
```

Cách viết đúng:

```json
{
  "user_stage": "render",
  "stage": "render_preprocess",
  "substage": "render_prewarm",
  "message": "render payload prewarm: ready"
}
```

## 3. Bảng giai đoạn con ổn định

| user_stage | stage | substage | progress_unit | Giải thích |
| --- | --- | --- | --- | --- |
| `ocr` | `ocr_processing` | `ocr_processing` | `page` | Tiến độ trang OCR. |
| `ocr` | `normalizing` | `normalizing` | `step` | Chuẩn hóa kết quả OCR. |
| `translation` | `translation_prepare` | `translation_prepare` | `step` | Chuẩn bị dịch. |
| `translation` | `domain_inference` | `domain_inference` | `step` | Nhận diện lĩnh vực. |
| `translation` | `page_policies` | `page_policies` | `page` | Chính sách trang và phân loại block. |
| `translation` | `continuation_review` | `continuation_review` | `page` | Rà soát đoạn tiếp nối xuyên cột/trang. |
| `translation` | `translating` | `translation_batches` | `batch` | Lô dịch chính. |
| `translation` | `translating` | `translation_tail_retry` | `batch` | Hàng đợi thử lại cuối. |
| `translation` | `garbled_repair` | `garbled_repair` | `page` | Sửa lỗi mã hóa. |
| `translation` | `agent_repair` | `agent_repair` | `page` | Sửa kết quả dịch. |
| `translation` | `final_untranslated_recovery` | `final_untranslated_recovery` | `page` | Thu hồi phần chưa dịch cuối cùng. |
| `render` | `render_prepare` | `render_prepare` | `step` | Chuẩn bị render. |
| `render` | `render_preprocess` | `render_prewarm` | `step` | Làm nóng render trước. |
| `render` | `rendering` | `render_pages` | `page` | Render theo trang, làm sạch nền, tạo mã nguồn Typst. |
| `render` | `rendering` | `render_compile` | `step` | Biên dịch Typst và lưu PDF. |

Khi thêm giai đoạn con mới, phải đồng bộ cập nhật:

- Python: `services/pipeline_shared/events.py`
- Rust: `models/job/stage.rs`
- Kiểm thử Rust API: `src/api_tests/jobs_query.rs`
- Kiểm thử giao thức Python: `devtools/tests/translation/test_pipeline_events_protocol.py`
- Tài liệu này

## 4. Hợp đồng sự kiện chuẩn tắc của Rust

API Rust trả về sự kiện không phải là dòng gốc Python mà là các sự kiện đã được chuẩn hóa (canonicalized).

Ví dụ các trường bên ngoài:

```json
{
  "job_id": "job-123",
  "seq": 24,
  "ts": "2026-05-28T10:12:33Z",
  "created_at": "2026-05-28T10:12:33Z",
  "level": "info",
  "lane": "main",
  "stage": "translation",
  "substage": "translation_batches",
  "stage_detail": "Đã hoàn thành lô dịch thứ 18/55",
  "event": "stage_progress",
  "event_type": "progress",
  "raw_event_type": "stage_progress",
  "progress": {
    "unit": "batch",
    "current": 18,
    "total": 55,
    "percent": 32.72727272727273
  },
  "message": "Đã hoàn thành lô dịch thứ 18/55",
  "payload": {
    "raw_stage": "translating",
    "raw_user_stage": "translation",
    "raw_event_type": "stage_progress"
  }
}
```

`stage` công khai chỉ biểu thị lớp hiển thị frontend:

- `ocr`
- `translation`
- `render`
- `done`

`event_type` công khai chỉ biểu thị loại sự kiện:

- `progress`
- `artifact`
- `terminal`
- `error`
- `diagnostic`

`user_stage` là trường nguồn nội bộ; đầu ra API sẽ ẩn mặc định. Frontend không nên phụ thuộc vào nó.

## 5. Quy tắc Lane

`lane` được dùng để giải quyết vấn đề "sự kiện nền ghi đè trạng thái chính".

- `main`
  Tiến độ chính. Thẻ trạng thái có thể hiển thị.
- `background`
  Làm nóng nền, xây dựng bộ nhớ đệm, v.v. Không được ghi đè giai đoạn chính.
- `artifact`
  Phát hành artifact/sản phẩm. Không được ghi đè giai đoạn chính.
- `diagnostic`
  Thông tin chẩn đoán và hỗ trợ lỗi.

Quy tắc cố định hiện tại:

- `substage=render_prewarm` -> `lane=background`
- `event_type=artifact` -> `lane=artifact`
- `event_type=diagnostic` hoặc sự kiện hỗ trợ thất bại -> `lane=diagnostic`
- Các sự kiện tiến độ khác -> `lane=main`

## 6. Snapshot giai đoạn (Stage Snapshot)

`GET /api/v1/jobs/{job_id}` và giao diện danh sách trả về `stage_snapshot`, `background_snapshots` và `stages` có thẩm quyền.

Quy tắc chọn:

- Chỉ chọn giai đoạn chính từ `lane=main`.
- Sự kiện `artifact` và `background` không được ghi đè giai đoạn chính.
- `render_prewarm` (chuẩn bị render trong khi dịch) sẽ vào `background_snapshots`.
- Giai đoạn render ưu tiên hiển thị tiến độ cấp trang của `render_pages`; `render_compile` là tiến độ bước (step), không thể giả làm "tổng N trang".
- Khi thất bại, nếu sự kiện trạng thái cuối không có tiến độ, sẽ giữ lại tiến độ đáng tin cậy cuối cùng.
- Khi `status=succeeded|failed|canceled`, `stage_snapshot=null`; trạng thái cuối chỉ do `status` biểu thị.
- `display_stage=done` không bao giờ xuất hiện.

`stage_snapshot.progress` trong giao diện chi tiết là ảnh chụp hiện tại:

```json
{
  "unit": "page",
  "current": 18,
  "total": 55,
  "percent": 32.72727272727273
}
```

Khi frontend làm mới trang, chỉ đọc `stage_snapshot` từ giao diện chi tiết để xác định giai đoạn hiện tại; luồng sự kiện chỉ dùng cho lịch sử, gỡ lỗi và dòng thời gian, không tham gia vào việc chọn giai đoạn hiện tại. `stage_detail` chỉ là văn bản; `stage` chỉ là giai đoạn máy nội bộ backend.

## 7. Tính đơn điệu tiến độ (Progress Monotonicity)

Writer phía Python sẽ duy trì tiến độ đơn điệu theo `(user_stage, substage, progress_unit)`.

Yêu cầu:

- Cùng một key, `progress_current` không được lùi.
- Các substage khác nhau có thể đếm độc lập; ví dụ `render_pages` và `render_compile` không ảnh hưởng lẫn nhau.
- `render_prewarm` là bước nền (background step) và không tham gia vào số trang render chính.
- Tác vụ mới hoặc tác vụ thử lại phải ghi lại sự kiện; không tái sử dụng seq sự kiện của tác vụ cũ.

## 8. Giao thức thất bại (Failure Protocol)

Đối tượng thất bại chính thức là `failure` trong chi tiết job.

Ví dụ:

```json
{
  "failed_stage": "translation",
  "provider": "deepseek",
  "provider_stage": "translation_batches",
  "failure_code": "upstream_timeout",
  "failure_category": "timeout",
  "provider_code": null,
  "summary": "Giai đoạn dịch bị quá thời gian (timeout)",
  "root_cause": "provider timed out",
  "retryable": true,
  "upstream_host": "api.deepseek.com",
  "suggestion": "Khôi phục tác vụ từ điểm dừng",
  "last_log_line": "request timed out",
  "raw_excerpt": "timeout"
}
```

Phân tầng trường:

- `failed_stage`
  Giai đoạn thất bại công khai, ưu tiên dùng `ocr | translation | render | done`.
- `provider` / `provider_stage`
  Thượng nguồn hoặc giai đoạn con nội bộ.
- `failure_code`
  Mã máy ổn định.
- `failure_category`
  Loại lỗi thô.
- `provider_code`
  Mã lỗi gốc từ thượng nguồn.
- `summary` / `root_cause` / `suggestion`
  Thông tin có thể đọc được cho frontend và người vận hành.
- `raw_excerpt`
  Đoạn trích gốc đã được làm sạch.

`failure_diagnostic` là view chiếu tương thích và không phải là đích ghi cho mã mới.

Khi frontend cần thông tin thất bại rõ ràng, ưu tiên dùng:

`GET /api/v1/jobs/{job_id}/diagnostics`

Giao diện này cũng có thể hiển thị `render_diagnostics` tùy chọn. Nguồn dữ liệu là trường cùng tên trong `artifacts/pipeline_summary.json`, hiện ghi lại hành vi dự phòng trong giai đoạn render, ví dụ `typst_cover_fallback_pages` và `typst_cover_fallback_items`. Các trường này dùng để xác định trang và block đã chuyển sang "dùng Typst phủ nền" khi xóa vật lý thất bại, không tham gia vào phân loại thất bại, cũng không thay đổi ngữ nghĩa của `failed_stage` / `retryable` / `resume_available`.

## 9. Tiêu chí nghiệm thu

Các thay đổi về sự kiện và giao thức thất bại phải đáp ứng:

- Frontend không dùng `message` để xác định giai đoạn.
- Sự kiện render không được mang `user_stage=translation`.
- `render_prewarm` không ghi đè tiến độ render chính.
- Đầu ra `/events` chỉ hiển thị `stage` công khai và `substage` ổn định.
- `progress` trong `/jobs/{job_id}` là ảnh chụp cuối cùng có thể dùng sau khi làm mới.
- Thông tin thất bại ưu tiên đến từ `failure`, không phải `log_tail` hay văn bản stdout.

## 10. Mã nguồn tương ứng

Python ghi:

- `backend/scripts/services/pipeline_shared/events.py`
- `backend/scripts/services/translation/workflow/stages.py`
- `backend/scripts/services/rendering/layout/stages.py`
- `backend/scripts/services/rendering/source/prewarm_payload.py`
- `backend/scripts/services/ocr_provider/paddle_runner.py`

Rust đọc và chuẩn hóa:

- `backend/rust_api/src/services/jobs/presentation/live_stage/pipeline_events.rs`
- `backend/rust_api/src/services/jobs/presentation/live_stage/canonical_events.rs`
- `backend/rust_api/src/services/jobs/presentation/live_stage.rs`
- `backend/rust_api/src/models/job/stage.rs`

Kiểm thử:

- `backend/scripts/devtools/tests/translation/test_pipeline_events_protocol.py`
- `backend/rust_api/src/api_tests/jobs_query.rs`