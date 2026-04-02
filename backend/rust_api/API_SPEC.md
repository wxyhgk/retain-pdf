# Rust API Spec

`rust_api` is the new external service layer for the PDF translation pipeline.

Its backend is now split into two layers:

- Rust side:
  - public HTTP API
  - auth / queue / SQLite job state
  - internal persistence split into `jobs`, `artifacts`, and `events`
  - OCR provider transport for MinerU: submit / upload / poll / bundle download
- Python side:
  - OCR normalization to `document.v1.json`
  - translation
  - Typst rendering
  - PDF merge/post-processing

Current Python entrypoints used by the Rust layer:

- `scripts/entrypoints/run_normalize_ocr.py`
- `scripts/entrypoints/run_translate_from_ocr.py`

Goals:

- JSON-first API for frontend and third-party integration
- Stable resource URLs instead of leaking local filesystem paths
- Clear separation:
  - Rust API: upload, job orchestration, status, download, auth/rate-limit extension point
  - Python worker: MinerU, translation, Typst, PDF rendering, post-processing

Current scope:

- Upload PDF
- Create translation job from uploaded PDF
- Internally create OCR child job first
- Poll job status
- Fetch structured job events
- List jobs
- Fetch final PDF
- Fetch Markdown
- Fetch Markdown images
- Download combined bundle
- Fetch normalized OCR artifacts

Planned but not fully implemented in this first pass:

- callback/webhook
- RBAC / tenant quota
- public/private artifact signing
- SSE push updates
- stronger cancel semantics
- multiple workflows in one endpoint family

## Base

- Base path: `/api/v1`
- Health path: `/health`
- Except for raw file download endpoints, all responses are JSON
- Except `GET /health`, all endpoints require `X-API-Key`

## Auth

Request header:

```http
X-API-Key: your-rust-api-key
```

Config:

- `auth.local.json`: local auth config file, preferred
- `RUST_API_KEYS`: comma-separated API key allowlist, required
- `RUST_API_MAX_RUNNING_JOBS`: max concurrently running jobs, default `4`

Notes:

- `X-API-Key` is for accessing the Rust API itself
- request body `api_key` is still the downstream model provider credential
- browsers may issue `OPTIONS` preflight for CORS; these are allowed through middleware
- if `auth.local.json` exists, it overrides key and concurrency settings from env

## Config Precedence

Current precedence contract is:

1. code defaults
2. local config files
3. environment variables
4. CLI / process startup parameters
5. request whitelist business parameters

Notes:

- request payloads may override business parameters only
- path, bind, data-root, and runtime storage locations are not request-overridable
- `DATA_ROOT` is the single storage root for uploads, jobs, downloads, and SQLite
- runtime persistence is split as:
  - `jobs`: job metadata / status machine
  - `artifacts`: artifact index JSON
  - `events`: structured event stream

## Unified JSON Envelope

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Rules:

- `code = 0` means success
- non-zero means business or server error
- `message` is short, frontend-display-safe text
- `data` is omitted only when no payload is needed

## Status Model

Job status values:

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Typical stage values:

- `queued`
- `mineru_upload`
- `mineru_processing`
- `translation_prepare`
- `domain_inference`
- `continuation_review`
- `page_policies`
- `translating`
- `rendering`
- `saving`
- `finished`
- `failed`
- `canceled`

Additional OCR-child-related stage values used by the current pipeline:

- `ocr_submitting`
- `mineru_upload`
- `mineru_processing`
- `translation_prepare`
- `normalizing`

Queue semantics:

- newly created jobs enter `queued`
- only `RUST_API_MAX_RUNNING_JOBS` jobs may be `running` at the same time
- queued jobs automatically start when a slot is released

## Job Events

