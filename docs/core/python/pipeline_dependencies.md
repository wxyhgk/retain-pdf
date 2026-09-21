# Python Pipeline Dependencies

This file is generated from static import scanning under `backend/pipeline`.
Regenerate with:
`python backend/pipeline/devtools/extract_pipeline_requirements.py --services-root backend --json-out docs/core/python/pipeline_dependencies.json --markdown-out docs/core/python/pipeline_dependencies.md --runtime-req-out docs/core/python/pipeline_runtime_requirements.in --test-req-out docs/core/python/pipeline_test_requirements.in`

## Runtime Python Packages

- `Pillow`
- `PyMuPDF`
- `fontTools`
- `pikepdf`
- `requests`
- `urllib3`

## Test-only Python Packages

- `docx`
- `pytest`

## External Commands

- `typst`
  refs: `devtools/analyze_render_item_composition.py`, `devtools/architecture_checks/rendering.py`, `devtools/architecture_checks/translation_field_writers.py`, `devtools/architecture_checks/translation_source_readers.py`, `devtools/backfill_typography_memory.py`, `devtools/benchmark_source_cleanup.py`
- `gs`
  refs: `retainpdf_pipeline/render/source/compression/ghostscript.py`, `retainpdf_pipeline/render/source/preparation/hidden_text_strip.py`

## Package Map

| Import | Package | Runtime | Test | Example refs |
| --- | --- | --- | --- | --- |
| `PIL` | `Pillow` | yes | yes | `retainpdf_pipeline/render/layout/inline_content/fallback/png_renderer.py`, `retainpdf_pipeline/render/source/background/extract.py`, `retainpdf_pipeline/render/source/background/patch.py` |
| `docx` | `docx` | no | yes | `devtools/tests/rendering/test_word_export.py` |
| `fitz` | `PyMuPDF` | yes | yes | `retainpdf_pipeline/document_operations/visual_validation.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_normalize.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_runner.py` |
| `fontTools` | `fontTools` | yes | no | `retainpdf_pipeline/foundation/config/fonts.py` |
| `pikepdf` | `pikepdf` | yes | yes | `retainpdf_pipeline/document_operations/page_program.py`, `retainpdf_pipeline/render/document/pikepdf_overlay.py`, `retainpdf_pipeline/render/document/pikepdf_pages.py` |
| `pytest` | `pytest` | no | yes | `devtools/tests/conftest.py`, `devtools/tests/document_operations/test_document_operation_cli.py`, `devtools/tests/document_operations/test_page_program.py` |
| `requests` | `requests` | yes | yes | `retainpdf_pipeline/ocr/mineru_provider/mineru_api.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_api.py`, `retainpdf_pipeline/ocr/retry.py` |
| `urllib3` | `urllib3` | yes | no | `retainpdf_pipeline/ocr/retry.py`, `retainpdf_pipeline/translate/llm/providers/deepseek/transport.py` |

## Dependency Sources

- `pyproject.toml`
- `uv.lock`
- `pipeline/pyproject.toml`
- `ai/pyproject.toml`

## Generated Outputs

- `docs/core/python/pipeline_dependencies.json`
- `docs/core/python/pipeline_dependencies.md`
- `docs/core/python/pipeline_runtime_requirements.in`
- `docs/core/python/pipeline_test_requirements.in`
