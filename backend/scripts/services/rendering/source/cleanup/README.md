# rendering/source/cleanup

## Responsibilities

Source PDF page cleanup layer. This module directly manipulates PyMuPDF page objects, handling source text removal, visual covering,
background filling, and related diagnostics. It is not responsible for Typst source code, translated content layout, raw OCR provider data, or workflow orchestration.

## Stable Entry Points

Prefer using the source layer's external facade:

- `services.rendering.source.redaction.redact_source_text_areas`
- `services.rendering.source.redaction.redact_translated_text_areas`

Stable entry points within the cleanup subpackage:

- `redaction.py`: External redaction entry point.
- `strategy.py`: Redaction strategy analysis at the user-facing/configuration layer.
- `routes.py`: Dispatches to specific execution branches based on the analyzed route.

Other modules are considered implementation details by default; when adding new calls, prefer depending on specific implementation modules rather than returning to aggregate facades.

## Deprecated Legacy Compatibility Entry Points

These old aggregate/compatibility modules have been removed; callers must switch to using specific implementation modules or source-layer primitives:

- `analysis.py`
- `document_ops.py`
- `fill.py`
- `geometry.py`
- `math_protection.py`
- `ops.py`
- `plan.py`
- `route_selection.py`
- `shared.py`
- `text_analysis.py`
- `text_draw.py`
- `text_match.py`
- `vector_analysis.py`

Locations of basic capabilities:

- Background filling: `source/background/fill.py`
- Basic rectangle utilities: `source/rects.py`
- Reading translated items: `source/items.py`
- PDF document operations: `source/document_ops.py`
- Dev overlay: `source/dev_overlay/`

## Implementation Groups

### Text Matching
- `text_matching.py`: Main matching workflow from items to removable text rectangles.
- `text_safe_direct.py`: Judges safe direct removal when a single span is sufficiently close to the OCR bbox.
- `text_ownership.py`: Judges word/span/block ownership in cases of bbox overlap.
- `text_math_guard.py`: Filters formula protection zones and detects display math intrusion.
- `text_rects.py`: Converts word/block matching results to redaction rects.
- `text_extract.py`: Extracts PyMuPDF text blocks/spans/words.
- `text_intrusion.py`: Detects large short text spans suspected of intruding into display math zones on the page.

### Route and Plan
- `auto.py`: Automatic cleanup route execution details; `routes.py` only dispatches after route selection.
- `valid_items.py`: Converts translated items into a list of executable cleanup items.
- `route_decision.py`: Type definitions for redaction route decisions.
- `route_context.py`: Creates image/drawing facts needed for route selection from plan/page.
- `route_decider.py`: Selects specific execution branches based on route, context, and fill policy.
- `plan_types.py`: Type definitions for `RedactionPlan`.
- `page_facts.py`: Collects image page, drawing rects, and drawing counts.
- `plan_builder.py`: Builds `RedactionPlan` from page and translated items.
- `plan_policy.py`: Helper to judge page-level cover/vector-heavy status based on plan.
- `empty_result.py`: Stable diagnostic result for empty redaction input.
- `redaction_flow.py`: Orchestrates the workflow behind the external redaction entry point.

### Execution Routes
- `standard.py`: Standard text layer cleanup route entry point, retaining historical monkeypatch/debug entry points.
- `standard_policy.py`: Strategy judgments at item/page level for the standard route.
- `standard_thresholds.py`: Threshold constants for the standard route.
- `standard_execution.py`: Helper for executing page-level cover+text cleanup and redaction annotations.
- `cover_only.py`: Pure cover + text layer cleanup execution branch for pages with high drawing counts.
- `image_page.py`: Image page cleanup route, preparing background cover first, then removing the text layer, and finally pasting back the background.
- `vector_heavy.py`: Complex vector page cleanup route, directly covering and removing safely removable text layers.
- `visual_cover_execution.py`: Helper for executing visual cover routes, including flat/normal cover and optional text layer removal.
- `layer_items.py`: Extracts visual cover rects and bbox text strip rects according to cleanup item plans.

### Math and Vector Guards
- `math_fonts.py`: Identifies special formula fonts.
- `math_spans.py`: Collects formula protection rects and normal text heights from page text spans.
- `math_intrusion.py`: Judges whether formula protection rects intrude into removable text zones.
- `vector_overlap.py`: Calculates the count and area ratio of overlaps between item bboxes and page drawing rects.
- `vector_item_policy.py`: Judges whether an item can only take the visual cover route based on overlap statistics.

### Legacy / Dev Overlay
- Old compatibility wrappers `text_layer.py` / `visual_cover.py` have been removed; callers must use
  `routes.py` or specific execution modules.
- Old compatibility wrappers `text_draw.py` / `builders.py` have been removed; callers must use
  `source/dev_overlay/`..

## Boundary Rules

- Do not directly import from `source/background/`; background can only be called through facades
  or source-layer primitives.
- Do not import backward from layout/output/workflow layers; only accept input from source/page/item layers.
- New code must not import compatibility entry points; architecture gates will block cleanup internal dependencies on these facades.
- When needing to share basic geometric operations, item reading, or PDF document operations, move them up to `source/rects.py`,
  `source/items.py`, or `source/document_ops.py`.
