# Source Cleanup

This package owns PDF source-text cleanup before Typst/overlay rendering.

Current mainline behavior is the `v4.1.6-beta10` cleanup model:

- `planning/planner.py` builds page-level `BBoxTextStripCandidates` from translated items and PDF page facts.
- `executor.py` applies a `SourceCleanupRequest` and returns a `SourceCleanupResult`.
- `pdf/document.py` rewrites matching PDF content streams through pikepdf.
- `contracts.py` and `types.py` are the stable runtime boundary for callers.

## Current Contract

- Physical deletion is an optimization for editable PDF text streams.
- Visual-background or pseudo-editable pages may skip physical deletion and use render cover fallback instead.
- Display/formula regions are protected through candidate protected rects.
- `formula` / `display_formula` blocks are not treated as body text to delete.
- Items without translated replacement text should preserve source text.
- Render prewarm may cache `BBoxTextStripCandidates`, but execution still consumes the beta10 candidate shape.
- Compatibility for newer manifest fields belongs in `source/prewarm_manifest_io.py`, not in the execution layer.

## Main Entry Points

- `plan_source_cleanup(...)`
- `execute_source_cleanup(SourceCleanupRequest(...))`
- `build_bbox_text_stripped_pdf_copy(...)`
- `strip_bbox_text_rects_from_pdf_copy(...)`

External callers should go through these package-level boundaries rather than importing old
`render.source.preparation.bbox_text_strip_*` modules.

## Fallback Rules

When a page is classified as visual background or otherwise unsuitable for exact text stripping, cleanup should report skip metadata and let the render workflow apply visual cover fallback. Do not force physical deletion on pseudo-editable or image-backed pages in the current mainline.

## Experimental Cleanup

The newer pdf-structure-profile / item-decision cleanup design is not part of the current mainline. Its tests live under:

```text
backend/pipeline/devtools/experiments/source_cleanup_next/
```

Do not reintroduce `build_source_cleanup_plan`, `decision_builder`, `deletion_contract`, `formula_adjacency`, `document_pages`, or `document_parallel` into the mainline unless the cleanup engine is explicitly switched away from beta10 behavior.
