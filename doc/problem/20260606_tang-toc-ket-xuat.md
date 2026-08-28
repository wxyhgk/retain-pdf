# 20260606 Rendering Speedup: PDF Physical Deletion Low-Level Optimization Record

## Background

The most critical time consumer in RetainPDF's rendering stage is not Typst text drawing itself, but source PDF cleanup and preprocessing, especially the "physically delete original text" pipeline.

For normal editable PDFs, the ideal path is:

1. Locate original text regions to delete based on OCR / normalized document bbox.
2. Parse and rewrite page content streams using pikepdf.
3. Delete text drawing tokens within hit regions.
4. Then have Typst draw translated text.

This path produces cleaner output without relying on white block overlays, and reduces background text residue issues in browser PDF rendering. However, under large PDFs, many Form XObjects, many vector paths, and complex page objects, the old implementation becomes very slow.

This optimization does not continue adding rules; it reduces algorithmic complexity and redundant IO at the low level, compressing physical deletion time for 500-page PDFs to acceptable range. Current phase goal: most normal PDFs complete source PDF cleanup within tens of seconds; complex pages take explicit fallback without dragging all pages down.

## Original Bottlenecks

### 1. Page Geometry Scanning Too Heavy

Old logic frequently called PyMuPDF's `page.get_bboxlog()` to determine whether images, lines, formulas, or complex objects exist near a bbox. This interface expands page drawing logs.

Problems:

- Normal pages are acceptable.
- Form XObject pages get expanded into internal objects.
- Vector graphics, charts, complex backgrounds may produce massive path / image / fill / stroke records.
- Planning phase actually only needs "is it dangerous" and "which regions may conflict"; not necessarily expanding all low-level objects.

So old logic turns "determining whether to delete text" into an expensive page-rendering-level scan on complex pages.

### 2. `item x rect` Full Scan

Many judgments are essentially rectangle intersection problems:

- Whether OCR item bbox covers unsafe vector rect.
- Whether target rect touches drawing rect.
- Whether deletion region needs to avoid guard rect.

Old implementation often used two-layer loops:

```text
for item in items:
    for rect in unsafe_rects:
        if overlap(item, rect):
            ...
```

With hundreds of OCR items and thousands of drawing rects per page, such `O(n*m)` scans amplify quickly. Multiplied by page count in large PDFs, overall time becomes unstable.

### 3. Global Rect Merge Approaches `O(n^2)`

Deletion candidate rectangles need merging to avoid generating overly fragmented strip rects. Old merge approach easily compared repeatedly across all rects, approaching `O(n^2)` worst case.

This problem amplifies on TOC, reference, table, and formula-dense pages.

### 4. Rewrite Worker Load Imbalance

pikepdf parsing and content stream rewriting is CPU-bound. If old logic chunks by page number order, one worker may get a batch of particularly heavy pages while others finish, leaving overall waiting for last heavy chunk.

Typical symptom: total page count not extreme, but final rewrite segment drags long.

### 5. Prewarm and Render Duplicate Stable Facts

Whether page contains Form XObjects, content stream size, deletion candidate pages etc. are basically stable within same job. Old implementation had duplicate scanning and judgment between planning, prewarm, render, causing same cost paid multiple times.

## Current Low-Level Optimization Approach

### Execution Chain

Current physical deletion main chain can be split into four layers:

```text
normalized document / translated items
    ↓
planning: generate per-page strip rect / protected rect / skip metadata
    ↓
manifest: cache page features and candidate deletion plans
    ↓
rewrite: pikepdf parses page content stream and deletes text show ops
    ↓
render source: decide whether to enter fallback based on changed / skipped / no-effect
```

Corresponding files roughly:

```text
source_cleanup/planning/planner.py
    Converts OCR / translated items into page-level deletion plans.

source/prewarm_manifest_io.py
source/prewarm_contracts.py
    Persists deletion candidates, page features, skip results.

source_cleanup/pdf/document.py
    Opens PDF, concurrently rewrites page content streams, saves output.

source_cleanup/pdf/stream_engine.py
    Actually parses content stream tokens and determines whether Tj/TJ text drawing hits deletion regions.

source/render_source.py
    Connects physical deletion results to subsequent render source selection and fallback.
```

Note that planning should only answer "which pages and regions are worth attempting deletion". Rewrite actually modifies PDF. Fallback should not reverse-affect planning's underlying fact judgments; otherwise rule conflicts will continue.

### 1. Spatial Index Replaces Full Rectangle Scan

Core file:

- `backend/scripts/services/rendering/source_cleanup/planning/spatial_index.py`

Added `RectOverlapIndex`, sorting page rects by y direction, then using `bisect_right` to find potentially intersecting candidate range, followed by x-direction quick reject.

