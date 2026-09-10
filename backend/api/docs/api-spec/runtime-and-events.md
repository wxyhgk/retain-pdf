# Runtime, Configuration, and Events

[API spec index](../../API_SPEC.md)


`retainpdf-api` is the external service layer for the PDF translation pipeline
and AI control plane.

Doc index:
[`README.md`](../../README.md)

If you only need the current active runtime path, read
[`CURRENT_API_MAP.md`](../../CURRENT_API_MAP.md) first.

If you need the current team-facing module boundaries and refactor rules, read
[`RUST_API_ARCHITECTURE.md`](../../RUST_API_ARCHITECTURE.md).

Its backend is now split into two layers:

- Rust side:
  - public HTTP API
  - auth / queue / SQLite job state
  - internal persistence split into `jobs`, `artifacts`, and `events`
  - OCR provider transport: submit / upload / poll / bundle download
- Python side:
  - OCR normalization to `document.v1.json`
  - translation
  - Typst rendering
  - PDF merge/post-processing

Current installed Python entrypoints used by the Rust layer:

- `retainpdf-pipeline normalize-ocr`
- `retainpdf-pipeline translate-only`
- `retainpdf-pipeline render-only`

When the package command is unavailable, auto mode falls back to the compatible
`services/pipeline/entrypoints/run_*.py` scripts. The stage spec and stdout
contracts are identical in both modes.

