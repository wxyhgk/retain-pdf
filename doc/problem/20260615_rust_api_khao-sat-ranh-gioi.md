# rust_api Coupling and Boundary Investigation

Date: 2026-06-15

Objective: Identify the coupling points in `backend/rust_api` that are most likely to cause repeated patches, responsibility conflicts, and extensibility issues going forward. This document only records current code evidence and decomposition directions; it does not require a one-shot refactor.

## Current Baseline

Target layering defined by existing architecture docs:

```text
app -> routes -> application services -> internal services -> job_runner / ocr_provider
```

Existing hard gate:

```bash
python3 backend/rust_api/scripts/check_architecture.py
```

Current check result:

```text
rust_api architecture check passed
```

Interim conclusions:

- The current hard gate passes.
- The main production areas (`routes / services / job_runner / ocr_provider / db / storage_paths / job_events`) have converged to the narrow facades `models::api` / `models::domain` / `models::request`.
- After filtering out `models/**` self-implementation and `api_tests/**`, production source code no longer has top-level `use crate::models::{...}` passthrough imports.
- Remaining top-level `crate::models` self-references are mainly inside `models/input/**`, `models/job/**`, and `models/view/**`; these are model module implementation details and no longer represent outer boundary violations.
- Subsequent sections of this document retain historical issues, completed consolidations, and soft coupling points still worth decomposing later.

## 1. Download API Also Handles Derived Artifact Generation

Representative files:

- `backend/rust_api/src/services/jobs/downloads/previews.rs`
- `backend/rust_api/src/services/jobs/downloads/side_by_side.rs`
- `backend/rust_api/src/services/jobs/downloads/pdf.rs`

Current state:

- `downloads/previews.rs` handles both pre-download business logic and embeds Python code to generate covers, thumbnails, and page previews.
- `downloads/side_by_side.rs` handles the download interface while directly calling Python scripts to generate side-by-side PDFs.
- `downloads/pdf.rs` calls `qpdf` for linearization.

Problem:

- The `download API` was originally intended as an HTTP file export layer, but has become "file export + artifact derivation builder + external process orchestration".
- If more derived artifacts are added (e.g., comparison PDFs, bilingual versions, watermarked PDFs, reader preview caches), `downloads/*` will continue to bloat.
- Caching strategies, locks, mtime checks, and temp file renames for these derived artifacts will repeat across modules.

Suggested boundary:

```text
routes/download_response
  -> services/jobs/downloads       only decides what to download
  -> services/derived_artifacts    responsible for generating/caching derived artifacts
      -> Python/qpdf/PyMuPDF calls
```

Priority: High.

Recommended first step:

- Create `services/derived_artifacts`.
- Move "generation and caching" of `side_by_side`, `preview/cover/thumbnail`, and `linearize` into it.
- `downloads/*` should only call `ensure_*_artifact(...) -> PathBuf`.

Current progress:

- Created `backend/rust_api/src/services/derived_artifacts.rs`
- Extracted:
  - `services/derived_artifacts/pdf.rs`
  - `services/derived_artifacts/preview.rs`
  - `services/derived_artifacts/side_by_side.rs`
- `services/derived_artifacts/**` is scoped to "generate/cache derived artifacts and return paths":
  - `pdf.rs` handles qpdf linearization caching.
  - `preview.rs` handles cover, thumbnail, and page preview image generation.
  - `side_by_side.rs` handles source/target side-by-side PDF generation.
  - Does not assemble `FileDownload` or decide HTTP responses here.
- Consolidated `services/jobs/downloads.rs` into a thin facade:
  - `downloads/previews.rs` handles cover, thumbnail, and page preview download decisions.
  - `downloads/artifact_deps.rs` converts job query deps into derived artifact deps.
  - `downloads.rs` no longer directly resolves source/target PDF paths or depends on derived artifact generation modules.
- `services/jobs/downloads/*` retains download decisions and `FileDownload` assembly; no longer directly spawns PyMuPDF/qpdf generators via `std::process::Command`.
- Architecture checks now enforce gates:
  - `services/jobs/downloads/**` must not use `std::process::Command` directly
  - `services/jobs/downloads/**` must not embed `import fitz` / `qpdf`
  - `services/jobs/downloads.rs` facade must not reintroduce storage path resolvers, artifact generators, or job loading business logic.

## 2. `worker_command` Handles Both Legacy CLI and New Stage Spec

Representative files:

- `backend/rust_api/src/worker_command.rs`
- `backend/rust_api/src/worker_command/legacy_ocr.rs`
- `backend/rust_api/src/worker_command/stage_commands.rs`
- `backend/rust_api/src/worker_command/stage_specs.rs`
- `backend/rust_api/src/services/job_snapshot_factory.rs`
- `backend/rust_api/src/job_runner/*`

Current state:

- `worker_command.rs` is now a thin facade that re-exports OCR/provider commands and stage commands.
- `legacy_ocr.rs` handles legacy OCR/provider CLI argument assembly, including `JOB_PATH_ARGS` and `OCR_ARGS`.
- `stage_commands.rs` handles conversion from `WorkerStageCommand` to concrete stage spec + entrypoint command.
- `stage_specs.rs` only handles writing stage spec JSON contracts to disk.
- `job_snapshot_factory.rs` writes only placeholder commands when creating job snapshots; no longer directly calls `build_ocr_command(...)`.
- `translation_flow_child.rs` also writes only placeholder commands when creating OCR child tasks.
- `ocr_flow::execute_ocr_job(...)` generates provider OCR commands uniformly at execution time.
- `job_runner` rewrites `job.command` per stage, but now expresses stage intent only through `build_worker_stage_command(...)` and `WorkerStageCommand`.

Problem:

- "Placeholder command at job creation" and "worker command at stage runtime" responsibilities are mixed.
- The production main chain already uses Rust-orchestrated stage specs, but legacy/provider CLI entry points remain in the same facade.
- Adding local OCR, other translation engines, or more stages will tend to push more parameters into `worker_command.rs`.

Suggested boundary:

```text
worker_command/
  legacy_ocr.rs          legacy OCR/provider CLI argument assembly
  stage_specs.rs         write stage spec JSON
  stage_commands.rs      WorkerStageCommand -> stage spec -> entrypoint command
  entrypoints.rs         Python script/console entrypoint mapping
  command_builder.rs     Vec<String> command construction utilities
job_snapshot_factory
  writes only placeholders; does not know provider CLI arguments
job_runner
  requests commands per StagePlan at runtime
```

Priority: High.

Recommended first step:

- Legacy OCR CLI argument construction from `worker_command.rs` has been moved to `legacy_ocr.rs`.
- `translate/render/normalize` stage command assembly has been moved to `stage_commands.rs`.
- Added `WorkerStageCommand` and `build_worker_stage_command(...)`; `job_runner` no longer directly calls `build_translate_only_command(...)` / `build_render_only_command(...)` / `build_normalize_ocr_command(...)`.
- `job_snapshot_factory` and OCR child creation logic now write only placeholder commands; real OCR/provider commands are generated uniformly at execution time in `execute_ocr_job(...)`.
- `worker_command.rs` and `worker_command/**` have migrated to model facades:
  - Production code reads `ResolvedJobSpec` only from `models::domain`.
  - Test construction of `CreateJobInput` / `GlossaryEntryInput` goes through `models::request`; provider/workflow enums go through `models::domain`.
- Gates added to `backend/rust_api/scripts/check_architecture.py`:
  - `worker_command.rs` facade must not reintroduce `OcrArg` / `JobPathArg` / OCR parameter tables.
  - `worker_command.rs` facade must not directly write `translate/render/normalize` stage specs.
  - Boundary modules `legacy_ocr.rs`, `stage_commands.rs`, `stage_specs.rs` must exist.
  - `worker_command.rs` and `worker_command/**` must import models through `models::domain` / `models::request`.
  - `job_runner/**` must not directly call concrete `build_*_command(...)` stage commands.
  - `job_snapshot_factory.rs` must not depend on `worker_command`.
  - `translation_flow_child.rs` must not assemble `build_ocr_command(...)` when creating OCR child tasks.

## 2.1 `stdout_parser` Is the Worker Stdout Contract Projection Layer

Representative files:

- `backend/rust_api/src/job_runner/stdout_parser/mod.rs`
- `backend/rust_api/src/job_runner/stdout_parser/artifact_rules.rs`
- `backend/rust_api/src/job_runner/stdout_parser/stage_rules.rs`
- `backend/rust_api/src/job_runner/stdout_parser/metric_rules.rs`
- `backend/rust_api/src/job_runner/stdout_parser/failure.rs`
- `backend/rust_api/src/job_runner/stdout_parser/state.rs`

Current state:

- `stdout_parser` only consumes stable tags, structured artifact events, provider status lines, and a few metric lines from worker stdout/stderr.
- Output is written back only to `JobSnapshot`, `JobArtifacts`, and OCR provider diagnostics.
- Does not start processes, handle API views, download artifacts, or assemble stage commands.

Current progress:

- `job_runner/stdout_parser/**` has migrated to model facades:
  - `JobSnapshot`, `JobArtifacts`, `JobStage`, and stage helpers go through `models::domain`.
  - Test construction of `CreateJobInput` goes through `models::request`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `job_runner/stdout_parser/**` must import models through `models::domain` / `models::request`.

## 2.2 `process_runner` Is the Generic Worker Process Execution Layer

Representative files:

- `backend/rust_api/src/job_runner/process_runner.rs`
- `backend/rust_api/src/job_runner/process_runner/execution.rs`
- `backend/rust_api/src/job_runner/process_runner/startup.rs`
- `backend/rust_api/src/job_runner/process_runner/io_support.rs`
- `backend/rust_api/src/job_runner/process_runner/completion.rs`
- `backend/rust_api/src/job_runner/process_runner/completion_pipeline.rs`
- `backend/rust_api/src/job_runner/process_runner/result_support.rs`
- `backend/rust_api/src/job_runner/process_runner/timeout_support.rs`
- `backend/rust_api/src/job_runner/process_runner/failure_ai_diagnosis.rs`

Current state:

- `process_runner` handles worker startup, stdout/stderr reading, cancel/timeout handling, runtime snapshot persistence, success artifact validation, process completion classification, and optional AI failure diagnosis.
- It should not know OCR/translation/render stage orchestration details; concrete stage commands and stage plans are decided by upper flow/worker_command layers.
- `failure_ai_diagnosis` constructs safe request bodies for Python diagnostic scripts, consuming both domain runtime/failure types and `models::api::PublicResolvedJobSpec` safe projections.

Current progress:

- `job_runner/process_runner.rs` and `job_runner/process_runner/**` have migrated to model facades:
  - Runtime, snapshot, artifact, status, workflow, failure, and process result types go through `models::domain`.
  - Safe public request body `public_request_payload` / `PublicResolvedJobSpec` goes through `models::api`.
  - Test construction of `CreateJobInput` goes through `models::request`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `job_runner/process_runner.rs` and `job_runner/process_runner/**` must import models through `models::api` / `models::domain` / `models::request`.

## 2.3 `job_runner` Base Contracts/Helpers Are Shared Flow Boundaries

Representative files:

- `backend/rust_api/src/job_runner/process_contract.rs`
- `backend/rust_api/src/job_runner/stage_contract.rs`
- `backend/rust_api/src/job_runner/runtime_state.rs`
- `backend/rust_api/src/job_runner/worker_process.rs`
- `backend/rust_api/src/job_runner/execution_queue.rs`

Current state:

- `process_contract.rs` only validates required artifacts after successful worker exit.
- `stage_contract.rs` only parses upstream stage artifacts into downstream stage inputs.
- `runtime_state.rs` only encapsulates runtime snapshot stdout/provider/failure/artifact updates.
- `worker_process.rs` only handles worker process startup, environment variable injection, and process tree termination.
- `execution_queue.rs` only handles execution slot waiting and cancellation awareness.

Current progress:

- Above files have migrated to model facades:
  - Runtime, snapshot, artifact, and status types go through `models::domain`.
  - Test construction of `CreateJobInput` goes through `models::request`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - These base contract/helper files must import models through `models::domain` / `models::request`.

