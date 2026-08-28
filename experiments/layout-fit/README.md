# Layout Fit Lab

Current absolute path:

`/home/wxyhgk/tmp/Code/experiments/layout-fit`

Existing task data directory:

`/home/wxyhgk/tmp/Code/data`

Existing task directory:

`/home/wxyhgk/tmp/Code/data/jobs`

This directory is a layout experiment zone targeting two capabilities:

1. Text block layout fitting using `HTML/CSS`
2. Using experimental results to inversely assist `Typst` in selecting more appropriate font size, line height, letter spacing, and paragraph parameters

Not production code zone. Short-term goal is producing methodology and experimental results, not direct mainline integration.

## Current Minimal Workflow

Do not rerun full pipeline from upload, OCR, translation currently.
Current phase only requires re-rendering and layout fitting experiments based on existing artifacts in `data/jobs/{job_id}`.

Experimenters should fetch data from here first:

`/home/wxyhgk/tmp/Code/data/jobs/{job_id}`

Typical task directory usually contains:

- `source/`
  Original PDF.
- `ocr/`
  OCR and MinerU related artifacts.
- `translated/`
  Translated intermediate artifacts.
- `rendered/`
  Rendered results and Typst related artifacts.
- `artifacts/`
  Registered download artifacts.
- `logs/`
  Runtime logs.

Current experiment principles:

- Prefer reusing existing results in `data/jobs`
- Do not re-call MinerU
- Do not re-call LLM translation
- Do not modify files in original job directory
- Write experimental results to `experiments/layout-fit/output/`
- Copy small samples to `experiments/layout-fit/fixtures/` if needed

Purpose clear: validate "can same OCR/translation results render better with different layout algorithms" first.

## Key JSON Locations

For layout, font, line height, block fitting experiments, check these files first:

