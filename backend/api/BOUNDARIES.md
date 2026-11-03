# Rust API Boundaries

This backend keeps route wiring, job orchestration, query scope checks, and view
projection separate. Keep new code on the narrowest layer that owns the
decision.

Paths written as `src/services/<domain>/…` (or `services/<domain>/…`) in this
file are logical paths: every service domain is its own package, so the code
lives in `backend/packages/retainpdf-<domain>/src/…` (for example
`src/services/jobs/lifecycle/creation/submit.rs` is
`backend/packages/retainpdf-jobs/src/lifecycle/creation/submit.rs`).
`backend/api/src/services/` only holds `mod.rs`.

## Route Layer

Files under `src/routes/**` should only:

- extract Axum state, headers, path params, query params, and JSON bodies;
- compute HTTP-only context such as `base_url`;
- call domain facades (`crate::services::<domain>`, see "Domain Facades"
  below: `JobsFacade`, the library / glossary / upload view functions) through
  deps builders in `routes/common.rs`;
- wrap results in `ApiResponse` or stream files via `stream_file` /
  `download_response`.

Routes should not read job files, inspect artifacts, merge event streams,
touch `state.db` / `state.config` directly, import internal services (e.g.
`derived_artifacts`), or construct view payloads from DB rows.

Job handlers under `src/routes/jobs/<category>.rs` call `JobsFacade` /
`JobQueries`, compute HTTP-only values such as `base_url`, and wrap typed views
in `ApiResponse`; they stay focused on extraction and delegation (see "Job
Routes" below for the eight categories).

`src/routes/download_response/**` is the file response boundary for job-backed
downloads, markdown documents, previews, covers, and thumbnails. Jobs and
library routes may both use it, but routes should not reach into another route
module to reuse a private download helper.

Create routes are the intentional input-side exception: they parse JSON or
multipart request bodies before delegating to `JobsFacade`, then still return a
typed `ApiResponse`. Font upload is the same pattern: multipart stays in the
route; persistence goes through the platform facade.

AI 路由（`ai_proxy`、公开文档操作、Agent 能力令牌和运行时会话）2026-11-03 跟 RetainPDF 自己的
AI 服务一起删了，产品里只留 Studio 的 AI。

## Job Routes

`/api/v1/jobs/**` is split into eight categories with the same name in the
router (`src/app/router/jobs/<category>.rs`), the handlers
(`src/routes/jobs/<category>.rs`) and the business logic
(`src/services/jobs/<category>/`): `lifecycle`, `actions`, `progress`, `files`,
`reports`, `reader`, `translations`, `data` (prefixes
`/jobs/:job_id/actions/…` and so on). A new job endpoint goes into the category that answers its question;
do not add top-level `/jobs/:job_id/<name>` paths.

Every router file is an endpoint table (`crate::endpoints!`, see
`src/app/endpoints.rs`): method, path, handler, access, a one-line summary.
Each legacy path is registered right below its new path with
`old "<new path>"` and points at the same handler, so both return exactly the
same thing. `docs/routes.txt` and `docs/api/00-接口目录.md` are generated from
the tables; paths are written out in full because the path-parameter
classification test reads the router sources. Legacy paths are removed only
after route usage shows no callers.

## Library Facade

Files under `src/services/library/**` implement library-domain use cases.
Routes import library work (books, documents, media, translate-from-library,
favorites, search, assets, collections) only from the
`services::library` facade; the route-facing view functions live in
`library/api.rs`.

- Routes use `build_library_route_deps` (`LibraryDeps` + `JobsFacade`).
- Translate-from-library binds a document's stored upload, then creates jobs
  only via `JobsFacade::create_document_submission`.
- Cover/thumbnail generation uses `derived_artifacts` inside `library/media`,
  not from routes.
- Library request/response types live in the library package (`retainpdf-library`
  `src/views.rs`); stored records (`DocumentRecord` and friends) stay in
  `retainpdf-core` because `db/*` reads and writes them. Routes keep importing
  everything through rust_api's `models::api` facade (`backend/api/src/models.rs`).

## API Contract Tests

HTTP-level tests under `src/api_tests/**` guard public route contracts:

- `http_contract.rs` owns the JSON envelope contract for success and common
  error responses.
- `jobs_events/**` owns event stream shape, source merging, and `seq` ordering.
- `jobs_reader/**`, `jobs_retry/**`, and translation debug tests own their
  public endpoint contracts.

Service unit tests should cover internal rules. Avoid mixing service fixtures,
HTTP envelope assertions, and frontend-facing event shape checks into one large
test file.

## Jobs Facade

`src/services/jobs/` is split into the same eight category directories as
`routes/jobs/` (`lifecycle`, `actions`, `progress`, `files`, `reports`,
`reader`, `translations`, `data`). The root keeps only what every category
shares: `facade.rs` (the `JobsFacade` struct), `deps/`, `presentation/`,
`query.rs` (the `JobQueries` struct and job loading), `runtime_gateway.rs`,
`summary_loaders/` and `support.rs`.

Each use case is an `impl JobsFacade` / `impl JobQueries` block in its category
directory (read methods in `<category>/queries.rs`). They decide which service
operation to run and return typed views or download handles, and may call:

- `crate::job_loading` for loading and scope checks;
- `services/jobs/presentation/**` for public job/list/event view projection;
- the modules of their own category, and of another category where the work
  belongs there (e.g. `reports/failure.rs` uses `actions/resume_plan.rs`).

Callers outside `services/jobs/**` should not call presentation internals.

## Job Creation

Every new job goes through one entry point,
`submit_job(deps, NewJob)` (`src/services/jobs/lifecycle/creation/submit.rs`): `POST /jobs`,
library translate/OCR, stage retry, rerun and
OCR-ambiguity recovery. The steps are written once, in this order: dev-stack
translation defaults, platform models (multi-user, before validation and before
any key reaches the credential vault), validation and snapshot by workflow,
credential import and usage lock, then persist (with the page-quota
reservation), link to the document, and launch.

`NewJob` carries what differs between callers: the job a retry derives ownership from (`derived_from`), the
document a library submission must land on (`for_document`), or the OCR
dispatch an ambiguity recovery resolves (`resolving_ocr_ambiguity`, persisted in
one transaction with that resolution and never charged).

Re-running an existing job in place (rerender, in-place render retry, refine)
uses `relaunch_in_place`, which refuses jobs that were never persisted.
`check_architecture.py` (`check_job_entry_ownership`) rejects any other module
that persists or launches a job. Internal `{id}-ocr` child jobs are created by
the job runtime, not here.

The outcome of every entry is pinned in `docs/submissions.txt`
(`src/api_tests/submissions.rs`).

## Job File Downloads

Every job file download goes through one entry point,
`JobDownloads::open(job_id, JobFile, Disposition)`
(`src/services/jobs/files/downloads/files.rs`):

- `JobFile` names the file (translated PDF, side-by-side PDF, Word, OCR
  Markdown, cover, page preview, bundle, or any other registry key). Where to
  find it, its content type and its user-facing download name are written once,
  in `locate`.
- `Disposition` says whether the browser opens the file (`Inline`) or downloads
  it (`Attachment`).

Routes only pick those three values; they do not resolve paths. Adding a file
means adding a `JobFile` variant and a `locate` branch, not another download
function.（以前 AI 写在 `<job>/ai/` 下的画板文件单独走一条出口，2026-11-03 跟画板接口一起删了。）

The response contract for all download endpoints is pinned in
`docs/file-responses.txt` (`src/api_tests/file_responses.rs`).

## Query Scope

`job_loading` in the `retainpdf-api-base` crate
(`backend/packages/retainpdf-api-base`, re-exported as `crate::job_loading`)
owns job loading and compatibility checks:

- missing job -> `404`;
- OCR-only scope checks;
- legacy layout rejection;
- merged-reading virtual job ids (`merged-<document>-<fingerprint>`), read-only.

It sits below `services` (jobs, files, library and merge all call it). Being a
separate crate, it cannot see `services`, `routes` or `AppState`. `AppError`
(`crate::error`) lives in the same crate. List filtering before presentation
stays in `src/services/jobs/query.rs`.

Do not put these checks in presentation code. Presentation should receive a job
that has already passed the route/facade scope.

## Domain Facades

There are exactly eight service domains, each its own package (see
`docs/ops/planning/api-reorg/20261015-模块化单体拆包规划.md`):
`accounts`, `providers`, `ingest`, `files`, `jobs`, `library`, `glossaries`,
`platform`. A new module goes inside one of them;
`check_service_domains` rejects anything else under `src/services/`, and
`check_domain_facades` rejects code added back under `src/services/<domain>`.

Each domain package's `lib.rs` is its only facade. Submodules are private
(`mod x;`), so the compiler rejects `crate::services::<domain>::<submodule>::…`
from outside the domain; what other domains, routes and app assembly need is
re-exported with `pub use` in the facade. Items only tests use sit under
`#[cfg(any(test, feature = "test-fixtures"))]`. `check_domain_facades` rejects a
`pub mod` in a facade. Inside a domain, code may use any path.

All eight domains are listed in `EXTRACTED_DOMAINS`: `accounts` →
`backend/packages/retainpdf-accounts`,
`files` → `backend/packages/retainpdf-files`, `glossaries` →
`backend/packages/retainpdf-glossaries`, `ingest` →
`backend/packages/retainpdf-ingest`, `jobs` → `backend/packages/retainpdf-jobs`,
`library` → `backend/packages/retainpdf-library`, `platform` →
`backend/packages/retainpdf-platform`, `providers` →
`backend/packages/retainpdf-providers`.
`services/mod.rs` re-exports each as
`services::<domain>` (`pub(crate) use retainpdf_glossaries as glossaries;`),
and nothing for it stays under `services/`. Exports only rust_api tests use sit
under `#[cfg(any(test, feature = "test-fixtures"))]`; rust_api turns the feature on in
`[dev-dependencies]` (`#[cfg(test)]` is not visible across crates), so production
builds never see them. It depends only on the base
crates (`retainpdf-api-base`, `retainpdf-core`, `retainpdf-data`; `retainpdf-jobs` also uses
`retainpdf-proc` and the job runtime `retainpdf-runner` behind `runtime_gateway`) and on
the crates of extracted domains below it (`retainpdf-accounts` uses
`retainpdf-providers`, `retainpdf-ingest` uses `retainpdf-accounts`, `retainpdf-jobs` uses
accounts, files, glossaries and providers, `retainpdf-library` uses files and jobs). Such a use is written with the crate name
(`retainpdf_providers::…`); `check_domain_dependency_direction` counts it as a
domain edge just like `crate::services::providers::…`.

Domains depend downward only. The allowed edges are listed in
`ALLOWED_DOMAIN_DEPENDENCIES` (`check_domain_dependency_direction` rejects a
new edge and an edge nothing uses any more):

```
library ─▶ jobs ─▶ accounts ─▶ providers
   │        ├────────────────▶ providers
   │        ├─▶ glossaries
   └────────┴─▶ files

ingest ─▶ accounts
```

`accounts → providers` exists because platform settings (in `accounts`) test
provider connectivity. `check_service_dependency_cycles` also stays on, now at
domain level. `library::merge` (merged reading) depends on `files` and `jobs`,
never the other way: building the merged directory lives in
`services/library/merge/build.rs`, and reading a virtual job lives in
`job_loading`. `FileDownload` is defined in `files::download_generation`
(re-exported by `services::jobs`).

## Job Request Questions

Code that needs something from a job's submitted request asks the job:
`job.source_job_id()`, `job.uses_model_executor()`, `job.credential_refs()`
and the other methods in retainpdf-core `models/job/questions.rs`. Do not reach
into `job.request_payload.<field>`; add a method there instead. Only the
modules that build or rewrite the request (credential handling at creation,
rerun, retry-stage, the merged-reading virtual job) touch fields directly; they
are listed in `KNOWN_REQUEST_PAYLOAD_WRITERS` and the list only shrinks
(`check_request_payload_access`). Passing the whole request on (redaction,
public projection, snapshots) is fine.

## Presentation

`src/services/jobs/presentation/**` owns view construction for job detail, job
list, events, artifact links, and contracts.

Presentation should not become a general shared utility bucket. Shared data
loading that is needed outside presentation belongs in a sibling module under
`services/jobs/**`.

## Shared Job Projection Helpers

These modules are shared inside the jobs service and, where needed, by sibling
service projections (the library shelf projection `library::book_projection` used
them until it was removed with `/api/v1/library/books` on 2026-10-22):

- `src/services/jobs/progress/live_stage.rs`: combined event loading, canonical event
  projection, and live progress snapshots.
- `src/services/jobs/summary_loaders.rs`: normalized/translation summary file
  readers, plus `SummaryCache::book_page_count` (the one page-count rule for
  job lists and job detail).

They are intentionally outside `presentation` so library/book projections do not
depend on job view internals.

Shared artifact display belongs to `src/artifacts/presentation.rs` in the
`retainpdf-files` crate, exposed only through `services::files::build_artifacts_display`. It consumes
`ArtifactLinksView` without loading jobs, files, or database records. Job views
depend on it; it must not call back into jobs or library.

The book title / upload id / source file name rules live once in
`src/artifacts/titles.rs` of the `retainpdf-files` crate (`display_title`, `job_upload_id`,
`source_file_name`); job and book projections call them instead of keeping
their own copies.

## Runner leaf dependencies

`ocr_flow/bundle_events`, `render_flow_artifacts`, and
`translation_flow_artifacts` consume only `JobPersistDeps` (database and data/output
roots). Orchestrators pass `&deps.persist`, not the full `ProcessRuntimeDeps`.
Architecture checks protect these modules and any nested modules from acquiring
global configuration or execution control capabilities again.

## Persistence

`../../database/retainpdf-db/src/db/**` should stay focused on SQLite rows and records.
It should not know about HTTP view contracts, route URLs, or frontend display
decisions.

## Models

`../packages/retainpdf-core/src/models/**` contains serializable input, stored records
(jobs, uploads, documents, glossaries, events) and the few shared helpers every domain
needs. Public request/response types live in the domain that owns them (2026-10-18):
jobs in `retainpdf-jobs` `src/views/`, artifact and action links plus file addresses in
`retainpdf-files` (`src/artifacts/links_view.rs`, `src/links.rs`), library in
`retainpdf-library` `src/views.rs`, glossaries, uploads and backups in their packages.
rust_api's `models::api` (`backend/api/src/models.rs`) re-exports all of them, so
routes and tests write `crate::models::api::…` without knowing the package.
View builders can build plain data structures, but service decisions such as file
readiness, route scope, and event-source merging should remain in services.
