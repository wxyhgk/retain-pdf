# Document-scoped Job and Agent History

[Jobs API index](jobs.md) · [API spec index](../../API_SPEC.md)

> Address note: `/jobs/{job_id}/…` is grouped into eight categories (`actions`, `progress`, `files`, `reports`, `reader`, `translations`, `data`; `ai` was removed on 2026-11-03). The old addresses were removed on 2026-10-18 and now return 404; use the new ones (a book's cover and thumbnail are `GET /documents/{document_id}/files/cover.jpg` and `/files/thumbnail.jpg`). Old-to-new table: [`docs/api/01-任务/04-任务接口分类.md`](../../../../docs/api/01-任务/04-任务接口分类.md); every endpoint: [`docs/api/00-接口目录.md`](../../../../docs/api/00-接口目录.md).

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
    "total": 128,
    "limit": 24,
    "offset": 0,
    "has_more": true
  }
}
```

`reading_status`, `collection_id`, and `q` apply identically to the page
and to `total`. Documents without a backing upload are excluded from both.
`limit` and `offset` affect only `documents`. With `job_id`, an associated
document returns `total: 1`; a miss returns an empty page with `total: 0`.

Paging (2026-10-22, rules in `docs/api/00-约定/03-分页.md`):

- `limit` (default `50`) outside `1..=500` is rejected with `400`
  (`limit must be 1..=500`); it used to be clamped silently.
- `limit`, `offset` and `has_more` are echoed. `has_more` is
  `offset + documents.length < total`; the page and `total` are read from one
  SQLite snapshot and no rows are skipped, so the comparison is exact.
- Ordering is `added_at DESC, document_id DESC`: documents added in the same
  second (a batch upload) no longer move between pages.
- With `job_id` the request is a lookup, not a page: `reading_status`,
  `collection_id`, `q` and `offset` have no effect, at most one document is
  returned, `limit` is still validated, `limit`/`offset` are echoed as sent and
  `has_more` is always `false`.
- Unknown query parameters are rejected with `400`
  (``unknown field `tag`, expected one of ... in the query string``). Tags were
  removed on 2026-09-26; `tag` used to be ignored silently.

`q` is document-level text search: a document matches when either its `title`
or its original `source_filename` contains the query (case-insensitive for
ASCII). `%` and `_` in the query are matched literally, not as wildcards. A
blank or whitespace-only `q` is equivalent to omitting it.

`q` is distinct from `GET /api/v1/search`, which searches **block-level body
text** for the reader's full-text hits. `q` only searches the document's own
title and filename, for library/shelf lookup.

Because `total` reflects the same filter, clients can paginate search results
normally. Before `q` existed, clients had to fetch a large first page and
filter locally, which silently dropped matches beyond that page.

Each document (list items and `GET /api/v1/documents/:document_id`) carries
`has_translation: bool` — whether the document has **any** succeeded job that is
not OCR-only. It answers "can this book be read side by side" and is independent
of `active_job_id`: while a re-translation or re-render is running, or after it
failed, an earlier translation is still readable, and `GET
/api/v1/documents/:document_id/reading` still resolves to it. The flag is a
database-only check (one indexed lookup per row); it does not open output PDFs,
so the reading endpoint remains the authority on what actually opens. Older
clients can ignore the field.

When several range translations have to be merged, the reading endpoint
returns a virtual job id `merged-<document_id>-<fingerprint>` backed by
`data/documents/<document_id>/merged/<fingerprint>/`. Every read of that id
refreshes a `.last-used` marker inside the directory; an older merged directory
is pruned only after it has gone unread for 24 hours and a newer merge for the
same book is built (the one the reading endpoint currently points at is never
pruned). Reads of a pruned id return `404` with
`error.details.reason = "merged_reading_expired"` (message unchanged:
`job not found: <id>`); clients call the reading endpoint again for a fresh id.
Concurrent reading requests for the same merge build it once; at most two
merges build at a time per process. The book's page count is the source PDF's
actual page count (cached by file stamp), falling back to `documents.page_count`
only when the PDF cannot be read; `/translation-coverage` uses the same count.

Book display metadata:

- list items expose `display_name`, `page_count`, `source_file_name`, `cover_url`,
  `thumbnail_url`, `output_pdf_ready`, `markdown_ready`, and `bundle_ready`
- job detail exposes stable `book_summary` and `artifacts_display`
- `cover_url` and `thumbnail_url` are nullable; clients should use their local placeholder cover
  when they are null
- cover/thumbnail paths are cached in `artifacts.artifacts_json` as `cover_image_path` and
  `thumbnail_image_path`; filesystem scanning of published markdown images is only a fallback

Book media endpoints:

- `GET /api/v1/documents/{document_id}/files/cover.jpg`
- `GET /api/v1/documents/{document_id}/files/thumbnail.jpg`

The old per-job addresses `GET /api/v1/jobs/{job_id}/cover` and `/thumbnail` were removed on 2026-10-18. A job's `cover_url` / `thumbnail_url` already point at the book's address, and are `null` when the job has no document id.

## Document-scoped task and Agent version history

`GET /api/v1/documents/:document_id/jobs?limit=50&offset=0` returns the
document's OCR/translation runs in deterministic newest-first order. In
addition to `items` and `invocation_summary`, this projection returns:

- `total`: authoritative number of jobs linked through `jobs.document_id`
- `limit` / `offset`: the effective page request
- `has_more`: whether another page exists. Since 2026-10-22 it is computed by
  reading one extra row (like `GET /api/v1/jobs`), not from `total`: unreadable
  rows are skipped by the list but still counted by `COUNT(*)`, which used to
  make the last page report `has_more: true`. `total` is unchanged.
- Unknown query parameters are rejected with `400` (2026-10-22); only `limit`
  and `offset` are accepted.

The omitted `limit` defaults to `20`; a `limit` outside `1..=500` is rejected
with `400` (not clamped, rule 3 of `docs/api/00-约定/03-分页.md`). Ordering is `updated_at DESC, job_id DESC`, so equal timestamps do
not move records between repeated page reads.

Every `JobListItemView` exposes durable retry metadata from `runtime_json`:
`attempt` (one-based), `retry_count`, and `last_retry_at`. Artifact-manifest
items expose the same one-based `attempt`; clients must not infer it from event
counts or timestamps.

`GET /api/v1/documents/:document_id/agent-versions` (Agent candidate/commit history) was removed on 2026-11-03
together with RetainPDF's own AI service.