It solves problems like:

```text
item bbox -> intersects unsafe vector rect?
target rect -> intersects drawing rect?
```

Current implementation is very lightweight:

```text
RectOverlapIndex
    rects: rectangles sorted by y0
    y0_sorted: separately extracted y0 array for bisect

overlaps_any(target_rect)
    1. Binary search target_rect.y1 on y0_sorted to get potentially intersecting prefix.
    2. Skip rectangles with y1 < target.y0.
    3. Quick exclude using x0/x1.
    4. Compute real intersection area only at end.
```

Old logic scanned all rects per item. New logic prunes by y interval first, checking only few potentially intersecting rects.

Underlying complexity drops from approximately:

```text
O(items * rects)
```

To closer to:

```text
O(rects log rects + items * local_candidates)
```

Where `local_candidates` is typically much smaller than full-page rect count.

### 2. Page Coordinates and BBoxLog Grouped Once

Core file:

- `backend/scripts/services/rendering/source_cleanup/planning/coordinate_resolver.py`

Old logic easily re-read same page geometry info across different judgments. Now page coordinates, text/image/vector rect extraction consolidated into one grouping.

Significance:

- Same page performs expensive bboxlog parsing only once.
- Text rect, image rect, unsafe vector rect returned in same result.
- Subsequent planner consumes structured results only; no longer scans page everywhere.
- Also selects OCR bbox coordinate interpretation, reducing coordinate system errors like "left/up offset".

Not just for code cleanliness; avoids each strategy module calling low-level PDF scan independently.

Key structure here:

```text
PageBBoxResolver
    text_rects
    text_index
    image_rects
    unsafe_vector_rects
    unsafe_vector_index
    preferred_candidate
```

`preferred_candidate` uses overlap score between OCR bbox and page text rects to select coordinate interpretation. More stable than guessing `top_left` / `pdf_matrix` everywhere in business layer.

### 3. Form XObject Pages Take Fast Plan Without Expanding Internal Geometry

Core files:

- `backend/scripts/services/rendering/source_cleanup/planning/page_probe.py`
- `backend/scripts/services/rendering/source_cleanup/planning/planner.py`

Form XObjects were previously the biggest slowdown. MuPDF expands XObject internal content, but pikepdf page-level content stream rewriting cannot reliably delete text inside XObjects.

New strategy:

1. Use cheap `page.get_xobjects()` or page features to determine Form XObject presence.
2. Planning phase does not expand XObject internal bboxlog.
3. Such pages generate page-level candidates based only on OCR bbox.
4. Execution phase retains `skipped_form_xobject` metadata.
5. If physical deletion ineffective for such pages, hand off to subsequent cover fallback.

Key design acknowledges boundary: page-level pikepdf rewriting is not omnipotent. When Form internal text cannot be deleted, should not drag entire book planning slow for "attempting deletion".

Not abandoning deletion; separating cost and semantics:

```text
Page-level text flow deletable -> pikepdf strip
Form internal text uncertain -> mark skipped_form_xobject
Residual still present -> cover / visual background fallback
```

This prevents mixing "planning phase skipped complex internal expansion" with "final did not cover residual English" during troubleshooting.

### 4. Page Features Cached in Prewarm Manifest

Core files:

- `backend/scripts/services/rendering/source_cleanup/planning/page_features.py`
- `backend/scripts/services/rendering/source/prewarm_manifest_io.py`
- `backend/scripts/services/rendering/source/prewarm_contracts.py`

Added `PageCleanupFeatures`, recording:

- `content_stream_size`
- `has_form_xobjects`

These are stable facts used by subsequent planning, scheduling, fallback. Now read/written with prewarm manifest, avoiding re-probing during render phase.

Manifest version upgraded to:

```text
bbox_text_strip_v18_page_features_lpt
```

### 5. Y-Band Rect Merge Avoids Global Pairwise Comparison

Core file:

- `backend/scripts/services/rendering/source_cleanup/planning/rects.py`

Rect merge changed from global brute-force comparison to y-band active window maintenance.

Intuitively, two rectangles far apart in y direction cannot merge and need not be compared. New implementation exploits this, attempting merge only within local y window.

Significantly reduces merge cost on TOC, reference, formula-dense pages.

### 6. Vector Text Cleanup Also Uses Spatial Index

Core file:

- `backend/scripts/services/rendering/source/vector_text.py`

Vector text cleanup originally had same `drawing x target_rects` scan issue. Now target rects also build spatial index; drawings query only potentially intersecting target regions.

Same philosophy as source cleanup: all rectangle intersection problems should not default to two-layer full scan.

### 7. PikePDF Rewrite Uses LPT Scheduling