Legacy/local wrappers retained for manual runs (script-mode，仅桌面兼容）：

- `retainpdf-pipeline provider-case`（`services/pipeline/entrypoints/run_provider_case.py` 仅桌面兼容）
- `run_document_flow.py`（script-mode，仅桌面兼容，无 console 等价物，对应 `services/pipeline/entrypoints/run_document_flow.py`）

Current top-level workflow contract:

1. `normalize.stage.v1`
   raw OCR payload -> `ocr/normalized/document.v1.json`
2. `translate.stage.v1`
   `document.v1.json` -> `translated/`
3. `render.stage.v1`
   translated payloads + source PDF -> `rendered/*.pdf`

The Rust layer treats the stage workers as the formal production path.
For local manual use, use the neutral wrapper names above.
Regression scripts under `scripts/devtools/` are not part of the runtime contract.

Current `document.v1` consumption contract for downstream workers:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Compatibility fields such as `type/sub_type/bbox/text/lines/segments` may still be present,
but they are no longer the primary runtime contract between normalization and translation/rendering.

Current worker contract:

- Rust launches these worker entrypoints through `--spec <job_root>/specs/*.spec.json`
- the worker layer no longer relies on legacy long CLI flag assembly
- both Rust-owned workers and the maintained local job entrypoints are now treated as spec-driven execution paths

Goals:

- JSON-first API for frontend and third-party integration
- Stable resource URLs instead of leaking local filesystem paths
- Clear separation:
  - Rust API: upload, job orchestration, status, download, auth/rate-limit extension point
  - Python worker: OCR transport implementation, translation, Typst, PDF rendering, post-processing

Current internal boundary conventions:

- `routes/*` only adapts HTTP requests/responses
- `services/jobs/*` owns job query, presentation, creation orchestration, and control logic
- `services/job_snapshot_factory` owns job snapshot assembly; `worker_command` owns Python worker command/spec construction
- `../packages/retain-jobs/src/job_runner/*` owns runtime execution, process lifecycle,
  OCR-child chaining, and cancellation
- `services/ai/api.rs` owns the Rust-to-AI HTTP proxy boundary;
  `services/library_api.rs` owns conversation persistence;
  `services/public_document_operations_api.rs` owns the browser-safe operation
  projection and CAS actions
- `AppState` should stay at route entrypoints and runtime coordination layers; pure assembly helpers should prefer `&Db`, narrow config projections, and explicit arguments

Current scope:

- Upload PDF
- Create `book` / `translate` / `render` jobs under `/api/v1/jobs`
- Create `ocr` jobs under `/api/v1/ocr/jobs`
- Internally create an OCR child first for `book` and `translate` only when the
  request does not reuse a validated `source.artifact_job_id`
- Poll job status
- Fetch structured job events
- List jobs
- Fetch final PDF
- Fetch Markdown
- Fetch Markdown images
- Download combined bundle
- Fetch artifact manifest
- Fetch normalized OCR artifacts
- Proxy AI ask/SSE and runtime configuration
- Persist conversation/message trees and FX runtime cursors
- Query and confirm safe public document-operation actions

Planned but not fully implemented in this first pass:

- callback/webhook
- RBAC / tenant quota
- public/private artifact signing
- general job-status SSE push updates (`/api/v1/jobs/{job_id}/events` remains a
  paginated JSON history endpoint; AI ask SSE and live-translation SSE already
  exist)
- stronger cancel semantics

## Reading Guide

- Want to know how requests actually run through Rust + Python:
  [`CURRENT_API_MAP.md`](../../CURRENT_API_MAP.md)
- Want to know team-facing refactor boundaries:
  [`RUST_API_ARCHITECTURE.md`](../../RUST_API_ARCHITECTURE.md)
- Want to know worker/stage spec contracts:
  [`STAGE_EXECUTION_CONTRACT.md`](../../STAGE_EXECUTION_CONTRACT.md)

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
- `RUST_API_QUEUE_POLL_INTERVAL_MS`: queued job slot polling interval, default `250`
- `RUST_API_WORKER_TERMINATE_GRACE_SECS`: SIGTERM grace window before SIGKILL, default `3`
- `RUST_API_WORKER_TERMINATE_POLL_MS`: worker process exit polling interval, default `100`
- `RUST_API_FAILURE_AI_DIAGNOSIS_TIMEOUT_SECS`: AI failure diagnosis helper timeout, default `60`
- `RUST_API_SYNC_BUNDLE_WAIT_INTERVAL_MS`: sync bundle terminal-job polling interval, default `1500`

Notes:

- `X-API-Key` is for accessing the Rust API itself
- request body `translation.api_key` is the temporary inline downstream-model
  credential; new translation calls should use `translation.credential_ref`
- browsers may issue `OPTIONS` preflight for CORS; these are allowed through middleware
- if `auth.local.json` exists, it overrides key and concurrency settings from env

## Config Precedence

Current precedence contract is:

1. code defaults
2. local config files
3. environment variables
4. CLI / process startup parameters
5. request whitelist business parameters

## Runtime Knobs

These values are deployment/provider knobs, not API protocol constants. Defaults are owned by
`backend/packages/retain-core/src/config/*` and can be overridden by environment variables.

Config source map:

- `../packages/retain-core/src/config/paths.rs`: project/data/scripts/jobs/uploads/downloads paths
- `../packages/retain-core/src/config/auth.rs`: `auth.local.json`, API keys, job concurrency, simple API port
- `../packages/retain-core/src/config/server.rs`: bind host, API port, Python binary
- `../packages/retain-core/src/config/upload.rs`: global upload size/page gates
- `../packages/retain-core/src/config/provider.rs`: MinerU / Paddle / DeepSeek runtime and provider limits
- `../packages/retain-core/src/config/ai_service.rs` and `ai_proxy.rs`: supervised
  AI sidecar address, startup command, and proxy timeouts
- `../packages/retain-core/src/config/job_runner.rs`: queue polling, worker termination, failure diagnosis, sync wait knobs
- `../packages/retain-core/src/config.rs`: config facade exposing the current `AppConfig` fields

Provider upload gates:

- `RUST_API_MINERU_MAX_BYTES`: default `209715200`
- `RUST_API_MINERU_MAX_PAGES`: default `600`
- `RUST_API_PADDLE_MAX_BYTES`: default `104857600`
- `RUST_API_PADDLE_MAX_PAGES`: default `999`

Provider HTTP and retry:

- `RUST_API_MINERU_BASE_URL`: default `https://mineru.net`
- `RUST_API_MINERU_REQUEST_TIMEOUT_SECS`: default `120`
- `RUST_API_MINERU_UPLOAD_TIMEOUT_SECS`: default `300`
- `RUST_API_MINERU_DOWNLOAD_TIMEOUT_SECS`: default `300`
- `RUST_API_MINERU_POLL_RETRY_LIMIT`: default `5`
- `RUST_API_MINERU_POLL_RETRY_BASE_DELAY_SECS`: default `2`
- `RUST_API_MINERU_POLL_RETRY_MAX_DELAY_SECS`: default `10`
- `RUST_API_MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT`: default `8`
- `RUST_API_MINERU_BUNDLE_DOWNLOAD_BASE_DELAY_SECS`: default `2`
- `RUST_API_MINERU_BUNDLE_READY_RETRY_LIMIT`: default `8`
- `RUST_API_MINERU_BUNDLE_READY_BASE_DELAY_SECS`: default `2`
- `RUST_API_MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS`: default `120`
- `RUST_API_MINERU_BUNDLE_RETRY_MAX_DELAY_SECS`: default `12`
- `RUST_API_MINERU_WAITING_FILE_GRACE_SECS`: default `90`
- `RETAIN_OCR_PROVIDER_CONFIG`: canonical shared Rust/Python registry path; default `services/config/ocr_providers.json`
- `RUST_API_OCR_PROVIDER_CONFIG`: compatibility alias used only when the shared variable is unset
- `RUST_API_PADDLE_BASE_URL`: default `https://paddleocr.aistudio-app.com`
- `RETAIN_PADDLE_DEFAULT_MODEL`: canonical shared Rust/Python override; default from `services/config/ocr_providers.json`
- `RUST_API_PADDLE_DEFAULT_MODEL`: compatibility alias used only when the shared variable is unset
- `RUST_API_PADDLE_REQUEST_TIMEOUT_SECS`: default `120`
- `RUST_API_PADDLE_DOWNLOAD_TIMEOUT_SECS`: default `300`
- `RUST_API_PADDLE_REQUEST_RETRY_ATTEMPTS`: default `3`
- `RUST_API_PADDLE_REQUEST_RETRY_BASE_DELAY_MILLIS`: default `500`
- `RUST_API_PADDLE_MAX_INPUT_IMAGES`: default `999`
- `RUST_API_DEEPSEEK_BASE_URL`: default `https://api.deepseek.com/v1`
- `RUST_API_DEEPSEEK_BALANCE_URL`: default `https://api.deepseek.com/user/balance`
- `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS`: default `20`

Notes:

- request payloads may override business parameters only
- path, bind, data-root, and runtime storage locations are not request-overridable
- `DATA_ROOT` is the single storage root for uploads, jobs, downloads, and SQLite
- protocol constants such as stage names, artifact keys, API paths, schema versions, and stdout labels are intentionally not env-configurable
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
- `startup`
- `ocr_upload`
- `ocr_submitting`
- `ocr_processing`
- `ocr_result_ready`
- `normalization`
- `normalizing`
- `translation_prepare`
- `domain_inference`
- `continuation_review`
- `page_policies`
- `translating`
- `render_prepare`
- `rendering`
- `compile`
- `overlay`
- `saving`
- `finished`
- `failed`
- `canceled`

Provider-specific state is no longer part of the formal top-level stage enum.
Provider-private progress may still appear through `provider` + `provider_stage`,
for example `mineru_upload`, `mineru_processing`, or `paddle_running`.

Queue semantics:

- newly created jobs enter `queued`
- only `RUST_API_MAX_RUNNING_JOBS` jobs may be `running` at the same time
- queued jobs automatically start when a slot is released

## Job Events

Read-only structured event APIs:

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/events`

Query parameters:

- `limit` (default `100`, clamped to `1..500`)
- `offset` (default `0`)

Behavior:

- events are returned in ascending `seq` order
- the JSON response contains `items`, the effective `limit`, and `offset`; it
  does not currently contain `total` or `has_more`
- `GET /api/v1/jobs/{job_id}/events` is the historical progress and debugging stream
- runtime merges DB events, `DATA_ROOT/jobs/<job_id>/logs/pipeline_events.jsonl`, and OCR child events from `{job_id}-ocr`
- OCR child events are mapped back to the parent `job_id`
- when an event came from the OCR child job, `payload.source_job_id` contains the child job ID and `payload.source_event` contains the original child event payload
- `GET /api/v1/ocr/jobs/{job_id}/events` remains available for OCR-only debugging and direct OCR jobs
- each public event includes:
  - `job_id`, `seq`, `created_at`, `ts`, `level`
  - `display_stage`: `ocr`, `translation`, `render`, or `null`; `done` is never emitted
  - `stage`: machine-readable backend stage such as `ocr_processing`, `translating`, or `rendering`
  - `substage`
  - `stage_detail`
  - `event_type`
  - `provider`
  - `provider_stage`
  - `progress`: `{ "unit": "page|batch|step|percent|none", "current": 0, "total": 0 }`
  - `message`
  - `payload`
  - `raw`: source-kind/source-seq/debug metadata for DB, pipeline jsonl, or OCR child events
- public events do not expose top-level `user_stage`, `progress_unit`, `progress_current`, or `progress_total`; those may still exist inside `raw` / `payload.source_event`
- `event` remains a compatibility alias for legacy clients; new clients should prefer `event_type`
- `stage` stays machine-readable. Frontend current-stage UI must use job `stage_snapshot`, not events.
- completed jobs keep historical events; clients should not rely only on the final `finished` event
- `stage_snapshot` in job detail/list is authoritative for current stage and progress. Clients MUST NOT compute the active stage from `events[*]`.
- failed `failure_classified` and `job_terminal` events include `payload.contracts`
  with the same `job_stage_contracts.v1` shape as job detail, so clients can
  explain missing artifacts directly from the event stream.
- Python workers also print structured `artifact_published` JSON records to stdout.
  These records are an internal Rust/Python runtime contract, but they mirror the
  same `event_type` and `payload.artifact_key` / `payload.path` shape used in
  `pipeline_events.jsonl`.

Frontend progress conventions:

- OCR upload / provider processing / normalization should publish as `display_stage=ocr`
- OCR provider page progress should use `stage=ocr_processing`, `substage=provider_processing`, and `progress.unit=page`
- translation batches should use `display_stage=translation`, `stage=translating`, and `progress.unit=batch`
- translation page sub-stages such as `continuation_review`, `page_policies`, `domain_inference`, and `garbled_repair` should use `progress.unit=page`
- render page progress should use `display_stage=render`, `stage=rendering`, and `progress.unit=page`
- Typst compile / overlay / saving steps may use `progress.unit=step` when page-level progress is unavailable

OCR progress example:

```json
{
  "job_id": "20260514-xxxx",
  "seq": 42,
  "created_at": "2026-05-14T01:00:00Z",
  "level": "info",
  "display_stage": "ocr",
  "stage": "ocr_processing",
  "substage": "provider_processing",
  "stage_detail": "Paddle 正在解析文件，第 12/34 页",
  "event_type": "progress",
  "progress": {
    "unit": "page",
    "current": 12,
    "total": 34
  },
  "payload": {
    "source_job_id": "20260514-xxxx-ocr",
    "source_event": {
      "provider_task_id": "task-1"
    }
  }
}
```

Translation batch progress example:

```json
{
  "job_id": "20260514-xxxx",
  "display_stage": "translation",
  "stage": "translating",
  "stage_detail": "正在翻译第 8/42 批",
  "event_type": "progress",
  "progress": {
    "unit": "batch",
    "current": 8,
    "total": 42
  }
}
```

Render progress example:

```json
{
  "job_id": "20260514-xxxx",
  "display_stage": "render",
  "stage": "rendering",
  "stage_detail": "正在渲染第 18/34 页",
  "event_type": "progress",
  "progress": {
    "unit": "page",
    "current": 18,
    "total": 34
  }
}
```
