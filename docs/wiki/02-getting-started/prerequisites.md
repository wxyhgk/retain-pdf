# Prerequisites

Purpose: Trang nay liet ke nhung runtime/tool can co de phat trien RetainPDF theo tung surface. Trang danh cho developer cai moi moi truong.

## Responsibilities

Prerequisites bao gom Rust cho API, Python 3.11 cho stage workers, Node cho frontend/desktop, Docker cho delivery, Typst va font/PDF dependencies cho render. Khong phai moi developer can cai tat ca; frontend-only co the dung Node, backend pipeline can Rust/Python/Typst, delivery can Docker.

## Key Files And Symbols

| Need | Evidence |
| --- | --- |
| Rust API crate | [`backend/rust_api/Cargo.toml`](../../../backend/rust_api/Cargo.toml) |
| Python version/deps | [`pyproject.toml`](../../../pyproject.toml), [`docker/requirements-app.txt`](../../../docker/requirements-app.txt) |
| Typst and fonts | [`Dockerfile.app`](../../../docker/Dockerfile.app), [`backend/scripts/foundation/config/fonts.py`](../../../backend/scripts/foundation/config/fonts.py) |
| Frontend Node deps | [`frontend/package.json`](../../../frontend/package.json), [`frontend/package-lock.json`](../../../frontend/package-lock.json) |
| Desktop Node deps | [`desktop/package.json`](../../../desktop/package.json) |
| Docker runtime | [`docker/delivery/docker-compose.yml`](../../../docker/delivery/docker-compose.yml) |

## How It Works

The app container is the most explicit baseline: [`Dockerfile.app`](../../../docker/Dockerfile.app) builds the Rust API with Rust 1.89, runs Python 3.11 slim, installs Typst, Python requirements, fonts and Typst packages, and exposes ports `41000`/`42000`. Local development can mirror that setup or use Docker as a reference.

Python dependencies are declared at repo root in [`pyproject.toml`](../../../pyproject.toml), with `Pillow`, `PyMuPDF`, `pikepdf`, `requests`, `urllib3` and optional pytest. The same file declares `typst` as required external binary and `gs` as optional external binary.

Frontend build scripts live in [`frontend/package.json`](../../../frontend/package.json). The web Docker image uses Node 22 Alpine in [`Dockerfile.web`](../../../docker/Dockerfile.web). Desktop package scripts live in [`desktop/package.json`](../../../desktop/package.json) and call `prepare-app.mjs`.

## Configuration

Before running API routes, provide at least one Rust API key through `auth.local.json` or `RUST_API_KEYS`; this is enforced by [`auth.rs`](../../../backend/rust_api/src/config/auth.rs). Docker delivery examples include [`auth.local.json`](../../../docker/delivery/docker/auth.local.json), [`app.env`](../../../docker/delivery/docker/app.env), and [`web.env`](../../../docker/delivery/docker/web.env).

Provider/API credentials are separate:

- OCR: `RETAIN_MINERU_API_TOKEN`, `RETAIN_PADDLE_API_TOKEN`, or request payload token fields; see [`ocr_providers.json`](../../../backend/config/ocr_providers.json).
- Translation: request `translation.api_key` becomes `RETAIN_TRANSLATION_API_KEY` for workers; see [`stage_specs.rs`](../../../backend/rust_api/src/worker_command/stage_specs.rs).
- retainpdf-ai: `RETAIN_AI_API_KEYS`, `RETAIN_AI_RUST_API_KEY`, and LLM key settings; see [`backend/ai_service/README.md`](../../../backend/ai_service/README.md).

## Failure Modes

Missing API key blocks all `/api/v1/*` routes. Missing Typst or fonts causes render failures or desktop startup failure. Missing Python modules breaks worker entrypoints. Missing frontend `runtime-config.js` can whitescreen web deployment; [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) creates it and writes runtime config.

## Extension Points

If a new dependency is needed, update the owning manifest and packaging path. Rust: `Cargo.toml`; Python: `pyproject.toml` plus Docker requirements if container needs it; frontend: `frontend/package.json`; desktop runtime asset: `desktop/scripts/prepare-app.mjs`; Docker base image/package: Dockerfiles.

## Source References

- [`docker/Dockerfile.app`](../../../docker/Dockerfile.app)
- [`docker/Dockerfile.web`](../../../docker/Dockerfile.web)
- [`pyproject.toml`](../../../pyproject.toml)
- [`frontend/package.json`](../../../frontend/package.json)
- [`desktop/package.json`](../../../desktop/package.json)

## Related Pages

- [Local development](local-development.md)
- [Configuration](configuration.md)
- [Build and test](../06-operations/build-and-test.md)

