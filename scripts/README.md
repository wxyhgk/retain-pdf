# Scripts Overview

This directory contains the OCR translation and PDF rendering pipeline.

Current status:

- paragraph-based Typst rendering is the default path
- default Typst Chinese font is `Noto Serif CJK SC`
- body layout tuning can be overridden from CLI without editing code
- current stable body-text strategy is: Chinese-first leading, page-level body font unification, emergency fallback only for true overflow blocks
- `list` child blocks are extracted and rendered item-by-item
- `inline_equation` is preserved via placeholders during translation
- `ref_text` is skipped and not sent to translation
- `image`, `image_body`, `image_caption`, `table_caption`, and `table_footnote` are left untouched in the stable sci pipeline
- translation supports DeepSeek and OpenAI-compatible local endpoints
- translation now supports concurrent batch workers and HTTP session reuse
- full-book translation now supports continuation groups across page boundaries
- continuation handling now uses a fast rule pass first, then only sends ambiguous candidate pairs to the model for review
- payloads now also carry orchestration metadata such as `layout_mode`, `layout_zone`, `skip_reason`, and `translation_unit_id`
- grouped translation/rendering now explicitly runs on `translation_unit_id`, while `continuation_group` remains only as one source of unit formation
- `precise` mode adds LLM block classification for suspicious OCR text blocks before translation
- `fast` and `sci` do not run the classifier; they rely on OCR block types plus skip policies
- `sci` mode can infer the document domain from the first two PDF pages and inject document-specific guidance into later translation batches
- full-book Typst build now compiles page overlays in parallel
- if a page hits unsupported Typst math, that page falls back to plain-text overlay instead of failing the whole book

## Layout

- `build_page.py`
  Build one translated preview page.
- `build_book.py`
  Build a translated multi-page PDF from per-page translation JSON files.
- `translate_page.py`
  Translate one page with a configurable OpenAI-compatible API.
- `translate_book.py`
  Translate a page range or the full book with a configurable OpenAI-compatible API.
- `run_book.py`
  Translate and render a full book in one page-by-page pipeline.
- `run_case.py`
  Simplest one-command entry: point it at a folder containing exactly one `.json` and one `.pdf`, and it auto-discovers inputs, auto-names outputs, then runs the full pipeline.
- `run_mineru_case.py`
  Recommended one-command MinerU entry at the top level. Parse with MinerU, translate from `layout.json`, and render into one structured job directory by reusing `integrations/mineru/mineru_pipeline.py`.
- `integrations/mineru/mineru_api.py`
  Minimal MinerU precise-API caller. Supports both remote URL task submission and local-file upload + polling.
- `integrations/mineru/mineru_api_example.py`
  Lightweight URL-only MinerU example: submit a task and poll until done.

### `common/`

- `config.py`
  Shared paths and default settings.
- `prompt_loader.py`
  Loads editable prompt files from `scripts/prompts/`.

### `ocr/`

- `json_extractor.py`
  Reads OCR JSON and extracts page/block text items. Skips `interline_equation`, `code`, `table`, `ref_text`, `image`, `image_body`, `image_caption`, `table_caption`, and `table_footnote`.
- `models.py`
  OCR-side data structures.

### `translation/`

- `deepseek_client.py`
  Translation API client for DeepSeek or any OpenAI-compatible endpoint, with per-thread `requests.Session()` reuse.
- `formula_protection.py`
  Protects inline formulas with placeholders during translation.
- `translations.py`
  Translation JSON template/load/save helpers.
- `translation_workflow.py`
  Shared translation workflow for page/book translation commands, including concurrent batch workers.
- `domain_context.py`
  In `sci` mode, infers the document domain from the first two PDF pages and generates translation guidance for the rest of the book.
- `continuations.py`
  Detects likely paragraph continuations, including cross-page continuation groups for full-book runs.

### `orchestration/`

- `zones.py`
  Shared page-layout helpers. Detects single/double-column structure and annotates each payload item with a layout zone.
- `units.py`
  Normalizes orchestration-facing payload fields such as `skip_reason` and `translation_unit_id`.
- `document_orchestrator.py`
  Lightweight document orchestration layer that keeps layout-zone annotation, candidate continuation review, and payload finalization out of rendering.

### `pipeline/`

- `book_pipeline.py`
  Thin entry layer for translate/build/run-book orchestration.
- `book_translation_flow.py`
  Full-book translation orchestration, including template loading, global continuation grouping, policy application, batched translation, and page JSON persistence.

### `classification/`

- `page_classifier.py`
  Lightweight LLM classification for suspicious OCR blocks. The model returns line-based labels like `item_id => translate`.

### `prompts/`

- `classification_system.txt`
  System prompt for precise-mode page classification.
- `translation_system.txt`
  System prompt for translation.
