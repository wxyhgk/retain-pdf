# Wiki Coverage

Purpose: Ma tran nay doi chieu cac major component voi trang Wiki va loai thong tin da bao phu. Cot co gia tri "Covered" nghia la trang co noi dung va source reference truc tiep; "Partial" nghia la da mo ta boundary nhung khong chay runtime de xac minh.

| Component | Entry point | Architecture | Runtime flow | Configuration | API/Data | Testing | Deployment | Wiki page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rust API | Covered: [`main.rs`](../../backend/rust_api/src/main.rs), [`router.rs`](../../backend/rust_api/src/app/router.rs) | Covered | Covered | Covered | Covered | Covered | Covered | [04-components/rust-api-and-job-runner.md](04-components/rust-api-and-job-runner.md) |
| Rust job lifecycle | Covered: [`spawn_job()`](../../backend/rust_api/src/job_runner/lifecycle.rs) | Covered | Covered | Covered | Covered | Covered | Partial | [03-architecture/runtime-lifecycle.md](03-architecture/runtime-lifecycle.md) |
| Python OCR/document normalization | Covered: [`run_normalize_ocr.py`](../../backend/scripts/entrypoints/run_normalize_ocr.py), [`normalize_pipeline.py`](../../backend/scripts/services/document_schema/normalize_pipeline.py) | Covered | Covered | Covered | Covered | Covered | Partial | [04-components/python-ocr-normalization.md](04-components/python-ocr-normalization.md) |
| Translation policy/payloads/LLM orchestration | Covered: [`translate_only_pipeline.py`](../../backend/scripts/services/translation/entrypoints/translate_only_pipeline.py) | Covered | Covered | Covered | Covered | Covered | Partial | [04-components/translation-and-llm-orchestration.md](04-components/translation-and-llm-orchestration.md) |
| PDF rendering pipeline | Covered: [`render_only.py`](../../backend/scripts/services/rendering/workflow/render_only.py) | Covered | Covered | Covered | Covered | Covered | Partial | [04-components/pdf-rendering-pipeline.md](04-components/pdf-rendering-pipeline.md) |
| retainpdf-ai service | Covered: [`retainpdf_ai/app.py`](../../backend/ai_service/retainpdf_ai/app.py) | Covered | Covered | Covered | Covered | Partial | Covered | [04-components/retainpdf-ai-service.md](04-components/retainpdf-ai-service.md) |
| Frontend library/home/detail | Covered: [`frontend/src/pages/home/entry.tsx`](../../frontend/src/pages/home/entry.tsx), [`DetailApp.tsx`](../../frontend/src/pages/detail/DetailApp.tsx) | Covered | Covered | Covered | Covered | Partial | Covered | [04-components/frontend-library-and-reader.md](04-components/frontend-library-and-reader.md) |
| Frontend reader | Covered: [`reader/entry.tsx`](../../frontend/src/pages/reader/entry.tsx), [`useReaderSession()`](../../frontend/src/pages/reader/hooks/use-reader-session.ts) | Covered | Covered | Covered | Covered | Partial | Covered | [04-components/frontend-library-and-reader.md](04-components/frontend-library-and-reader.md) |
| Electron runtime/IPC/packaging | Covered: [`desktop/main.js`](../../desktop/main.js), [`preload.js`](../../desktop/preload.js), [`prepare-app.mjs`](../../desktop/scripts/prepare-app.mjs) | Covered | Covered | Covered | Covered | Partial | Covered | [04-components/electron-desktop-runtime.md](04-components/electron-desktop-runtime.md) |
| Docker delivery | Covered: [`docker-compose.yml`](../../docker/delivery/docker-compose.yml), [`Dockerfile.app`](../../docker/Dockerfile.app), [`Dockerfile.web`](../../docker/Dockerfile.web) | Covered | Covered | Covered | Covered | Partial | Covered | [06-operations/deployment.md](06-operations/deployment.md) |
| SQLite/library data | Covered: [`db.rs`](../../backend/rust_api/src/db.rs), [`db/schema.rs`](../../backend/rust_api/src/db/schema.rs) | Covered | Covered | Covered | Covered | Covered | Partial | [05-interfaces/data-models.md](05-interfaces/data-models.md) |
| API endpoints | Covered: [`build_app()`](../../backend/rust_api/src/app/router.rs), [`build_simple_app()`](../../backend/rust_api/src/app/router.rs) | Covered | Covered | Covered | Covered | Covered | Covered | [05-interfaces/api-reference.md](05-interfaces/api-reference.md) |
| Cross-runtime contracts | Covered: [`stage_specs.rs`](../../backend/rust_api/src/worker_command/stage_specs.rs), [`contracts.py`](../../backend/scripts/services/pipeline_shared/contracts.py) | Covered | Covered | Covered | Covered | Covered | Covered | [05-interfaces/cross-runtime-contracts.md](05-interfaces/cross-runtime-contracts.md) |
| `document.v1` schema/intermediate artifacts | Covered: [`document.v1.schema.json`](../../backend/scripts/services/document_schema/document.v1.schema.json), [`version.py`](../../backend/scripts/services/document_schema/version.py) | Covered | Covered | Partial | Covered | Covered | Partial | [05-interfaces/data-models.md](05-interfaces/data-models.md) |
| CI/release workflows | Covered: [`.github/workflows`](../../.github/workflows) | Partial | Partial | Partial | Partial | Covered | Covered | [06-operations/build-and-test.md](06-operations/build-and-test.md) |

## Coverage Notes

Source-grounded areas: API surface, job lifecycle, stage contracts, provider configuration, Docker delivery, Electron packaging, reader loading, `document.v1` schema and SQLite schema are tied to implementation files.

Unverified: Full production deployment, real OCR provider calls, real DeepSeek calls, and desktop package installers were not executed during Wiki generation. The docs describe the code paths and configuration that would be used.

