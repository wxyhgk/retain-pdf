# Reader Read Model

[API spec index](../../API_SPEC.md) · [public API index](../../../../docs/core/api/index.md)

> Address note: `/jobs/{job_id}/…` is grouped into nine categories (`actions`, `progress`, `files`, `reports`, `reader`, `translations`, `data`, `ai`). The old addresses were removed on 2026-10-18 and now return 404; use the new ones (`GET /jobs/{job_id}/reader/markdown`, `/progress/layout`, `/progress/pages/{page}`, `/progress/stream`, `/files`). Old-to-new table: [`docs/api/01-任务/04-任务接口分类.md`](../../../../docs/api/01-任务/04-任务接口分类.md); every endpoint: [`docs/api/00-接口目录.md`](../../../../docs/api/00-接口目录.md).

This document defines the read surfaces a Reader host consumes before it maps
backend responses into its own PDF, content, AI, and shell ports. It is the
normative integration boundary for Reader data. The versioned payload shapes
are defined by [`reader-data.v1.schema.json`](../../../../contracts/reader-data.v1.schema.json);
this page owns route selection, identity, availability, recovery, and error
semantics.

A Reader host must consume public API paths/URLs and structured responses. It
must not inspect job directories, artifact relative paths, checkpoints,
workspace files, provider payloads, or credentials.

## Route matrix

All JSON success responses use `{ "code": 0, "message": "ok", "data": ... }`.
All listed endpoints require `X-API-Key`. New consumers branch on
`error.code`, never on a human-readable error message.

