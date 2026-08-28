# Wiki Plan

Purpose: Ke hoach nay ghi lai ban do kien truc so bo, bang chung nguon va pham vi phan tich truoc khi viet chi tiet Wiki. No danh cho maintainer can biet tai sao cac trang trong `docs/wiki/` duoc chia nhu hien tai.

## Components Phat Hien

| Component | Vai tro | Bang chung nguon |
| --- | --- | --- |
| Rust API | HTTP API, auth, job lifecycle, SQLite persistence, artifact manifest, AI proxy | [`build_app()`](../../backend/rust_api/src/app/router.rs), [`run_servers()`](../../backend/rust_api/src/app/server.rs), [`spawn_job()`](../../backend/rust_api/src/job_runner/lifecycle.rs), [`Database`](../../backend/rust_api/src/db.rs) |
| Rust job runner | Dieu phoi workflow `ocr`, `translate`, `render`, `book`; ghi stage spec cho Python worker | [`dispatch_workflow()`](../../backend/rust_api/src/job_runner/lifecycle.rs), [`PipelinePlan`](../../backend/rust_api/src/job_runner/pipeline_plan.rs), [`write_*_stage_spec()`](../../backend/rust_api/src/worker_command/stage_specs.rs) |
| Python OCR/normalization | Chuyen provider result thanh `document.v1`, validate va ghi report | [`normalize_pipeline.main`](../../backend/scripts/services/document_schema/normalize_pipeline.py), [`adapt_path_to_document_v1_with_report()`](../../backend/scripts/services/document_schema/adapters.py), [`document.v1.schema.json`](../../backend/scripts/services/document_schema/document.v1.schema.json) |
| Translation pipeline | Ap dung policy, glossary/context/memory modes, DeepSeek-compatible LLM calls, diagnostics va manifest | [`translate_only_pipeline.main`](../../backend/scripts/services/translation/entrypoints/translate_only_pipeline.py), [`execute_translation_request()`](../../backend/scripts/services/translation/workflow/execution.py), [`ProviderRegistry`](../../backend/scripts/services/translation/llm/shared/provider_registry.py) |
| Rendering pipeline | Tao PDF dich bang overlay/Typst, cleanup source, prewarm render artifacts | [`render_only.main`](../../backend/scripts/services/rendering/workflow/render_only.py), [`run_render_stage()`](../../backend/scripts/runtime/pipeline/render_stage.py), [`execute_render_plan()`](../../backend/scripts/services/rendering/workflow/executor.py) |
| retainpdf-ai | Resident FastAPI AI service, retrieval tools, conversation persistence through Rust | [`retainpdf_ai.app`](../../backend/ai_service/retainpdf_ai/app.py), [`RetrievalAgent`](../../backend/ai_service/retainpdf_ai/agent.py), [`ToolRegistry`](../../backend/ai_service/retainpdf_ai/tools.py) |
| Production frontend | Built multi-entry React UI for home, detail, reader; calls Rust API with runtime config | [`home entry`](../../frontend/src/pages/home/entry.tsx), [`reader entry`](../../frontend/src/pages/reader/entry.tsx), [`runtime config`](../../frontend/src/js/config/runtime.ts), [`build-js-bundle.mjs`](../../frontend/scripts/build-js-bundle.mjs) |
| Reader | Default `react-pdf` reader plus legacy engine fallback, artifact loading, AI panel, notes | [`ReaderApp`](../../frontend/src/pages/reader/ReaderApp.tsx), [`useReaderSession()`](../../frontend/src/pages/reader/hooks/use-reader-session.ts), [`createReaderDataPort()`](../../frontend/src/js/reader/data-port.ts) |
| Electron desktop | Bundles and launches Rust API, Python scripts, Typst, retainpdf-ai, frontend, IPC bridge | [`desktop/main.js`](../../desktop/main.js), [`preload.js`](../../desktop/preload.js), [`prepare-app.mjs`](../../desktop/scripts/prepare-app.mjs), [`buildBackendEnv()`](../../desktop/src/main/backend-env.js) |
| Docker delivery | App container runs Rust/Python; web container builds frontend and proxies `/api` | [`docker-compose.yml`](../../docker/delivery/docker-compose.yml), [`Dockerfile.app`](../../docker/Dockerfile.app), [`Dockerfile.web`](../../docker/Dockerfile.web), [`nginx.conf.template`](../../docker/nginx.conf.template) |
| Shared contracts | Stage specs, stdout labels, artifact keys, API payload grouping, `document.v1` schema | [`stage_specs.rs`](../../backend/rust_api/src/worker_command/stage_specs.rs), [`contracts.py`](../../backend/scripts/services/pipeline_shared/contracts.py), [`CreateJobInput`](../../backend/rust_api/src/models/input/request.rs), [`constants.rs`](../../backend/rust_api/src/storage_paths/constants.rs) |

## Wiki Tree Du Kien

```text
docs/wiki/
├── README.md
├── WIKI_PLAN.md
├── WIKI_COVERAGE.md
├── 01-overview/
│   ├── project-overview.md
│   ├── repository-structure.md
│   └── technology-stack.md
├── 02-getting-started/
│   ├── prerequisites.md
│   ├── local-development.md
│   ├── configuration.md
│   └── troubleshooting.md
├── 03-architecture/
│   ├── system-architecture.md
│   ├── component-boundaries.md
│   ├── data-flow.md
│   └── runtime-lifecycle.md
├── 04-components/
│   ├── rust-api-and-job-runner.md
│   ├── python-ocr-normalization.md
│   ├── translation-and-llm-orchestration.md
│   ├── pdf-rendering-pipeline.md
│   ├── retainpdf-ai-service.md
│   ├── frontend-library-and-reader.md
│   └── electron-desktop-runtime.md
├── 05-interfaces/
│   ├── api-reference.md
│   ├── data-models.md
│   ├── cross-runtime-contracts.md
│   └── external-integrations.md
├── 06-operations/
│   ├── build-and-test.md
│   ├── deployment.md
│   ├── observability.md
│   └── security.md
└── 07-development/
    ├── extension-guide.md
    ├── common-change-scenarios.md
    └── technical-debt-and-limitations.md
```

