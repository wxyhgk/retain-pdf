# Job Retry, Ambiguity Recovery, and Control

[Jobs API index](jobs.md) · [API spec index](../../API_SPEC.md)

> Address note: `/jobs/{job_id}/…` is grouped into eight categories (`actions`, `progress`, `files`, `reports`, `reader`, `translations`, `data`; `ai` was removed on 2026-11-03). The old addresses were removed on 2026-10-18 and now return 404; use the new ones (for example `GET /jobs/{job_id}/actions`, `POST /jobs/{job_id}/actions/retry-stage`, `/actions/resume`, `/actions/rerun`, `/actions/cancel`, `/actions/resolve-ocr-ambiguity`, `GET /jobs/{job_id}/reports/failure`, `/reports/refine`). Old-to-new table: [`docs/api/01-任务/04-任务接口分类.md`](../../../../docs/api/01-任务/04-任务接口分类.md); every endpoint: [`docs/api/00-接口目录.md`](../../../../docs/api/00-接口目录.md).

> Contract: [`job-actions.v1`](../../../../contracts/job-actions.v1.schema.json) covers `actions`, `actions/cancel`, `actions/resume` (GET plan, POST resume), `actions/retry-stage` and `actions/resolve-ocr-ambiguity`; [`job-reports.v1`](../../../../contracts/job-reports.v1.schema.json) covers `reports/failure`. The 409 `error.details.reason` values are the contract's `ActionBlockReason` enum.

## Stage Retry Actions

`GET /api/v1/jobs/{job_id}/actions`