## 2.4 `job_runner` Top-Level Entry Handles Queue and Workflow Dispatch

Representative files:

- `backend/rust_api/src/job_runner/mod.rs`
- `backend/rust_api/src/job_runner/lifecycle.rs`

Current state:

- `mod.rs` is the runner facade, exporting cancellation, spawn, process runner, runtime deps, runtime state helpers, and worker process helpers.
- `lifecycle.rs` handles job queuing, execution slot waiting, dispatch to OCR/book/translate/render flows by `WorkflowKind`, unified completion persistence, and failure state writing on errors.
- It does not handle specific OCR provider lifecycles, translation stage details, render artifact construction, or direct worker stage command assembly.

Current progress:

- `job_runner/mod.rs` and `job_runner/lifecycle.rs` have migrated to model facades:
  - Runtime, snapshot, status, workflow, and time helpers go through `models::domain`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `job_runner/mod.rs` and `job_runner/lifecycle.rs` must import models through `models::domain`.

## 2.5 `translation_flow` Is the Translation Stage Orchestration Layer

Representative files:

- `backend/rust_api/src/job_runner/translation_flow.rs`
- `backend/rust_api/src/job_runner/translation_flow_artifacts.rs`
- `backend/rust_api/src/job_runner/translation_flow_child.rs`
- `backend/rust_api/src/job_runner/translation_flow_executor.rs`
- `backend/rust_api/src/job_runner/translation_flow_stage.rs`
- `backend/rust_api/src/job_runner/translation_flow_support.rs`

Current state:

- `translation_flow.rs` decides "OCR first then translate/render" or "reuse existing OCR artifacts and continue translate/render" based on workflow.
- `translation_flow_child.rs` only handles OCR child job creation, parent OCR submitting marking, and upload source reading.
- `translation_flow_stage.rs` only handles translate/render stage command preparation, stage state, and OCR child completion events.
- `translation_flow_artifacts.rs` only handles copying/parsing OCR checkpoint artifacts from existing OCR jobs.
- `translation_flow_executor.rs` only handles the next stage after translation in PipelinePlan.
- `translation_flow_support.rs` only handles parent job success/cancellation/failure finalization after OCR child completion.

Current progress:

- `translation_flow*.rs` files have migrated to model facades:
  - Runtime, snapshot, artifact, status, workflow, and stage helpers go through `models::domain`.
  - Test construction of `CreateJobInput` goes through `models::request`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `translation_flow*.rs` must import models through `models::domain` / `models::request`.

## 2.6 `render_flow` Is the Render Stage Orchestration Layer

Representative files:

- `backend/rust_api/src/job_runner/render_flow.rs`
- `backend/rust_api/src/job_runner/render_flow_artifacts.rs`

Current state:

- `render_flow.rs` prepares render stage commands from published translation artifacts and switches the task to rendering state before handing off to the generic `process_runner`.
- `render_flow_artifacts.rs` reads translation outputs from source artifact jobs, parses render inputs, and copies translation input artifacts to the current render job.
- It does not handle Typst/Python rendering internals or derived artifact downloads.

Current progress:

- `render_flow*.rs` files have migrated to model facades:
  - Runtime, artifact, status, and stage helpers go through `models::domain`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `render_flow*.rs` must import models through `models::domain`.

## 2.7 `ocr_flow` Is the OCR Provider Lifecycle Orchestration Layer

Representative files:

- `backend/rust_api/src/job_runner/ocr_flow/mod.rs`
- `backend/rust_api/src/job_runner/ocr_flow/workspace.rs`
- `backend/rust_api/src/job_runner/ocr_flow/provider_transport.rs`
- `backend/rust_api/src/job_runner/ocr_flow/mineru*.rs`
- `backend/rust_api/src/job_runner/ocr_flow/paddle*.rs`
- `backend/rust_api/src/job_runner/ocr_flow/bundle_*.rs`
- `backend/rust_api/src/job_runner/ocr_flow/status.rs`
- `backend/rust_api/src/job_runner/ocr_flow/support.rs`
- `backend/rust_api/src/job_runner/ocr_flow/transport.rs`

Current state:

- `ocr_flow/mod.rs` is the OCR lifecycle orchestrator: prepares workspace, constructs provider OCR commands, executes provider transport, handles cancellation/missing source PDFs, then switches to normalize worker stage.
- `workspace.rs` only handles job directory, provider result/zip/raw/layout path preparation, and registers paths back to job artifacts.
- `provider_transport.rs` only handles dispatching MinerU/Paddle local/remote transport by provider kind.
- `mineru*.rs` / `paddle*.rs` only handle specific provider submission, polling, error mapping, result persistence, and raw bundle/markdown processing.
- `bundle_*.rs` only handles MinerU bundle ready/download retry and events.
- `status.rs` and `support.rs` handle shared OCR status, parent task mirroring, and failure finalization logic.

Current progress:

- `ocr_flow/mod.rs` and model-dependent `ocr_flow/*` helpers have migrated to model facades:
  - Runtime, status, stage helpers, and time helpers go through `models::domain`.
  - Test construction of `CreateJobInput` goes through `models::request`.
- Gate added to `backend/rust_api/scripts/check_architecture.py`:
  - `ocr_flow/mod.rs` and model-dependent OCR flow helpers must import models through `models::domain` / `models::request`.

## 3. `models` Carries Both Internal Runtime Contracts and External API Views

Representative files:

- `backend/rust_api/src/models.rs`
- `backend/rust_api/src/models/input/**`
- `backend/rust_api/src/models/job/**`
- `backend/rust_api/src/models/view/**`
- `backend/rust_api/src/services/jobs/presentation/**`

Current state:

- `models.rs` uniformly `pub use`s input, job, view, redaction, public_contract, and other object categories.
- Many business modules directly `use crate::models::{...}`, making it unclear whether they consume internal runtime models or external views.
- Documentation already emphasizes:
  - `CreateJobInput / ResolvedJobSpec / JobSnapshot` are internal runtime contracts.
  - `JobDetailView / JobEventListView / TranslationDiagnosticsView` are external API contracts.

