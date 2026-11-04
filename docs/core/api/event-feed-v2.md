# Job events v2

This is a coordinated, breaking upgrade of `GET /api/v1/jobs/:id/progress/events`
(the old addresses `/jobs/:id/events` and `/api/v1/ocr/jobs/:id/events` were removed on 2026-10-18). Ship the API, generated contracts, SDK and
first-party web/desktop clients together. Translation `progress/stream` SSE (formerly `/live-events`) is
unchanged and its sequence numbers are not event-feed cursors.

## Requests and responses

- Initial window: `?start=tail&limit=500` (the default). Full history: `start=head`.
- Continue using `?cursor=<next_cursor>&limit=500`; follow `has_more` until caught up.
- `limit` must be 1–500; anything else is `400` (no silent clamping). `offset`, unknown parameters and `start` with `cursor`
  are rejected. Cursor scope includes the job and ordinary/OCR route.
- Success retains the API envelope. Data contains `protocol_version: 2`,
  `items`, `next_cursor`, `has_more`, and `limit`.
- Each item has a stable `event_id`; `seq` is a delivery position. Display by
  timestamp, deduplicate by identity, and never synthesize a cursor from either.
- A pagination batch pins its upper watermark. A new batch picks up later
  arrivals, even when their event timestamp is older than the last displayed row.
- `410 EVENT_CURSOR_EXPIRED` means reset only that job's event window and request
  a new head/tail snapshot. Invalid cursors return 400; task/OCR/layout guards
  retain their existing 404/409 priority before cursor decoding.

The active UI fetches one tail page, then increments from its cursor. Complete
history is fetched at terminal transition or in the detail history consumer.
Transient errors retain visible data and back off; request generations prevent
old completions from overwriting a new job's state.

Task, document-task and library lists validate live-stage projections in a
request-scoped batch. At most two SQLite queries capture owners and direct OCR
children, source versions, authority, retention cutoffs and stored checkpoints
in one short read transaction. File inspection happens after that transaction.
Unchanged complete projections reuse their bounded stage basis; jobs that have
never emitted events need no empty feed initialization. Changed or unavailable
inputs fall back to normal synchronization, including its revision/CAS checks.
There is no cross-request TTL cache and no relaxation of event cursor semantics.

## Storage and recovery

SQLite source UID/version triggers cover both API and jobsd writers, including
pipeline transaction writers. A rebuildable feed stores owner-scoped source
checkpoints, sanitized records, projection epoch and a bounded live-stage basis.
UIDs survive re-projection; reused raw DB sequence numbers do not reuse identity.

Only Python `pipeline_events.jsonl` is an independent file source. The Rust
`events.jsonl` mirror is not re-imported as a second copy of DB history. Managed
files are append-only: complete lines advance byte offsets, partial lines wait,
and complete malformed/oversized lines are counted and skipped. Detected file
replacement, truncation, context/source changes or DB mutations reset the epoch.
Arbitrary undetected external in-place edits to already consumed middle bytes
are outside the managed append-only contract; restore/replacement must invalidate
the source rather than preserving its file identity and boundary fingerprints.

File work runs outside SQLite transactions. Source-version/CAS validation,
deduplication, event insertion and checkpoint publication commit atomically.
Initial import is chunked (16384 DB events per chunk; incremental syncs use 1024),
so a 280k-event history commits ~18 times instead of ~275; no cursor is exposed until chronological bootstrap
publication completes. Publication renumbers only rows whose chronological position
differs from their import position (usually none: DB events arrive in timestamp order). The initial live-stage basis is reduced from that same
publication order in one streaming pass, including equal-timestamp ties. File
batches target 1 MiB at complete-line boundaries, with a 4 MiB maximum accepted
line. Empty warm polls do not parse historical JSONL again.

Feed retention follows `RUST_API_EVENTS_RETENTION_DAYS` (default 30, 0 disables
cleanup), only for terminal jobs. A persisted cutoff prevents rebuilding expired
history from retained source files. Original files are not additionally deleted.
The cutoff is floored to UTC midnight: moving it bumps every terminal job's
source revision and forces a full feed rebuild on the next read, so repeated
sweeps and restarts on the same day leave it unchanged (at most one move a day;
events may be kept up to one extra day).

## Release and verification

Migrations add source identity/read-model tables and query indexes; old jobs
tables acquire `document_id` before index migration. First feed access lazily
imports that job, not all jobs at startup. Back up the DB before production
upgrade and prevent old clients from using the breaking endpoint. Roll back API
and clients together; do not destructively downgrade the additive schema.

Verification includes >10,000 events, fixed-watermark paging, late events,
concurrent readers, API restart, source mutation/replacement, parent/child
checkpoint isolation, retention and credential redaction. Query execution is
bounded independently of job execution (2 running, 128 admitted); downloads keep
their separate single-flight generation limits and HTTP Range behavior.

See [local query acceptance](query-acceptance.md) for the isolated HTTP fixture,
browser acceptance steps, measured performance and remaining release boundaries.