Returns frontend-ready stage buttons. This endpoint is for user-initiated stage
reruns and is separate from failure-oriented `GET /api/v1/jobs/{job_id}/actions/resume`.

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
        "disabled_code": null,
        "action": {
          "method": "POST",
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
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
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
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
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
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
          "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
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

`POST /api/v1/jobs/{job_id}/actions/retry-stage`

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

`disabled_code` (additive, 2026-10-19) is the machine-readable twin of
`disabled_reason`: `null` when `disabled_reason` is empty, otherwise one of the
reasons in the table below (the same values a refused `retry-stage` returns in
`error.details.reason`). Translation with an ambiguous request journal keeps
`can_retry=true` and reports `disabled_code=ambiguous_translation_request` (retry needs
`ambiguous_request_policy=accept_duplicate_risk`).

The same gate applies to the automatic resume after a runtime restart: a job that
was in the translation stage with an unfinished request in the journal is not
resumed; it ends `failed` with `failure_code=translation_request_ambiguous`
(`resume_from=translation`) and the retry above is the way forward. A clean or
missing journal still resumes automatically; render/refine stages ignore the journal.

Automatic resume is also capped (additive, 2026-10-19). Startup recovery and the
runtime driverless sweep count, per pipeline attempt, how many times in a row a job
was put back to `queued` without any new progress in between (no new committed unit,
no newly completed stage). After `MAX_AUTO_RESUMES_WITHOUT_PROGRESS` (3) such resumes,
the next time the job is found interrupted it ends `failed` with
`failure_code=auto_resume_limit_exceeded` (`failure_category=internal`,
`failed_stage=startup_recovery`, `retryable=true`, `resume_from=null`, summary
「自动续跑次数超过上限，疑似导致运行时崩溃」) instead of being resumed again. Progress
between two interruptions resets the count; a manual retry or resume claims a new
attempt and starts from zero. The counters live in `pipeline_attempts.auto_resume_count`
/ `auto_resume_progress` (schema migration v27).

### Refusals: 400 versus 409, and `error.details.reason`

A request that is itself malformed is `400` regardless of the job's state:
unsupported `mode`, `refine` options on a non-refine stage, `create_new_job=false`
for `ocr`/`translation`, `create_new_job=true` for `refine`, invalid `overrides`,
and **any unknown field in the request body** (`RetryStageRequest` and
`resolve-ocr-ambiguity` use `deny_unknown_fields`; a misspelled
`createNewJob` used to be ignored and silently created a new job).

A valid request that the job's current state does not allow is `409`, and every
such `409` carries a stable `error.details.reason` (envelope otherwise identical
to a plain `CONFLICT`; see
[`docs/api/00-约定/02-认证与错误.md`](../../../../docs/api/00-约定/02-认证与错误.md)).
Before 2026-10-19 "job is queued or running" and "required artifacts are missing"
returned `400` here (refine returned `409`); they are all `409` now.

| `reason` | When | Endpoints |
|---|---|---|
| `job_active` | job is queued/running; cancel it first. Checked before everything else. Also returned to the losing request when two in-place reruns read the same terminal state and the other one already started | retry-stage (every stage, in place or new job), resume/rerun, resolve-ocr-ambiguity |
| `job_not_active` | cancel on a job that is not queued/running | cancel |
| `artifacts_missing` | artifacts or the original source (`upload_id`/`source_url`) the stage or resume plan needs are gone | retry-stage, resume/rerun |
| `translations_not_owned` | refine target renders another job's translations; refine the source job | retry-stage `stage=refine` |
| `ambiguous_ocr_dispatch` | OCR dispatch outcome is ambiguous; resolve with `resolve-ocr-ambiguity` (bind receipt or accept duplicate risk), not by retrying translation | retry-stage (ocr), resume/rerun |
| `ambiguous_translation_request` | translation request outcome is ambiguous; retry-stage translation with `ambiguous_request_policy=accept_duplicate_risk` | retry-stage (translation), resume/rerun |
| `request_journal_corrupt` | translation request journal is corrupt; `accept_duplicate_risk` cannot repair it | retry-stage `stage=translation`, resume/rerun |
| `model_executor_unsupported` | job is bound to a Rust model executor; legacy retry/resume/refine is disabled | retry-stage, resume/rerun |
| `stale_resolution` | `resolution_revision` is stale, or another request already resolved the ambiguity. For an in-place rerun: the job ran again (its run generation changed) after this request read it; reload and retry | resolve-ocr-ambiguity, retry-stage (in-place render / refine), resume/rerun (in-place render) |
| `no_ocr_dispatch` | job is neither failed nor canceled, or has no ambiguous OCR dispatch | resolve-ocr-ambiguity |
| `ocr_dispatch_unsupported` | the ambiguous dispatch is for a provider/operation whose receipt cannot be bound | resolve-ocr-ambiguity |

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
  `/actions/rerun` is also blocked in that state.
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
  `GET /api/v1/jobs/{job_id}/reports/refine`. When the workflow
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

### In-place reruns and the previous PDF

`stage=render` with `create_new_job=false`, `stage=refine`, and the in-place
render chosen by resume/rerun keep the job id and run again on the same job
(`relaunch_in_place`):

- The write that requeues the job is a compare-and-set: it only succeeds while
  the row still has the terminal status and run generation the request read.
  Of two concurrent requests only one starts; the other gets `409`
  (`job_active` while the winner is queued/running, `stale_resolution` if it
  already finished). The winner's row is never reset back to `queued`.
- A refused relaunch (`409`, `503` model executor not enabled, page quota,
  persistence failure) changes nothing: the previous translated PDF, the
  `<id>-ocr` child job and its directory are left as they were, and
  `files/output/translated.pdf` keeps serving the old PDF. (Resume/rerun used to
  delete `rendered/` and the `-ocr` child before validating.)
- Once the run is persisted, the previous PDF is renamed to
  `<name>.previous.pdf` in the same directory and `artifacts.previous_output_pdf`
  points there, so the renderer (which rewrites `rendered/<name>.pdf`
  non-atomically) cannot truncate it; merged reading keeps using it while the
  job is queued. The rest of `rendered/` is no longer wiped. Resume/rerun drops
  the stale `-ocr` child only after the run started.
- When the run ends `failed` or `canceled` with no new `output_pdf`, every job
  write restores `artifacts.output_pdf` to the previous PDF (if the file still
  exists), so `translated.pdf`, page previews and the Word export keep working.
  `translated.pdf` is `404 … not ready` only while the rerun is queued/running.

## Resume Plan, Resume, and Generic Rerun

```text
GET  /api/v1/jobs/{job_id}/actions/resume
POST /api/v1/jobs/{job_id}/actions/resume
POST /api/v1/jobs/{job_id}/actions/rerun   (old name of actions/resume)
```

`GET .../actions/resume` is read-only and returns `can_resume`, `from_stage`,
`resume_workflow`, `reuses_artifacts`, `reruns_stages`, a disabling
`reason` and its machine-readable twin `reason_code` (additive, `null` when
`can_resume` is true; same values as the table above: `job_active`,
`model_executor_unsupported`, `ambiguous_translation_request`, `request_journal_corrupt`,
`artifacts_missing`). `POST .../actions/resume` executes the server-selected plan.
`actions/rerun` is the old name of the same handler (marked `old` in the
endpoint registry since 2026-10-19); new code posts to `actions/resume` and reads
the `actions.resume` link of job views (`actions.rerun` carries the same value
for now). Use
`actions/retry-stage` when the caller needs to select a stage, change allowed options,
or explicitly accept an ambiguous translation-request risk.

If committed translations are available, generic rerun performs an in-place
render using the same job id. If only reusable OCR artifacts are available, it
creates a new recovery job and can seed a compatible translation checkpoint.
Queued/running jobs cannot be resumed (`409`, `reason=job_active`). When no
checkpoint is usable the POST is also `409` (`reason=artifacts_missing`), not
`400`. A durable ambiguous OCR dispatch or
translation request blocks generic rerun with `409` (`reason=ambiguous_ocr_dispatch` /
`ambiguous_translation_request`;
`request_journal_corrupt` when the journal is corrupt); the caller must use the
explicit recovery route described below or `actions/retry-stage` with the documented
duplicate-risk policy.

## OCR Dispatch Ambiguity

Where the dispatch record lives: the record of the provider submit is written under the job
that actually calls the provider. A book/translate job runs its OCR in the child job
`{job_id}-ocr`, so the record belongs to the child; a standalone OCR job owns it itself. Every
`{job_id}` in this section (diagnostics, `retry-stage`/`rerun` gates, `resolve-ocr-ambiguity`) is the
user-visible job id and is resolved to the owner (`{job_id}-ocr` first, then `{job_id}`), so a
book job's failed OCR is reported and gated on the book job. A `bind_existing_receipt` recovery
job is a book job as well; its seeded receipt is attached to its own `{recovery_job_id}-ocr`
child, whose provider call therefore resumes polling instead of submitting again.

When a record becomes `ambiguous` (the outcome of the provider request is unknown, so a retry
could submit again and be billed twice): (1) the submit call fails after the intent was
recorded with a transport error that does not prove the request stayed local (response timeout,
connection reset, 5xx, unreadable response) or the upload is cancelled mid-flight; (2) the runtime
restarts while the intent has no receipt. Requests that provably did not reach or were refused by
the provider (connection could not be established, request could not be built, 4xx/auth/quota
refusals) discard the intent instead, so a plain retry stays allowed. A job cancelled while its
upload was in flight is also left ambiguous; use `retry-stage` with
`ambiguous_request_policy=accept_duplicate_risk` to retry it.

`GET /api/v1/jobs/{job_id}/reports/failure` returns `ocr_ambiguity` only while the
job is failed or canceled (an upload canceled midway may have reached the provider) and its latest `ocr-submit` dispatch is still ambiguous. The
projection contains the authoritative `provider`, `operation`,
`resolution_revision`, `allowed_resolutions`, and backend-derived
`receipt_fields`. An absent or resolved ambiguity is returned as `null`.

Supported receipt shapes are:

- Paddle `submit_local_file` / `submit_remote_url`: required `task_id`, optional
  `trace_id`;
- MinerU `create_extract_task`: required `task_id`, optional `trace_id`;
- MinerU `apply_upload_url`: required `batch_id` and secret `upload_url`,
  optional `trace_id`.

Resolve through `POST /api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity`:

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
the wrong dispatch. The `reason` says which precondition failed: `job_active`
(queued/running), `no_ocr_dispatch` (neither failed nor canceled, or nothing ambiguous),
`stale_resolution` (revision mismatch, or lost the race to another request).
Unknown request fields are `400`.

The response contains only `resolution`, `provider`, `operation`, and the new
retry `submission`. It never echoes receipt values. In particular,
`upload_url`, request hashes, existing receipt JSON, provider credentials, and
raw requests are not returned by diagnostics or the resolution response.
Durable audit events record only the names of bound receipt fields, never their
values.

## Cancel Job

`POST /api/v1/jobs/{job_id}/actions/cancel`

Current intent:

- best-effort kill of the running Python worker process
- mark job as `canceled`

Cancelling a job that is not queued/running returns `409` with
`error.details.reason = "job_not_active"`.

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

For an OCR-workflow job (`workflow=ocr`), cancel only
writes the terminal `canceled` row itself when the job is still `queued`. Past
that point the process is killed and the runner records the terminal state
when it observes the exit — so a client that polls right after cancelling may
still read `running` for one tick.

The response `status` is the stored status right after the cancel, not a fixed
`canceled` (since 2026-10-19): normally `canceled`; `running` for an OCR job past
`queued` (see above); or the job's own terminal status (for example `succeeded`)
when it finished on its own just before the cancel landed.

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
      "artifacts_path": "/api/v1/jobs/20260327190500-ef3456/files",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files",
      "cancel_path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"
    },
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files"},
      "cancel": {"enabled": false, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"},
      "download_pdf": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf"},
      "open_markdown": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown"},
      "open_markdown_raw": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md"},
      "download_bundle": {"enabled": false, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1"}
    }
  }
}
```