## Muc Dich Tung Nhom Trang

| Nhom trang | Muc dich | Evidence chinh |
| --- | --- | --- |
| `01-overview` | Giai thich san pham, repo, stack | [`README.md`](../../README.md), manifests, Dockerfiles |
| `02-getting-started` | Cai dat, chay local, config, loi thuong gap | [`pyproject.toml`](../../pyproject.toml), [`frontend/package.json`](../../frontend/package.json), [`desktop/package.json`](../../desktop/package.json), Docker delivery config |
| `03-architecture` | Kien truc, boundaries, luong end-to-end, lifecycle | Rust router/server/job runner, Python stage entrypoints, frontend entries |
| `04-components` | Mo ta tung major component bang source-grounded detail | File implementation cua tung component |
| `05-interfaces` | API, data model, contracts, integrations | [`router.rs`](../../backend/rust_api/src/app/router.rs), [`schema.rs`](../../backend/rust_api/src/db/schema.rs), stage specs, provider config |
| `06-operations` | Build/test/deploy/observability/security | Dockerfiles, workflow files, auth/config, event/artifact code |
| `07-development` | Cach mo rong theo pattern hien co | Creation services, route modules, stage contracts, frontend composition |

## Component-Page Matrix

| Component | Trang chinh | Trang lien quan |
| --- | --- | --- |
| Rust API/job runner | [04-components/rust-api-and-job-runner.md](04-components/rust-api-and-job-runner.md) | [03-architecture/runtime-lifecycle.md](03-architecture/runtime-lifecycle.md), [05-interfaces/api-reference.md](05-interfaces/api-reference.md) |
| Python OCR/normalization | [04-components/python-ocr-normalization.md](04-components/python-ocr-normalization.md) | [05-interfaces/data-models.md](05-interfaces/data-models.md), [05-interfaces/cross-runtime-contracts.md](05-interfaces/cross-runtime-contracts.md) |
| Translation/LLM | [04-components/translation-and-llm-orchestration.md](04-components/translation-and-llm-orchestration.md) | [05-interfaces/external-integrations.md](05-interfaces/external-integrations.md), [06-operations/security.md](06-operations/security.md) |
| Rendering | [04-components/pdf-rendering-pipeline.md](04-components/pdf-rendering-pipeline.md) | [03-architecture/data-flow.md](03-architecture/data-flow.md), [06-operations/build-and-test.md](06-operations/build-and-test.md) |
| retainpdf-ai | [04-components/retainpdf-ai-service.md](04-components/retainpdf-ai-service.md) | [05-interfaces/api-reference.md](05-interfaces/api-reference.md), [06-operations/security.md](06-operations/security.md) |
| Frontend/reader | [04-components/frontend-library-and-reader.md](04-components/frontend-library-and-reader.md) | [05-interfaces/api-reference.md](05-interfaces/api-reference.md), [07-development/common-change-scenarios.md](07-development/common-change-scenarios.md) |
| Electron | [04-components/electron-desktop-runtime.md](04-components/electron-desktop-runtime.md) | [06-operations/deployment.md](06-operations/deployment.md), [02-getting-started/configuration.md](02-getting-started/configuration.md) |
| Docker/CI | [06-operations/deployment.md](06-operations/deployment.md) | [06-operations/build-and-test.md](06-operations/build-and-test.md) |

## Thu Muc Loai Tru Khoi Phan Tich Sau

| Thu muc | Ly do |
| --- | --- |
| `.git/`, `.github` internals ngoai workflow YAML | Metadata/CI; khong phai runtime implementation, chi workflow duoc dung cho ops docs |
| `.kilo/` | Untracked/local agent metadata; khong phai source product |
| `resources/`, `experiments/` | Asset/experiment phu tro; khong phai duong runtime chinh da xac minh |
| `frontend/vendor`, generated `dist`, `node_modules`, Rust `target` | Build outputs/dependencies; implementation nam trong source va manifests |
| `doc/` va docs cu | Co the huu ich tham khao, nhung Wiki uu tien implementation source khi co mau thuan |

## Phan Biet Bang Chung, Suy Luan Va Gioi Han

Architectural interpretation: Repo la mot monorepo desktop/web/container cho cung mot pipeline: Rust API quan ly state va hop dong, Python xu ly document, frontend/Electron/Docker la cac runtime surface. Dien giai nay duoc suy ra tu router, job runner, entrypoints, Dockerfiles va desktop launcher.

Unverified: Wiki khong render Mermaid bang CLI chuyen dung trong qua trinh lap ke hoach; buoc kiem tra cuoi se kiem tra fenced block, diagram declarations va link/source existence. Wiki cung khong chay full app end-to-end vi yeu cau chi la documentation va khong sua source.

## Source References

- [`backend/rust_api/src/app/router.rs`](../../backend/rust_api/src/app/router.rs)
- [`backend/rust_api/src/job_runner/lifecycle.rs`](../../backend/rust_api/src/job_runner/lifecycle.rs)
- [`backend/scripts/foundation/shared/stage_specs.py`](../../backend/scripts/foundation/shared/stage_specs.py)
- [`frontend/scripts/build-js-bundle.mjs`](../../frontend/scripts/build-js-bundle.mjs)
- [`desktop/scripts/prepare-app.mjs`](../../desktop/scripts/prepare-app.mjs)