Problem:

- The Rust type system does not enforce "internal contract vs external contract".
- New contributors or AI may accidentally expose internal fields in responses.
- `models/view/job_builders.rs`, `models/view/job_types.rs`, and `services/jobs/presentation/*` have overlapping responsibilities: it is not intuitive who owns view assembly.

Suggested boundary:

```text
models/
  domain/      internal runtime models: JobSnapshot, ResolvedJobSpec, JobArtifacts
  api/         external API views: JobDetailView, JobEventListView
  request/     external request -> internal spec input structures
  security/    redaction/public projection
```

Not recommended to move directories significantly in the short term. Two small steps first:

- Reduce full facade usage in `models.rs`; add narrower re-export modules.
- Add architecture check to prevent routes from using internal sensitive models for JSON responses.

Priority: Medium-High.

Current progress:

- Added narrow facades:
  - `backend/rust_api/src/models/api.rs`: external API views, queries, response DTOs.
  - `backend/rust_api/src/models/domain.rs`: internal runtime models, status enums, stage helpers.
  - `backend/rust_api/src/models/request.rs`: external request input structures.
- `backend/rust_api/src/routes/**` has migrated to `models::api` / `models::domain` / `models::request`; no longer uses top-level `use crate::models::{...}`.
- Scanned `backend/rust_api/src/routes/**`; the only remaining direct reference to internal job models was in the download response layer for path resolver closures referencing `JobSnapshot`.
- Added `DocumentDownloadKind`:
  - `OutputPdf`
  - `NormalizedDocument`
  - `NormalizationReport`
- `routes/jobs/download.rs` now only expresses "which document type to download"; no longer imports `storage_paths::resolve_*`.
- `routes/download_response/files.rs` no longer references `JobSnapshot` or accepts `impl Fn(&JobSnapshot, ...)`.
- `backend/rust_api/src/services/jobs/downloads/**` has migrated to `models::api` / `models::domain` as the first service-layer model facade pilot.
- `backend/rust_api/src/services/jobs/presentation/**` has migrated to `models::api` / `models::domain`, covering external view DTOs, event records, redaction helpers, and internal job snapshot boundary separation.
- `backend/rust_api/src/services/jobs/creation/**` production code has migrated to `models::request` / `models::domain`:
  - `CreateJobInput` goes through `models::request` for external submission input.
  - `JobSnapshot` / `ResolvedJobSpec` / `UploadRecord` / `WorkflowKind` go through `models::domain` for internal runtime contracts.
  - `prepare.rs` no longer uses implicit `crate::models::JobSnapshot` type paths to avoid bypassing facade gates.
- `services/job_validation.rs` has migrated to model facades:
  - `CreateJobInput` goes through `models::request`, clarifying it validates external submission input.
  - `OcrProviderKind` / `UploadRecord` / source cleanup constants go through `models::domain`, clarifying provider limits and upload metadata belong to internal runtime contracts.
- `services/job_snapshot_factory.rs` has migrated to `models::domain`:
  - `ResolvedJobSpec` / `JobSnapshot` / `UploadRecord` are used only as internal snapshot construction inputs and outputs.
  - This module continues to write only placeholder commands without depending on worker command argument assembly.
- Outer API wrappers and launchers have migrated to model facades:
  - `services/glossary_api.rs` reads glossary request/view and projection helpers only from `models::api`.
  - `services/library_api.rs` reads library/list query views only from `models::api`.
  - `services/upload_api.rs` HTTP returns go through `models::api::UploadView`; internal save results go through `models::domain::UploadRecord`.
  - `services/provider_probe.rs` reads `now_iso` only from `models::domain`; no longer penetrates top-level `models`.
  - `services/job_launcher.rs` reads `JobSnapshot` only from `models::domain`.
- Internal business services `services/glossaries.rs` and `services/library.rs` have migrated to model facades:
  - In `glossaries.rs`, persistence record/id/time goes through `models::domain`; external glossary/job input goes through `models::request`; list filter queries go through `models::api`.
  - In `library.rs`, API return views/queries go through `models::api`; internal task status and workflow decisions go through `models::domain`.
  - Currently only import boundaries are consolidated; business functions like glossary normalization, CSV parsing, and task glossary merging are not yet split out.
- `services/jobs/facade/command/{creation,control,rerun}.rs` have migrated to model facades:
  - `JobSubmissionView` goes through `models::api`.
  - `CreateJobInput` / `JobSourceInput` go through `models::request`.
  - `JobSnapshot` / `JobStatusKind` / `WorkflowKind` go through `models::domain`.
- `services/jobs/{facade,query,control,support}.rs` have migrated to model facades:
  - Submission views and link construction in `facade/support/control` go through `models::api`.
  - Job queries, status, workflow, and time utilities go through `models::domain`.
  - List query parameters in `query.rs` go through `models::api::ListJobsQuery`; internal returns remain `JobSnapshot`.
- `services/artifacts/**` and `services/derived_artifacts/**` have migrated to `models::domain`:
  - `JobArtifactRecord` / `JobSnapshot` are used as internal artifact/task runtime contracts.
  - Artifact registration, bundling, and derived artifact generation no longer import from top-level `models`.
- `storage_paths.rs` and `storage_paths/**` have migrated to model facades:
  - Production code depends only on `models::domain` for `JobSnapshot` / `JobArtifacts` / `JobArtifactRecord` / `now_iso`.
  - Test fixture `CreateJobInput` goes through `models::request`.
  - Module boundary is limited to data_root relative path normalization, job directory conventions, and artifact registry path resolution; does not handle download responses, permission checks, or API view assembly.
- `db.rs` and `db/**` have migrated to model facades:
  - jobs/uploads/glossaries/artifacts table read/write uses `models::domain` internal runtime/persistence models.
  - events table read/write returns `models::api::JobEventRecord` since it serves as both database event record and `/events` external event contract.
  - Request construction in db tests goes through `models::request::CreateJobInput`.
  - Module boundary is limited to SQLite schema, row mapping, and persistence read/write; does not handle task runtime, artifact generation, HTTP responses, or frontend stage projection.
