# RetainPDF Backend API Entry Point

This document is the sole entry point for frontend integration, third-party invocation, and backend joint debugging. Other API documents serve only as topic pages or historical compatibility entries.

## 1. Basic Conventions

- Full API default port: `41000`
- Multipart async submission API default port: `42000`
- Health check: `GET /health`
- Business prefix: `/api/v1`
- Except `GET /health`, business APIs require `X-API-Key` by default

Success response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Error response:

```json
{
  "code": 40000,
  "message": "invalid request"
}
```

Common error codes:

- `40000`: Request error
- `40100`: Authentication failed
- `40400`: Resource not found
- `40900`: Status conflict
- `42900`: Model or external service rate limited
- `50200`: Model or external service failed
- `50000`: Internal error

`X-API-Key` is backend whitelist key for accessing Rust API; not OCR Provider token nor model API key.

## 2. Recommended Frontend Integration Path

Library pages prefer "book semantics" endpoints:

- `GET /api/v1/library/books`
- `GET /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}`
- `POST /api/v1/library/books/delete`
- `GET /api/v1/library/books/{job_id}/cover`
- `GET /api/v1/library/books/{job_id}/thumbnail`

Task creation and execution still use job API:

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. `GET /api/v1/jobs/{job_id}`
4. `GET /api/v1/jobs/{job_id}/events`
5. Download artifacts per `actions` / `artifacts` / `artifacts_display`
6. Completed task reading Q&A uses `POST /api/v1/jobs/{job_id}/reader/ai/chat`

## 3. Library Endpoints

List:

`GET /api/v1/library/books?limit=20&offset=0&q=physics`

Query parameters:

- `limit` / `offset`: Pagination.
- `q`: Optional; full-library search across book title, source filename, job_id, source URL, status text.

Returns `data.items[]`:

```json
{
  "id": "job-id",
  "job_id": "job-id",
  "title": "book title",
  "display_name": "book title",
  "source_file_name": "source.pdf",
  "authors": null,
  "page_count": 533,
  "status": "succeeded",
  "stage": "finished",
  "stage_detail": "done",
  "progress": {
    "current": 533,
    "total": 533,
    "percent": 100.0
  },
  "cover_url": "/api/v1/library/books/job-id/cover",
  "thumbnail_url": "/api/v1/library/books/job-id/thumbnail",
  "output_pdf_ready": true,
  "markdown_ready": true,
  "bundle_ready": true,
  "created_at": "2026-05-16T00:00:00Z",
  "updated_at": "2026-05-16T00:10:00Z"
}
```

Detail:

`GET /api/v1/library/books/{job_id}`

Key return fields:

- `id`
- `job_id`
- `title`
- `authors`
- `source_file_name`
- `page_count`
- `source_language`
- `target_language`
- `file_size_bytes`
- `status`
- `stage`
- `progress`
- `cover_url`
- `thumbnail_url`
- `artifacts`

Delete:

- `DELETE /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}?force=true`
- `POST /api/v1/library/books/delete`

Delete behavior:

- Deletes main job record
- Deletes associated `artifacts` / `job_artifact_entries` / `events`
- Deletes `DATA_ROOT/jobs/{job_id}`
- Deletes `DATA_ROOT/downloads/{job_id}.zip`
- If `{job_id}-ocr` child task exists, deletes together
- Does not delete `uploads` source file by default
- `queued` / `running` rejected by default unless `force=true`

## 4. Upload Endpoint

`POST /api/v1/uploads`

`multipart/form-data`:

- `file`: Required, PDF
- `developer_mode`: Optional, `true/false`

Key return fields:

- `upload_id`
- `filename`
- `bytes`
- `page_count`
- `uploaded_at`

## 5. Create Task

`POST /api/v1/jobs`

Accepts grouped JSON only; does not accept legacy flat JSON.

