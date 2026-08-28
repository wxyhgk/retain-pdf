# Common Change Scenarios

Purpose: Trang nay tra loi cac cau hoi thuc te khi sua RetainPDF. Moi scenario dua tren pattern dang co trong repository.

## Muon Them Mot API Endpoint

1. Add route in [`backend/rust_api/src/app/router.rs`](../../../backend/rust_api/src/app/router.rs).
2. Add handler under [`routes`](../../../backend/rust_api/src/routes) and service logic under [`services`](../../../backend/rust_api/src/services).
3. Add request/view model under [`models`](../../../backend/rust_api/src/models) if needed.
4. Add DB method/migration if endpoint persists data.
5. Add frontend client under [`frontend/src/js/api`](../../../frontend/src/js/api).
6. Add tests under Rust `api_tests` or module tests.

Failure mode: route exists but frontend lacks `X-API-Key` or model shape mismatches. Check [`runtime.ts`](../../../frontend/src/js/config/runtime.ts) and serde `deny_unknown_fields` models.

## Muon Them Mot Buoc Vao Processing Pipeline

1. Add/modify workflow dispatch in [`job_runner`](../../../backend/rust_api/src/job_runner).
2. Add stage spec writer in [`stage_specs.rs`](../../../backend/rust_api/src/worker_command/stage_specs.rs).
3. Add Python entrypoint/service under [`backend/scripts/entrypoints`](../../../backend/scripts/entrypoints) and [`backend/scripts/services`](../../../backend/scripts/services).
4. Add stdout labels/artifact publication if stage writes outputs.
5. Add artifact readiness contract and resume/retry behavior if needed.
6. Add frontend status/detail UI only after API exposes state.

## Muon Them Provider Hoac Integration Moi

OCR provider: update [`ocr_providers.json`](../../../backend/config/ocr_providers.json), provider validation/transport in [`ocr_provider`](../../../backend/rust_api/src/ocr_provider) or local command config, Python adapter if output format changes, and provider UI config.

LLM provider: extend [`provider_registry.py`](../../../backend/scripts/services/translation/llm/shared/provider_registry.py), client implementation, diagnostics, credential mapping, and frontend model/base URL controls.

## Muon Them Config/Environment Variable

Rust runtime env: add parser/default in `backend/rust_api/src/config/*.rs`, thread it through `AppConfig`, and update Docker/Electron env injection. Frontend env: add field in [`runtime.ts`](../../../frontend/src/js/config/runtime.ts), Docker [`entrypoint-web.sh`](../../../docker/entrypoint-web.sh), and desktop [`prepare-app.mjs`](../../../desktop/scripts/prepare-app.mjs). Python per-job behavior: prefer stage spec fields.

## Muon Thay Doi Data Model

API payload: update Rust model, frontend payload/client, stage spec if worker consumes it, and tests. SQLite: append migration in [`db/schema.rs`](../../../backend/rust_api/src/db/schema.rs), update DB access methods, views and cleanup/backfill if needed. `document.v1`: update schema, adapter/enrichment/validator, translation/render/reader consumers.

## Muon Bo Sung Test

Rust API/job: add module tests or `api_tests` near affected routes/services. Python pipeline: follow `backend/scripts/devtools/tests` layout and pytest pattern from workflows. Frontend: add Node tests under `frontend/tests` or smoke script in package scripts. Desktop: add/extend `smoke:frontend-bundle` or bundle validation if packaging affected.

## Source References

- [`backend/rust_api/src/app/router.rs`](../../../backend/rust_api/src/app/router.rs)
- [`backend/rust_api/src/models/input/request.rs`](../../../backend/rust_api/src/models/input/request.rs)
- [`backend/rust_api/src/db/schema.rs`](../../../backend/rust_api/src/db/schema.rs)
- [`frontend/src/js/api/jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts)
- [`backend/scripts/services/document_schema/document.v1.schema.json`](../../../backend/scripts/services/document_schema/document.v1.schema.json)

## Related Pages

- [Extension guide](extension-guide.md)
- [API reference](../05-interfaces/api-reference.md)
- [Data models](../05-interfaces/data-models.md)

