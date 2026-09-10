# Python Pipeline Dependencies

This file is generated from static import scanning under `backend/pipeline`.
Regenerate with:
`python backend/pipeline/devtools/extract_pipeline_requirements.py --services-root services --json-out docs/core/python/pipeline_dependencies.json --markdown-out docs/core/python/pipeline_dependencies.md --runtime-req-out docs/core/python/pipeline_runtime_requirements.in --test-req-out docs/core/python/pipeline_test_requirements.in`

## Runtime Python Packages

- `Pillow`
- `PyMuPDF`
- `docx`
- `fontTools`
- `lxml`
- `pikepdf`
- `requests`
- `urllib3`

## Test-only Python Packages

- `pytest`

## External Commands

- `typst`
  refs: `devtools/analyze_render_item_composition.py`, `devtools/architecture_checks/entrypoints.py`, `devtools/architecture_checks/rendering.py`, `devtools/architecture_checks/translation_field_writers.py`, `devtools/backfill_typography_memory.py`, `devtools/benchmark_source_cleanup.py`
- `gs`
  refs: `retainpdf_pipeline/render/source/compression/ghostscript.py`

## Package Map

| Import | Package | Runtime | Test | Example refs |
| --- | --- | --- | --- | --- |
| `PIL` | `Pillow` | yes | yes | `retainpdf_pipeline/render/layout/inline_content/fallback/png_renderer.py`, `retainpdf_pipeline/render/source/background/extract.py`, `retainpdf_pipeline/render/source/background/patch.py` |
| `docx` | `docx` | yes | no | `devtools/word_export/document_builder.py`, `devtools/word_export/exporter.py`, `devtools/word_export/math_omml.py` |
| `fitz` | `PyMuPDF` | yes | yes | `retainpdf_pipeline/runtime/pipeline/render_mode.py`, `retainpdf_pipeline/services/document_operations/visual_validation.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_normalize.py` |
| `fontTools` | `fontTools` | yes | no | `retainpdf_pipeline/foundation/config/fonts.py` |
| `lxml` | `lxml` | yes | yes | `devtools/word_export/textboxes.py` |
| `pikepdf` | `pikepdf` | yes | yes | `retainpdf_pipeline/services/document_operations/page_program.py`, `retainpdf_pipeline/render/document/pikepdf_overlay.py`, `retainpdf_pipeline/render/document/pikepdf_pages.py` |
| `pytest` | `pytest` | no | yes | `devtools/tests/document_operations/test_page_program.py`, `devtools/tests/document_schema/test_adapters_detection.py`, `devtools/tests/document_schema/test_backfill_normalized_documents.py` |
| `requests` | `requests` | yes | yes | `retainpdf_pipeline/ocr/mineru/mineru_api.py`, `retainpdf_pipeline/services/network/retry.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_api.py` |
| `urllib3` | `urllib3` | yes | no | `retainpdf_pipeline/services/network/retry.py`, `retainpdf_pipeline/translate/llm/providers/deepseek/transport.py` |

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
