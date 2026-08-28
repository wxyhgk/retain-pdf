# OCR Provider Contract

This document answers one question:

**In `rust_api`, what exactly is the OCR provider layer responsible for, and what is it NOT responsible for.**

Related documents:

- Overall architecture boundaries:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- Current execution main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- Stage runtime contract:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- Paddle OCR API Summary:
  [`src/ocr_provider/paddle/API_SUMMARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/API_SUMMARY.md)

## 1. Goal

The goal of the `ocr_provider` layer is not to run the complete OCR process, but to provide:

- Provider identity recognition
- Provider capability declaration
- Provider transport client
- Provider status mapping
- Provider error classification

In other words:

- "Who is this provider?"
- "What does it support?"
- "What does the status it returns mean?"
- "How to classify it when it fails?"

## 2. Current Directory

- [src/ocr_provider/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/mod.rs)
- [src/ocr_provider/types.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/types.rs)
- [src/ocr_provider/catalog.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/catalog.rs)
- [src/ocr_provider/mineru](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/mineru)
- [src/ocr_provider/paddle](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle)

## 3. Division of Labor

### 3.1 `types.rs`

Responsible for provider shared data structures:

- `OcrProviderKind`
- `OcrProviderCapabilities`
- `OcrProviderDiagnostics`
- `OcrTaskStatus`
- `OcrProviderErrorInfo`

Rules:

- Place shared contracts here.
- Do not place provider-specific transport logic here.

### 3.2 `catalog.rs`

Responsible for provider metadata registration:

- `provider_definition`
- `provider_capabilities`
- `is_supported_provider`
- `ensure_provider_diagnostics`

Rules:

- When adding a new provider, register it here first.
- The unique aggregation point for `capabilities` must be here.
- Do not scatter `diagnostics` initialization logic across the runner.

### 3.3 `<provider>/client.rs`

Responsible for provider communication:

- Construct requests.
- Call external APIs.
- Parse responses.

Not responsible for:

- Job lifecycle.
- Route returns.
- Translation/render decisions.

### 3.4 `<provider>/status.rs`

Responsible for mapping provider raw status to unified status.

Example:

- provider raw state -> `OcrTaskState`
- provider raw message -> stage/detail

### 3.5 `<provider>/errors.rs`

Responsible for mapping provider errors to unified error categories.

Example:

- invalid token
- expired token
- upload failed
- poll timeout

## 4. Dependency Direction

Allowed:

```text
job_runner -> ocr_provider
ocr_provider/catalog -> ocr_provider/<provider>
ocr_provider/<provider> -> ocr_provider/types
```

Forbidden:

```text
ocr_provider -> routes
ocr_provider -> services/jobs/presentation
ocr_provider -> translation/render logic
```

## 5. Current Runtime Conventions

The `job_runner` side should now only consume provider metadata through these unified entry points:

- `parse_provider_kind`
- `require_supported_provider`
- `provider_definition`
- `provider_capabilities`
- `ensure_provider_diagnostics`

Specifically:

- Do not hand-write `OcrProviderDiagnostics` initialization in multiple modules.
- It has been unified into `ensure_provider_diagnostics`.

## 6. Minimum Steps for Adding a Provider

If a third provider is added in the future, the minimum steps should be:

1. Create `src/ocr_provider/<provider>/`
2. Implement:
   - `client.rs`
   - `status.rs`
   - `errors.rs`
3. Register in `catalog.rs`:
   - `kind`
   - `key`
   - `capabilities`
4. Expose the provider module in `mod.rs`
5. Integrate transport dispatch in `job_runner/ocr_flow`

Things that should NOT be done:

- Do not add provider-specific special handling in `routes`.
- Do not add provider-specific special handling in `services/jobs/facade`.
- Do not add provider initialization logic in `process_runner`.

### 6.1 Boundary with `job_runner/ocr_flow`

`ocr_provider` and `job_runner/ocr_flow` are now divided as follows:

- `ocr_provider`
  Responsible for provider client, status mapping, error classification, and capability declaration.
- `job_runner/ocr_flow`
  Responsible for OCR sub-task runtime orchestration, workspace, provider raw/result persistence, and normalization kết nối.

Further:

- `ocr_flow/mod.rs`
  Is the sole orchestrator of the OCR sub-process.
- Construction of provider client and selection of local/remote transport branches
  Must also be centralized in `ocr_flow/mod.rs`.
- Other sub-modules of `ocr_flow/*` must not grow into a second orchestrator.
- Understanding of provider raw tokens should converge in specialized helpers.
  Example: Paddle Markdown artifact helper.

## 7. Boundary Red-lines

### Red-line 1

The provider layer does not perform complete job orchestration.

### Red-line 2

The provider layer does not determine translation strategy.

### Red-line 3

The provider layer does not return HTTP view models.

### Red-line 4

Provider capability declarations can only have one registration point; do not `match kind` everywhere.

The current registration point is:

- [catalog.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/catalog.rs)