Read-only structured event APIs:

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/events`

Query parameters:

- `limit`
- `offset`

Behavior:

- events are returned in ascending `seq` order
- each event includes `job_id`, `seq`, `ts`, `level`, `stage`, `event`, `message`, `payload`
- runtime also persists the same stream to `DATA_ROOT/jobs/<job_id>/logs/events.jsonl`

## 1. Upload PDF

`POST /api/v1/uploads`

Multipart fields:

- `file`: required, PDF file
- `developer_mode`: optional, `true/false`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "upload_id": "20260327190000-ab12cd",
    "filename": "paper.pdf",
    "bytes": 1234567,
    "page_count": 18,
    "uploaded_at": "2026-03-27T11:00:00Z"
  }
}
```

## 2. Create Translation Job

`POST /api/v1/jobs`

Request:

```json
{
  "workflow": "mineru",
  "upload_id": "20260327190000-ab12cd",
  "job_id": "",
  "mode": "sci",
  "render_mode": "auto",
  "model": "deepseek-chat",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxxx",
  "mineru_token": "mineru-xxxx",
  "batch_size": 1,
  "workers": 0,
  "classify_batch_size": 12,
  "rule_profile_name": "general_sci",
  "custom_rules_text": "",
  "compile_workers": 0,
  "typst_font_family": "Source Han Serif SC",
  "pdf_compress_dpi": 200,
  "translated_pdf_name": "",
  "model_version": "vlm",
  "is_ocr": false,
  "disable_formula": false,
  "disable_table": false,
  "language": "ch",
  "page_ranges": "",
  "data_id": "",
  "no_cache": false,
  "cache_tolerance": 900,
  "extra_formats": "",
  "poll_interval": 5,
  "poll_timeout": 1800,
  "start_page": 0,
  "end_page": -1,
  "skip_title_translation": false,
  "body_font_size_factor": 0.95,
  "body_leading_factor": 1.08,
  "inner_bbox_shrink_x": 0.035,
  "inner_bbox_shrink_y": 0.04,
  "inner_bbox_dense_shrink_x": 0.025,
  "inner_bbox_dense_shrink_y": 0.03
}
```

Required provider fields:

- `mineru_token`
- `base_url`
- `api_key`
- `model`

Validation:

- `mineru_token` must not be a URL-like string
- `base_url` must start with `http://` or `https://`
- `api_key` must not be a URL-like string
- Rust API no longer supplies default MinerU / LLM credentials for `create_job`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "status": "queued",
    "workflow": "mineru",
    "links": {
      "self_path": "/api/v1/jobs/20260327190500-ef3456",
      "self_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456",
      "artifacts_path": "/api/v1/jobs/20260327190500-ef3456/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts",
      "cancel_path": "/api/v1/jobs/20260327190500-ef3456/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"
    },
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
      "cancel": {"enabled": true, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
      "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
      "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
      "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
      "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
    }
  }
}
```

Execution model for `/api/v1/jobs`:

1. create parent translation job
2. create OCR child job `{job_id}-ocr`
3. OCR child completes provider transport + normalization
4. parent job reuses:
   - `normalized_document_json`
   - `normalization_report_json`
   - `layout_json`
   - `provider_raw_dir`
   - `provider_zip`
   - `provider_summary_json`
5. parent job enters translation/render

## 3. Get Job Detail

`GET /api/v1/jobs/{job_id}`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "workflow": "mineru",
    "status": "running",
    "stage": "translating",
    "stage_detail": "正在翻译，第 3/12 批",
    "progress": {
      "current": 3,
      "total": 12,
      "percent": 25.0
    },
    "timestamps": {
      "created_at": "2026-03-27T11:05:00Z",
      "updated_at": "2026-03-27T11:05:30Z",
      "started_at": "2026-03-27T11:05:01Z",
      "finished_at": null,
      "duration_seconds": null
    },
    "links": {
      "self_path": "/api/v1/jobs/20260327190500-ef3456",
      "self_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456",
      "artifacts_path": "/api/v1/jobs/20260327190500-ef3456/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts",
      "cancel_path": "/api/v1/jobs/20260327190500-ef3456/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"
    },
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
      "cancel": {"enabled": true, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
      "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
      "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
      "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
      "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
    },
    "artifacts": {
      "pdf_ready": false,
      "markdown_ready": false,
      "bundle_ready": false,
      "pdf_url": "/api/v1/jobs/20260327190500-ef3456/pdf",
      "markdown_url": "/api/v1/jobs/20260327190500-ef3456/markdown",
      "markdown_images_base_url": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
      "bundle_url": "/api/v1/jobs/20260327190500-ef3456/download",
      "normalized_document_url": "/api/v1/jobs/20260327190500-ef3456/normalized-document",
      "normalization_report_url": "/api/v1/jobs/20260327190500-ef3456/normalization-report",
      "actions": {
        "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
        "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
        "cancel": {"enabled": true, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
        "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
        "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
        "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
        "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
      },
      "normalized_document": {
        "ready": true,
        "path": "/api/v1/jobs/20260327190500-ef3456/normalized-document",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/normalized-document",
        "method": "GET",
        "content_type": "application/json",
        "file_name": "document.v1.json",
        "size_bytes": 182341
      },
      "normalization_report": {
        "ready": true,
        "path": "/api/v1/jobs/20260327190500-ef3456/normalization-report",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/normalization-report",
        "method": "GET",
        "content_type": "application/json",
        "file_name": "document.v1.report.json",
        "size_bytes": 1248
      },
      "pdf": {
        "ready": false,
        "path": "/api/v1/jobs/20260327190500-ef3456/pdf",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf",
        "method": "GET",
        "content_type": "application/pdf",
        "file_name": "paper-translated.pdf",
        "size_bytes": null
      },
      "markdown": {
        "ready": false,
        "json_path": "/api/v1/jobs/20260327190500-ef3456/markdown",
        "json_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown",
        "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
        "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
        "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
        "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/",
        "file_name": "full.md",
        "size_bytes": null
      },
      "bundle": {
        "ready": false,
        "path": "/api/v1/jobs/20260327190500-ef3456/download",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download",
        "method": "GET",
        "content_type": "application/zip",
        "file_name": "20260327190500-ef3456.zip",
        "size_bytes": null
      }
    },
    "normalization_summary": {
      "provider": "mineru",
      "detected_provider": "mineru",
      "provider_was_explicit": true,
      "pages_seen": 12,
      "blocks_seen": 428,
      "document_defaults": 0,
      "page_defaults": 0,
      "block_defaults": 0,
      "schema": "normalized_document_v1",
      "schema_version": "1.0",
      "page_count": 12,
      "block_count": 428
    },
    "log_tail": [
      "batch 123: state=done",
      "layout json: output/..."
    ]
  }
}
```

Main job detail now also includes OCR-child-facing fields in `artifacts` / detail payload:

- `ocr_job`
- `normalized_document`
- `normalization_report`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`
- `schema_version`

`normalization_summary` is a lightweight view derived from `document.v1.report.json`.
If a client needs the full adapter / compat / validation report, it should download `artifacts.normalization_report`.

## 4. List Jobs

`GET /api/v1/jobs?limit=20`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260327190500-ef3456",
        "workflow": "mineru",
        "status": "running",
        "stage": "translating",
        "created_at": "2026-03-27T11:05:00Z",
        "updated_at": "2026-03-27T11:05:30Z",
        "detail_path": "/api/v1/jobs/20260327190500-ef3456",
        "detail_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"
      }
    ]
  }
}
```

## 5. Artifact JSON

`GET /api/v1/jobs/{job_id}/artifacts`

Purpose:

