# Job Query, Detail, and List Projections

[Jobs API index](jobs.md) · [API spec index](../../API_SPEC.md)

## List Jobs: Stable Library Projection

`GET /api/v1/jobs`

The list response is the preferred source for the React library home page. Each
item includes stable card fields so the frontend does not need to infer them
from `request_payload`, raw artifacts, or event internals.

Stable list item fields:

- `job_id`
- `display_name`
- `workflow`
- `status`
- `attempt`: one-based durable execution attempt
- `retry_count`
- `last_retry_at`: timestamp of the last accepted retry, or `null`
- `trace_id`
- `stage_snapshot`: current main stage snapshot, or `null` for terminal jobs
- `background_snapshots`: background stage snapshots such as `render_prewarm`
- `stages`: stage-state object for `ocr`, `translation`, and `render`
- `page_count`
- `source_file_name`
- `output_pdf_ready`
- `markdown_ready`
- `bundle_ready`
- `created_at`
- `updated_at`
- `detail_path`
- `detail_url`

Example item:

```json
{
  "job_id": "20260327190500-ef3456",
  "display_name": "paper.pdf",
  "workflow": "book",
  "status": "running",
  "attempt": 1,
  "retry_count": 0,
  "last_retry_at": null,
  "trace_id": null,
  "stage_snapshot": {
    "display_stage": "translation",
    "stage": "translating",
    "substage": "translation_batches",
    "lane": "main",
    "stage_detail": "正在翻译，第 3/12 批",
    "progress": {"unit": "batch", "current": 3, "total": 12, "percent": 25.0}
  },
  "background_snapshots": [],
  "stages": {
    "ocr": {"state": "completed", "progress": {"current": null, "total": null, "percent": null}},
    "translation": {"state": "in_progress", "progress": {"unit": "batch", "current": 3, "total": 12, "percent": 25.0}},
    "render": {"state": "pending", "progress": {"current": null, "total": null, "percent": null}}
  },
  "page_count": 12,
  "source_file_name": "paper.pdf",
  "output_pdf_ready": false,
  "markdown_ready": true,
  "bundle_ready": false,
  "created_at": "2026-03-27T11:05:00Z",
  "updated_at": "2026-03-27T11:05:30Z",
  "detail_path": "/api/v1/jobs/20260327190500-ef3456",
  "detail_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"
}
```
## Get Job Detail

`GET /api/v1/jobs/{job_id}`

The detail projection always includes `ocr_reused` and
`source_artifact_job_id`. When OCR was reused, `stages.ocr.state` is `reused`;
clients must not infer reuse from event absence or from the current stage.

When the job runs its OCR in a child job (`<job_id>-ocr`, for example GLM-OCR
streaming pages to translation while it still recognizes), `stages.ocr.state`
follows that child: `in_progress` while it runs (even if translation already
started), `completed` once it succeeded, `failed` when it failed, was canceled,
or stopped with the parent. Only `completed` (or `reused`) means the job's OCR
can seed another translation; a parent that failed in translation after its OCR
child succeeded still shows `completed`. Before 2026-11-02 this was inferred
from stage order and showed `completed` as soon as translation started.