- `translation_task.txt`
  Task text injected into the translation user payload.
- `domain_inference_system.txt`
  System prompt for first-two-pages domain inference in `sci` mode.
- `domain_inference_task.txt`
  Task text for domain-aware translation guidance generation.

### `rendering/`

- `render_payloads.py`
  Converts translated items into render-ready paragraph blocks, normalizes OCR math for Typst, and distributes continuation-group text back into multiple original OCR boxes.
- `pdf_overlay.py`
  Legacy direct PDF text/image overlay helpers.
- `typst_formula_renderer.py`
  Formula rendering helpers used by the legacy overlay path.
- `typst_page_renderer.py`
  Current Typst-based paragraph renderer using `cmarker + mitex`, with page-level compile fallback, parallel book build support, and side-by-side dual PDF output.

## Current Rendering Path

The current preferred path is:

`OCR JSON -> translation JSON -> render_payloads -> typst_page_renderer -> PDF`

For the simplest day-to-day usage, prefer the top-level one-step entry for local OCR JSON/PDF cases:

```bash
python scripts/run_case.py \
  --source-json Data/test3/test3.json \
  --source-pdf Data/test3/test3.pdf \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY" \
  --workers 50 \
  --output-dir translations/test3-run \
  --output test3-run.pdf
```

This will:

- translate the whole document
- render the final PDF
- write translation JSONs under `output/translations/`
- write the final PDF under `output/`

## CLI Usage

Use these commands from the repo root:

```bash
cd /home/wxyhgk/tmp/Code
```

Recommended default entry:

```bash
python scripts/run_case.py \
  --source-json Data/test9/test9.json \
  --source-pdf Data/test9/test9.pdf \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY" \
  --workers 50 \
  --output-dir translations/test9-run \
  --output test9-run.pdf
```

Recommended MinerU one-step entry:

```bash
python scripts/run_mineru_case.py \
  --file-path Data/test9/test9.pdf \
  --model-version vlm \
  --mode sci \
  --model Q3.5-turbo \
  --base-url http://1.94.67.196:10001/v1
```

What each main CLI is for:

- `run_case.py`
  Recommended daily/API entry. Prefer explicit `--source-json`, `--source-pdf`, `--output-dir`, and `--output`. It also supports one fallback `input_dir` for local convenience.
- `run_book.py`
  Full end-to-end entry when you want to pass the JSON path, PDF path, output folder, and output PDF name explicitly.
- `run_mineru_case.py`
  Recommended MinerU daily entry. Use this when the source is still a PDF and you want `parse -> unpack -> translate -> render` in one command from the `scripts/` top level.
- `translate_book.py`
  Translate only. Use this when you want to keep translation JSONs and rebuild multiple times without paying translation cost again.
- `build_book.py`
  Build only from existing translation JSONs.
- `translate_page.py` / `build_page.py`
  Single-page debugging tools.

Current mode behavior:

- `fast`
  Fast general mode. No classifier.
- `sci`
  Recommended for papers. No classifier. It also infers document domain from the first two PDF pages and skips document tail after the last title.
- `precise`
  Experimental high-precision mode. This is the only mode that enables the LLM classifier for suspicious OCR blocks.

Common output behavior:

- translation JSONs are written under `output/translations/...`
- final PDFs are written under `output/...`
- if you omit `--end-page`, the full document is processed
- the default render mode is `typst`
- `--render-mode dual` outputs side-by-side pages: left original, right translated
- MinerU integrated flows can also write everything into one structured job directory under `output/<job-id>/`

Examples:

Recommended MinerU all-in-one pipeline:

```bash
python scripts/run_mineru_case.py \
  --file-path Data/test9/test9.pdf \
  --model-version vlm \
  --mode sci \
  --model Q3.5-turbo \
  --base-url http://1.94.67.196:10001/v1
```

This creates:

- `output/<job-id>/originPDF`
- `output/<job-id>/jsonPDF`
- `output/<job-id>/transPDF`

`layout.json` is used as the default MinerU OCR JSON for the translation pipeline.

Low-level MinerU implementation note:

- `scripts/run_mineru_case.py` is the recommended public entry.
- `scripts/integrations/mineru/mineru_pipeline.py` remains the stable implementation it delegates to.

MinerU middle-level job runner, only parse and unpack:

```bash
python scripts/integrations/mineru/mineru_job.py \
  --file-path Data/test9/test9.pdf \
  --model-version vlm \
  --job-id 202603212300-demo
```

Migrate old `output/mineru/<case>` experiments into the new structured layout:

```bash
python scripts/integrations/mineru/migrate_legacy_output.py \
  --legacy-root output/mineru/test9 \
  --job-id 20260321-legacy-mineru-test9
```

This creates:

- `output/202603212300-demo/originPDF`
- `output/202603212300-demo/jsonPDF`
- `output/202603212300-demo/transPDF`

Use MinerU `layout.json` as the main OCR JSON input:

```bash
python scripts/run_case.py \
  --source-json output/202603212300-demo/jsonPDF/unpacked/layout.json \
  --source-pdf output/202603212300-demo/originPDF/test9.pdf \
  --mode sci \
  --model Q3.5-turbo \
  --base-url http://1.94.67.196:10001/v1 \
  --output-dir 202603212300-demo/transPDF/translations \
  --output 202603212300-demo/transPDF/test9-translated.pdf
```

Low-level MinerU API script remains available when you only want the raw API response:

```bash
python scripts/integrations/mineru/mineru_api.py \
  --token "$MINERU_TOKEN" \
  --file-url "https://cdn-mineru.openxlab.org.cn/demo/example.pdf" \
  --model-version vlm \
  --poll \
  --output-json output/mineru-result.json
```

Run a whole case folder with DeepSeek:

```bash
python scripts/run_case.py \
  --source-json Data/test3/test3.json \
  --source-pdf Data/test3/test3.pdf \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY" \
  --workers 50 \
  --output-dir translations/test3-run \
  --output test3-run.pdf
```

Run a whole case folder with the self-hosted endpoint:

```bash
python scripts/run_case.py \
  --source-json Data/test9/test9.json \
  --source-pdf Data/test9/test9.pdf \
  --mode sci \
  --model Q3.5-turbo \
  --base-url http://1.94.67.196:10001/v1 \
  --workers 50 \
  --output-dir translations/test9-q35 \
  --output test9-q35.pdf
```

Fallback auto-discovery mode for local manual use:

```bash
python scripts/run_case.py Data/test9 \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY" \
  --workers 50
```

Run with explicit paths instead of a case folder:

```bash
python scripts/run_book.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --mode sci \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/test1-run \
  --output test1-run.pdf
```

Translate first, then rebuild repeatedly:

```bash
python scripts/translate_book.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --mode sci \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/test1-q35

python scripts/build_book.py \
  --translations-dir translations/test1-q35 \
  --source-pdf Data/test1/test1.pdf \
  --output test1-q35.pdf \
  --render-mode typst
```

Rendering is paragraph-based:

- use the paragraph `bbox`
- join text and inline formulas into one Markdown paragraph
- for continuation groups, translate once and flow the result back across multiple OCR boxes, including cross-page cases
- render with Typst `cmarker + mitex`
- build one combined Typst overlay for the whole selected page range by default
- for editable PDFs, remove original text without white fill before overlaying Chinese
- for image-style PDFs, keep white redaction fill as fallback
- if the combined Typst build fails, fall back to page-level plain-text-safe overlay compilation

Inline formula coordinates are not used directly in the current Typst path.

## Font Strategy

The current font-fitting strategy is based on two expert conclusions:

- do not chase the original English point size directly
- instead, reproduce the original block's rhythm and occupied area with the target Chinese font in Typst

Current engineering rules:

- `title` is handled separately and is not used as the body-text baseline
- `table`, `image`, `image_body`, `code`, `ref_text`, and `interline_equation` do not participate in Chinese font fitting
- body text is estimated from OCR geometry, not from translation length alone
- the main signal is `line pitch` from `line.bbox` center-to-center distance
- `line height` is only a fallback signal
- original OCR block `bbox` is not treated as the final usable text box directly
- rendering uses a conservative `inner_bbox` to avoid fat-looking paragraphs caused by OCR padding
- page-level baseline is preferred over aggressive per-block font drift
- block-level scaling is allowed only in a very narrow range

What we learned from the two experts:

- Expert 1:
  use page-level baseline plus small block-level adjustment
- Expert 2:
  the real target is line rhythm and occupied ratio, not source English font size
- Shared conclusion:
  line geometry matters more than raw text length or translated character count

Practical consequences in the code:

- body text should look uniform inside the same page/column
- font variation should be small, not zero and not large
- line spacing should stay in a narrow band instead of using a loose global default
- `inner_bbox` is often more important than another `0.2pt` font tweak

Runtime tuning knobs:

- `--body-font-size-factor`
- `--body-leading-factor`
- `--inner-bbox-shrink-x`
- `--inner-bbox-shrink-y`
- `--inner-bbox-dense-shrink-x`
- `--inner-bbox-dense-shrink-y`

What we are not doing on purpose:

- no attempt to recover the original PDF font family
- no per-span font restoration
- no strong dependence on AI output length differences between models

The current direction is:

- stable page-level body-text size
- small elasticity only
- rhythm-first fitting using OCR line geometry
- Chinese-first body leading instead of tight OCR-English leading lock-in
- page-level body font unification with emergency fallback only for true overflow blocks
- continue improving body-text detection before touching non-body blocks