- `job_failure.rs`, `job_failure_support.rs`, `job_failure_structured.rs` have migrated to model facades:
  - Failure classification input/output `JobSnapshot`, `JobStatusKind`, `JobFailureInfo`, `JobRawDiagnostic` go through `models::domain`.
  - Test request construction goes through `models::request::CreateJobInput`.
  - Module boundary is limited to failure reason classification, structured Python failure parsing, and user-readable diagnostic generation; does not handle API response assembly, task recovery, or job persistence.
- `app/state.rs` and `app/state_recovery.rs` have migrated to model facades:
  - Time, status, and failure info in app startup recovery logic go through `models::domain`.
  - App state test request construction goes through `models::request`; internal snapshot/workflow/status fixtures go through `models::domain`.
  - Module boundary is limited to AppState assembly, SQLite initialization, and stale running job startup recovery; does not handle task runtime orchestration or HTTP projection.
- `ocr_provider/**` has migrated to model facades:
  - Provider type facade `ocr_provider/types.rs` re-exports OCR provider domain types from `models::domain`.
  - `JobArtifacts` in provider catalog goes through `models::domain`; `OcrInput` goes through `models::request`.
  - Module boundary is limited to provider metadata, capabilities, token/model selection, and provider error/status types; does not handle job API views or task persistence.
- `services/jobs/debug/**` and `services/jobs/facade/query/**` have migrated to `models::api` / `models::domain` / `models::request` facades.
- `services/book_projection.rs` and `services/book_projection/**` have migrated to `models::api` / `models::domain` facades:
  - Library/book API view DTOs go through `models::api`.
  - `JobSnapshot` / `WorkflowKind` go through `models::domain`.
  - Test fixture `CreateJobInput` goes through `models::request`; internal snapshot/artifacts fixtures go through `models::domain`.
