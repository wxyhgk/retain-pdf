# MinerU Integration Guide

This layer is solely responsible for MinerU integration, not translation strategy or PDF rendering.

If you are interested in "how to abstract external OCR APIs independently instead of coupling them into the current workflow", read first:

- `scripts/services/ocr_provider/README.md`

`services/mineru/` is just the concrete implementation for the MinerU provider.

## Functional Boundaries

- Submit tasks to MinerU
- Query task status
- Download and unpack MinerU results
- Organize MinerU provider products in the standard job root, primarily writing to `source/`, `ocr/unpacked/`, and `ocr/normalized/`
- Retain raw `layout.json` for adapters, debugging, and traceability
- Output the unified intermediate layer `document.v1.json`

Out of scope:

- No OCR post-processing
- No translation
- No PDF rendering
- No decision on `fast/sci/precise` translation strategies

## Recommended Entry Points

- `scripts/entrypoints/run_provider_case.py`
  When using manually locally, prioritize this common entry point name. This is a neutral entry point that does not hardcode the provider name.
- `mineru_pipeline.py`
  Stable implementation behind `entrypoints/run_provider_case.py`.
- `mineru_job.py`
  Only performs analysis and unpacking, suitable for obtaining MinerU results first and then manually connecting translation.
- `mineru_api.py`
  Encapsulates low-level API calls, only use when needing to directly call the MinerU interface.
- `scripts/devtools/tools/mineru_api_example.py`
  Minimal example, suitable for interface connection and viewing return structure.

## Directory Structure

- `<job-root>/source`
- `<job-root>/ocr`
- `<job-root>/translated`
- `<job-root>/rendered`
- `<job-root>/artifacts`
- `<job-root>/logs`

## Default Conventions

- The MinerU stage will simultaneously produce:
  - `ocr/unpacked/layout.json`
  - `ocr/normalized/document.v1.json`
  - `ocr/normalized/document.v1.report.json`
- The current main translation/render workflow defaults to requiring and prioritizing `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` is retained for adapters, debugging, and traceability, no longer an implicit fallback of the main workflow
- `content_list_v2.json` is currently only used for experiments and adapters, not the main path
- If only wanting to display provider summaries / defaults / validation, prioritize reading `document.v1.report.json`

Responsibility Division:

- `document_v1.py`
  Only responsible for converting MinerU's `layout.json` to `document.v1.json`
- `artifacts.py`
  Only responsible for MinerU product paths and provider internal file organization
- `contracts.py`
  Only responsible for MinerU provider-specific product file and directory names
- `job_flow.py`
  Only responsible for task orchestration, download, unpacking, and storage
- `mineru_pipeline.py`
  Only responsible for feeding normalized OCR input into the main translation/render workflow

Notes:

- The main `pipeline_summary.json`, stdout labels, and source-json selection rules have been consolidated into `services/pipeline_shared/`
- `services/mineru/` is no longer responsible for any common normalization shells

Currently, this workflow is exposed as a unified adapter through `services/document_schema/adapters.py`,
meaning MinerU no longer directly exposes its raw structure to the main translation workflow.

## Relationship with the Main Workflow

The typical process is:

1. `mineru_job.py` or `mineru_pipeline.py` submits PDF to MinerU
2. Poll until task completion
3. Download and unpack results
4. Copy source PDF to `source`
5. Place analysis results in `ocr/unpacked`
6. Simultaneously generate `ocr/normalized/document.v1.json`
7. The rest of the workflow is completed by `runtime/pipeline` calling `services/translation` and `services/rendering`

Currently, `pipeline_summary.json` also records a `schema_validation` to quickly confirm whether the normalized text meets the current `document.v1` contract; it also includes `normalization_report` and `normalization_summary` to prevent outer layers from having to parse raw OCR.

In other words, the responsibility of this layer is to "turn PDF into OCR input consumable by the main workflow", not to handle subsequent business logic.

## Provider Stage Spec

`provider.stage.v1` is currently mainly retained for local provider-case helpers and compatibility paths:

`python -u scripts/entrypoints/run_provider_case.py --spec <job_root>/specs/provider.spec.json`

In the main production workflow, the Rust API is responsible for provider-backed OCR flow: dispatching MinerU / Paddle transport based on the OCR provider in the request, and after generating the provider's raw results, proceeding to normalize, translate, and render stages. MinerU provider code still only maintains MinerU API semantics and raw product organization, not defining higher-level book workflow contracts.

Security Conventions:

- MinerU tokens must not be written directly into job specs or artifacts
- Compatible with using `credential_ref=env:RETAIN_MINERU_API_TOKEN` in provider specs
- Translation keys also use `credential_ref=env:RETAIN_TRANSLATION_API_KEY`

Compatibility Guidelines:

- If old task directories still use `originPDF/jsonPDF/transPDF/typstPDF`, the current backend will directly reject detail/download interfaces; please rerun the task

## Coordination Rules

If the OCR portion is assigned to someone else to maintain, this layer is only responsible for "taking results from the provider and organizing them into OCR input consumable by the main workflow".

- Allowed to change provider API integration, download/unpacking, task directory organization, and provider-side compatibility here
- Do not directly add translation rules, terminology logic, or PDF rendering logic here
- If downstream required fields are found to be insufficient, prioritize upgrading to stable fields through `document_schema`; do not directly expose raw provider fields to translation / rendering
- If changing OCR product directory conventions, stdout labels, or main workflow input locations, must synchronously update `document_schema`, `runtime/pipeline`, and corresponding tests
