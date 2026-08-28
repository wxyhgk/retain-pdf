# Shared Guide

`scripts/foundation/shared` contains basic capabilities that the entire script suite depends on.

This layer does not implement OCR, translation, or rendering business logic, primarily responsible for centralizing "shared things" to avoid redefining paths, environment variables, and default parameters across multiple scripts.

## Main Files

- `config.py`
  Forwarding entry point. Internal implementations have been split into `scripts/foundation/config/`; new code should depend directly on the split modules.
- `input_resolver.py`
  Responsible for resolving input directories into clear `source_json/source_pdf`.
- `job_dirs.py`
  Responsible for resolving and validating the standard job directory contract: `source/ocr/translated/rendered/artifacts/logs`.
- `local_env.py`
  Responsible for reading keys from explicit parameters, environment variables, or `scripts/.env/`.
- `prompt_loader.py`
  Responsible for loading editable prompt templates from `scripts/foundation/prompts/`.
- `job_cleanup.py`
  Responsible for output directory cleanup logic.
- `stage_specs.py`
  Responsible for stage spec schema constants, JSON loading, and `credential_ref` resolution.

## Position in the Overall Process

`foundation/shared` is the support layer for all layers:

- Stage workers / orchestration layers use it to resolve specs, credential references, and standard job directories
- OCR provider implementation layers use it to read tokens, environment configurations, and output paths
- Translation layers use it to load prompts and default configurations
- Rendering layers use it to read fonts, compression, and layout parameters
- Rust/Python orchestration layers use it to resolve `job_root/specs/*.spec.json`

## An Important Convention

Currently, `config.py` contains a section for "process-level adjustable tuning parameters", such as:

- `BODY_FONT_SIZE_FACTOR`
- `BODY_LEADING_FACTOR`
- `INNER_BBOX_SHRINK_X/Y`

These parameters can be overridden at runtime via `apply_layout_tuning(...)`.

This is very convenient for CLI, but it also means:

- When running multiple tasks consecutively in the same process, pay attention to whether parameters affect each other
- If further splitting and consolidation are needed later, this layer is a worthwhile point to focus on

## Stage Spec and Credential Conventions

Current stage workers have been unified into:

`python -u <entrypoint> --spec <job_root>/specs/<stage>.spec.json`

Schema versions currently maintained in `stage_specs.py` include:

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`
- `provider.stage.v1`
- `book.stage.v1`

Additional conventions:

- Spec is a stable data contract from Rust to Python, no longer dependent on concatenating long CLI flags
- Do not write keys directly into JSON specs
- Only retain `credential_ref` in specs
  - `env:RETAIN_TRANSLATION_API_KEY`
  - `env:RETAIN_MINERU_API_TOKEN`
- Python workers uniformly obtain actual values at runtime via `resolve_credential_ref(...)`
- Workers called by the main Rust process now require `--spec`
- Local development entry points are also uniformly controlled via stage specs

## Usage Recommendations

- New code should prioritize viewing configurations split by responsibility in `scripts/foundation/config/`.
- Upper-layer scripts should not manually concatenate paths like `output/<job-id>/...`; prioritize going through `job_dirs.py`
- Python workers should only consume stage specs, no longer exposing long business parameter entry points
- If it's a stage worker, prioritize adding/consuming schemas in `stage_specs.py` rather than continuing to expand CLI parameters
- Key reading should not be scattered in business code; prioritize going through `local_env.py`
- Prompts should not be hardcoded in business modules; prioritize going through `prompt_loader.py`