- Main OCR unified structure:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/normalized/document.v1.json`
- OCR unified structure documentation:
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
- OCR unified structure machine schema:
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/document.v1.schema.json`
- OCR raw provider result summary:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/mineru_result.json`
- OCR raw unpacked content:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/layout.json`
- OCR raw content list:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/content_list_v2.json`
- Translation page-level results:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/page-XXX-deepseek.json`
- Domain context:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/domain-context.json`
- Typst layout input and output:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.typ`
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.pdf`
- Event stream:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/logs/events.jsonl`
- Task summary:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/artifacts/pipeline_summary.json`

## Which JSON to Treat as Ground Truth During Experiments

Priority must be clear for layout experiments:

1. `document.v1.json`
   Current mainline standardized OCR ground truth; most suitable for block-level layout fitting.
2. `translated/page-XXX-deepseek.json`
   For viewing per-page translated block content, protected placeholders, translation results.
3. `book-overlay.typ`
   For viewing how current Typst actually sets parameters and lays out.
4. `layout.json` / `content_list_v2.json`
   Only when needing to trace original OCR provider output; do not treat as primary experiment input.

Simply put:

- To study "how blocks lay out", check `document.v1.json` first
- To study "what translated text is", then check `translated/*.json`
- To study "how current Typst actually laid out", then check `book-overlay.typ`

## Onboarding Reading Order

For newcomers, read in this order:

1. This file:
   `/home/wxyhgk/tmp/Code/experiments/layout-fit/README.md`
2. OCR unified structure documentation:
   `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
3. Pick a real task directory:
   `/home/wxyhgk/tmp/Code/data/jobs/{job_id}`
4. Open first:
   - `ocr/normalized/document.v1.json`
   - `translated/page-001-deepseek.json`
   - `rendered/typst/book-overlays/book-overlay.typ`

This gives basic understanding of:

- What normalized OCR looks like
- What translation results look like
- What input Typst consumes and what layout it produces

## Why Separate Directory

Main project already has stable frontend, Rust API, Python pipeline, Typst rendering chain.
But questions like "how to choose font size, determine line spacing, fit text block into target box" remain experimental; unsuitable for direct production code insertion.

Therefore separate experiment zone:

- Does not pollute `backend/` and `frontend/`
- Enables rapid trial-and-error
- Allows multiple approaches to coexist in parallel
- Migrate stable parts back to formal pipeline after maturation

## Directory Conventions

- `fixtures/`
  Experiment input data. Recommend small representative samples; do not stuff entire books.
- `html/`
  HTML/CSS/JS layout experiment pages.
- `typst/`
  Typst comparison samples for comparing HTML fitting results with current Typst strategy.
- `scripts/`
  Automation scripts, e.g., parameter sweep, error scoring, result aggregation.
- `notes/`
  Phase conclusions, parameter records, failure cases, future ideas.
- `output/`
  Local artifacts, e.g., screenshots, scoring results, debug JSON. Not in Git by default.

## Recommended Research Boundaries

Do not start with "full page restoration". Begin with smallest, most controllable problems.

Recommend three layers:

1. `text metrics`
   Study single text block font size, line height, letter spacing, paragraph width only.
2. `block layout`
   Fit one text block into given target box as closely as possible.
3. `page composition`
   Place multiple fitted blocks back onto page; check for collisions, overflow, order errors.

Layers 1 and 2 most important short-term.

## Specific Problems Suitable for Exploration

### 1. Font Size Fitting

Input:

- Text content
- Target box width/height
- Font family
- Initial font size range

Output:

- Optimal font size
- Line count, total height, overflow status at that size

### 2. Line Height Fitting

Input:

- Fixed font size
- Different line height candidates

Output:

- Which line height closest to target box height
- Whether causes orphan lines, overflow, over-compression

### 3. Letter Spacing and Paragraph Compression

Input:

- Fixed font size and line height
- Different letter spacing, word spacing, paragraph before/after settings

Output:

- Whether text fits target box closer without significantly harming readability

### 4. Typst Parameter Reverse Engineering

Goal not replacing Typst with HTML but using HTML experiment results to answer:

- What font size suits this block better
- Should line height be looser or tighter
- Are current Typst defaults too conservative at certain layout densities

## Explicitly Not Done

Avoid scattering problem scope; do not touch following yet:

- Do not do full PDF HTML reflow first
- Do not do complex image-text mixed restoration first
- Do not do ultimate solution for tables, formulas, floating captions first
- Do not modify production rendering pipeline directly
- Do not do translation strategy experiments unrelated to layout here

## Recommended Input Samples

Suggest extracting 5-10 block-level samples from existing tasks covering:

- Single paragraph body
- Two to three consecutive body paragraphs
- Title
- Paragraph with inline formula
- CJK-Latin mixed paragraph
- Dense small-font paragraph
- Sparse large-font paragraph

Each sample should contain minimum:

- Source text
- Translated text
- Target box coordinates and dimensions
- Page width/height
- Current Typst parameters used
- Rendered result screenshot or reference image

## Recommended Technical Approaches

### Approach A: HTML as Measurement Tool

Idea:

- Use browser layout engine to compute real text layout at target width
- Sweep font size, line height, letter spacing
- Select parameter set with minimal error

Pros:

- Fast iteration
- Convenient visualization
- Suitable for block-level experiments first

Cons:

- Not fully consistent with Typst layout model
- Can only serve as "fitting reference", not final ground truth

### Approach B: HTML Assisting Typst

Idea:

- First search good parameter range with HTML
- Then feed parameters to Typst sample for secondary validation

Pros:

- Closer to real production pipeline
- Can migrate experimental results back to main system

Cons:

- Higher implementation complexity
- Slower debugging than pure HTML

Currently recommend doing `Approach A` first, then supplementing `Approach B`.

## Suggested Minimal Closed Loop First

1. Place 5-10 text block samples in `fixtures/`
2. Write minimal experiment page in `html/` supporting:
   - Text input
   - Target width/height input
   - Font switching
   - Font size, line height, letter spacing sweep
3. Write scorer in `scripts/` outputting:
   - Height error
   - Width overflow status
   - Line count
   - Overflow or not
4. Record best parameter distribution per sample type in `notes/`
5. Create corresponding comparison samples in `typst/` to test migrating parameters back

## Suggested Scoring Method

Do not pursue overly complex loss functions initially; make simple interpretable version first:

- Smaller height error better
- Width overflow heavily penalized
- Line count deviation moderately penalized
- Too-small font penalized
- Too-large line height penalized

Can start with something like:

`score = height_error * a + overflow_penalty * b + line_count_penalty * c + readability_penalty * d`

Focus not on formula elegance but stable, interpretable, iterable scoring results.

## Deliverable Requirements

Person taking over this directory must deliver at minimum:

1. Minimal HTML experiment page openable locally
2. Small but representative sample set
3. Basic parameter sweep or scoring script
4. Phase summary explaining:
   - Which blocks easy to fit
   - Which blocks hard to fit
   - Which parameters most sensitive
   - How much HTML results differ from Typst results
5. Recommendations for main project:
   - Worth integrating or not
   - Which layer suitable for integration
   - What risks exist

## Handover Requirements

If taking over this experiment, do these first:

1. Read this file completely
2. Write one page experiment plan in `notes/`
3. Do not modify main project directly
4. Validate one hypothesis at a time; do not mix multiple variables at once
5. Conclusions must include samples, screenshots, or scoring results; no subjective judgments only

## Current Recommendation

Most reasonable entry point currently not "full-page HTML layout" but "block-level fitter".

Because once block-level fitter stable, three uses follow:

- Directly serve HTML rendering
- Provide better initial parameters for Typst
- Provide font size and paragraph style reference for future Word/DOCX export

If this step unstable, jumping to full-page restoration only amplifies problems.

</content>