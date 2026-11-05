# Runtime, Configuration, and Events

[API spec index](../../API_SPEC.md)


`retainpdf-api` is the external service layer for the PDF translation pipeline.
（以前还是 AI 控制面，2026-11-03 跟 RetainPDF 自己的 AI 服务一起删了，产品里只留 Studio 的 AI。）

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

The Rust layer starts stage workers as `python -m retainpdf_pipeline.<stage>`
(`RUST_API_PYTHON_ENTRYPOINT_MODE` is deprecated and ignored); the
`backend/pipeline/retainpdf_pipeline/entrypoints/run_*.py` scripts are for manual
runs. The stage spec and stdout contracts are identical everywhere.

Legacy/local wrappers retained for manual runs (script-mode，仅桌面兼容）：

- `retainpdf-pipeline provider-case`（`backend/pipeline/retainpdf_pipeline/entrypoints/run_provider_case.py` 仅桌面兼容）

Current top-level workflow contract:

1. `normalize.stage.v1`
   raw OCR payload -> `ocr/normalized/document.v1.json`
2. `translate.stage.v1`
   `document.v1.json` -> `translated/`
3. `render.stage.v1`
   translated payloads + source PDF -> `rendered/*.pdf`
   `params.refine` (always written, all keys present):
   `{"mode": "off|review_only|review_and_fix", "trigger": "auto|manual", "start_page": null|int, "end_page": null|int, "max_items": int, "max_tokens": int, "reviewer_model": str, "reviewer_base_url": str, "reviewer_credential_ref": "" | "env:RETAIN_REVIEWER_API_KEY"}`.
   The worker refines committed translations before rendering when `mode != off`.
   Rust picks the mode: a `retry-stage stage=refine` one-shot override
   (`specs/refine-override.json`) -> override values with `trigger=manual`; the render
   that directly follows translation (Book / Translate with render_after_translation,
   including its durable resume) -> the job's `translation.refine` with `trigger=auto`;
   every other render (plain re-render, rerun) -> `off`. Pages are 1-based and inclusive.
   The translation model keeps using `params.model/base_url/credential_ref`; keys only
   travel as env (`RETAIN_TRANSLATION_API_KEY`, `RETAIN_REVIEWER_API_KEY`).

The Rust layer treats the stage workers as the formal production path.
For local manual use, use the neutral wrapper names above.
Regression scripts under `backend/pipeline/devtools/` are not part of the runtime contract.

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
- `services/jobs/*` (logical path; the code is the `retainpdf-jobs` package, `backend/packages/retainpdf-jobs/src`) owns job query, presentation, creation orchestration, and control logic
- `services/jobs/lifecycle/snapshot_factory` owns job snapshot assembly; `worker_command` owns Python worker command/spec construction
- `../packages/retainpdf-runner/src/job_runner/*` owns runtime execution, process lifecycle,
  OCR-child chaining, and cancellation
- `AppState` should stay at route entrypoints and runtime coordination layers; pure assembly helpers should prefer `&Db`, narrow config projections, and explicit arguments

Current scope:

- Upload PDF
- Create `book` / `translate` / `render` jobs under `/api/v1/jobs`
- Create OCR-only jobs (`workflow=ocr`) under `/api/v1/jobs`, after `/api/v1/uploads`
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

Planned but not fully implemented in this first pass:

- callback/webhook
- RBAC / tenant quota
- public/private artifact signing
- general job-status SSE push updates (`/api/v1/jobs/{job_id}/progress/events` remains a
  paginated JSON history endpoint; live-translation SSE already
  exists)
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
- All endpoints require `X-API-Key` except: `GET /health` and `GET /ready`
  (also served on the simple port), the sign-in routes `GET
  /api/v1/auth/session`, `POST /api/v1/auth/login`, `POST /api/v1/auth/register`,
  and the three model-executor worker routes under
  `/api/v1/internal/model/jobs/:job_id/requests…`, which authenticate with a
  per-job capability instead (see [Model Executor Worker Routes](#model-executor-worker-routes))

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
- `RUST_API_WORKER_OUTPUT_DRAIN_SECS`: after a worker exits, how long the stdout
  reader may go without reading a new line before the runner gives up, default `30`
  (stderr: how long to wait in total). While the stdout reader is still working
  through a backlog it is waited for, up to 20× this value — every line is persisted,
  so a worker that prints thousands of progress lines and exits can leave a backlog
  whose last line is the `output_pdf` publication (2026-11-04). Normally these finish
  instantly — the cap exists because a grandchild that called `setsid()` escapes
  the process-group kill and can keep the pipe write end open forever, which
  would otherwise hang the runner on that job with no log line explaining it.
  On expiry the remaining output is dropped and the job still reaches a terminal
  state.
- `RUST_API_FAILURE_AI_DIAGNOSIS_TIMEOUT_SECS`: AI failure diagnosis helper timeout, default `60`
- `RUST_API_SYNC_BUNDLE_WAIT_INTERVAL_MS`: sync bundle terminal-job polling interval, default `1500`

Notes:

- `X-API-Key` is for accessing the Rust API itself
- request body `translation.api_key` is the temporary inline downstream-model
  credential; new translation calls should use `translation.credential_ref`
- browsers may issue `OPTIONS` preflight for CORS; these are allowed through middleware
- single mode (since 2026-10-22) answers CORS only for loopback origins
  (`localhost`, `127.0.0.0/8`, `[::1]`, any port), origins whose host equals the
  request `Host` / `X-Forwarded-Host` (port may differ), and
  `RUST_API_ALLOWED_ORIGINS`; other origins get no CORS headers but are not
  rejected. Methods and request headers are mirrored, all response headers are
  exposed, no credentials. When listening on a loopback address, a `Host` that is not
  `localhost`, an IP literal or listed in `RUST_API_ALLOWED_HOSTS` gets `403
  request host is not allowed` (DNS rebinding); on a non-loopback address the
  `Host` check only applies when `RUST_API_ALLOWED_HOSTS` is set. See
  `docs/core/api/index.md` section 1.1.
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
`backend/packages/retainpdf-core/src/config/*` and can be overridden by environment variables.

Config source map:

- `../packages/retainpdf-core/src/config/paths.rs`: project/data/scripts/jobs/uploads/downloads paths
- `../packages/retainpdf-core/src/config/auth.rs`: `auth.local.json`, API keys, job concurrency, simple API port
- `../packages/retainpdf-core/src/config/server.rs`: bind host, API port, Python binary
- `../packages/retainpdf-core/src/config/upload.rs`: global upload size/page gates
- `../packages/retainpdf-core/src/config/provider.rs`: MinerU / Paddle / DeepSeek runtime and provider limits
- `../packages/retainpdf-core/src/config/job_runner.rs`: queue polling, worker termination, failure diagnosis, sync wait knobs
- `../packages/retainpdf-core/src/config.rs`: config facade exposing the current `AppConfig` fields

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
- `RETAIN_OCR_PROVIDER_CONFIG`: canonical shared Rust/Python registry path; default `backend/config/ocr_providers.json`
- `RUST_API_OCR_PROVIDER_CONFIG`: compatibility alias used only when the shared variable is unset
- `RUST_API_PADDLE_BASE_URL`: default `https://paddleocr.aistudio-app.com`
- `RETAIN_PADDLE_DEFAULT_MODEL`: canonical shared Rust/Python override; default from `backend/config/ocr_providers.json`
- `RUST_API_PADDLE_DEFAULT_MODEL`: compatibility alias used only when the shared variable is unset
- `RUST_API_PADDLE_REQUEST_TIMEOUT_SECS`: default `120`
- `RUST_API_PADDLE_DOWNLOAD_TIMEOUT_SECS`: default `300`
- `RUST_API_PADDLE_REQUEST_RETRY_ATTEMPTS`: default `3`
- `RUST_API_PADDLE_REQUEST_RETRY_BASE_DELAY_MILLIS`: default `500`
- `RUST_API_PADDLE_MAX_INPUT_IMAGES`: default `999`
- `RUST_API_DEEPSEEK_BASE_URL`: default `https://api.deepseek.com/v1`
- `RUST_API_DEEPSEEK_BALANCE_URL`: default `https://api.deepseek.com/user/balance`
- `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`: default `20`; timeout shared by the four
  credential probes (`/providers/{mineru,paddle}/validate-token`,
  `/providers/deepseek/{validate-token,balance}`). Keep it below the web client's
  30 s wait. Probes never retry and never follow redirects (a 3xx answer becomes
  `status: "redirected"`); task-time MinerU / Paddle clients keep their own
  timeouts and retries above.
- `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS`: legacy name, used only when
  `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS` is unset
- `RUST_API_ALLOW_PRIVATE_PROVIDER_URLS`: default off. Probe `base_url` policy:
  single-user mode allows loopback and private networks (the user's own machine)
  but still blocks link-local / cloud metadata addresses; multi-user mode blocks
  loopback, private and link-local. Setting this to `1` allows everything in both
  modes. Details: `docs/core/rust_api/08-Provider 校验接口.md`.

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

Exceptions:

- `GET /ready` that is not ready returns HTTP `503` with `code = 50300`,
  `message = "not ready"`, an `error` object (`SERVICE_UNAVAILABLE`,
  `details.reasons`) **and** the full readiness view in `data` (see
  [Health and Readiness](#health-and-readiness)). Before 2026-10-22 the 503 body
  still said `code: 0`, `message: "ok"`.
- The model-executor worker routes return bare JSON on success (no envelope).

## Health and Readiness

Neither route needs `X-API-Key`; both are also served on the simple port.

`GET /health` (liveness) always answers `200`:

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | `"up"` \| `"degraded"` | `degraded` when the job database does not answer a ping |
| `db` | `"ok"` \| `"error"` | same check |
| `queue_depth` | integer \| `null` | queued jobs; `null` when the count cannot be read (before 2026-10-22 this was `0`, which looked idle) |
| `running_jobs` | integer \| `null` | running jobs; `null` when the count cannot be read |
| `provider_backends` | string[] | OCR provider keys this build supports |
| `ai_service` | string | 固定 `"disabled"`：AI 服务 2026-11-03 删了，键留着不删（以前是 AI 服务的监督器状态） |
| `jobsd` | string | supervisor state of jobsd: `starting`, `healthy`, `unhealthy`, or `unsupervised` |
| `disk` | object | since 2026-10-24: the disk holding the data directory — `free_bytes` (integer \| `null` when unknown, e.g. on Windows), `min_free_bytes` (`RUST_API_MIN_FREE_DISK_MB`; `0` disables the check), `low` (below the floor). Below the floor, new uploads and new jobs answer `503` with `error.details.reason = "insufficient_storage"`; `status` and `/ready` do not change |
| `time` | string | server time, ISO 8601 |

`GET /ready` (readiness) answers `200` when ready and `503` otherwise; decide by
the HTTP status (Docker uses `curl -f`, the dev stack waits for a 2xx):

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | `"ready"` \| `"not_ready"` | |
| `components.db` / `.ai_service` / `.jobsd` | `{required, status}` | `db` is always required; jobsd only when this process supervises it, otherwise `status = "not_required"`；`ai_service` 2026-11-03 起固定 `{required: false, status: "not_required"}` |
| `reasons` | string[] | `db_unavailable`, `jobsd_not_healthy`; empty when ready（`ai_service_not_healthy` 不会再出现） |
| `time` | string | server time, ISO 8601 |

Not ready:

```json
{
  "code": 50300,
  "message": "not ready",
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "http_status": 503,
    "details": { "reasons": ["jobsd_not_healthy"] }
  },
  "data": { "status": "not_ready", "components": { "...": "..." }, "reasons": ["jobsd_not_healthy"], "time": "..." }
}
```

## Model Executor Worker Routes

The translation worker calls the upstream model through the Rust executor:

- `POST /api/v1/internal/model/jobs/:job_id/requests`
- `GET /api/v1/internal/model/jobs/:job_id/requests/:operation_id`
- `POST /api/v1/internal/model/jobs/:job_id/requests/:operation_id/cancel`

They sit outside the `X-API-Key` layer and require `Authorization: Bearer
<capability>`, a 64-hex token bound to one job and minted by the job runtime
in-process when it launches the worker. An application API key is never
accepted as a capability. There is no issuance route: `POST
/api/v1/internal/model/jobs/:job_id/capability` had no production caller and was
removed on 2026-10-22 (now `404`). Multi-user policy: `closed`.

The capability is checked before the request body is parsed, so a request
without a valid capability only ever gets `401` and learns nothing about the
body. With a valid capability, body errors follow the shared extractor contract
in the unified error envelope: missing or non-JSON `Content-Type` `415`, syntax
error `400`, unknown field `400` (message names the field only), other schema
mismatch `422`; values from the request are never echoed. Success responses
are bare JSON (`ModelOperation`, or `{"changed": bool}` for cancel); every error
uses the unified envelope.

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

- `GET /api/v1/jobs/{job_id}/progress/events` (the old `/api/v1/jobs/{job_id}/events` and `/api/v1/ocr/jobs/{job_id}/events` were removed on 2026-10-18)

Query parameters:

- `limit` (default `500`, `1..=500`; outside that range the request is rejected with `400`)
- `start` (`tail` by default, or `head`) and `cursor`; `offset` is not accepted. See `docs/core/api/event-feed-v2.md`

Behavior:

- events are returned in ascending `seq` order
- the JSON response contains `protocol_version`, `items`, `next_cursor`, `has_more` and the effective `limit`
- `GET /api/v1/jobs/{job_id}/progress/events` is the historical progress and debugging stream
- runtime merges DB events, `DATA_ROOT/jobs/<job_id>/logs/pipeline_events.jsonl`, and OCR child events from `{job_id}-ocr`
- OCR child events are mapped back to the parent `job_id`
- when an event came from the OCR child job, `payload.source_job_id` contains the child job ID and `payload.source_event` contains the original child event payload
- OCR-only jobs use the same `progress/events` address
- each public event includes:
  - `job_id`, `seq`, `created_at`, `ts`, `level`
  - `display_stage`: `ocr`, `translation`, `render`, or `null`; `done` is never emitted
  - `stage`: machine-readable backend stage such as `ocr_processing`, `translating`, or `rendering`
  - `substage`
  - `stage_detail`
  - `event_type`
  - `provider`
  - `provider_stage`
  - `progress`: `{ "unit": "page|batch|block|step|percent|none", "current": 0, "total": 0 }`
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
