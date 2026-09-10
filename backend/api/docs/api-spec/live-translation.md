# Live Translation Overlay

[API spec index](../../API_SPEC.md)

## Durable Overlay Contract

These authenticated endpoints let a reader display translated blocks while a
job is still running:

```text
GET /api/v1/jobs/{job_id}/live-translation/layout
GET /api/v1/jobs/{job_id}/live-translation/pages/{page_idx}
GET /api/v1/jobs/{job_id}/live-events?after_seq={seq}
```

`layout` projects page dimensions and text-block `item_id`, PDF-coordinate
`bbox`, source text, and kind from the normalized OCR document. When a valid
renderer typography plan exists, the block `bbox` instead uses that plan's
background rectangle so its padding and bounding box stay in the same
coordinate system. `page_idx` is zero-based. Item IDs are canonicalized so
layout blocks and translated items use the same stable identity and can be
joined directly.

When a valid structured render-prewarm manifest is available, each layout
block may also include the renderer-authored `typography` plan used to place
its translation:

```json
{
  "item_id": "p001-b0003",
  "bbox": [59, 176, 304, 445],
  "source_text": "Original text",
  "kind": "paragraph",
  "typography": {
    "font_family": "Source Han Serif SC",
    "font_size_pt": 9.82,
    "leading_em": 0.56,
    "font_weight": 400,
    "text_align": "justify",
    "padding_top_pt": 0,
    "padding_right_pt": 0,
    "padding_bottom_pt": 0,
    "padding_left_pt": 0,
    "fit_min_font_size_pt": 7,
    "fit_max_font_size_pt": 9.82
  }
}
```

`bbox`, font sizes, and padding values are PDF points; `leading_em` is in `em`.
`font_weight` is numeric and `text_align` is the planned alignment value. The
API reads the layout values from the structured render-prewarm manifest and
the font family from the job's durable render settings; it never requires
clients to fetch or parse a `.typ` file. The padding values are the differences
between the persisted background and content rectangles.

This is the input plan and fitting range supplied to Typst, not a claim about
the final size selected internally by a later Typst binary-fit compilation.
`typography` is optional and is omitted for old jobs or whenever the matching
block lacks a complete, valid parameter set; clients may then apply their own
fitting fallback. A missing or malformed prewarm manifest does not make the
layout request fail.

The page endpoint returns `attempt`, the Rust state-machine `generation`,
`page_hash`, and translated items. It does not read the mutable translated
page file. It first selects the latest committed `translate` pipeline unit for
the page, then reads only an immutable `.translation-checkpoints/generation-*`
page snapshot whose raw SHA-256 equals the committed database `page_hash`.
Items without a non-empty committed translation are omitted.
`translated_text` is returned without rewriting its content, including `$...$`
and `$$...$$` LaTeX delimiters; mathematical content is not converted to an
image or stripped before delivery to the client.

`live-events` is an SSE stream. Each committed event has an SSE `id` equal to
the authoritative per-job database sequence and event name
`translation_units_committed`; its JSON data contains `seq`, `attempt`,
`generation`, `page_idx`, `page_hash`, and `changed_item_ids`. The event is a
refresh hint, not the translation payload: clients fetch the page endpoint
after receiving it. Reconnect with `after_seq` or `Last-Event-ID`; when both
are present the larger value wins. Authentication remains header-based, so a
browser client that cannot attach the configured API-key header to native
`EventSource` must use authenticated streaming `fetch`.

This ordering is deliberate: atomic page snapshot, durable pipeline unit and
event commit, SSE notification, then authoritative page read. A disconnect or
service restart therefore cannot expose translation text that later vanishes.

Producer integration requirement: every page made visible to the overlay must
have its own committed `translate` pipeline unit carrying that page's exact
snapshot hash. A checkpoint that reports only the legacy global
`last_committed_unit` does not authorize other dirty pages, even if their files
exist on disk; those page reads deliberately return
`LIVE_TRANSLATION_PAGE_NOT_COMMITTED`.

For a multi-page flush, the producer should send the optional
`committed_pages` array in `pipeline_checkpoint_v1`. Each item contains
`unit_key`, `unit_order`, `page_index`, `page_hash`, and `changed_item_ids`.
Rust validates and commits the entire array in one SQLite transaction and one
authority generation, then creates one durable refresh event per page. The
legacy top-level unit fields remain accepted for old workers, but they cannot
be mixed with `committed_pages` in one observation. A malformed page prevents
the whole batch from becoming visible. `unit_order` is stable document order,
not completion order: concurrent workers may first commit a later page and
then an earlier page. This does not move the stage's highest committed cursor
backwards; authoritative mutation ordering comes from the fenced generation.

Live-translation failures use string codes:

- `LIVE_TRANSLATION_LAYOUT_NOT_READY`
- `LIVE_TRANSLATION_LAYOUT_INVALID`
- `LIVE_TRANSLATION_PAGE_NOT_COMMITTED`
- `LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE`
- `LIVE_TRANSLATION_SNAPSHOT_INVALID`
- `LIVE_TRANSLATION_EVENT_INVALID`

These strings are the authoritative `error.code` values. During the compatible
migration they are also returned in the legacy top-level `code` field:

```json
{
  "code": "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
  "message": "this page has no committed translation yet",
  "error": {
    "code": "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
    "http_status": 404,
    "details": {}
  }
}
```

Clients should use `error.code` to distinguish “not committed yet” from an
invalid or unavailable snapshot. They must not infer retry behavior by matching
`message`. The top-level fields remain for existing clients and currently have
no declared removal date. No error response exposes a checkpoint path, raw
snapshot payload, or translated content that has not been durably committed.

Invalid typed `job_id` / `page_idx` paths and invalid `after_seq` query values
are framework-input failures, not live-translation domain failures. They use
the shared unified error object and fixed safe messages; parser details are not
returned. The SSE success response and event payload contract are unchanged.

See [Errors, storage, and implementation notes](storage-and-errors.md) for the
shared error contract.
