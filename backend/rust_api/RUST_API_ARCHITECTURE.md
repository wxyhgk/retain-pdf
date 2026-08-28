# Rust API Architecture

This document answers one question only:

**What are the current team collaboration boundaries in `rust_api`, and where should changes be made.**

No history, no compatibility migration; defaults to current mainline code only.

Related documents:

- Documentation entry point:
  [`README.md`](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- Directory map:
  [`RUST_API_DIRECTORY_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_DIRECTORY_MAP.md)
- Current runtime main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- OCR provider boundary:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- Stage runtime contract:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- Rust-side artifact boundary:
  [`doc/core/rust_api/10-Rust Side Artifact Boundary.md`](/home/wxyhgk/tmp/Code/doc/core/rust_api/10-Rust%20Side%20Artifact%20Boundary.md)
- External API protocol:
  [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)

## 1. Overall Layering

Current `rust_api` is divided into 6 layers:

1. `app`
2. `routes`
3. Application entry points in `services`
4. Internal implementations in `services`
5. `job_runner`
6. `ocr_provider`

Dependency direction must remain unidirectional:

```text
app -> routes -> application services -> internal services -> job_runner / ocr_provider
```

Reverse dependencies are prohibited.

Examples:

- `routes` should not know how Python worker commands are assembled
- `job_runner` should not know HTTP headers and JSON envelopes
- `ocr_provider` should not know route-layer return structures

## 1.1 Where `AppState` Is Allowed

`AppState` is not a general dependency injection container. Currently allowed only at these locations:

- `app/*`
  Responsible for assembling and holding global resources
- `axum` route entry functions
  The layer where `State(AppState)` is destructured
- A small number of boundary assembly points
  Used to compress `AppState` into narrower deps structures
- Test helper code

Prohibited from passing `AppState` down to:

- Business implementation main chain in `services`
- Runtime main chain in `job_runner`
- `ocr_provider`
- Presentation / view assembly layer

If a module needs resources, the correct approach is:

1. Extract needed fields from `AppState` at boundary layer
2. Assemble into explicit deps struct
3. Business modules receive only this narrower deps

Currently established public patterns:

- `routes/common.rs`
  Responsible for route-side common lightweight deps builders, `request_base_url(...)`, and `ok_json(...)`
  - `build_jobs_route_deps` → `JobsFacade`
  - `build_library_route_deps` → `LibraryDeps` + `JobsFacade` (library→job scenarios like initiating translation from library)
  - `build_glossary_route_deps` / `build_upload_route_deps` / `build_health_route_deps`
- `routes/download_response.rs` / `routes/download_response/**`
  Responsible for file download, markdown, preview, cover, thumbnail response boundary
- `routes/jobs/json_response/**`
  Responsible for jobs JSON query / debug / control / retry response boundary
- `app/jobs.rs::build_process_runtime_deps(...)`
  Responsible for runner assembly

Runner-side rules are now fixed as:

- `job_runner` exposes only `ProcessRuntimeDeps::new(...)`
- `AppState -> ProcessRuntimeDeps` assembly responsibility stays in `app/*` boundary layer
- `ProcessRuntimeDeps`
  Reserved for orchestrator-level entry use only
- `JobPersistDeps`
  Handles `db + data_root + output_root` persistence/event resource group; leaf helpers prefer this over grabbing entire runtime deps
- `app/state.rs`
  Handles only `AppState` assembly; startup leftover running task recovery has been moved to `app/state_recovery.rs`
- `job_runner/lifecycle.rs`
  Retains only runner top-level orchestration; "queued persistence/cancel short-circuit" and "dispatch by workflow" should remain small helpers rather than being stuffed back into one large function

Do not import `AppState` directly into `job_runner` anymore.

Prohibit hand-writing local `route_deps(...)` in every route file.

## 1.2 Internal Contracts vs External Contracts

This boundary must be clear:

- `CreateJobInput` / `ResolvedJobSpec` / `JobSnapshot`
  Are **internal runtime contracts**
- `JobDetailView` / `JobEventListView` / `TranslationDiagnosticsView`
  Are **external API contracts**

Internal contracts may hold real credentials:

- `translation.api_key`
- `ocr.mineru_token`
- `ocr.paddle_token`

But these fields may exist only in:

- Runtime memory
- SQLite job record
- Worker env injection
- Stage spec `credential_ref`

Prohibited from entering:

- HTTP JSON responses
- External diagnostics / replay / debug payloads
- Events API payloads

Current safety adaptation layer has two categories:

1. `public_request_payload(...)`
   Projects internal `ResolvedJobSpec` into externally returnable request payload
2. `models/redaction.rs`
   Performs unified redaction on arbitrary strings / JSON payloads

Team collaboration rules:

- When adding a new external view, first decide whether it consumes internal or external contracts
- Any change serializing internal objects directly to HTTP is considered an error by default
- When adding secret fields, must update redaction module synchronously; do not patch locally in routes

## 1.3 Configuration Layer Boundary

`src/config.rs` is a compatibility facade, retaining current `AppConfig` fields for existing callers. Real configuration grouping is in `src/config/*`:

- `paths.rs`
  Handles only root/data/scripts/jobs/uploads/downloads paths and runtime directory creation.
- `auth.rs`
  Handles only `auth.local.json`, API keys, concurrency, and simple port.
- `server.rs`
  Handles only bind host, API port, Python binary.
- `upload.rs`
  Handles only global upload size/page limits.
- `provider.rs`
  Handles only MinerU / Paddle / DeepSeek provider runtime, HTTP timeout, retry, and provider upload thresholds.
- `job_runner.rs`
  Handles only queue polling, worker terminate, AI failure diagnosis, synchronous wait, and other runner runtime parameters.
- `env_vars.rs`
  Holds only env reading helpers.

When adding deployment-tunable parameters, determine which submodule they belong to first; do not continue writing env parsing back into `config.rs`. `config.rs` is responsible only for:

1. `from_env()` parsing server environment sources
2. `from_desktop()` parsing desktop sources
3. Assembling compatible `AppConfig` via internal `AppConfigParts`

Do not make the following configurable:

- API path
- Stage names
- Artifact key / artifact group
- Schema version
- Stdout label
- External JSON field names

These are protocol constants, not deployment parameters. Making them env-based causes frontend, Python workers, tests, and historical job interpretation to lose stable anchors simultaneously.

## 1.4 Architecture Gates

These boundaries are enforced not just by documentation but by hard checks:

- Local command:
  `python3 backend/rust_api/scripts/check_architecture.py`
- CI workflow:
  `.github/workflows/rust-api-architecture.yml`

Current gates cover at minimum:

- `AppState` must not flow back into `services/job_runner/ocr_provider` main chain
- `routes` must not depend directly on `job_runner`
- `routes/jobs/*` must not redefine local `route_deps(...)`
- Artifact / download boundary layer must not begin understanding provider raw internal fields
- Published markdown artifacts must not reverse-infer from `provider_raw_dir/full.md` or `provider_raw_dir/images`

If adjusting whitelist later, must update both script and this document synchronously; cannot change only one.

## 1.4 Artifact Boundary

Rust-side artifact-related boundaries are fixed at four layers:

1. `provider raw`
2. `normalized`
3. `published artifact`
4. `download API`

Dependencies and responsibilities must remain unidirectional:

```text
provider raw -> normalized -> published artifact -> download API
```

Minimum definition per layer:

- `provider raw`
  Provider raw result snapshot; used only for fidelity, retrospective analysis, troubleshooting, normalize input
- `normalized`
  Unified document contract from OCR to translation/rendering
- `published artifact`
  Rust task file artifact key registration, discovery, and export layer
- `download API`
  Outermost HTTP download exposure layer

Key Rust-side landing points:

- [src/storage_paths.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/storage_paths.rs)
  Facade; now split into `constants / job_paths / path_ops / resolvers / registry`
- [src/services/artifacts/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/artifacts/mod.rs)
  Artifact facade; now split into `registry / bundle / response`
- [src/routes/download_response.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/download_response.rs)
  Handles file download, markdown, preview, cover, thumbnail HTTP response exit
- [src/routes/jobs/json_response](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/json_response)
  Handles jobs JSON query / debug / control / retry HTTP response exit

Boundary rules:

- `storage_paths.rs` and `services/artifacts/*`
  Handle only files, artifact keys, stable resources; do not interpret provider raw internal JSON structures
- `db.rs`
  Now retains only `Db` facade; row decode and schema checks have been moved to `src/db/rows.rs` and `src/db/schema.rs` respectively
- `routes/jobs/download.rs`
  Exposes only stable download entry; does not promise provider-private field semantics
- `normalized-document` / `normalization-report`
  Belong to normalized boundary, not provider raw
- `provider_result_json` / `provider_raw_dir`
  Belong to provider raw boundary; can only be downloaded as explicit artifacts, not unified document interfaces
- Published markdown materialize
  Must preserve provider-returned image relative path semantics; may add page-scoped prefix but must not rewrite internal path patterns to custom directory rules

Quick determination:

- If a change requires download layer to understand provider field names like `layoutParsingResults`, `prunedResult`, the boundary has been violated
- If a change only adds artifact keys, adjusts resource paths, or adjusts stable download entries, it should typically land in published artifact or download API layer

## 1.4 Published Markdown Artifact Boundary

This is a recently tightened boundary:

- `provider_result_json`
- `provider_raw_dir`

Belong to provider raw.

- `ocr/normalized/document.v1.json`

Belongs to post-normalize unified contract.

- `md/full.md`
- `md/images/`
- `markdown_bundle_zip`

Belong to published job artifacts.

Rules:

1. `provider_raw_dir` may retain provider raw responses and debug materials.
2. `provider_raw_dir` must not be used as fallback source for published markdown artifacts.
3. External resource resolution functions like `resolve_markdown_path()` / `resolve_markdown_images_dir()` may only resolve published paths like `job_root/md/*`.
4. If a provider wants to expose Markdown in the future, should explicitly add a publish/materialize step rather than letting download layer or storage path layer guess provider raw layout.

Additional constraints:

- Publish/materialize may perform "conflict-prevention wrapping", e.g., adding `page-N/` to image paths for multi-page tasks
- Image paths in markdown must point to published directory `md/images/`
- But must not rewrite provider-returned internal relative path structure
- E.g., when Paddle returns `<img src="imgs/foo.jpg">`, published form can be `images/page-6/imgs/foo.jpg`
- Must not become our custom fixed pattern like `assets/foo.jpg` or other repo-private naming

Reason is simple:

- Provider raw changes frequently
- Published artifact is external stable download interface
- Once mixed, `markdown_ready` becomes inaccurate and download interface couples with provider-private structure

## 2. Module Responsibilities

### 2.1 `app/`

Files:

- [src/app/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/mod.rs)
- [src/app/state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/state.rs)
- [src/app/router.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
- [src/app/server.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/server.rs)

Responsibilities:

- Assemble `AppState`
- Start HTTP server
- Mount routes
- Recover leftover running jobs at startup

Should not do:

- Write business validation
- Assemble job views
- Decide worker workflows

### 2.2 `routes/`

Directory:

- [src/routes](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes)

Responsibilities:

- HTTP request parsing
- Header / Query / Multipart extraction
- Forward requests to service
- Return unified JSON / file response

Should not do:

- Access SQLite details directly
- Read artifact files themselves
- Assemble Python commands themselves

Current routes have been unified to application facades:

- jobs → [src/services/jobs/facade.rs](src/services/jobs/facade.rs)
- library → [src/services/library_api.rs](src/services/library_api.rs)
- glossaries → [src/services/glossary_api.rs](src/services/glossary_api.rs)
- uploads → [src/services/upload_api.rs](src/services/upload_api.rs)

In other words:

- `routes/jobs/*` calls `JobsFacade` only through response boundary
- `routes/library.rs` / `library_data.rs` / `library_extras.rs` / `collections.rs`
  Call only `services/library_api.rs` (via `build_library_route_deps`)
- `routes/common.rs`
  Retains only route-side common deps builder, base URL, and unified HTTP envelope helper
- `routes/download_response/**`
  Retains only file response exit
- `routes/jobs/json_response/**`
  Retains only JSON response exit
- `routes/glossaries.rs`
  Calls only `services/glossary_api.rs`
- `routes/uploads.rs`
  Calls only `services/upload_api.rs`

**Library route file division (HTTP boundary; business does not enter route):**

| Route file | HTTP surface |
|------------|---------|
| `library.rs` | Books list/detail/delete, book cover/thumbnail |
| `library_data.rs` | Documents CRUD/media/translate, favorites, search |
| `library_extras.rs` | Assets, conversations |
| `collections.rs` | Collection CRUD and document membership |

Quick determination:

- To change HTTP input/output, check `routes/*` first
- To change use case orchestration, check application service first
- To change provider / worker / stage behavior, do not start from route

### 2.3 Application Entry Points in `services/`

Directory:

- [src/services](src/services)

Responsibilities:

- Provide stable invocation entry for routes
- Handle use case orchestration and return external views
- Shield `db/config/data_root/storage` resource assembly details

Currently formed application entries:

- [src/services/jobs/facade.rs](src/services/jobs/facade.rs)
- [src/services/library_api.rs](src/services/library_api.rs)
- [src/services/glossary_api.rs](src/services/glossary_api.rs)
- [src/services/upload_api.rs](src/services/upload_api.rs)

Rules:

- Routes should depend only on these entries preferentially
- Do not let routes assemble `db + config + helper + artifact service` directly again
- If application service internals continue growing, prefer splitting facade submodules or deps substructures; do not regress to one monolithic entry file plus one monolithic deps
- Library domain DTOs (`DocumentRecord`, favorites/search/collections etc.) re-exported via
  `models::api`; routes and migrated `db/*` **must not** connect directly to `models::library`

#### `services/library_api` + `services/library/*`

Library domain under modular monolith (**not** microservice decomposition):

```text
routes/library*.rs, collections.rs
  → library_api (view-level API)
      → services/library/*
           books | documents | media | translate
           favorites | search | assets | conversations | collections
      → JobsFacade   (only translate-from-library creates job)
      → derived_artifacts (only media internal use cover/thumbnail)
```

- [src/services/library_api.rs](src/services/library_api.rs)
  Only library service import allowed for routes
- [src/services/library/](src/services/library/)
  Internal implementation; `LibraryDeps` holds `db + data_root + output_root + downloads_dir + scripts_dir + python_bin`
- Translation from library: `library/translate.rs` binds document upload then calls only
  `JobsFacade::create_submission`; does not bypass job creation pipeline
- File streaming responses remain in route: `stream_file` / download response; service returns only path or bytes

### 2.4 Internal Implementations in `services/`

Current key divisions:

- [src/services/job_snapshot_factory.rs](src/services/job_snapshot_factory.rs)
  Handles job snapshot / command assembly
- [src/services/job_launcher.rs](src/services/job_launcher.rs)
  Handles job persistence and execution start
- [src/services/runtime_gateway.rs](src/services/runtime_gateway.rs)
  Handles services-side runtime capability consolidation
- [src/services/jobs](src/services/jobs)
  Handles jobs-related business
- [src/services/library](src/services/library)
  Handles library domain business (see 2.3)
- [src/services/book_projection](src/services/book_projection)
  Handles library books projection (called by `library/books`)
- [src/services/derived_artifacts](src/services/derived_artifacts)
  Handles cover/thumbnail/page preview derived artifacts (called by library media / jobs downloads, **not** directly connected by routes)

Where `services/jobs` is further split into:

- `creation`
- `control`
- `query`
- `debug`
- `facade`
- `presentation`

#### `services/jobs/facade`

Files:

- [src/services/jobs/facade.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade.rs)
- [src/services/jobs/facade/command](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade/command)
- [src/services/jobs/facade/query](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade/query)

Responsibilities:

- Provide unified entry for route layer
- Shield `db/config/data_root` low-level details
- Continue splitting into smaller facade submodules by use case rather than stacking all entries back into one file
- Separate command-side and query-side dependencies to avoid one monolithic deps dragging create/query/debug/download together

Rules:

- When adding new job route capability, add to facade first, then route calls
- For create / cancel type resources, prefer placing in `CommandJobsDeps`
- For query / download / debug type resources, prefer placing in `QueryJobsDeps`

#### `services/jobs/creation`

Directory:

- [src/services/jobs/creation](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)

Responsibilities:

- `submit.rs`
  Handles only "receive input then create and start task"
- `bundle.rs`
  Handles only "run full pipeline synchronously and produce download bundle"
- `job_builders.rs`
  Handles only parsing input into `JobSnapshot`
- `upload.rs`
  Handles only PDF upload persistence and upload record reading
- `context.rs`
  Handles only creation-side explicit deps

Rules:

- Do not stuff "submit task" and "synchronous bundling" back into one file
- Do not reassemble upload storage details in facade or route
- When adding new creation use case, determine first whether it belongs to `submit`, `bundle`, `job_builders`, or `upload`

#### `services/jobs/presentation`

Directory:

- [src/services/jobs/presentation](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/presentation)

Responsibilities:

- `views.rs`
  Handles API view assembly
- `summary_loaders.rs`
  Handles reading summary information from manifest / report / summary files
- `mod.rs`
  Handles presentation external boundary

Rules:

- To change JSON return structure, modify `views.rs` first
- To change disk-supplemented summary fields, modify `summary_loaders.rs` first
- Do not stuff file reading logic back into view assembly functions

### 2.5 `job_runner/`

Directory:

- [src/job_runner](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)

Responsibilities:

- Job runtime scheduling
- Python worker startup
- stdout/stderr parsing
- Cancel, timeout, failure attribution
- OCR child job / translate / render runtime chains

Current decomposition:

- `lifecycle`
  Task queuing, execution slot acquisition, dispatch by workflow
- `cancel_registry`
  Cancel request registry
- `execution_queue`
  Concurrency slot waiting
- `worker_command`
  Stage command / stage spec / worker entry command unified factory; neutral contract layer shared by `services` and `job_runner`
- `worker_process`
  Process startup, environment injection, process tree termination
- `process_runner`
  Real worker execution orchestrator
- `process_runner/completion.rs`
  Completion state classification and backfill for cancel / success / shutdown noise / failed
- `process_runner/timeout_support.rs`
  Timeout messaging and timeout failure state persistence
- `process_runner/failure_ai_diagnosis.rs`
  Failure AI diagnosis request/response and event recording
- `process_runner/io_support.rs`
  stdout/stderr consumption and stream reading strategy during cancel; takes only `JobPersistDeps + canceled_jobs` here
- `runtime_state`
  Runtime snapshot changes
- `translation_flow`
  Translate / book related orchestrator; handles only chaining OCR child -> translate -> optional render
- `translation_flow_child.rs`
  Upload source reading, parent task entering `ocr_submitting`, OCR child construction and `ocr_child_created` event
- `translation_flow_stage.rs`
  Translate stage command preparation, `ocr_child_finished` event, render stage preparation after translate
- `translation_flow_support.rs`
  Pure rule helpers like OCR terminal state determination, translate input extraction
- `render_flow`
  Render-only chain
- `ocr_flow`
  OCR provider runtime chain
- `ocr_flow/support.rs`
  OCR job saving, parent OCR status mirroring, transport/source-pdf failure handling, `sync_parent_with_ocr_child(...)`
- `ocr_flow/workspace.rs`
  Handles only OCR workspace path and directory preparation; now takes only `output_root`
- `ocr_flow/polling.rs`
  Handles only polling wait and cancel check; `should_stop_polling(...)` now takes only cancel handle
- `stdout_parser`
  stdout parsing facade
- `stdout_parser/labels.rs` / `state.rs` / `stage_rules.rs` / `artifact_rules.rs` / `failure.rs`
  stdout line labels, shared parsing state, stage/artifact/failure rules

#### `worker_command`

Directory:

- [src/worker_command](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command)

Responsibilities:

- `stage_specs.rs`
  Writes spec files for `provider/normalize/translate/render`
- `entrypoints.rs`
  Selects Python script entry, assembles entry arguments
- `command_builder.rs`
  Handles only command-line construction details
- [src/worker_command.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
  Retains only external `build_*` facade

Rules:

- To change spec fields, modify `stage_specs.rs`
- To change worker entry script, modify `entrypoints.rs`
- Do not rewrite JSON at facade layer

#### `job_runner/process_runner`

Files:

- [src/job_runner/process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [src/job_runner/process_runner/startup.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [src/job_runner/process_runner/execution.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [src/job_runner/process_runner/completion.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/completion.rs)
- [src/job_runner/process_runner/timeout_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/timeout_support.rs)
- [src/job_runner/process_runner/failure_ai_diagnosis.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/failure_ai_diagnosis.rs)
- [src/job_runner/process_runner/io_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/io_support.rs)

Responsibilities:

- `process_runner.rs`
  Retains only worker execution orchestrator
- `startup.rs`
  Handles worker startup, pid persistence, and post-startup cancel short-circuit; takes only `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`
- `execution.rs`
  Handles stdout/stderr tasks, process wait, and timeout branching; takes only `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`
- `completion.rs`
  Handles completion state classification beyond timeout, shutdown noise success determination, failure backfill
- `timeout_support.rs`
  Handles timeout failure state persistence; takes only `JobPersistDeps + project_root`
- `failure_ai_diagnosis.rs`
  Handles AI-assisted failure diagnosis
- `io_support.rs`
  Handles stdout/stderr consumption and cancel special cases; leaf helpers no longer take entire `ProcessRuntimeDeps`

Rules:

- Do not write new command construction logic here
- Do not maintain cancel registry here
- Do not decide execution slot strategy here
- `execute_process_job(...)`
  May retain entire `ProcessRuntimeDeps`, but must convert to `persist`, cancel handle, or narrow config projection before passing to leaf helpers
- `spawn_worker_process(...)` / `spawn_started_process(...)` / `collect_process_execution(...)` / `read_stdout(...)`
  These leaf helpers should take only config / persist / cancel dependencies they actually need

#### `job_runner` Stop Line

Decoupling should stop here at this final round:

- Orchestrator-level entries continue taking `ProcessRuntimeDeps`
- Leaf helpers switch to `JobPersistDeps`, `&Db`, narrow config projection, or cancel handle
- Do not continue decomposing orchestrator into more cross-file small functions
- Do not introduce trait / wrapper / facade just to avoid passing 1-2 fields

#### `job_runner/translation_flow_*`

Files:

- [src/job_runner/translation_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)
- [src/job_runner/translation_flow_child.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_child.rs)
- [src/job_runner/translation_flow_stage.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_stage.rs)
- [src/job_runner/translation_flow_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_support.rs)

Responsibilities:

- `translation_flow.rs`
  Retains only parent translation job orchestrator.
- `translation_flow_child.rs`
  Handles upload source reading, parent entering `ocr_submitting`, OCR child job creation and `ocr_child_created` event.
- `translation_flow_stage.rs`
  Handles OCR child finished event, translate stage command preparation, render stage preparation after translate.
- `translation_flow_support.rs`
  Handles pure rule helpers like `finalize_parent_after_ocr(...)`, `translation_inputs_from_artifacts(...)`.

Rules:

- Do not stack OCR child construction details in orchestrator
- Do not make persistence entry selections in support helpers
- Translate/render command rewriting unified at stage helper

#### `job_runner/ocr_flow/*`

Files:

- [src/job_runner/ocr_flow/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)
- [src/job_runner/ocr_flow/support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/support.rs)
- Plus `transport / polling / mineru / paddle / artifacts / provider_result / workspace / markdown_bundle / bundle_download / status / page_subset / mineru_retry / mineru_polling / paddle_markdown`

Responsibilities:

- `ocr_flow/mod.rs`
  Retains only OCR orchestrator, chaining transport -> normalize -> process runner.
- `ocr_flow/support.rs`
  Handles OCR job saving, parent OCR status mirroring, transport/source-pdf failure handling, `sync_parent_with_ocr_child(...)`.
- Other sub-files
  Handle provider transport, polling, downloading, raw result placement, markdown materialize, workspace, and status backfill respectively.

#### `job_runner/stdout_parser/*`

Files:

- [src/job_runner/stdout_parser/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/mod.rs)
- [src/job_runner/stdout_parser/labels.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/labels.rs)
- [src/job_runner/stdout_parser/state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/state.rs)
- [src/job_runner/stdout_parser/stage_rules.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/stage_rules.rs)
- [src/job_runner/stdout_parser/artifact_rules.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/artifact_rules.rs)
- [src/job_runner/stdout_parser/failure.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/failure.rs)

Responsibilities:

- `mod.rs`
  Facade; invokes artifact/stage rules per line.
- `labels.rs`
  Stdout contract label constants.
- `state.rs`
  Shared parsing state for artifact/provider diagnostics.
- `stage_rules.rs`
  Stage/progress related rules.
- `artifact_rules.rs`
  Artifact/metric related rules.
- `failure.rs`
  Provider failure attribution and detail extraction.

### 2.5 `ocr_provider/`

Directory:

- [src/ocr_provider](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider)

Responsibilities:

- Provider transport abstraction
- MinerU / Paddle client, status mapping, error classification

Rules:

- Handles only provider communication and provider semantics here
- Does not handle translation, rendering, HTTP return structures

## 3. Current Main Call Chain

Main chain:

1. `POST /api/v1/jobs`
2. `routes/jobs/create.rs`
3. `services/jobs/facade.rs`
4. `services/jobs/creation.rs`
5. `services/job_snapshot_factory.rs`
6. `services/job_launcher.rs`
7. `job_runner/lifecycle.rs`
8. `worker_command.rs`
9. `job_runner/process_runner.rs`
10. Python worker

In other words:

- Route enters only facade
- Facade enters only service
- Service enters only runner

## 4. Team Collaboration Red Lines

These are hard constraints:

### Red Line 1

`routes/*` does not directly read:

- `Db`
- `job_paths`
- Manifest/report JSON files
- Python worker command details

### Red Line 2

`job_runner/*` does not depend on:

- `axum`
- `HeaderMap`
- HTTP response model

### Red Line 3

`ocr_provider/*` does not perform:

- Job view assembly
- Translation strategy
- Rendering strategy

### Red Line 4

If a change requires touching:

- Route
- Service
- Runner

Stop first; ask whether boundaries are misplaced.

### Red Line 5

New file reading summary logic should be placed preferentially in:

- `services/jobs/presentation/summary_loaders.rs`

Do not scatter to:

- Route
- Facade
- `views.rs`

## 5. Change Guide

### Scenario 1: Adding a New Jobs Query Endpoint

Change order:

1. `routes/jobs/*`
2. `services/jobs/facade.rs`
3. `services/jobs/query.rs` or `presentation/*`

Do not cross facade from route to touch lower layers directly.

### Scenario 2: Adding a Worker Stage Spec Field

Change order:

1. `worker_command/stage_specs.rs`
2. Python `stage_specs` loader
3. Corresponding worker consumption logic

Do not add temporary parameters at route/service layer.

### Scenario 3: Adding a New Provider

Change order:

1. `ocr_provider/<provider>/`
2. `job_runner/ocr_flow/*`
3. Python provider pipeline

Do not scatter provider judgment to route or facade.

### Scenario 4: Adjusting Job Detail Return Fields

Change order:

1. `services/jobs/presentation/views.rs`
2. If field comes from disk summary, then modify `summary_loaders.rs`

## 6. Current Recommendations

If continuing refactoring, priority recommendations are:

1. Add clearer request/response DTO boundaries to `services/jobs`
2. Add stage execution contract documentation to `job_runner`
3. Define unified trait / capability contract for `ocr_provider`

But current version is sufficient to support parallel development by multiple people, provided dependency direction and red lines above are followed.

Related supplementary documents:

- [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)

</content>