| Need | Route | Stable output | Notes |
| --- | --- | --- | --- |
| Current job/read snapshot | `GET /api/v1/jobs/{job_id}` | job detail | Explicit `job_id` selects that immutable job snapshot. |
| Published artifact links | `artifacts` field of `GET /api/v1/jobs/{job_id}` | `ReaderArtifactLinks` | The standalone `GET /api/v1/jobs/{job_id}/artifacts` was removed on 2026-10-18; `GET /api/v1/jobs/{job_id}/files` (`JobFilesView`) is the file list, and the returned `manifest_*` / `artifacts_*` / `open_artifacts` links point there. Use readiness plus public resource links; do not infer files from names. |
| Job file list | `GET /api/v1/jobs/{job_id}/files` | `JobFilesView` | `output` / `pages` / `internal` (`internal` only for administrators and single-user mode); each entry carries `name`, `url`, `content_type`, `ready`, `on_demand`, `size_bytes`. |
| Structured Markdown | `GET /api/v1/jobs/{job_id}/reader/markdown` | `MarkdownDocumentView` | Provides content, absolute-image content, and image manifest. |
| Windowed raw Markdown | `GET /api/v1/jobs/{job_id}/files/output/ocr.md` | raw Markdown | Supports `Range`, `Content-Range`, and `ETag`; see [artifacts](artifacts.md#reading-long-markdown-in-parts). |
| PDF alignment/selection | `GET /api/v1/jobs/{job_id}/reader/regions` | `ReaderRegionsView` | Backend joins normalized source blocks and published translations. |
| One block (quoting a paragraph) | `GET /api/v1/jobs/{job_id}/reader/regions/{item_id}` | `ReaderRegionItem` | The same entry as in `reader/regions`, without fetching the whole book. Accepts the three-digit (`p008-b009`) and four-digit (`p008-b0009`) block id; answers with the four-digit one. No regions yet: 404 with `reason: "not_ready"`; no such block: plain 404. |
| PDF dimensions | `GET /api/v1/jobs/{job_id}/reader/metadata` | `ReaderMetadataView` | Source and translated metadata are independently nullable. |
| In-progress layout | `GET /api/v1/jobs/{job_id}/progress/layout` | `LiveTranslationLayout` | Layout can be ready before any page translation. |
| Committed page translation | `GET /api/v1/jobs/{job_id}/progress/pages/{page}` | `LiveTranslationPageSnapshot` | Reads only a hash-matched durable checkpoint. |
| Commit refresh stream | `GET /api/v1/jobs/{job_id}/progress/stream?after_seq={seq}` | SSE `translation_units_committed` | An event is a refresh hint, not translation text. |
| Reading AI / operations | `POST /api/v1/ai/ask` and conversation/operation routes | existing AI schemas | See [Reader AI chat](../../../../docs/core/api/reader-ai-chat.md). |

`POST /api/v1/jobs/{job_id}/reader/ai/chat` remains a legacy, completed-job,
one-shot compatibility endpoint. New Reader integrations must use `/api/v1/ai/ask`,
conversation APIs, and public document-operation APIs instead.

## Identity and coordinates

- `document_id` is the stable library and AI identity. Document-level history,
  AI conversations, and committed agent versions belong to it.
- An explicit `job_id` selects an immutable job/read snapshot. A host must not
  substitute the document's newer active job for a historical job link.
- `item_id` is canonicalized by backend Reader projections. Matching IDs in a
  region, live layout, and live page snapshot identify the same document block
  when those surfaces describe that block.
- `ReaderRegionsView.source.page` and `.translated.page` are **one-based**.
  Their boxes are `[x0, y0, x1, y1]` in `pdf_point` with `top_left` origin.
- Reader metadata dimensions describe the **visible page**, matching PDF.js's
  scale-1 viewport: the non-empty intersection of CropBox and MediaBox, with
  inherited page boxes/rotation and page-local UserUnit applied. Empty or invalid
  crops fall back to MediaBox. Region coordinates are already relative to the
  visible page's top-left; hosts must not apply the CropBox offset a second time
  or scale regions using the uncropped MediaBox dimensions.
- Live translation `page_idx` is **zero-based**. Its layout boxes are also PDF
  points with top-left origin. The index conversion is deliberately explicit:
  a host must convert only at its UI boundary, not silently mix the two models.

## Availability and fallback

| Reader state | Expected host behavior |
| --- | --- |
| Source-only document/OCR | Source PDF and source-only regions may be available while translated PDF/metadata are null. Do not fabricate a translated pane. |
| Translation running before OCR layout | Keep source readable; `progress/layout` may return `LIVE_TRANSLATION_LAYOUT_NOT_READY`. Retry with bounded backoff. |
| Layout ready, page not committed | Keep source readable and wait. `LIVE_TRANSLATION_PAGE_NOT_COMMITTED` means that no durable translation exists for that page yet; it is not an empty translation payload. |
| Committed live page | Render only the returned hash-matched snapshot. Never read a mutable translated working file. |
| Terminal translation | Prefer published artifact links for final source/translated PDFs. Retained live snapshots may remain useful for diagnostics but do not replace the final artifact authority. |
| Failed/cancelled translation | Keep source readable and any already committed pages available. Do not report the Reader itself as failed merely because translation stopped. |

Regions and metadata are optional presentation overlays. A failure to load them
must not invalidate a successfully loaded source PDF; surface their errors
separately and continue with baseline reading.

## Durable live recovery

`progress/stream` is an authenticated fetch-SSE stream because browser `EventSource`
cannot attach the required API-key header. The server uses the greater of
`after_seq` and `Last-Event-ID` as the replay cursor.

For every `translation_units_committed` event:

1. Ignore duplicate or older `seq` values.
2. Fetch `progress/pages/{page}`.
3. Compare `attempt`, `generation`, and `page_hash` before replacing a local
   page snapshot.
4. Render only the resulting durable snapshot.

A disconnect, reconnect, or service restart must not cause the client to show
translation text that was never durably committed. Exact snapshot/error rules,
producer requirements, and error codes are defined in
[Live translation overlay](live-translation.md).

## Port handoff

A frontend host can implement a Reader runtime without raw payload parsing:

```ts
ReaderDataPort.loadArtifacts(jobId)
ReaderDataPort.loadArtifactManifest(jobId)
ReaderDataPort.loadMarkdownDocument(jobId)
ReaderDataPort.loadRegions(jobId)
ReaderDataPort.loadMetadata(jobId)
ReaderLiveTranslationPort.loadLayout(jobId)
ReaderLiveTranslationPort.loadPage(jobId, pageIdx)
ReaderLiveTranslationPort.streamEvents(jobId, cursor)
```

The host owns authentication, HTTP/SSE transport, mock behavior, and conversion
from this wire contract into Reader-owned DTOs. The reusable Reader package
must not import API clients, read RetainPDF artifact conventions, or branch on
backend message text.
