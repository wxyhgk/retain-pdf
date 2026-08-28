# Configuration

Purpose: Trang nay gom cac bien moi truong, config file va defaults quan trong theo tung runtime. No danh cho DevOps, backend developer va desktop maintainer.

## Responsibilities

Configuration chia thanh: Rust API runtime, provider/translation credentials, frontend runtime config, retainpdf-ai config, desktop env assembly, Docker delivery env. Secrets khong nen hard-code trong Wiki; source chi ra noi code doc va noi example dat placeholder.

## Key Files And Symbols

| Config area | Source |
| --- | --- |
| Rust env parsing | [`config.rs`](../../../backend/rust_api/src/config.rs), [`config/*.rs`](../../../backend/rust_api/src/config) |
| Auth | [`auth.rs`](../../../backend/rust_api/src/config/auth.rs), [`auth.local.example.json`](../../../backend/rust_api/auth.local.example.json) |
| OCR providers | [`ocr_providers.json`](../../../backend/config/ocr_providers.json), [`provider.rs`](../../../backend/rust_api/src/config/provider.rs) |
| Frontend runtime | [`runtime.ts`](../../../frontend/src/js/config/runtime.ts), [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) |
| Desktop runtime env | [`backend-env.js`](../../../desktop/src/main/backend-env.js) |
| AI service | [`backend/ai_service/retainpdf_ai/config.py`](../../../backend/ai_service/retainpdf_ai/config.py), [`backend/ai_service/README.md`](../../../backend/ai_service/README.md) |

## Rust API Configuration

| Key | Default/behavior | Source |
| --- | --- | --- |
| `RUST_API_BIND_HOST` | `127.0.0.1`, Docker sets `0.0.0.0` | [`server.rs`](../../../backend/rust_api/src/config/server.rs), [`app.env`](../../../docker/delivery/docker/app.env) |
| `RUST_API_PORT` | `41000` | [`server.rs`](../../../backend/rust_api/src/config/server.rs) |
| `RUST_API_SIMPLE_PORT` | `42000` | [`auth.rs`](../../../backend/rust_api/src/config/auth.rs) |
| `RUST_API_KEYS` / `auth.local.json` | Required for `/api/v1/*` | [`auth.rs`](../../../backend/rust_api/src/config/auth.rs) |
| `RUST_API_MAX_RUNNING_JOBS` | `4` | [`auth.rs`](../../../backend/rust_api/src/config/auth.rs) |
| `RUST_API_DATA_ROOT` / `RUST_API_DATA_DIR` | Data root fallback from project/current dir | [`paths.rs`](../../../backend/rust_api/src/config/paths.rs) |
| `RUST_API_PROJECT_ROOT`, `RUST_API_ROOT`, `RUST_API_SCRIPTS_DIR` | Runtime path overrides | [`paths.rs`](../../../backend/rust_api/src/config/paths.rs) |
| `RUST_API_PYTHON_ENTRYPOINT_MODE` | `script`, alternative `console` | [`config.rs`](../../../backend/rust_api/src/config.rs), [`entrypoints.rs`](../../../backend/rust_api/src/worker_command/entrypoints.rs) |
| `RUST_API_UPLOAD_MAX_BYTES`, `RUST_API_UPLOAD_MAX_PAGES` | `0` means disabled limit in upload config | [`upload.rs`](../../../backend/rust_api/src/config/upload.rs) |
| `RUST_API_MINERU_*`, `RUST_API_PADDLE_*`, `RUST_API_DEEPSEEK_*` | Provider limits/timeouts/base URLs | [`provider.rs`](../../../backend/rust_api/src/config/provider.rs) |
| `RUST_API_AI_SERVICE_BASE` | `http://127.0.0.1:41100` | [`ai_proxy.rs`](../../../backend/rust_api/src/routes/ai_proxy.rs) |

## Frontend Configuration

[`runtime.ts`](../../../frontend/src/js/config/runtime.ts) reads `window.__FRONT_RUNTIME_CONFIG__`, normalizes `apiBase`, and attaches `X-API-Key` via `buildApiHeaders()`. Docker writes this object from:

| Docker env | Frontend field | Source |
| --- | --- | --- |
| `FRONT_API_BASE` | `apiBase` or `window.location.origin` | [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) |
| `FRONT_X_API_KEY` | `xApiKey` | [`web.env`](../../../docker/delivery/docker/web.env) |
| `FRONT_OCR_PROVIDER` | `ocrProvider` | [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) |
| `FRONT_PADDLE_TOKEN`, `FRONT_MINERU_TOKEN` | OCR defaults | [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) |
| `FRONT_MODEL_API_KEY`, `FRONT_MODEL`, `FRONT_BASE_URL` | LLM defaults | [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh) |

## Desktop Configuration

Electron sets local defaults in [`buildBackendEnv()`](../../../desktop/src/main/backend-env.js): Rust binds `127.0.0.1`, API key is `retain-pdf-desktop`, data root is under Electron `userData`, `RUST_API_AI_SERVICE_BASE` points to retainpdf-ai, and retainpdf-ai receives `RETAIN_AI_*` variables sharing the same desktop key.

## Failure Modes

Auth config missing: Rust config fails because [`auth.rs`](../../../backend/rust_api/src/config/auth.rs) requires at least one API key. Frontend key mismatch: API calls return 401 because `buildApiHeaders()` sends the wrong `X-API-Key`. AI service unreachable: `/api/v1/ai/ask` returns bad gateway from [`ai_proxy.rs`](../../../backend/rust_api/src/routes/ai_proxy.rs). Provider limits or private URL rules can reject OCR requests in provider validation and config code.

## Extension Points

Add a Rust env var in the appropriate `backend/rust_api/src/config/*.rs` module, then pass it from Docker/Electron if needed. Add frontend runtime config in `runtime.ts`, then write it from `entrypoint-web.sh` and desktop `prepare-app.mjs` if it must exist in packaged builds. Add provider option defaults in `ocr_providers.json` and provider model parsing code.

## Source References

- [`backend/rust_api/src/config.rs`](../../../backend/rust_api/src/config.rs)
- [`backend/rust_api/src/config/auth.rs`](../../../backend/rust_api/src/config/auth.rs)
- [`frontend/src/js/config/runtime.ts`](../../../frontend/src/js/config/runtime.ts)
- [`desktop/src/main/backend-env.js`](../../../desktop/src/main/backend-env.js)
- [`docker/entrypoint-web.sh`](../../../docker/entrypoint-web.sh)

## Related Pages

- [Security](../06-operations/security.md)
- [External integrations](../05-interfaces/external-integrations.md)
- [Deployment](../06-operations/deployment.md)