- frontend consumes structured URLs only
- no local absolute path leakage

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "pdf_ready": true,
    "markdown_ready": true,
    "bundle_ready": true,
    "pdf_url": "/api/v1/jobs/20260327190500-ef3456/pdf",
    "markdown_url": "/api/v1/jobs/20260327190500-ef3456/markdown",
    "markdown_images_base_url": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "bundle_url": "/api/v1/jobs/20260327190500-ef3456/download",
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
      "cancel": {"enabled": false, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
      "download_pdf": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
      "open_markdown": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
      "open_markdown_raw": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
      "download_bundle": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
    },
    "pdf": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/pdf",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf",
      "method": "GET",
      "content_type": "application/pdf",
      "file_name": "paper-translated.pdf",
      "size_bytes": 1048576
    },
    "markdown": {
      "ready": true,
      "json_path": "/api/v1/jobs/20260327190500-ef3456/markdown",
      "json_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown",
      "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
      "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
      "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
      "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/",
      "file_name": "full.md",
      "size_bytes": 18234
    },
    "bundle": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/download",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download",
      "method": "GET",
      "content_type": "application/zip",
      "file_name": "20260327190500-ef3456.zip",
      "size_bytes": null
    }
  }
}
```

## 6. Final PDF

`GET /api/v1/jobs/{job_id}/pdf`

Response:

- raw `application/pdf`

## 7. Markdown

`GET /api/v1/jobs/{job_id}/markdown`

Default response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "content": "# title",
    "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/"
  }
}
```

`GET /api/v1/jobs/{job_id}/markdown?raw=1`

Response:

- raw `text/markdown; charset=utf-8`

## 8. Markdown Images

`GET /api/v1/jobs/{job_id}/markdown/images/{path}`

Response:

- raw image file stream

## 9. Download Bundle

`GET /api/v1/jobs/{job_id}/download`

Bundle contents:

- final translated PDF
- `markdown/full.md` if present
- `markdown/images/**` if present

Response:

- raw `application/zip`

## 10. Cancel Job

`POST /api/v1/jobs/{job_id}/cancel`

Current intent:

- best-effort kill of the running Python worker process
- mark job as `canceled`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "status": "canceled",
    "workflow": "mineru",
    "links": {
      "self_path": "/api/v1/jobs/20260327190500-ef3456",
      "self_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456",
      "artifacts_path": "/api/v1/jobs/20260327190500-ef3456/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts",
      "cancel_path": "/api/v1/jobs/20260327190500-ef3456/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"
    },
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
      "cancel": {"enabled": false, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
      "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
      "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
      "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
      "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
    }
  }
}
```

## Error Shape

Example:

```json
{
  "code": 40004,
  "message": "job not found: 20260327190500-ef3456"
}
```

Suggested code ranges:

- `400xx` request errors
- `404xx` not found
- `409xx` state conflict
- `500xx` internal error

## Storage Layout

Rust API layer stores:

- uploads in `DATA_ROOT/uploads/`
- downloads in `DATA_ROOT/downloads/`
- metadata in `DATA_ROOT/db/jobs.db`
- SQLite logical split:
  - `jobs` table for core job state
  - `artifacts` table for artifact index payload
  - `events` table for structured timeline
- job workspaces in `DATA_ROOT/jobs/<job_id>/`

Current standard job workspace layout:

- `DATA_ROOT/jobs/<job_id>/source`
- `DATA_ROOT/jobs/<job_id>/ocr`
- `DATA_ROOT/jobs/<job_id>/translated`
- `DATA_ROOT/jobs/<job_id>/rendered`
- `DATA_ROOT/jobs/<job_id>/artifacts`
- `DATA_ROOT/jobs/<job_id>/logs`

Legacy jobs using `originPDF/jsonPDF/transPDF/typstPDF` or absolute-path artifact storage are no longer supported by detail and download endpoints and must be rerun.

## Implementation Notes

- Rust API should not parse or manipulate PDF internals
- Rust only orchestrates jobs and exposes resources
- Python CLI remains the single worker implementation
- later migration to dedicated Python worker service is straightforward because the API contract is already stable
