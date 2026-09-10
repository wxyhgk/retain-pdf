# Document-scoped Job and Agent History

[Jobs API index](jobs.md) · [API spec index](../../API_SPEC.md)

## Frontend Library Contract

The backend is the source of truth for book/library state. Frontend clients should not persist
PDFs, covers, thumbnails, or generated artifacts locally; they should consume the job/list/detail
views and resource URLs returned by the API.

Storage ownership:

- `uploads`: source file name, source PDF size, and page count
- `jobs`: status, stage, progress, timestamps, and request/runtime state
- `artifacts.artifacts_json`: canonical per-job artifact paths plus cached book display metadata
- `job_artifact_entries`: normalized artifact manifest for download/listing views
- `events`: complete historical progress stream

### Document list pagination

`GET /api/v1/documents?limit=24&offset=0` returns the current page in
`documents` and the filtered, pre-pagination count in `total`:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "documents": [],
    "total": 128
  }
}
```

`reading_status`, `tag`, and `collection_id` apply identically to the page and
to `total`. Documents without a backing upload are excluded from both. `limit`
and `offset` affect only `documents`. With `job_id`, an associated document
returns `total: 1`; a miss returns an empty page with `total: 0`.

Book display metadata:

- list items expose `display_name`, `page_count`, `source_file_name`, `cover_url`,
  `thumbnail_url`, `output_pdf_ready`, `markdown_ready`, and `bundle_ready`
- job detail exposes stable `book_summary` and `artifacts_display`
- `cover_url` and `thumbnail_url` are nullable; clients should use their local placeholder cover
  when they are null
- cover/thumbnail paths are cached in `artifacts.artifacts_json` as `cover_image_path` and
  `thumbnail_image_path`; filesystem scanning of published markdown images is only a fallback

Book media endpoints:

- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`

## Document-scoped task and Agent version history

`GET /api/v1/documents/:document_id/jobs?limit=50&offset=0` returns the
document's OCR/translation runs in deterministic newest-first order. In
addition to `items` and `invocation_summary`, this projection returns:

- `total`: authoritative number of jobs linked through `jobs.document_id`
- `limit` / `offset`: the effective page request
- `has_more`: whether another page exists

The omitted `limit` defaults to `20`; the effective value is clamped to
`1..500`. Ordering is `updated_at DESC, job_id DESC`, so equal timestamps do
not move records between repeated page reads.

Every `JobListItemView` exposes durable retry metadata from `runtime_json`:
`attempt` (one-based), `retry_count`, and `last_retry_at`. Artifact-manifest
items expose the same one-based `attempt`; clients must not infer it from event
counts or timestamps.

`GET /api/v1/documents/:document_id/agent-versions?limit=50&offset=0` returns
the safe document-level Agent candidate/commit history. Each item includes the
version and operation identity, status, active flag, content hash, timestamps,
and an authenticated `download_path` / `download_url`. Internal `artifact_key`
and filesystem paths are never returned.

For Agent versions, omitted `limit` defaults to `50` and is clamped to
`1..100`; `offset` defaults to zero. Ordering is
`created_at DESC, version_id DESC`. The response contains `versions`,
`active_version_id`, `total`, the effective `limit`, `offset`, and `has_more`.
The path is usable only while the owning operation is `result_ready` or
`committed`; callers should use the public operation projection's
`candidate_available` / `allowed_actions` before offering a download.

This endpoint is version history, not live operation state. To render and act
on the current draft/run/validation lifecycle, clients use the conversation
operation list and public CAS actions described in the
[AI control-plane contract](ai-control-plane.md#public-operation-projection-and-actions).