Top-level structure:

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "upload-id"
  },
  "ocr": {
    "provider": "paddle",
    "paddle_token": "paddle-access-token",
    "language": "ch",
    "page_ranges": ""
  },
  "translation": {
    "mode": "sci",
    "math_mode": "direct_typst",
    "model": "deepseek-v4-flash",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-xxxx",
    "batch_size": 1,
    "workers": 50
  },
  "render": {
    "render_mode": "auto",
    "compile_workers": 8
  },
  "runtime": {
    "timeout_seconds": 1800
  }
}
```

`workflow`:

- `book`: OCR -> Normalize -> Translate -> Render
- `translate`: OCR -> Normalize -> Translate
- `render`: Rerun rendering based on existing task artifact

Stage recovery:

- `POST /api/v1/jobs/{job_id}/rerun`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`
- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- When `translations_dir + source_pdf` exist, reuses original `job_id` for in-place rerender replacing render artifacts
- When only `normalized_document_json + source_pdf` exist, creates new `book` recovery task
- `workflow=translate` + `source.artifact_job_id`: Reuses OCR checkpoint
- `workflow=book` + `source.artifact_job_id`: Reuses OCR checkpoint then continues translate and render
- `workflow=render` + `source.artifact_job_id`: Reuses translation artifacts then reruns render only

`/resume` currently reuses `/rerun` recovery execution contract; `/resume-plan` allows frontend to preview "where recovery starts, which artifacts reused, which stages rerun".

Active stage retry:

`GET /api/v1/jobs/{job_id}/stage-actions`

Returns whether each stage can be actively retried currently. Frontend buttons read this endpoint first; do not guess retryable stages.

```json
{
  "job_id": "job-id",
  "stages": [
    {
      "stage": "translation",
      "label": "Retry Translation",
      "can_retry": true,
      "disabled_reason": "",
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/job-id/retry-stage",
        "body": {
          "stage": "translation",
          "mode": "from_stage",
          "create_new_job": true
        }
      }
    }
  ]
}
```

`POST /api/v1/jobs/{job_id}/retry-stage`

```json
{
  "stage": "render",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "render": {
      "compile_workers": 8
    }
  }
}
```

Returns new task or in-place task `job_id`. Frontend enters `GET /jobs/{job_id}` and `GET /jobs/{job_id}/events` polling directly per returned `job_id`.

## 6. Task Query and Events

Task query:

- `GET /api/v1/jobs?limit=20&offset=0&status=&workflow=&provider=`
- `GET /api/v1/jobs/{job_id}`

Detail key fields:

- `job_id`
- `workflow`
- `status`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `request_payload`
- `actions`
- `artifacts`
- `artifacts_display`
- `book_summary`
- `contracts`
- `ocr_job`
- `runtime`
- `failure`
- `failure_diagnostic`
- `normalization_summary`
- `glossary_summary`
- `invocation`
- `log_tail`

Events:

`GET /api/v1/jobs/{job_id}/events?limit=200&offset=0`

Stable fields frontend should consume:

- `stage`
- `substage`
- `lane`
- `stage_detail`
- `event_type`
- `raw_event_type`
- `progress`
- `message`
- `payload`

Where:

- `stage`: Public display stage; currently understood as `ocr` / `translation` / `render` / `done` only.
- `substage`: Machine-readable sub-stage.
- `lane`: Event channel; main status card consumes `main` only.
- `progress`: Only recommended progress object.
- `message`: Human-readable only; frontend should not judge stage by it.

`stage` enum:

- `ocr`
- `translation`
- `render`
- `done`

`substage` is machine-readable sub-stage, e.g.:

- `ocr_processing`
- `translation_batches`
- `translation_tail_retry`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

`lane` can be:

- `main`: Main status card displayable.
- `background`: Background prewarm or cache build; should not override main status.
- `artifact`: Artifact publishing.
- `diagnostic`: Diagnostic information.

`event_type` can be:

- `progress`
- `artifact`
- `terminal`
- `error`
- `diagnostic`

`progress` object:

```json
{
  "unit": "page",
  "current": 37,
  "total": 142,
  "percent": 26.056338028169012
}
```

`progress_unit` can be:

- `page`
- `batch`
- `step`
- `percent`
- `none`

Compatibility notes:

- `progress_current` / `progress_total` / `progress_unit` in API output are internal compatibility fields; not serialized by default; frontend reads `progress` first.
- `message` human-readable only; frontend should not judge stage by it.
- `user_stage` in Python raw events not exposed as public API field; check `payload.raw_user_stage` for troubleshooting.

Main task event stream merges OCR child task page progress. Historical events retained after task completion.

Frontend integration minimum rules:

1. Status card stage recognizes only `stage`.
2. Sub-stage card recognizes only `substage`.
3. Progress bar recognizes only `progress.unit/current/total/percent`.
4. Background prewarm, cache, parallel render prep events with `lane != "main"` cannot override main status card.
5. Event ordering reads `seq` first; falls back to `created_at` when no `seq`.

Failure diagnostics:

`GET /api/v1/jobs/{job_id}/diagnostics`