Core file:

- `backend/scripts/services/rendering/source_cleanup/pdf/document.py`

PikePDF rewrite phase estimates page weight by decoded content stream size, then uses LPT (Longest Processing Time first) chunk allocation.

Approach:

1. Estimate rewrite weight per page.
2. Sort by weight descending.
3. Assign heaviest page to worker with smallest cumulative weight each time.

Reduces "last worker gets heaviest page" long-tail problem.

Current weight source is decoded content stream size:

```text
_page_content_stream_weight(pdf, page_idx)
    /Contents is single stream -> len(read_bytes())
    /Contents is array -> sum of multiple stream lengths
    Read failure -> fall back to /Length
```

Weight is imperfect but cheap enough, and usually correlates with pikepdf parse/unparse cost.

Logs output `top_chunks` for observing whether extreme heavy pages still exist:

```text
top_chunks=34p/3289283b/11.41s,...
```

### 8. Runtime Skip Metadata Retained

Related structure:

- `BBoxTextStripCandidates`

Now retains:

- `skipped_form_xobject`
- `strip_no_effect`
- `page_features`

These enter manifest round-trip. Subsequent rendering, events, fallback can explicitly know:

- Which pages did not perform precise deletion due to Form XObject.
- Which pages attempted physical deletion but had no effect.
- Which pages should not have undergone heavy scanning originally.

More reliable than simply returning "deletion success/failure"; facilitates subsequent strategy layering.

## Why These Optimizations Do Not Change Core Deletion Semantics

This optimization round mainly changes "candidate finding" and "execution scheduling", not text token deletion rules.

Unchanged semantics:

- `RectOverlapIndex` only reduces candidate intersection check count; final judgment still uses real rect intersection.
- Y-band merge only skips rectangles impossible to merge in y direction; local window still uses original `rects_should_merge`.
- LPT only changes concurrent worker assignment order; final results still written back by page index.
- `PageCleanupFeatures` caches stable page facts; does not directly decide which tokens to delete.

Intentionally changed strategy boundaries:

- Form XObject pages no longer expand internal geometry during planning.
- Such pages explicitly exposed to fallback via `skipped_form_xobject`.

Change avoids expensive and semantically unreliable internal expansion. Because when page-level content stream has only `Do` calls, continuing to expand bboxlog does not make pikepdf page-level deletion inherently reliable.

## Current Results

Baseline sample:

```text
job_id: 20260606121415-e49002
```

In pre-optimization bad cases, physical deletion and preprocessing could be dragged to minutes by complex pages. Last precise strip path was ~`27.9s` before optimization; same sample ~`13.08s` after.

Latest complete statistics:

```text
FULL PLAN elapsed 0.58s
candidate_pages 200
skipped_complex 5
features 263

FULL STRIP elapsed 13.08s
changed 156
removed 14130
skipped_form 200
no_effect 44
features 263
```

Phase breakdown:

```text
candidates=0.59s
rewrite=11.64s
save=0.66s
top_chunks=34p/3289283b/11.41s,...
```

Largest time now concentrated in pikepdf content stream rewrite, which is reasonable. Planning phase dropped from primary bottleneck to sub-second.

## Validation

Executed:

```bash
python3 -m compileall -q backend/scripts/services/rendering
```

Related tests:

```bash
pytest \
  backend/scripts/devtools/tests/rendering/test_bbox_text_strip_document.py \
  backend/scripts/devtools/tests/rendering/test_vector_text_cleanup.py \
  backend/scripts/devtools/tests/rendering/test_render_prewarm.py
```

Results:

```text
62 passed
```

## How to Locate Next Slowdown

Check this line in backend logs first:

```text
bbox text strip: mode=strip pages=... text_show_ops=... candidates=... open=... rewrite=... apply=... make_stream=... assign=... save=... top_apply_pages=... top_chunks=...
```

Field meanings:

- `candidates`: Planning candidate generation time.
- `open`: pikepdf source PDF open time.
- `rewrite`: Content stream parse / strip time.
- `apply`: Time writing rewritten stream back to pikepdf object.
- `make_stream`: Time creating new PDF stream.
- `assign`: Time replacing page `/Contents`.
- `save`: Output PDF save time.
- `top_apply_pages`: Slowest pages during writeback.
- `top_chunks`: Slowest chunks in rewrite workers.

Diagnosis:

```text
candidates slow
    Check whether planning reintroduced duplicate bboxlog or full rect scan.

rewrite slow
    Check pages with particularly large content streams, worker chunk imbalance, duplicate parsing.

save slow
    Check output PDF object count, compression parameters, repeated intermediate file generation.

top_chunks shows only one chunk significantly slower
    Check whether LPT weight underestimated certain page types.

skipped_form_xobject high with final English residue
    Check whether fallback covers skipped / no-effect pages rather than adding more physical deletion rules.
```

