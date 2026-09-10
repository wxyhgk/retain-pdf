# Jobs and Workflow API

[API spec index](../../API_SPEC.md)

This page is the stable entrypoint for job-related implementation contracts.
Existing links to `jobs.md` remain valid; detailed request, response, recovery,
and document-history rules are maintained in the pages below.

## Shared Job Conventions

- `/api/v1/jobs` owns `book`, `translate`, and `render` workflows.
- `/api/v1/ocr/jobs` owns OCR-only workflows.
- A job's detail/list `stage_snapshot` is authoritative for current progress;
  historical events must not be used to infer the active stage.
- Reusing OCR, translations, or render inputs is always validated against
  durable artifacts. A failed reuse request does not silently start a new OCR
  run.
- Retry and effectful Agent-adjacent actions use explicit state and idempotency
  boundaries. State conflicts return `409` instead of overwriting newer work.
- Provider and model secrets are never returned. Translation and OCR requests
  should use their opaque `credential_ref` fields as described in the
  [credential reference contract](credentials.md).

## Detailed Contracts

| Area | Contents |
| --- | --- |
| [Submission and workflow inputs](jobs-submission.md) | Upload, grouped create request, provider and translation options, OCR artifact reuse, validation, redaction, response and execution model |
| [Query, detail, and list projections](jobs-query.md) | Stable list fields, full job detail, stage readiness, artifacts, diagnostics summaries, and pagination response examples |
| [Retry, ambiguity recovery, and control](jobs-retry-and-control.md) | Stage actions, retry overrides, ambiguous dispatch policy, reusable artifacts, rerun boundaries, and cancellation |
| [Document-scoped job and Agent history](jobs-document-history.md) | Frontend library ownership, document job pagination, durable retry metadata, and safe Agent version history |

## Common Endpoint Map

```text
POST /api/v1/uploads
POST /api/v1/translate/bundle
POST /api/v1/jobs
GET  /api/v1/jobs
GET  /api/v1/jobs/{job_id}
GET  /api/v1/jobs/{job_id}/events
GET  /api/v1/jobs/{job_id}/diagnostics
GET  /api/v1/jobs/{job_id}/resume-plan
GET  /api/v1/jobs/{job_id}/stage-actions
POST /api/v1/jobs/{job_id}/resume
POST /api/v1/jobs/{job_id}/rerun
POST /api/v1/jobs/{job_id}/retry-stage
POST /api/v1/jobs/{job_id}/ocr/resolve-ambiguity
POST /api/v1/jobs/{job_id}/cancel
POST /api/v1/ocr/jobs
GET  /api/v1/ocr/jobs
GET  /api/v1/ocr/jobs/{job_id}
GET  /api/v1/ocr/jobs/{job_id}/events
POST /api/v1/ocr/jobs/{job_id}/cancel
POST /api/v1/documents/:document_id/translate
POST /api/v1/documents/:document_id/ocr
GET  /api/v1/documents
GET  /api/v1/documents/:document_id/jobs
GET  /api/v1/documents/:document_id/agent-versions
POST /api/v1/documents/:document_id/metadata-suggestions
GET  /api/v1/documents/:document_id/metadata-suggestions
POST /api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply
```

Artifact downloads, Reader regions, Markdown, and PDF endpoints are documented
under [Reader regions and published artifacts](artifacts.md). Durable overlay
updates are documented under [Live translation](live-translation.md).