Returns stable fields:

```json
{
  "failed_stage": "translation",
  "failed_substage": "continuation_review",
  "summary": "Translation stage timeout",
  "detail": "provider timed out",
  "suggestion": "Resume task from breakpoint",
  "retryable": true,
  "resume_available": true,
  "render_diagnostics": {
    "typst_cover_fallback_pages": {
      "count": 2,
      "head": [2, 5],
      "tail": []
    },
    "typst_cover_fallback_items": {
      "count": 3,
      "head": ["p002-b002", "p005-b004", "p005-b007"],
      "tail": []
    }
  }
}
```

`render_diagnostics` optional field; returned only when `artifacts/pipeline_summary.json` contains render diagnostics. Used for troubleshooting which pages or blocks took Typst white-background fallback after physical deletion failure; does not indicate task failure.

Breakpoint recovery plan:

`GET /api/v1/jobs/{job_id}/resume-plan`

```json
{
  "can_resume": true,
  "job_id": "job-id",
  "from_stage": "render",
  "resume_workflow": "render",
  "reuses_artifacts": ["source_pdf", "translations_dir", "normalized_document_json"],
  "reruns_stages": ["rendering"],
  "reason": null
}
```

Execute recovery:

`POST /api/v1/jobs/{job_id}/resume`

Response same as `POST /api/v1/jobs/{job_id}/rerun`; returns `JobSubmissionView`.

## 7. Artifacts and Downloads

