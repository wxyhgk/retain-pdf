# Scripts Overview

This directory contains the OCR translation and PDF rendering pipeline.

Current status:

- paragraph-based Typst rendering is the default path
- `list` child blocks are extracted and rendered item-by-item
- `inline_equation` is preserved via placeholders during translation
- `ref_text` is skipped and not sent to translation
- translation supports DeepSeek and OpenAI-compatible local endpoints
- translation now supports concurrent batch workers and HTTP session reuse

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

### `rendering/`

- `render_payloads.py`
  Converts translated items into render-ready paragraph blocks.
- `pdf_overlay.py`
  Legacy direct PDF text/image overlay helpers.
- `typst_formula_renderer.py`
  Formula rendering helpers used by the legacy overlay path.
- `typst_page_renderer.py`
  Current Typst-based paragraph renderer using `cmarker + mitex`.

## Current Rendering Path

The current preferred path is:

`OCR JSON -> translation JSON -> render_payloads -> typst_page_renderer -> PDF`

Rendering is paragraph-based:

- use the paragraph `bbox`
- join text and inline formulas into one Markdown paragraph
- render with Typst `cmarker + mitex`

Inline formula coordinates are not used directly in the current Typst path.

## Translation Rules

- translate natural-language text blocks
- keep inline formulas untouched through placeholder protection
- do not translate `interline_equation`
- do not translate `code`
- do not translate `table`
- do not translate `ref_text`

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
  --end-page 18
```

Translate one page:

```bash
python scripts/translate_page.py --page 5 --batch-size 4 --workers 2
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
  --end-page 19
```

Run the page-by-page pipeline in one command:

```bash
python scripts/run_book.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --batch-size 6 \
  --workers 4 \
  --base-url http://1.94.67.196:10001/v1 \
  --model Q3.5-turbo \
  --output-dir translations/test1-run \
  --output test1-run.pdf
```

If you omit `--end-page`, the scripts process the full document by default.
`run_book.py` defaults to `typst` rendering, which now compiles one combined overlay PDF for the whole book.