- Gates added to `backend/rust_api/scripts/check_architecture.py`:
  - `routes/**` must import models through `models::api` / `models::domain` / `models::request`.
  - `routes/**` must not import `JobSnapshot` / `JobRuntimeState` / `JobRecord` / `ResolvedJobSpec` / `JobArtifacts` / `JobFailureInfo`.
  - `routes/**` must not directly select `storage_paths::resolve_*`; must go through service download kind/facade.
  - `services/{glossary_api,library_api,upload_api,provider_probe,job_launcher}.rs` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/{glossaries,library}.rs` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/job_validation.rs` must import models through `models::request` / `models::domain`.
  - `services/job_snapshot_factory.rs` must import internal snapshot models through `models::domain`.
  - `services/jobs/downloads/**` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/jobs/creation/**` must import models through `models::request` / `models::domain`.
  - `services/jobs/facade/command/{creation,control,rerun}.rs` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/jobs/{facade,query,control,support}.rs` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/artifacts/**` and `services/derived_artifacts/**` must import internal artifact/task models through `models::domain`.
  - `storage_paths.rs` and `storage_paths/**` must import models through `models::domain` / `models::request`.
  - `db.rs` and `db/**` must import models through `models::api` / `models::domain` / `models::request`.
  - `job_failure*.rs` must import models through `models::domain` / `models::request`.
  - `app/state*.rs` must import models through `models::domain` / `models::request`.
  - `ocr_provider/**` must import models through `models::domain` / `models::request`.
  - `job_runner/stdout_parser/**` must import models through `models::domain` / `models::request`.
  - `job_runner/process_runner.rs` and `job_runner/process_runner/**` must import models through `models::api` / `models::domain` / `models::request`.
  - `job_runner/{process_contract,stage_contract,runtime_state,worker_process,execution_queue}.rs` must import models through `models::domain` / `models::request`.
  - `job_runner/mod.rs` and `job_runner/lifecycle.rs` must import models through `models::domain`.
  - `job_runner/translation_flow*.rs` must import models through `models::domain` / `models::request`.
  - `job_runner/render_flow*.rs` must import models through `models::domain`.
  - `job_runner/ocr_flow/mod.rs` and model-dependent OCR flow helpers must import models through `models::domain` / `models::request`.
  - `services/jobs/presentation/**` must import models through `models::api` / `models::domain` / `models::request`.
  - `services/jobs/debug/**`, `services/jobs/facade/query/**`, `services/book_projection/**` production code is covered by model facade gates.
  - `.ipynb_checkpoints` Jupyter cache directories are not scanned as Rust production source.

Optional future consolidation:

- Continue reducing opaque `use crate::models::{...}` imports along service subtrees.
- Consolidate `models/view/job_builders.rs` and `services/jobs/presentation/**` responsibility boundaries to avoid view construction scattered across both.

## 4. Event/Progress Snapshot Logic Is Scattered Across live_stage, presentation, models/view

Representative files:

- `backend/rust_api/src/job_events.rs`
- `backend/rust_api/src/job_events/**`
- `backend/rust_api/src/services/jobs/live_stage/**`
- `backend/rust_api/src/services/jobs/presentation/detail_projection.rs`
- `backend/rust_api/src/models/view/job_builders.rs`
- `backend/rust_api/src/models/view/job_types.rs`

Current state:

- `/events` already has a clear public event projection.
- `/jobs/{id}` detail recombines `display_stage/stage/substage/lane/progress/background_stages` in `detail_projection.rs`.
- List endpoints have their own projection.

Problem:

- The frontend's most sensitive "task stage display" depends on multiple locations maintained together.
- Adding background lanes, render prewarm, or sidecar stages will easily cause detail/list/events inconsistencies.

Suggested boundary:

```text
services/jobs/stage_view/
  canonical_event.rs
  live_snapshot.rs
  progress_projection.rs
  job_detail_stage.rs
  job_list_stage.rs
```

Core principle:

- `events`, `detail`, and `list` must consume the same stage snapshot projection function.
- `message/stage_detail` is for human-readable text only; does not participate in decisions.

Priority: High.

Current progress:

- `backend/rust_api/src/job_events.rs` and `backend/rust_api/src/job_events/**` have migrated to model facades:
  - Reads `models::domain::JobSnapshot` / `JobRuntimeState` when writing/deriving events.
  - Final persistence and jsonl use `models::api::JobEventRecord` since it is also the `/events` external event contract.
  - `job_events` only derives events from current/previous snapshots and appends to DB/jsonl; does not handle `/events` reading, merging, or frontend projection.
- Created `backend/rust_api/src/services/jobs/stage_view.rs` as the unified task stage snapshot projection entry.
- `services/jobs/presentation/detail_projection.rs`, `services/jobs/presentation/listing.rs`, `services/book_projection/live.rs` now consume `build_job_stage_view(...)`.
- `services/jobs/live_stage.rs`, `services/jobs/live_stage/**`, `services/jobs/stage_view.rs` have migrated to `models::api` / `models::domain` facades:
  - `JobEventRecord`, `JobEventProgressView`, `JobEventRawView`, `JobProgressView`, `JobStageSnapshotView` go through `models::api`.
  - `JobSnapshot`, stage normalize/rank/helpers go through `models::domain`.
- `models::api` has added event contract DTOs: `JobEventProgressView`, `JobEventRawView`.
- Created `backend/rust_api/src/services/jobs/readiness.rs` with `job_readiness(job, data_root)` to uniformly determine PDF, Markdown, and bundle readiness.
- `presentation` and `book_projection` no longer compose their own `resolve_output_pdf` / `resolve_markdown_path` resolver closures.
- `book_projection` now uses the same `stage_view` / `job_readiness` boundaries as `presentation`; model imports also converge to `models::api/domain`.
- Architecture checks added:
  - detail/list/book projection must obtain stage snapshots via `build_job_stage_view(...)`.
  - presentation/book projection must not pass storage resolver closures to old-style readiness.
  - live_stage/stage_view production code must import models through `models::api` / `models::domain` / `models::request`.

## 5. Translation Debug Handles Reading, Redaction, and Replay Execution Simultaneously

Representative files:

- `backend/rust_api/src/services/jobs/debug/index.rs`
- `backend/rust_api/src/services/jobs/debug/item.rs`
- `backend/rust_api/src/services/jobs/debug/diagnostics.rs`
- `backend/rust_api/src/services/jobs/debug/replay.rs`
- `backend/rust_api/src/services/jobs/facade/query/translation_debug.rs`

Current state:

- `debug/index.rs` reads translation debug index; if index does not exist, falls back to translation manifest and constructs list view on-the-fly.
- `debug/item.rs` and `debug/diagnostics.rs` handle file reading, redaction, and API view assembly.
- `debug/replay.rs` starts Python replay scripts, belonging to external process orchestration.
- `facade/query/translation_debug.rs` loads job scope then directly calls debug submodules.

Problem:

- "Debug artifact reading" and "API view redaction projection" are still in the same layer.
- Replay is a development/diagnostic action but lives in the same debug service subtree as pure query debug views.
- Adding more debug data sources (batch latency, provider response, agent repair traces) will tend to mix file reading, DTO construction, and command execution in one layer.

Suggested boundary:

```text
services/jobs/debug/
  artifacts/       only locates and reads translation debug artifacts
  projection/      artifact json -> API view + redaction
  replay/          replay script/external process execution
facade/query/
  only handles job scope and calls query/projection
facade/command/
  replay can move from query facade to command facade if treated as an action
```

Current progress:

- Model boundary consolidation completed first:
  - API DTOs, queries, redaction helpers go through `models::api`.
  - `JobSnapshot` goes through `models::domain`.
  - `facade/query/**` also uses `models::api` / `models::domain`.
- Created `backend/rust_api/src/services/jobs/debug/artifacts.rs`:
  - Uniformly handles reading translation debug index files.
  - Uniformly handles locating translation manifests.
  - Uniformly handles loading page item payloads by manifest.
- `debug/index.rs` only handles list view and fallback index projection.
- `debug/item.rs` no longer borrows artifact helpers from `debug/index.rs`; depends on `debug/artifacts.rs` instead.
- Architecture gate added to prevent debug/query production code from reusing top-level `crate::models::{...}`.
- Architecture gate added to prevent `index.rs` / `item.rs` from directly parsing translation manifests or debug index file paths.
- Created `backend/rust_api/src/services/jobs/facade/command/translation_debug.rs`:
  - `POST /translation/items/{item_id}/replay` corresponding `replay_translation_item(...)` moved from query facade to command facade.
  - `facade/query/translation_debug.rs` retains only diagnostics/items/item read methods.
- Architecture gate added to prevent query facade from reintroducing `replay_translation_item` / `TranslationReplayView` / `Command::new(...)`.

Optional future consolidation:

- `debug/diagnostics.rs` still directly reads diagnostics artifacts and performs redaction; can be split into artifact reader + projection similarly.
- `debug/replay.rs` underlying implementation remains in `debug` subtree; can be further split into `debug/replay_executor.rs` or `services/jobs/actions/translation_debug_replay.rs` semantically.

## 6. Reader Regions Mix Artifact Reading and Reader View Projection

Representative files:

- `backend/rust_api/src/services/jobs/reader_regions.rs`
- `backend/rust_api/src/services/jobs/reader_regions/artifacts.rs`
- `backend/rust_api/src/services/jobs/reader_regions/metadata.rs`
- `backend/rust_api/src/services/jobs/facade/query/reader_regions.rs`

Current state:

- Reader regions API needs to align translated items from translation manifest with source blocks from normalized document.
- Metadata API needs to read source/output PDF page dimensions.
- These interfaces serve frontend readers and future AI Q&A; they are external API views but depend on multiple artifact files underneath.

Problem:

- Originally `reader_regions.rs` handled:
  - Locating and reading translation manifest.
  - Reading per-page translation item JSON.
  - Reading normalized document.
  - Constructing `ReaderRegionsView`.
- This mixes artifact path rules, JSON schema parsing, and frontend view projection in one file; supporting more reader data sources will become patch accumulation.

Suggested boundary:

```text
reader_regions/
  artifacts.rs       only reads translation manifest / normalized document artifacts
  value_extract.rs   only extracts fields from JSON values
  metadata.rs        PDF metadata -> ReaderMetadataView
reader_regions.rs    artifact records -> ReaderRegionsView
```

Current progress:

- `reader_regions.rs` has migrated to `models::api` / `models::domain` facade.
- `reader_regions/metadata.rs` has migrated to `models::api` / `models::domain` facade.
- `models::api` has added reader API DTOs:
  - `ReaderRegionBoxView`
  - `ReaderRegionItemView`
  - `ReaderDocumentMetadataView`
  - `ReaderPageMetadataView`
- Created `backend/rust_api/src/services/jobs/reader_regions/artifacts.rs`:
  - `load_translation_manifest_pages(...)`
  - `load_source_region_map(...)`
- `reader_regions.rs` no longer directly calls `resolve_translation_manifest` / `resolve_normalized_document` or directly `read_to_string` / `serde_json::from_str` to read artifacts.
- Architecture gates added:
  - `reader_regions` production code must import models through `models::api` / `models::domain` / `models::request`.
  - `reader_regions.rs` must not directly read/parse source artifacts; must go through `reader_regions/artifacts.rs`.

Optional future consolidation:

- `reader_regions/metadata.rs` still directly reads PDF metadata; if cover/thumbnail/reader metadata share page dimensions later, a `pdf_metadata` derived artifact/utility boundary can be extracted.

## 7. Summary Loaders Mix Summary Artifact Reading and View Projection

Representative files:

- `backend/rust_api/src/services/jobs/summary_loaders.rs`
- `backend/rust_api/src/services/jobs/summary_loaders/shared.rs`
- `backend/rust_api/src/services/jobs/summary_loaders/glossary.rs`
- `backend/rust_api/src/services/jobs/summary_loaders/invocation.rs`
- `backend/rust_api/src/services/jobs/summary_loaders/normalization.rs`

Current state:

- `presentation/detail_projection.rs`, `presentation/listing.rs`, `book_projection/metadata.rs` read normalization, glossary, invocation summaries.
- `glossary` and `invocation` summaries prefer translation manifest, falling back to pipeline summary.
- `normalization` summary comes from normalization report.

Problem:

- Originally `glossary.rs` and `invocation.rs` each duplicated parsing:
  - Translation manifest path.
  - Pipeline summary path.
  - JSON file reading.
- These files do both artifact lookup and specific view projection; adding more summary fields will duplicate fallback rules.

Suggested boundary:

```text
summary_loaders/
  shared.rs          summary artifact lookup, JSON reading, manifest/pipeline summary fallback
  glossary.rs        JSON -> GlossaryUsageSummaryView
  invocation.rs      JSON -> InvocationSummaryView
  normalization.rs   normalization report -> NormalizationSummaryView
```

Current progress:

- `summary_loaders/**` has migrated to `models::api` / `models::domain` facade.
- Added `read_translation_manifest_or_pipeline_summary(...)` in `summary_loaders/shared.rs`.
- `glossary.rs` and `invocation.rs` no longer directly call `resolve_translation_manifest` / `resolve_data_path` or directly read JSON files.
- Architecture gates added:
  - `summary_loaders` production code must import models through `models::api` / `models::domain` / `models::request`.
  - `glossary.rs` / `invocation.rs` must not directly parse manifest/pipeline summary paths or read JSON.

Optional future consolidation:

- `normalization.rs` still directly reads normalization reports; if normalization summary expands, can split into `shared::read_normalization_report(...)` or independent artifact reader.

## 8. Stage Retry Connects API View, Internal Artifact Availability, and Request Copying

Representative files:

- `backend/rust_api/src/services/jobs/stage_plan.rs`
- `backend/rust_api/src/services/jobs/facade/command/stage_retry.rs`
- `backend/rust_api/src/services/jobs/facade/command/stage_retry_request.rs`
- `backend/rust_api/src/services/jobs/facade/command/stage_retry_overrides.rs`
- `backend/rust_api/src/services/jobs/facade/command/stage_retry_view.rs`

Current state:

- `stage_plan.rs` determines OCR / translation / render retryability based on job status and artifact availability.
- `stage_retry_request.rs` copies requests by retry stage and decides which artifact to reuse.
- `stage_retry_overrides.rs` handles frontend-provided stage retry overrides.
- `stage_retry_view.rs` assembles `stage-actions` and `retry-stage` API responses.
- `stage_retry.rs` is the command orchestration entry, handling source job loading, mode validation, new job creation, or in-place render retry.

Problem:

- This area touches external API DTOs, internal job/artifact, request input, workflow, and command orchestration simultaneously.
- Without layered type imports, internal `JobSnapshot` / `ResolvedJobSpec` may leak into API view assembly, or API DTOs may be misused as internal runtime models.

Suggested boundary:

```text
stage_plan.rs                 internal artifact availability -> retry/resume plan
facade/command/stage_retry.rs command orchestration
stage_retry_request.rs        source JobSnapshot -> CreateJobInput
stage_retry_overrides.rs      overrides JSON -> request/spec patch
stage_retry_view.rs           internal result -> API DTO
```

Current progress:

- `stage_plan.rs` has migrated to `models::api` / `models::domain` facade:
  - `RetryStageKind` goes through `models::api`.
  - `JobSnapshot` / `JobArtifacts` / `JobStatusKind` / `WorkflowKind` go through `models::domain`.
- `stage_retry*.rs` have migrated to `models::api` / `models::domain` / `models::request` facades:
  - API DTOs: `RetryStageRequest`, `RetryStageSubmissionView`, `StageActionsView`, `StageRetryAction*`.
  - Internal runtime models: `CreateJobInput`, `ResolvedJobSpec`, `JobSnapshot`, `WorkflowKind`.
  - Request input structures: `JobSourceInput`.
- `models::api` has added stage retry DTOs:
  - `RetryStageKind`
  - `StageRetryActionLinkView`
  - `StageRetryActionView`
- Architecture checks now cover `stage_plan.rs` and `facade/command/stage_retry*.rs` under model facade gates.

Optional future consolidation:

- If stage retry grows more complex, in-place render retry orchestration can be split from `stage_retry.rs` into `stage_retry_in_place.rs`, but current file boundaries and test coverage are sufficient for now.

Current progress:

- Created `backend/rust_api/src/services/jobs/stage_view.rs`
- `stage_view` now centrally handles:
  - `display_stage`
  - `stage`
  - `substage`
  - `lane`
  - `stage_detail`
  - `progress`
  - `background_stages`
- Integrated into:
  - `services/jobs/presentation/detail_projection.rs`
  - `services/jobs/presentation/listing.rs`
  - `services/book_projection/live.rs`
- `live_stage` continues to handle event merging and live snapshot selection; no longer handles API view field projection.
- Architecture gate added: presentation/book projection stage and progress display must go through `build_job_stage_view(...)`.

## 5. `services/jobs/query::load_supported_job` Is Bypassed by Multiple Internal Modules

Representative files:

- `backend/rust_api/src/services/jobs/downloads/previews.rs`
- `backend/rust_api/src/services/jobs/downloads/side_by_side.rs`
- `backend/rust_api/src/services/jobs/facade/query/downloads.rs`

Current state:

- `JobsFacade` is already the external service facade.
- But downloads submodules still directly call `load_supported_job(...)`.

Problem:

- Facade responsibilities (permission/workflow filtering, OCR-only semantics, supported-job checks) are easily duplicated by submodules.
- Acceptable now, but as OCR job, book job, library job, and derived artifact entries grow, these direct queries will erode boundaries.

Suggestion:

- Downloads service receives pre-loaded `JobSnapshot`; facade loads uniformly.
- Or establish `JobReadContext { job, data_root, deps }` shared by all download/derived artifact modules.

Priority: Medium.

## 6. `services/book_projection` Overlaps with `services/jobs/presentation`

Representative files:

- `backend/rust_api/src/services/book_projection.rs`
- `backend/rust_api/src/services/book_projection/**`
- `backend/rust_api/src/services/jobs/presentation/**`
- `backend/rust_api/src/services/library.rs`

Current state:

- Job detail/list presentation handles job API.
- book_projection handles library/book views.
- Both read artifacts, progress, summary, cover/thumbnail information.

Problem:

- "Task display view" and "library display view" can differ, but base artifact/progress/readiness projection should be reused.
- Already have shared helpers like `readiness(...)`, but artifact display, links, and cover logic remain scattered.

Suggestion:

```text
services/projections/
  artifact_links.rs
  progress.rs
  book.rs
  job.rs
```

Priority: Medium.

## 7. `job_runner` Provider Transport and Stage Orchestration Remain Tightly Coupled

Representative files:

- `backend/rust_api/src/job_runner/ocr_flow/**`
- `backend/rust_api/src/job_runner/translation_flow*.rs`
- `backend/rust_api/src/job_runner/render_flow*.rs`
- `backend/rust_api/src/ocr_provider/**`

Current state:

- `ocr_flow` directly handles MinerU/Paddle upload/poll/download/markdown bundle details.
- `ocr_provider` provides client and provider types, but provider lifecycle orchestration remains in `job_runner/ocr_flow`.

Problem:

- Adding local OCR APIs, new Paddle versions, or other OCR providers will cause `ocr_flow` to grow.
- Current `ocr_provider` is more like a transport client; does not fully encapsulate provider job lifecycle.

Suggestion:

```text
ocr_provider/
  client transport
  provider_job lifecycle trait
job_runner/ocr_flow
  only consumes unified provider lifecycle result
```

Priority: Medium-High.

## 8. Route Registration Is Too Centralized

Representative files:

- `backend/rust_api/src/app/router.rs`
- `backend/rust_api/src/routes/jobs/mod.rs`

Current state:

- All v1 APIs are concentrated in a single `Router::new()` chain.
- Job sub-routes, OCR job sub-routes, library, provider, glossary are all hand-written in one place.

Problem:

- Every new endpoint modifies the same large file.
- URL grouping semantics are not obvious in code.

Suggestion:

```text
routes/mod.rs
  v1_router(state)
routes/jobs/router.rs
  jobs_router()
routes/ocr_jobs/router.rs
  ocr_jobs_router()
routes/library/router.rs
  library_router()
```

Priority: Medium. This decomposition is relatively mechanical but must not affect auth layer and `DefaultBodyLimit`.

## Recommended Decomposition Order

Round 1: Low-risk boundary consolidation.

1. `derived_artifacts`: Extract preview/cover/thumbnail/side-by-side/linearize generation and caching from downloads.
2. `stage_view`: Unify events/detail/list progress snapshot projection entry.
3. `worker_command`: Split legacy CLI and stage spec command.

Round 2: Model boundary consolidation.

1. Narrow `models.rs` facade.
2. Document/split API view builder and domain model builder directories.
3. Add architecture check: route JSON responses must not expose internal runtime models.

Round 3: Provider lifecycle consolidation.

1. Add provider lifecycle trait to `ocr_provider`.
2. `job_runner/ocr_flow` shifts from provider-specific orchestration to consuming unified lifecycle.
3. Local OCR API integration follows the same lifecycle.

## Checks to Add to Architecture Gates

Short-term non-invasive checks to add:

- `routes/**` must not `use crate::worker_command`.
- `routes/**` must not `use crate::job_runner` (already enforced).
- `services/jobs/downloads/**` must not use `std::process::Command` directly; delegate to `services/derived_artifacts/**`.
- `services/jobs/downloads/**` must not embed multi-line Python scripts. Already covers `import fitz` / `qpdf`.
- `routes/jobs/**` must not duplicate `route_deps` (already enforced).
- `services/jobs/presentation/**` and `services/book_projection/**` use the same artifact/readiness projection helper.
- `models/view/**` must not reference `AppState`, `Db`, `storage_paths`.

## Most Valuable Immediate Action

Do `derived_artifacts` first.

Reasons:

- Recently added `side-by-side PDF` already exposed that download layer continues absorbing derived artifact generation logic.
- Clear decomposition boundary with controllable risk.
- Once complete, frontend additions of "preview/export/comparison/watermark" buttons will not continue polluting the download API layer.

</content>