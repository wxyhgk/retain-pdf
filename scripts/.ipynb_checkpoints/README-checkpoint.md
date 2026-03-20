# Scripts Overview

This directory contains the OCR translation and PDF rendering pipeline.

## Layout

- `build_page.py`
  Build one translated preview page.
- `build_book.py`
  Build a translated multi-page PDF from per-page translation JSON files.
- `translate_page.py`
  Translate one page with DeepSeek.
- `translate_book.py`
  Translate a page range or the full book with DeepSeek.

### `common/`

- `config.py`
  Shared paths and default settings.

### `ocr/`

- `json_extractor.py`
  Reads OCR JSON and extracts page/block text items.
- `models.py`
  OCR-side data structures.

### `translation/`

- `deepseek_client.py`
  DeepSeek API client.
- `formula_protection.py`
  Protects inline formulas with placeholders during translation.
- `translations.py`
  Translation JSON template/load/save helpers.
- `translation_workflow.py`
  Shared translation workflow for page/book translation commands.

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
python scripts/translate_page.py --page 5 --batch-size 4
```

Translate a page range:

```bash
python scripts/translate_book.py --start-page 0 --end-page 20 --batch-size 2
```
