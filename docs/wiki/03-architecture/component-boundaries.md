# Component Boundaries

Purpose: Trang nay ghi ro component nao so huu data/logic nao va component nao khong nen lam gi. No giup tranh viet code cross-layer lam vo contract.

## Responsibilities

| Component | Owns | Does not own |
| --- | --- | --- |
| Rust API | Routes, auth, SQLite, job state, artifact manifest, stage specs, library/index data | OCR/translation/render algorithms, PDF drawing internals |
| Python OCR/normalization | Provider payload adaptation, `document.v1`, normalization report | API auth, durable job queue, library DB |
| Python translation | Translation policy, batching, LLM calls, diagnostics, manifest | HTTP route surface, frontend state |
| Python rendering | PDF output, cleanup, Typst/PyMuPDF/pikepdf details | Job scheduling, API artifact index |
| retainpdf-ai | Q&A orchestration, retrieval tools, streaming answer | Primary document ownership, direct DB writes |
| Frontend | UX, runtime config consumption, API calls, reader rendering | Filesystem access, source of truth for job state |
| Electron | Desktop process orchestration, local env, IPC bridge, bundled assets | Translation semantics, document schema |
| Docker/nginx | Process packaging, env injection, reverse proxy | Application business logic |

## Key Files And Symbols

| Boundary | Source |
| --- | --- |
| API layer | [`router.rs`](../../../backend/rust_api/src/app/router.rs), [`routes`](../../../backend/rust_api/src/routes) |
| Service layer | [`services`](../../../backend/rust_api/src/services) |
| Job process layer | [`job_runner`](../../../backend/rust_api/src/job_runner), [`worker_command`](../../../backend/rust_api/src/worker_command) |
| Python service layer | [`backend/scripts/services`](../../../backend/scripts/services) |
| Frontend API clients | [`frontend/src/js/api`](../../../frontend/src/js/api) |
| Reader shared ports | [`frontend/src/pages/reader/external.ts`](../../../frontend/src/pages/reader/external.ts), [`frontend/src/js/reader/data-port.ts`](../../../frontend/src/js/reader/data-port.ts) |
| AI service tools | [`retainpdf_ai/tools.py`](../../../backend/ai_service/retainpdf_ai/tools.py) |

## How It Works

Rust accepts grouped API payloads through [`CreateJobInput`](../../../backend/rust_api/src/models/input/request.rs). It validates source/provider/credentials/render options in job creation services, then converts request into a resolved job snapshot. Python receives a spec, not the raw HTTP request; for example translation receives `translate.spec.json` written by [`write_translate_stage_spec()`](../../../backend/rust_api/src/worker_command/stage_specs.rs).

Frontend never constructs artifact paths by guessing the filesystem. It asks the API for job detail and artifact manifest through clients such as [`jobs-artifacts.ts`](../../../frontend/src/js/api/jobs-artifacts.ts), then resolves protected resource URLs through reader/resource helpers.

retainpdf-ai is intentionally stateless for document data: its README says Rust owns the data plane, and implementation uses a Rust HTTP client plus safe artifact reads under data root. Source: [`backend/ai_service/README.md`](../../../backend/ai_service/README.md), [`rust_client.py`](../../../backend/ai_service/retainpdf_ai/rust_client.py), [`tools.py`](../../../backend/ai_service/retainpdf_ai/tools.py).

## Execution Or Data Flow

```mermaid
flowchart LR
    HTTP["HTTP request"] --> RustSvc["Rust route/service"]
    RustSvc --> Spec["Stage spec JSON"]
    Spec --> PyStage["Python stage"]
    PyStage --> Files["Job artifact files"]
    Files --> RustIndex["Rust artifact index"]
    RustIndex --> API["API manifest/download"]
    API --> UI["Frontend reader/library"]
```

## Configuration

Boundaries are also config boundaries. Rust reads process env and generates stage specs. Python reads spec files and credential env refs. Frontend reads only runtime config injected into browser. Electron builds backend env before spawning Rust and AI service.

## Failure Modes

Boundary violations usually look like missing artifacts or mismatched schemas. Rust rejects flat legacy job payloads because [`CreateJobInput`](../../../backend/rust_api/src/models/input/request.rs) uses `deny_unknown_fields`; frontend also guards grouped payloads in [`jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts). Render-only workflow rejects missing `source.artifact_job_id` in [`prepare_render_input()`](../../../backend/rust_api/src/services/jobs/creation/prepare.rs).

## Extension Points

When adding a feature, extend the component that owns the boundary:

- New API: Rust route + service + model.
- New stage data: Rust stage spec + Python spec loader/entrypoint + artifact registry.
- New reader UI: React reader code and API client only.
- New desktop setting: Electron config store/env generation and frontend runtime config if UI needs it.

## Source References

- [`backend/rust_api/src/models/input/request.rs`](../../../backend/rust_api/src/models/input/request.rs)
- [`backend/rust_api/src/worker_command/stage_specs.rs`](../../../backend/rust_api/src/worker_command/stage_specs.rs)
- [`frontend/src/js/api/jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts)
- [`backend/ai_service/retainpdf_ai/tools.py`](../../../backend/ai_service/retainpdf_ai/tools.py)

## Related Pages

- [System architecture](system-architecture.md)
- [Cross-runtime contracts](../05-interfaces/cross-runtime-contracts.md)
- [Common change scenarios](../07-development/common-change-scenarios.md)