Abbreviated response (the complete DTO also contains the request, artifact,
contract, diagnostics, runtime, failure, and log projections described below):

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "workflow": "book",
    "status": "running",
    "ocr_reused": false,
    "source_artifact_job_id": null,
    "stage_snapshot": {
      "display_stage": "translation",
      "stage": "translating",
      "substage": "translation_batches",
      "lane": "main",
      "stage_detail": "正在翻译，第 3/12 批",
      "progress": {
        "unit": "batch",
        "current": 3,
        "total": 12,
        "percent": 25.0
      }
    },
    "background_snapshots": [
      {
        "display_stage": "render",
        "stage": "rendering",
        "substage": "render_prewarm",
        "lane": "background",
        "stage_detail": "渲染预热完成",
        "progress": {
          "unit": "step",
          "current": 2,
          "total": 3,
          "percent": 66.66666666666666
        }
      }
    ],
    "stages": {
      "ocr": {"state": "completed", "progress": {"current": null, "total": null, "percent": null}},
      "translation": {"state": "in_progress", "progress": {"unit": "batch", "current": 3, "total": 12, "percent": 25.0}},
      "render": {"state": "pending", "progress": {"current": null, "total": null, "percent": null}}
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
      "artifacts_path": "/api/v1/jobs/20260327190500-ef3456/files",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files",
      "cancel_path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"
    },
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files"},
      "cancel": {"enabled": true, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"},
      "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf"},
      "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown"},
      "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md"},
      "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1"}
    },
    "book_summary": {
      "title": "paper.pdf",
      "authors": null,
      "page_count": 12,
      "source_language": "ch",
      "target_language": null,
      "source_file_name": "paper.pdf",
      "cover_url": "http://127.0.0.1:41000/api/v1/documents/<document_id>/files/cover.jpg",
      "file_size_bytes": 3481120,
      "document_id": "<document_id>"
    },
    "artifacts": {
      "pdf_ready": false,
      "markdown_ready": false,
      "bundle_ready": false,
      "pdf_url": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
      "markdown_url": "/api/v1/jobs/20260327190500-ef3456/reader/markdown",
      "markdown_images_base_url": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
      "bundle_url": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
      "normalized_document_url": "/api/v1/jobs/20260327190500-ef3456/files/internal/normalized-document.json",
      "normalization_report_url": "/api/v1/jobs/20260327190500-ef3456/files/internal/normalization-report.json",
      "actions": {
        "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
        "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files"},
        "cancel": {"enabled": true, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"},
        "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf"},
        "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown"},
        "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md"},
        "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1"}
      },
      "normalized_document": {
        "ready": true,
        "path": "/api/v1/jobs/20260327190500-ef3456/files/internal/normalized-document.json",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/internal/normalized-document.json",
        "method": "GET",
        "content_type": "application/json",
        "file_name": "document.v1.json",
        "size_bytes": 182341
      },
      "normalization_report": {
        "ready": true,
        "path": "/api/v1/jobs/20260327190500-ef3456/files/internal/normalization-report.json",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/internal/normalization-report.json",
        "method": "GET",
        "content_type": "application/json",
        "file_name": "document.v1.report.json",
        "size_bytes": 1248
      },
      "pdf": {
        "ready": false,
        "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
        "method": "GET",
        "content_type": "application/pdf",
        "file_name": "paper-translated.pdf",
        "size_bytes": null
      },
      "markdown": {
        "ready": false,
        "json_path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown",
        "json_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown",
        "raw_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
        "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
        "images_base_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
        "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
        "file_name": "full.md",
        "size_bytes": null
      },
      "bundle": {
        "ready": false,
        "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
        "method": "GET",
        "content_type": "application/zip",
        "file_name": "20260327190500-ef3456.zip",
        "size_bytes": null
      }
    },
    "artifacts_display": [
      {
        "key": "output_pdf",
        "label": "译文 PDF",
        "ready": false,
        "kind": "pdf",
        "file_name": "paper-translated.pdf",
        "size_bytes": null,
        "download_url": null
      },
      {
        "key": "markdown",
        "label": "Markdown",
        "ready": true,
        "kind": "markdown",
        "file_name": "full.md",
        "size_bytes": 68234,
        "download_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md"
      }
    ],
    "contracts": {
      "schema_version": "job_stage_contracts.v1",
      "stages": [
        {
          "stage": "ocr_ready_for_translation",
          "ready": true,
          "artifacts": [
            {"artifact_key": "source_pdf", "required": true, "ready": true, "relative_path": "jobs/20260327190500-ef3456/source/input.pdf", "detail": null},
            {"artifact_key": "normalized_document_json", "required": true, "ready": true, "relative_path": "jobs/20260327190500-ef3456/ocr/normalized/document.v1.json", "detail": null},
            {"artifact_key": "layout_json", "required": false, "ready": true, "relative_path": "jobs/20260327190500-ef3456/ocr/layout.json", "detail": null}
          ]
        },
        {
          "stage": "translation_ready_for_render",
          "ready": false,
          "artifacts": [
            {"artifact_key": "source_pdf", "required": true, "ready": true, "relative_path": "jobs/20260327190500-ef3456/source/input.pdf", "detail": null},
            {"artifact_key": "translations_dir", "required": true, "ready": true, "relative_path": "jobs/20260327190500-ef3456/translated", "detail": null},
            {"artifact_key": "translation_manifest_json", "required": true, "ready": false, "relative_path": "jobs/20260327190500-ef3456/translated/translation-manifest.json", "detail": "translation_manifest_json file is not ready for 20260327190500-ef3456: ..."}
          ]
        },
        {
          "stage": "render_complete",
          "ready": false,
          "artifacts": [
            {"artifact_key": "output_pdf", "required": true, "ready": false, "relative_path": null, "detail": "20260327190500-ef3456 has not published output_pdf"},
            {"artifact_key": "summary", "required": true, "ready": false, "relative_path": null, "detail": "20260327190500-ef3456 has not published summary"}
          ]
        }
      ]
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
      "schema_version": "1.1",
      "page_count": 12,
      "block_count": 428
    },
    "glossary_summary": {
      "enabled": true,
      "glossary_id": "glossary-20260411-abc123",
      "glossary_name": "semiconductor",
      "entry_count": 12,
      "resource_entry_count": 10,
      "inline_entry_count": 3,
      "overridden_entry_count": 1,
      "source_hit_entry_count": 7,
      "target_hit_entry_count": 6,
      "unused_entry_count": 5,
      "unapplied_source_hit_entry_count": 1
    },
    "invocation": {
      "stage": "translate",
      "input_protocol": "stage_spec",
      "stage_spec_schema_version": "translate.stage.v1"
    },
    "log_tail": [
      "batch 123: state=done",
      "layout json: output/..."
    ]
  }
}
```

Failure contract:

- `data.failure` is the formal failure object when a job has entered structured failure classification
- formal failure fields include:
  - `failed_stage`
  - `failure_code`
  - `failure_category`
  - `provider`
  - `provider_stage`
  - `provider_code`
  - `summary`
  - `root_cause`
  - `retryable`
  - `upstream_host`
  - `suggestion`
  - `last_log_line`
  - `raw_excerpt`
- `data.failure_diagnostic` is kept as a compatibility projection for older clients and is derived from `data.failure` when formal fields are present

Stage contract readiness:

- `data.contracts.schema_version` is currently `job_stage_contracts.v1`
- `data.contracts.stages[]` exposes Rust-side readiness checks for stable stage boundaries
- `ocr_ready_for_translation` requires `source_pdf` and `normalized_document_json`; `layout_json` is optional but must exist if published
- `translation_ready_for_render` requires `source_pdf`, `translations_dir`, and `translation_manifest_json`. For checkpoint-aware jobs, `translation_checkpoint_json` must additionally be `complete/committed`; an `in_progress` checkpoint is never renderable. Jobs created before checkpoint v1 remain compatible.
- `render_complete` requires `output_pdf` and `summary`
- each artifact item contains:
  - `artifact_key`
  - `required`
  - `ready`
  - `relative_path`
  - `detail`
- frontend can use this field to explain why a job cannot continue or why a supposedly successful worker was rejected by Rust-side output validation

Main job detail now also includes OCR-child-facing fields in `artifacts` / detail payload:

- `ocr_job`
- `normalized_document`
- `normalization_report`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`
- `schema_version`