## Design Principles

### No More Job/Page Rule Patching

Incomplete deletion cannot be fixed by continuously adding:

```text
If page x
If bbox looks like formula
If certain block id
```

Such rules conflict and slow large PDFs. Current direction decomposes PDF pages into stable underlying facts:

- Whether page has Form XObject.
- Page content stream size.
- Which OCR bboxes need deletion.
- Which candidate regions have ineffective physical deletion.
- Which pages should enter cover fallback directly.

Strategies consume these facts only; do not depend on specific job exceptions.

### Acknowledge Boundaries for Complex Pages

PikePDF page-level content stream rewriting suits deleting text in page flow. But if text hides inside Form XObject with only one `Do` call in page flow, forcing page-level text deletion is unreliable.

Therefore complex pages should be identified early to avoid heavy expansion. Undeletable pages retain explicit metadata; cover fallback or background rendering handles them.

### All Rectangle Problems Prefer Indexing

Rendering cleanup logic is largely rect overlap. When adding features, should not default to `A x B` two-layer full scan; ask first:

- Can rect count grow?
- Can index be built per page?
- Can prune by y-band / x-range?
- Can cache during prewarm?

## Boundaries for Future Code Changes

### Planning Layer

Should contain:

- Bbox coordinate transformation.
- Page-level feature probing.
- Strip rect / protected rect generation.
- Skip reasons and candidate metadata.
- Fast, cacheable, reusable rectangle judgments.

Should not contain:

- Real content stream token deletion.
- Massive PDF object rewriting.
- Special rules per job/page.
- Logic coupled with frontend event display.

### PDF Rewrite Layer

Should contain:

- PikePDF open, parse, rewrite, save.
- Concurrent scheduling.
- Content stream weight estimation.
- Deleted token count, changed page count, timing stats.

Should not contain:

- OCR item semantic judgment.
- Translation status judgment.
- Business classification of "is this body/formula/title".

### Render Source / Fallback Layer

Should contain:

- Source PDF selection based on physical deletion results.
- Enable cover or visual background for `skipped_form_xobject` / `strip_no_effect` pages.
- Output final background source for Typst / PDF composition.

Should not contain:

- Rescan entire book to generate deletion plan.
- Modify planner's underlying candidate logic.

This boundary is critical. Otherwise will cycle back to "render finds residual English -> fallback modifies planner -> planner affects physical deletion speed".

## Future Optimization Directions

### 1. Reduce Parse/Unparse Count in Rewrite Layer

Main time now in pikepdf rewrite. Continue checking:

- Whether pages are parsed repeatedly.
- Whether decoded content can be cached by object stream.
- Whether only streams with hit tokens need rewriting.
- Whether multiple small streams can be merged to reduce Python scheduling overhead.

### 2. Move More Stable Facts Forward to Post-OCR Preprocessing

After OCR completes, source PDF, normalized document, and most bboxes are known. Can immediately do:

- Page feature probe
- Candidate planning
- Background / pseudo-copyable determination
- Deletion candidate manifest generation

This allows rendering preprocessing to complete concurrently during translation; render phase consumes ready manifest only.

### 3. Clearer Strategy Branching for Form/XObject Pages

Current strategy is fast plan + skip metadata + fallback. Further possibilities:

- Pages with high Form internal text ratio go directly to visual-only background.
- Normal pages continue pikepdf physical strip.
- Mixed pages strip page-level text only; Form regions forced cover.

Key is branching depends on page features, not handwritten job rules.

### 4. Add Performance Fields to Events and Logs

For locating slow pages, recommend continuous output of:

- Planning elapsed
- Rewrite elapsed
- Save elapsed
- Candidate page count
- Changed page count
- Skipped form count
- No-effect count
- Top heavy chunks

When frontend sees "render slow", backend can directly determine whether planning, rewrite, save is slow, or fallback triggered excessively.

## Current Conclusion

Essence of this speedup round is three things:

1. **Reduce expensive page scans**: Complex pages not expanded; stable page facts cached in manifest.
2. **Lower algorithmic complexity**: Rectangle intersection uses spatial index; rect merge uses y-band.
3. **Reduce rewrite long tail**: PikePDF rewrite scheduled by page weight using LPT.

This brings 500-page sample physical deletion main chain from nearly half a minute down to ~13 seconds; planning itself down to ~0.6 seconds. Further improvement focus is no longer at rule layer, but pikepdf content stream rewrite parse/unparse count, page branching, and post-OCR preprocessing parallelization.

</content>