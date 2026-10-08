# Job Retry, Ambiguity Recovery, and Control

[Jobs API index](jobs.md) · [API spec index](../../API_SPEC.md)

## Stage Retry Actions

`GET /api/v1/jobs/{job_id}/stage-actions`

Returns frontend-ready stage buttons. This endpoint is for user-initiated stage
reruns and is separate from failure-oriented `resume-plan`.

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260519010101-abcd12",
    "stages": [
      {
        "stage": "ocr",
        "label": "重试 OCR",
        "can_retry": true,
        "reason": "",
        "disabled_reason": "",
        "action": {
          "method": "POST",
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/retry-stage",
          "body": {"stage": "ocr", "ambiguous_request_policy": "block"}
        },
        "will_reuse": ["source_pdf"],
        "will_rerun": ["ocr", "translation", "render"],
        "danger": true
      },
      {
        "stage": "translation",
        "label": "重试翻译",
        "can_retry": true,
        "reason": "",
        "disabled_reason": "",
        "action": {
          "method": "POST",
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/retry-stage",
          "body": {"stage": "translation", "ambiguous_request_policy": "block"}
        },
        "will_reuse": ["source_pdf", "ocr_result"],
        "will_rerun": ["translation", "render"],
        "danger": false
      },
      {
        "stage": "render",
        "label": "重新渲染",
        "can_retry": true,
        "reason": "",
        "disabled_reason": "",
        "action": {
          "method": "POST",
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/retry-stage",
          "body": {"stage": "render", "ambiguous_request_policy": "block"}
        },
        "will_reuse": ["source_pdf", "ocr_result", "translation_result"],
        "will_rerun": ["render"],
        "danger": false
      },
      {
        "stage": "refine",
        "label": "精修译文",
        "can_retry": true,
        "reason": "",
        "disabled_reason": "",
        "action": {
          "method": "POST",
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/retry-stage",
          "body": {"stage": "refine", "create_new_job": false, "ambiguous_request_policy": "block", "refine": {"mode": "review_and_fix"}}
        },
        "will_reuse": ["source_pdf", "ocr_result", "translation_result"],
        "will_rerun": ["refine", "render"],
        "danger": false
      }
    ]
  }
}
```
Rules:

- queued/running jobs return disabled stage actions; cancel the job before
  retrying a stage.
- OCR retry currently requires the original `upload_id` or `source_url` to still
  be available on the job. Jobs that only have `source_pdf` as an artifact may
  expose OCR as disabled until artifact-backed OCR retry is implemented.
- translation retry requires `source_pdf + normalized_document_json`.
- render retry requires `source_pdf + translations_dir`.
- refine retry requires `source_pdf + translations_dir` (committed translations),
  and `translations_dir` must be the job's own `<job_root>/translated` (refine
  writes back there; a render job derived with `create_new_job=true` must refine
  its source job instead). It is disabled for jobs bound to a Rust model
  `execution_connection`. Progress shows up as `stage=rendering`,
  `substage=refining` (display stage `render`, unit `step`).

`POST /api/v1/jobs/{job_id}/retry-stage`

Request:

```json
{
  "stage": "translation",
  "mode": "from_stage",
  "create_new_job": true,
  "ambiguous_request_policy": "block",
  "overrides": {
    "translation": {
      "model": "deepseek-flash",
      "glossary_id": "glossary-xxx",
      "workers": 50
    },
    "render": {
      "compile_workers": 8
    }
  }
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260519010202-ef3456",
    "source_job_id": "20260519010101-abcd12",
    "status": "queued",
    "workflow": "book",
    "rerun_from_stage": "translation",
    "reused_artifacts": ["source_pdf", "ocr_result"],
    "rerun_stages": ["translation", "render"],
    "ambiguous_request_policy": "accept_duplicate_risk",
    "links": {},
    "actions": {}
  }
}
```

Request fields:

- `stage`: `ocr`, `translation`, `render`, or `refine`.
- `mode`: optional; currently only `from_stage` is supported.
- `create_new_job`: optional; defaults to `true`, except `stage=refine` which
  defaults to `false` and rejects `true` with `400`.
- `refine`: optional, only accepted with `stage=refine` (`400` otherwise).
  `{"mode": "review_only" | "review_and_fix", "start_page": 3, "end_page": 5}`;
  `mode` defaults to `review_and_fix`; pages are 1-based and inclusive, either
  may be omitted (omitted = whole book). Unknown keys are rejected.
- `ambiguous_request_policy`: optional; defaults to `block`. When the request
  journal contains an active ambiguous dispatch, translation retry returns
  `409` until the caller explicitly sends `accept_duplicate_risk`. Generic
  `/rerun` is also blocked in that state.
- `overrides`: optional object with `ocr`, `translation`, `render`, and
  `runtime` sections. Unknown sections are rejected. Each section is validated
  against the same input structs as normal job creation.
- `overrides.ocr.credential_ref` can replace a legacy inline OCR token, and a
  provider-specific inline token can temporarily replace an existing OCR
  reference. The backend clears the superseded source so the retry never
  persists both.

Execution semantics:

- `stage=ocr`: reuses the original upload or source URL, reruns OCR ->
  translation -> render, and creates a new `book` job.
- `stage=translation`: reuses source PDF and OCR result, reruns translation ->
  render, and creates a new `book` job.
- `stage=render`: reuses source PDF, OCR result, and translation result, reruns
  render, and creates a new `render` job by default.
- `stage=render` with `create_new_job=false`: reuses the existing job id and
  replaces render artifacts in place. A plain render never refines, even when
  the job was created with `translation.refine` enabled.
- `stage=refine` (always in place): reuses the committed translations, runs the
  refine pass (review, then targeted fixes for `review_and_fix`) inside the
  render stage right before rendering, and renders once. Accepted fixes go
  through the translation revision history (`source=refine`), so the original
  text stays revertible; the report is
  `GET /api/v1/jobs/{job_id}/translation/refine-report`. When the workflow
  finishes (succeeded, failed or canceled) the revised pages are registered for
  live translation (`pipeline_unit_committed`, `source=translation_revision`).
  The refine options are a one-shot override stored in
  `<job>/specs/refine-override.json`, never in the job's `translation.refine`;
  it is deleted when the render workflow ends and survives a runtime restart
  that requeues the job. A queued/running job returns `409`.
  Refine calls a model, so the job keeps its `translation.credential_ref` /
  `reviewer_credential_ref` (inline keys are rejected in `overrides`). If an
  earlier plain re-render already cleared them, pass
  `overrides.translation.{model, base_url, credential_ref}`; otherwise `400`.

## Resume Plan, Resume, and Generic Rerun

```text
GET  /api/v1/jobs/{job_id}/resume-plan
POST /api/v1/jobs/{job_id}/resume
POST /api/v1/jobs/{job_id}/rerun
```

`resume-plan` is read-only and returns `can_resume`, `from_stage`,
`resume_workflow`, `reuses_artifacts`, `reruns_stages`, and a disabling
`reason`. `resume` is currently an alias of `rerun`; both execute the
server-selected plan rather than accepting client overrides. Use
`retry-stage` when the caller needs to select a stage, change allowed options,
or explicitly accept an ambiguous translation-request risk.

If committed translations are available, generic rerun performs an in-place
render using the same job id. If only reusable OCR artifacts are available, it
creates a new recovery job and can seed a compatible translation checkpoint.
Queued/running jobs cannot be resumed. A durable ambiguous OCR dispatch or
translation request blocks generic rerun with `409`; the caller must use the
explicit recovery route described below or `retry-stage` with the documented
duplicate-risk policy.

## OCR Dispatch Ambiguity

`GET /api/v1/jobs/{job_id}/diagnostics` returns `ocr_ambiguity` only while the
job is failed and its latest `ocr-submit` dispatch is still ambiguous. The
projection contains the authoritative `provider`, `operation`,
`resolution_revision`, `allowed_resolutions`, and backend-derived
`receipt_fields`. An absent or resolved ambiguity is returned as `null`.

Supported receipt shapes are:

- Paddle `submit_local_file` / `submit_remote_url`: required `task_id`, optional
  `trace_id`;
- MinerU `create_extract_task`: required `task_id`, optional `trace_id`;
- MinerU `apply_upload_url`: required `batch_id` and secret `upload_url`,
  optional `trace_id`.

Resolve through `POST /api/v1/jobs/{job_id}/ocr/resolve-ambiguity`:

```json
{
  "resolution": "bind_existing_receipt",
  "resolution_revision": 3,
  "batch_id": "provider-batch-id",
  "upload_url": "<secret-upload-target>",
  "trace_id": "optional-provider-trace"
}
```

`bind_existing_receipt` accepts only the fields declared by diagnostics and
continues from provider polling without resubmitting. `accept_duplicate_risk`
must not include receipt fields and creates a new OCR retry with explicit
duplicate-submit acceptance. The job must still be failed, the dispatch must
still be ambiguous, and `resolution_revision` must equal the dispatch
generation; otherwise the backend returns `409` so stale UI state cannot bind
the wrong dispatch.

The response contains only `resolution`, `provider`, `operation`, and the new
retry `submission`. It never echoes receipt values. In particular,
`upload_url`, request hashes, existing receipt JSON, provider credentials, and
raw requests are not returned by diagnostics or the resolution response.
Durable audit events record only the names of bound receipt fields, never their
values.

## Cancel Job

`POST /api/v1/jobs/{job_id}/cancel`

Current intent:

- best-effort kill of the running Python worker process
- mark job as `canceled`

Cancel always terminates the worker process. There is no stage that gets to
finish first.

An earlier exemption let an OCR job in the `normalizing` stage keep running
after a cancel, on the theory that interrupting normalization could leave a
truncated `document.v1.json`. It cannot: normalization's only disk write goes
through `save_json_atomic()` (temp file in the same directory, then
`os.replace`), so a killed worker leaves at most an orphan `.tmp` and the
target file stays either fully old or fully new. Normalization is also a full
recompute, so a re-run needs no resume bookkeeping. Meanwhile the exemption
cost was real: the process kept running while the job sat in the database
neither killed nor marked terminal, so a user who pressed cancel had to wait
for the stage to end on its own.

The OCR-specific cancel (`POST /api/v1/ocr/jobs/{job_id}/cancel`) still only
writes the terminal `canceled` row itself when the job is still `queued`. Past
that point the process is killed and the runner records the terminal state
when it observes the exit — so a client that polls right after cancelling may
still read `running` for one tick.

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "status": "canceled",
    "workflow": "book",
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