## Translation Rules

- translate natural-language text blocks
- keep inline formulas untouched through placeholder protection
- do not translate `interline_equation`
- do not translate `code`
- do not translate `table`
- do not translate `ref_text`
- do not translate `image`
- do not translate `image_body`
- do not translate `image_caption`
- do not translate `table_caption`
- do not translate `table_footnote`

In `precise` mode:

- only suspicious OCR blocks are sent to the classifier
- the classifier returns only `translate`, `code`, or `skip`
- no original OCR structure is rewritten
- non-`translate` items stay untouched in the output PDF

## Build Strategy

For full-book PDF generation, the current strategy is:

- translate page-by-page into per-page JSON
- build one combined Typst overlay for the selected page range
- remove original text directly for editable PDFs before overlaying Chinese
- use white redaction fill only for image-style PDFs
- if the combined build fails on a Typst issue, fall back to page-level compilation
- page-level fallback can still compile pages in parallel when needed

This is currently the best size / stability tradeoff we found. Experiments with extra pre-subset font assets did not reduce the final PDF size in this pipeline, so they are not part of the main route.

## Continuation Groups

The current full-book path supports logical paragraphs that were split by OCR:

- same-page continuation:
  left-column bottom -> right-column top
- cross-page continuation:
  previous page tail -> next page head
- single-column continuation:
  lower block -> next page first block

The rule is based on reading-order adjacency plus sentence-continuation heuristics. When a continuation group is detected:

- the group is translated as one paragraph
- the translated result is stored once at group level
- rendering redistributes that paragraph into the original boxes in order
- original English text is redacted from every box in the group before Chinese overlay

## Recommended Endpoints

- local OpenAI-compatible endpoint:
  `http://1.94.67.196:10001/v1`
- tested local model:
  `Q3.5-turbo`
- DeepSeek model:
  `deepseek-chat`

Recent end-to-end benchmark on pages 1-20:

- local `Q3.5-turbo`, `batch-size=6`, `workers=4`:
  about `75.90s` total
- DeepSeek `deepseek-chat`, same workload:
  about `249.25s` total

## Common Commands

Build page 6 from an existing translation JSON:

```bash
python scripts/build_page.py \
  --page 5 \
  --translation-json old/translations/page-6-deepseek-v3.json \
  --output dev-6-check.pdf \
  --single-page \
  --render-mode typst
```

Build a book preview from archived translations:

```bash
python scripts/build_book.py \
  --translations-dir old/translations/book \
  --output dev-book-preview.pdf \
  --start-page 0 \
  --end-page 18 \
  --compile-workers 12
```

Build a dual preview with original pages on the left and translated pages on the right:

```bash
python scripts/build_book.py \
  --translations-dir translations/test1-run \
  --source-pdf Data/test1/test1.pdf \
  --start-page 0 \
  --end-page 1 \
  --output test1-dual-preview.pdf \
  --render-mode dual
```

Translate one page:

```bash
python scripts/translate_page.py --page 5 --batch-size 4 --workers 2
```

Translate one page with precise classification:

```bash
python scripts/translate_page.py \
  --page 5 \
  --mode precise \
  --classify-batch-size 8 \
  --batch-size 4 \
  --workers 2
```

Translate a page range:

```bash
python scripts/translate_book.py --start-page 0 --end-page 19 --batch-size 6 --workers 4
```

Use the self-hosted OpenAI-compatible endpoint:

```bash
python scripts/translate_page.py \
  --page 5 \
  --batch-size 4 \
  --workers 2 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo
```

Translate and build the full book with the local endpoint:

```bash
python scripts/translate_book.py \
  --start-page 0 \
  --end-page 19 \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/book-q35

python scripts/build_book.py \
  --translations-dir translations/book-q35 \
  --output book-q35.pdf \
  --start-page 0 \
  --end-page 19 \
  --compile-workers 24
```

Run the page-by-page pipeline in one command:

```bash
python scripts/run_book.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --mode precise \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/test1-run \
  --output test1-run.pdf
```

Run the same pipeline but emit a dual PDF:

```bash
python scripts/run_book.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --mode precise \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/test1-dual-run \
  --output test1-dual-run.pdf \
  --render-mode dual
```

If you omit `--end-page`, the scripts process the full document by default.
`run_book.py` defaults to `typst` rendering.
The current preferred production route is still the Typst path: delete original text on editable PDFs, then apply one combined Typst overlay for the whole book.
`run_book.py --render-mode dual` and `build_book.py --render-mode dual` output side-by-side pages: left original, right translated.
`build_book.py` supports `--compile-workers`; `0` means auto, and the current auto mode caps parallel Typst page compilation to a safe upper bound instead of trying to use all CPU threads blindly.
