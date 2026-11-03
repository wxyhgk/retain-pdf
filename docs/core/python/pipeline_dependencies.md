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
- `retainpdf_base`
- `retainpdf_math`
- `retainpdf_translation`
- `retainpdf_translation_agent`
- `urllib3`

## Test-only Python Packages

- `docx`
- `pytest`

## External Commands

- `typst`
  refs: `devtools/analyze_render_item_composition.py`, `devtools/architecture_checks/rendering.py`, `devtools/architecture_checks/translation_field_writers.py`, `devtools/architecture_checks/translation_source_readers.py`, `devtools/benchmark_source_cleanup.py`, `devtools/experiments/mineru_content_v2/render_translated.py`
- `gs`
  refs: `retainpdf_pipeline/render/source/compression/ghostscript.py`, `retainpdf_pipeline/render/source/preparation/hidden_text_strip.py`

## Package Map

| Import | Package | Runtime | Test | Example refs |
| --- | --- | --- | --- | --- |
| `PIL` | `Pillow` | yes | yes | `retainpdf_pipeline/render/layout/inline_content/fallback/png_renderer.py`, `retainpdf_pipeline/render/source/background/extract.py`, `retainpdf_pipeline/render/source/background/patch.py` |
| `docx` | `docx` | no | yes | `devtools/tests/rendering/test_word_export.py` |
| `fitz` | `PyMuPDF` | yes | yes | `retainpdf_pipeline/ocr/document_schema/pdf_geometry.py`, `retainpdf_pipeline/ocr/ocr_provider/glm_ocr_api.py`, `retainpdf_pipeline/ocr/ocr_provider/glm_ocr_driver.py` |
| `fontTools` | `fontTools` | yes | no | `retainpdf_pipeline/foundation/config/fonts.py` |
| `pikepdf` | `pikepdf` | yes | yes | `retainpdf_pipeline/render/document/pikepdf_overlay.py`, `retainpdf_pipeline/render/document/pikepdf_pages.py`, `retainpdf_pipeline/render/output/rpr_fit/renderer.py` |
| `pytest` | `pytest` | no | yes | `devtools/tests/agent_lab/test_agent_lab.py`, `devtools/tests/agent_lab/test_sample_conference.py`, `devtools/tests/agent_lab/test_sample_essay.py` |
| `requests` | `requests` | yes | yes | `retainpdf_pipeline/ocr/mineru_provider/mineru_api.py`, `retainpdf_pipeline/ocr/ocr_provider/glm_ocr_api.py`, `retainpdf_pipeline/ocr/ocr_provider/paddle_api.py` |
| `retainpdf_base` | `retainpdf_base` | yes | yes | `retainpdf_pipeline/foundation/config/__init__.py`, `retainpdf_pipeline/foundation/shared/config.py`, `retainpdf_pipeline/foundation/shared/job_dirs.py` |
| `retainpdf_math` | `retainpdf_math` | yes | yes | `retainpdf_pipeline/render/layout/inline_content/__init__.py`, `retainpdf_pipeline/render/layout/inline_content/core/inline_math.py`, `retainpdf_pipeline/render/layout/inline_content/core/markdown.py` |
| `retainpdf_translation` | `retainpdf_translation` | yes | yes | `retainpdf_pipeline/entrypoints/diagnose_failure_with_ai.py`, `retainpdf_pipeline/entrypoints/revise_translation_item.py`, `retainpdf_pipeline/ocr/mineru_provider/mineru_pipeline.py` |
| `retainpdf_translation_agent` | `retainpdf_translation_agent` | yes | yes | `devtools/agent_lab/__main__.py`, `devtools/agent_lab/metrics.py`, `devtools/agent_lab/pages.py` |
| `urllib3` | `urllib3` | yes | no | `retainpdf_pipeline/ocr/retry.py` |

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
