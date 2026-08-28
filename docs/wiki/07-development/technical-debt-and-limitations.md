# Technical Debt And Limitations

Purpose: Trang nay ghi ro cac gioi han, phan chua xac minh va khu vuc can chu y khi bao tri. No khong phai danh sach loi; no la ban do rui ro dua tren source da doc.

## Responsibilities

Trang nay phan biet source-grounded limitation, architectural interpretation, va unverified runtime behavior. Maintainer nen cap nhat trang nay khi code thay doi hoac khi co ket qua end-to-end tests moi.

## Source-Grounded Limitations

| Area | Limitation/risk | Source |
| --- | --- | --- |
| Legacy APIs | `/api/v1/ocr/jobs` and `/api/v1/library/books` coexist with canonical `/api/v1/jobs` and documents APIs | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| Legacy artifact storage | Non-empty legacy `jobs.artifacts_json` column is rejected | [`ensure_no_legacy_artifacts_json()`](../../../backend/rust_api/src/db/schema.rs) |
| Frontend migration | Production build uses `frontend`; `frontend-react` is separate Vite app/migration area | [`Dockerfile.web`](../../../docker/Dockerfile.web), [`frontend-react/package.json`](../../../frontend-react/package.json) |
| Browser runtime secrets | Docker web can embed `FRONT_MODEL_API_KEY` and OCR defaults in browser JS | [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh), [`web.env`](../../../docker/delivery/docker/web.env) |
| LLM provider | Translation registry currently wires DeepSeek-compatible provider as active runtime | [`provider_registry.py`](../../../backend/scripts/services/translation/llm/shared/provider_registry.py) |
| Desktop fixed local key | Desktop sets `retain-pdf-desktop` as shared Rust/frontend/AI key | [`desktop/main.js`](../../../desktop/main.js), [`backend-env.js`](../../../desktop/src/main/backend-env.js) |
| Permissive CORS | Rust router applies permissive CORS layer | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |

## Architectural Interpretation

The codebase is built for local/private deployment, desktop and controlled Docker installs. Exposing it directly to the public internet would require external auth, secret handling review, CORS/proxy hardening and operational limits beyond current API-key pattern.

The pipeline has strong file-contract coupling. This is practical for multi-language workers, but renaming artifact keys, stdout labels, or stage spec fields can silently break downstream indexing unless producer and consumer tests are added together.

## Unverified

- Real MinerU/Paddle provider calls were not executed during Wiki generation.
- Real DeepSeek/LLM calls were not executed.
- Desktop installers and Docker images were not built in this documentation pass.
- Mermaid diagrams were validated structurally by local checks, not rendered through a browser/CLI.
- Some old docs under `doc/` may describe legacy behavior that differs from current implementation; this Wiki prioritizes source code read during this pass.

## Failure Modes

Debt-related failures include stale docs after contract changes, partial frontend migration causing duplicate patterns, secrets put into browser runtime config, artifact resolver drift, and release scripts missing new runtime assets.

## Extension Points

Reduce risk by adding contract tests around stage specs/stdout labels/artifact manifest, documenting each new env var in configuration docs, keeping `frontend-react` migration status explicit, and making provider/LLM integration tests mockable but representative.

## Source References

- [`backend/rust_api/src/db/schema.rs`](../../../backend/rust_api/src/db/schema.rs)
- [`frontend/src/pages/reader/README.md`](../../../frontend/src/pages/reader/README.md)
- [`docker/entrypoint-web.sh`](../../../docker/entrypoint-web.sh)
- [`backend/scripts/services/translation/llm/shared/provider_registry.py`](../../../backend/scripts/services/translation/llm/shared/provider_registry.py)

## Related Pages

- [WIKI_PLAN](../WIKI_PLAN.md)
- [WIKI_COVERAGE](../WIKI_COVERAGE.md)
- [Security](../06-operations/security.md)

