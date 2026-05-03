# Python Pipeline Dependencies

This file is generated from static import scanning under `backend/scripts`.
Regenerate with:
`python backend/scripts/devtools/extract_pipeline_requirements.py --repo-root . --json-out doc/core/python/pipeline_dependencies.json --markdown-out doc/core/python/pipeline_dependencies.md --runtime-req-out doc/core/python/pipeline_runtime_requirements.in --test-req-out doc/core/python/pipeline_test_requirements.in`

## Runtime Python Packages

- `Pillow`
- `PyMuPDF`
- `pikepdf`
- `requests`
- `urllib3`

## Test-only Python Packages

- `pytest`

## External Commands

- `typst`
  refs: `devtools/check_pipeline_architecture.py`, `devtools/experiments/mineru_content_v2/render_translated.py`, `devtools/job_debug_runner.py`, `devtools/replay_translation_item.py`, `devtools/tests/document_schema/test_normalize_stage_spec.py`, `devtools/tests/document_schema/test_provider_pipeline_entry.py`
- `gs`
  refs: `services/rendering/compress/ghostscript.py`

## Package Map

| Import | Package | Runtime | Test | Example refs |
| --- | --- | --- | --- | --- |
| `PIL` | `Pillow` | yes | yes | `services/rendering/background/extract.py`, `services/rendering/background/patch.py`, `services/rendering/compress/image_ops.py` |
| `fitz` | `PyMuPDF` | yes | yes | `runtime/pipeline/render_mode.py`, `runtime/pipeline/render_stage.py`, `services/document_schema/normalize_pipeline.py` |
| `pikepdf` | `pikepdf` | yes | no | `services/rendering/compress/image_ops.py`, `services/rendering/compress/image_pipeline.py`, `services/rendering/preprocess/hidden_text_strip.py` |
| `pytest` | `pytest` | no | yes | `devtools/tests/rendering/test_typst_render_refactor.py`, `devtools/tests/translation/test_formula_math_markers.py` |
| `requests` | `requests` | yes | yes | `services/mineru/artifacts.py`, `services/mineru/mineru_api.py`, `services/mineru/mineru_job.py` |
| `urllib3` | `urllib3` | yes | no | `services/translation/llm/providers/deepseek/client.py` |

## Existing Requirement Files

- `docker/requirements-app.txt`
- `desktop/requirements-desktop-posix.txt`
- `desktop/requirements-desktop-windows.txt`
- `desktop/requirements-desktop-macos.txt`

## Generated Outputs

- `doc/core/python/pipeline_dependencies.json`
- `doc/core/python/pipeline_dependencies.md`
- `doc/core/python/pipeline_runtime_requirements.in`
- `doc/core/python/pipeline_test_requirements.in`
