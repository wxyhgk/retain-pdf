# Repository Structure

Purpose: Trang nay mo ta cac project va package doc lap trong monorepo, khong chi liet ke thu muc. No giup developer biet nen doc/sua khu vuc nao khi lam mot thay doi.

## Responsibilities

Repo gom nhieu runtime cua cung mot san pham. `backend/rust_api` la control plane va HTTP API. `backend/scripts` la Python processing plane. `backend/ai_service` la AI Q&A service rieng. `frontend` la production web UI. `desktop` goi frontend/backend thanh app Electron. `docker` dong goi web/app containers. `frontend-react` la khu vuc migration Vite rieng, khong phai production entry theo manifests da doc.

## Key Files And Symbols

| Path | Role | Evidence |
| --- | --- | --- |
| `backend/rust_api` | Rust API, job runner, SQLite | [`Cargo.toml`](../../../backend/rust_api/Cargo.toml), [`main.rs`](../../../backend/rust_api/src/main.rs) |
| `backend/scripts` | Python workers, OCR/translation/render services | [`entrypoints`](../../../backend/scripts/entrypoints), [`services`](../../../backend/scripts/services) |
| `backend/ai_service` | FastAPI resident AI service | [`README.md`](../../../backend/ai_service/README.md), [`app.py`](../../../backend/ai_service/retainpdf_ai/app.py) |
| `backend/config` | OCR provider definitions | [`ocr_providers.json`](../../../backend/config/ocr_providers.json) |
| `frontend` | Production React/esbuild UI | [`package.json`](../../../frontend/package.json), [`scripts/build-js-bundle.mjs`](../../../frontend/scripts/build-js-bundle.mjs) |
| `frontend-react` | Vite/React migration or separate UI area | [`package.json`](../../../frontend-react/package.json), [`vite.config.ts`](../../../frontend-react/vite.config.ts) |
| `desktop` | Electron package and launcher | [`package.json`](../../../desktop/package.json), [`main.js`](../../../desktop/main.js) |
| `docker` | App/web images and delivery compose | [`Dockerfile.app`](../../../docker/Dockerfile.app), [`Dockerfile.web`](../../../docker/Dockerfile.web), [`delivery/docker-compose.yml`](../../../docker/delivery/docker-compose.yml) |
| `.github/workflows` | CI/release automation | [`.github/workflows`](../../../.github/workflows) |

## How It Works

The Rust API is compiled as a binary named `rust_api`, then run directly by Docker or Electron. The app container copies Rust binary plus Python scripts and sets `PROJECT_ROOT`, `RUST_API_ROOT`, `RUST_API_DATA_ROOT`, `PYTHON_BIN`, `TYPST_BIN`, font env vars, and ports in [`Dockerfile.app`](../../../docker/Dockerfile.app). Electron prepares an equivalent bundle under `desktop/app` in [`prepare-app.mjs`](../../../desktop/scripts/prepare-app.mjs).

The production frontend is built from three entries in [`build-js-bundle.mjs`](../../../frontend/scripts/build-js-bundle.mjs): home, detail, and reader. `frontend-react` has a Vite dev server and separate package metadata, but the Docker web image copies and builds `frontend`, not `frontend-react`, as shown in [`Dockerfile.web`](../../../docker/Dockerfile.web).

## Execution Or Data Flow

Code flow crosses repository boundaries rather than following directory order:

1. Frontend submits job payload through [`frontend/src/js/api/jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts).
2. Rust validates and persists job through service and DB modules under [`backend/rust_api/src/services/jobs`](../../../backend/rust_api/src/services/jobs) and [`backend/rust_api/src/db`](../../../backend/rust_api/src/db).
3. Rust launches Python entrypoints under [`backend/scripts/entrypoints`](../../../backend/scripts/entrypoints).
4. Python services write artifacts under the job root.
5. Rust exposes artifacts to frontend reader and library via routes in [`router.rs`](../../../backend/rust_api/src/app/router.rs).

## Configuration

Config lives near runtime boundaries:

- Rust env parsing: [`backend/rust_api/src/config`](../../../backend/rust_api/src/config)
- Provider defaults and credential metadata: [`backend/config/ocr_providers.json`](../../../backend/config/ocr_providers.json)
- Frontend runtime config: [`frontend/src/js/config/runtime.ts`](../../../frontend/src/js/config/runtime.ts)
- Docker delivery env examples: [`docker/delivery/docker`](../../../docker/delivery/docker)
- Desktop env assembly: [`desktop/src/main/backend-env.js`](../../../desktop/src/main/backend-env.js)

## Failure Modes

Structural mistakes usually show up as missing binaries/scripts/assets at runtime. Docker and Electron both validate expected resources: Docker installs/copies dependencies in [`Dockerfile.app`](../../../docker/Dockerfile.app), while Electron checks bundled backend binary, Python, scripts, Typst, fonts and AI service in [`desktop/main.js`](../../../desktop/main.js) and [`prepare-app.mjs`](../../../desktop/scripts/prepare-app.mjs).

## Extension Points

Use the repo boundary that owns the behavior: API and job state in `backend/rust_api`; provider/normalization/translation/render logic in `backend/scripts`; UI behavior in `frontend`; desktop packaging/runtime in `desktop`; deployment in `docker`.

## Source References

- [`backend/rust_api/Cargo.toml`](../../../backend/rust_api/Cargo.toml)
- [`pyproject.toml`](../../../pyproject.toml)
- [`frontend/package.json`](../../../frontend/package.json)
- [`desktop/package.json`](../../../desktop/package.json)
- [`docker/Dockerfile.app`](../../../docker/Dockerfile.app)

## Related Pages

- [Technology stack](technology-stack.md)
- [Component boundaries](../03-architecture/component-boundaries.md)
- [Build and test](../06-operations/build-and-test.md)