`normalization_summary` is a lightweight view derived from `document.v1.report.json`.
If a client needs the full adapter / defaults / validation report, it should download `artifacts.normalization_report`.

`glossary_summary` is loaded from `translation-manifest.json` when present, and falls back to the pipeline summary artifact.
It is a task-side usage snapshot, not the glossary resource itself.
It tells the frontend which named glossary was actually used for this job and how many entries were enabled, overridden, and matched during translation.

`invocation` is loaded from `translation-manifest.json` when present, and falls back to the pipeline summary artifact.
Current workers are spec-driven, so new tasks should report:

- `input_protocol=stage_spec`
- `stage_spec_schema_version`: the concrete stage schema version
This means render-only jobs can still expose the original translation glossary summary as long as the translation artifacts are preserved.

## List Jobs: Full Response Example

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
        "display_name": "paper.pdf",
        "workflow": "book",
        "status": "running",
        "attempt": 1,
        "retry_count": 0,
        "last_retry_at": null,
        "trace_id": null,
        "stage_snapshot": {
          "display_stage": "translation",
          "stage": "translating",
          "substage": "translation_batches",
          "lane": "main",
          "stage_detail": "正在翻译，第 3/12 批",
          "progress": {
            "unit": "batch",
            "current": 3,
            "total": 12,
            "percent": 25.0
          }
        },
        "background_snapshots": [],
        "stages": {
          "ocr": {"state": "completed", "progress": {"current": null, "total": null, "percent": null}},
          "translation": {"state": "in_progress", "progress": {"unit": "batch", "current": 3, "total": 12, "percent": 25.0}},
          "render": {"state": "pending", "progress": {"current": null, "total": null, "percent": null}}
        },
        "page_count": 12,
        "source_file_name": "paper.pdf",
        "cover_url": "http://127.0.0.1:41000/api/v1/documents/<document_id>/files/cover.jpg",
        "thumbnail_url": "http://127.0.0.1:41000/api/v1/documents/<document_id>/files/thumbnail.jpg",
        "output_pdf_ready": false,
        "markdown_ready": true,
        "bundle_ready": true,
        "invocation": {
          "stage": "translate",
          "input_protocol": "stage_spec",
          "stage_spec_schema_version": "translate.stage.v1"
        },
        "created_at": "2026-03-27T11:05:00Z",
        "updated_at": "2026-03-27T11:05:30Z",
        "detail_path": "/api/v1/jobs/20260327190500-ef3456",
        "detail_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"
      }
    ],
    "invocation_summary": {
      "stage_spec_count": 12,
      "unknown_count": 0
    },
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

`limit` is the effective page size (`1..=500`, default `20`; anything else is `400`), `offset` echoes the request, and
`has_more` says whether another page follows (computed by fetching one extra row). `q` (case-insensitive substring over
`job_id`, the document title, the upload file name / source URL, `stage`, `stage_detail` and `error`) and `job_ids`
(comma-separated whitelist) filter before pagination. See `docs/api/01-任务/03-任务列表.md`.

Book cards and folders read live job state through `job_ids` (at most 500 ids per request; the frontend batches).
The frozen shelf `GET /api/v1/library/books` that used to serve them, and its delete alias
`DELETE /api/v1/library/books/:job_id`, were removed on 2026-10-22 and now return `404`; delete a job with
`DELETE /api/v1/jobs/:job_id`.