Artifact endpoints:

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/markdown/images/*path`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/normalized-document`
- `GET /api/v1/jobs/{job_id}/normalization-report`

Frontend button state reads preferentially:

- `actions.*.enabled`
- `artifacts.*.ready`
- `artifacts_display[].ready`
- `artifacts-manifest.items[].ready`

Markdown notes:

- `/markdown` returns JSON wrapper by default
- `/markdown/document` returns structured document view including `content`, `content_with_absolute_image_urls`, `images[]` image direct link list; suitable for frontend preview and AI Q&A
- `/markdown?raw=true` returns raw Markdown
- Images read via `/markdown/images/*path`

PDF on-demand loading:

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/artifacts/source_pdf`

Both endpoints support HTTP Range Requests. Frontend PDF.js should prefer URL mode over fetching entire PDF into `ArrayBuffer` first.

Backend returns linearized PDF cache preferentially:

- If `qpdf` exists in runtime environment, lazily generates `*.linearized.pdf` on first download
- Subsequent downloads reuse cache
- Without `qpdf`, automatically falls back to original PDF; interface availability unaffected

Request example:

```http
GET /api/v1/jobs/{job_id}/pdf
X-API-Key: your-rust-api-key
Range: bytes=0-65535
```

Success response:

```http
206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-65535/12345678
Content-Length: 65536
Content-Type: application/pdf
```

Cross-origin reads expose:

- `Accept-Ranges`
- `Content-Range`
- `Content-Length`
- `X-Job-Id`

Page-level preview:

`GET /api/v1/jobs/{job_id}/preview/pages/{page}?kind=translated`

Parameters:

- `page`: 1-based page number
- `kind`: `source | translated`; default `translated`
- `width`: Optional; default `1200`; range `240..2400`
- `dpi`: Optional; priority over `width`; max `300`

Response:

```http
200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
```

Preview images cached per job at `DATA_ROOT/jobs/{job_id}/artifacts/`. Frontend can request first page preview for instant open, then load PDF.js in background.

## 8. Side-by-Side Reading Assistance Endpoints

Reading region mapping:

`GET /api/v1/jobs/{job_id}/reader/regions`

Each item contains:

- `item_id`
- `source.page/bbox/unit/origin/text`
- `translated.page/bbox/unit/origin/text`
- `markdown`
- `region_type`
- `status`

Coordinate unit fixed as PDF point; origin top-left. Frontend can use `item_id` for translated hover to source bbox mapping; can also use `text` / `markdown` directly for copy menu.

PDF metadata:

`GET /api/v1/jobs/{job_id}/reader/metadata`

Returns source / translated side page counts and per-page dimensions:

```json
{
  "source": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  },
  "translated": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  }
}
```

When one side PDF not ready, that side returns `null`.

## 9. OCR-Only Endpoints

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs?limit=20&offset=0&status=&provider=`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`

## 10. Glossary Endpoints

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`

Glossary used by frontend for "custom vocabulary":

- Do not translate; keep original: `level=preserve`
- Fixed translation for technical term: `level=canonical`
- Soft preference translation: `level=preferred`

Table row fields:

```json
{
  "source": "Hartree-Fock",
  "target": "Hartree-Fock",
  "level": "preserve",
  "match_mode": "case_insensitive",
  "context": "",
  "note": "Method name; keep English"
}
```

Field descriptions:

- `source`: Source term; required.
- `target`: Target translation. Can be empty when `level=preserve`; backend auto-sets to `source`.
- `level`:
  - `preserve`: Force keep; do not translate.
  - `canonical`: Force fixed translation.
  - `preferred`: Hint model to prefer this translation; no guaranteed hit.
- `match_mode`:
  - `exact`: Default exact match.
  - `case_insensitive`: Ignore case.
  - `regex`: Regex match.
- `context`: Optional; takes effect only when nearby context contains term.
- `note`: Remark; for frontend and prompt explanation only.

Create glossary:

```http
POST /api/v1/glossaries
```

```json
{
  "name": "Quantum Chemistry Terms",
  "entries": [
    {
      "source": "Hartree-Fock",
      "target": "",
      "level": "preserve",
      "match_mode": "case_insensitive",
      "note": "Keep English"
    },
    {
      "source": "density functional theory",
      "target": "lý thuyết phiếm hàm mật độ",
      "level": "canonical",
      "match_mode": "case_insensitive",
      "note": "Fixed technical translation"
    }
  ]
}
```

Update glossary:

```http
PUT /api/v1/glossaries/{glossary_id}
```

Request body same as create endpoint. Backend replaces by entire `entries` array.

CSV parsing:

```http
POST /api/v1/glossaries/parse-csv
```

```json
{
  "csv_text": "Source,Translation,Type,Match Mode,Note\nHartree-Fock,,Preserve,Case Insensitive,Keep English\nDFT,lý thuyết phiếm hàm mật độ,Canonical,Case Insensitive,Fixed Translation\n"
}
```

CSV headers support English and Chinese aliases:

- Source: `source/src/term/original/từ gốc/văn bản gốc/thuật ngữ`
- Translation: `target/translation/translated/bản dịch/dịch/bản dịch mục tiêu`
- Type: `level/mode/action/loại/chế độ/hành động`
- Match mode: `match/match_mode/khớp/chế độ khớp`
- Note: `note/comment/ghi chú/giải thích`
- Context: `context/ngữ cảnh/bối cảnh`

Task submission can reference named glossary via `translation.glossary_id` or pass inline entries via `translation.glossary_entries`.

## 11. Provider Validation

- `POST /api/v1/providers/mineru/validate-token`
- `POST /api/v1/providers/paddle/validate-token`
- `POST /api/v1/providers/deepseek/validate-token`
- `POST /api/v1/providers/deepseek/balance`

Recommended return statuses:

- `valid`
- `unauthorized`
- `expired`
- `network_error`
- `provider_error`

## 12. Simple App Entry

`POST /api/v1/translate/bundle`

This endpoint belongs to simple app; typically listens on `42000`. Accepts multipart flat fields; suitable for scripts uploading PDF directly and creating background translation task.

Returns `ApiResponse<JobSubmissionView>`; does not wait for Python OCR / translation / rendering completion; does not return ZIP synchronously.

## 13. Storage and Ownership

Backend is single source of truth for books, PDFs, artifacts, covers. Frontend does not persist real files.

Main storage:

- `DATA_ROOT/uploads/`: Uploaded files
- `DATA_ROOT/jobs/{job_id}/`: Task working directory
- `DATA_ROOT/downloads/`: Download cache
- `DATA_ROOT/db/jobs.db`: SQLite database

SQLite main tables:

- `uploads`: Source filename, source PDF size, page count
- `jobs`: Task status, stage, progress, timestamps, request/runtime state
- `artifacts`: Task artifact paths and cached book display metadata
- `job_artifact_entries`: Normalized artifact manifest
- `events`: Complete historical progress stream

## 14. Topic Documents

- [Local Startup and Configuration](./local-dev.md)
- [Storage Structure](./storage.md)
- [Troubleshooting](./troubleshooting.md)
- [Rust API Architecture Boundaries](../rust_api/README.md)
- [Current Runtime Main Chain](../../../backend/rust_api/CURRENT_API_MAP.md)
- [Stage Execution Contract](../../../backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider Contract](../../../backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- [Render Options Contract](../../../backend/rust_api/RENDER_OPTIONS_CONTRACT.md)

</content>