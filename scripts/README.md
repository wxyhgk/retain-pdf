# Scripts Overview

This directory contains the OCR translation and PDF rendering pipeline.

Current status:

- paragraph-based Typst rendering is the default path
- `list` child blocks are extracted and rendered item-by-item
- `inline_equation` is preserved via placeholders during translation
- `ref_text` is skipped and not sent to translation
- translation supports DeepSeek and OpenAI-compatible local endpoints
- translation now supports concurrent batch workers and HTTP session reuse
- full-book translation now supports continuation groups across page boundaries
- `precise` mode adds LLM block classification for suspicious OCR text blocks before translation
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

### `common/`

- `config.py`
  Shared paths and default settings.
- `prompt_loader.py`
  Loads editable prompt files from `scripts/prompts/`.

### `ocr/`

- `json_extractor.py`
  Reads OCR JSON and extracts page/block text items. Skips `interline_equation`, `code`, `table`, and `ref_text`.
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
- `continuations.py`
  Detects likely paragraph continuations, including cross-page continuation groups for full-book runs.

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

### `rendering/`

- `render_payloads.py`
  Converts translated items into render-ready paragraph blocks, normalizes OCR math for Typst, and distributes continuation-group text back into multiple original OCR boxes.
- `pdf_overlay.py`
  Legacy direct PDF text/image overlay helpers.
- `typst_formula_renderer.py`
  Formula rendering helpers used by the legacy overlay path.
- `typst_page_renderer.py`
  Current Typst-based paragraph renderer using `cmarker + mitex`, with page-level compile fallback and parallel book build support.

## Current Rendering Path

The current preferred path is:

`OCR JSON -> translation JSON -> render_payloads -> typst_page_renderer -> PDF`

Rendering is paragraph-based:

- use the paragraph `bbox`
- join text and inline formulas into one Markdown paragraph
- for continuation groups, translate once and flow the result back across multiple OCR boxes, including cross-page cases
- render with Typst `cmarker + mitex`
- build full books page-by-page instead of one giant overlay compile
- compile page overlays in parallel during full-book build
- if one page contains unsupported math syntax, downgrade only that page to plain-text overlay

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

What we are not doing on purpose:

- no attempt to recover the original PDF font family
- no per-span font restoration
- no strong dependence on AI output length differences between models

The current direction is:

- stable page-level body-text size
- small elasticity only
- rhythm-first fitting using OCR line geometry
- continue improving body-text detection before touching non-body blocks

## Translation Rules

- translate natural-language text blocks
- keep inline formulas untouched through placeholder protection
- do not translate `interline_equation`
- do not translate `code`
- do not translate `table`
- do not translate `ref_text`

In `precise` mode:

- only suspicious OCR blocks are sent to the classifier
- the classifier returns only `translate`, `code`, or `skip`
- no original OCR structure is rewritten
- non-`translate` items stay untouched in the output PDF

## Build Strategy

For full-book PDF generation, the current strategy is:

- translate page-by-page into per-page JSON
- compile per-page Typst overlays in parallel
- if a page fails Typst math rendering, retry that page as plain-text overlay
- after all overlays are ready, merge them back into the source PDF sequentially

This keeps the final build fast on multi-core CPUs without letting one bad formula kill the whole book.

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

If you omit `--end-page`, the scripts process the full document by default.
`run_book.py` defaults to `typst` rendering.
`build_book.py` supports `--compile-workers`; `0` means auto, and the current auto mode caps parallel Typst page compilation to a safe upper bound instead of trying to use all CPU threads blindly.
