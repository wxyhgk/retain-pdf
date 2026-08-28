# Rust API Docs

This index answers one question:

**When looking at `rust_api` docs, which one should I read first.**

## Recommended Reading Order

1. External HTTP API, Library interfaces and Frontend integration:
   [`../doc/core/api/index.md`](../../doc/core/api/index.md)
2. How the current system actually runs:
   [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
3. First look at the directory to know where to make changes:
   [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
4. Team collaboration boundaries and layering rules:
   [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
5. Rust side artifact four-layer boundary:
    [`10-ranh-gioi-artifact-rust.md`](../../doc/core/rust_api/10-ranh-gioi-artifact-rust.md)
6. Rust and Python stage spec contract:
   [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
7. Stage events and failure protocol:
    [`../doc/core/rust_api/11-su-kien-giai-doan-va-giao-thuc-that-bai.md`](../../doc/core/rust_api/11-su-kien-giai-doan-va-giao-thuc-that-bai.md)
8. job_runner runtime boundary:
    [`../doc/core/rust_api/12-ranh-gioi-job-runner.md`](../../doc/core/rust_api/12-ranh-gioi-job-runner.md)
9. OCR provider boundary:
   [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
10. Paddle OCR Async API Summary:
    [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
11. Paddle Markdown / artifact boundary:
    [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)

## What Problem Each Document Solves

- [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
  Focuses on the current official running main chain, answering "after a request comes in, how are Rust and Python actually chained together".
- [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
  Focuses on current directory responsibilities, answering "which directory should I enter first to change code".
- [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
  Focuses on current team collaboration boundaries, answering "where is the right place to change, and which layers must not be penetrated".
-    [`10-ranh-gioi-artifact-rust.md`](../../doc/core/rust_api/10-ranh-gioi-artifact-rust.md)
  Focuses on the Rust side artifact boundary, answering "what are the responsibilities of the four layers: provider raw / normalized / published artifact / download API".
- [`../doc/core/api/index.md`](../../doc/core/api/index.md)
  Focuses on external HTTP behavior, answering "how to call the interface, what it returns, and which fields are official contracts".
- [`API_SPEC.md`](API_SPEC.md)
  Retained for historical and implementation reference, no longer the primary document for the frontend.
- [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
  Focuses on the stage worker spec protocol, answering "how Rust passes execution input to Python".
-    [`../doc/core/rust_api/11-su-kien-giai-doan-va-giao-thuc-that-bai.md`](../../doc/core/rust_api/11-su-kien-giai-doan-va-giao-thuc-that-bai.md)
  Focuses on official status/event/failure protocols, answering "how Python sends events, how Rust canonicalizes them, and which fields the frontend should consume".
-    [`../doc/core/rust_api/12-ranh-gioi-job-runner.md`](../../doc/core/rust_api/12-ranh-gioi-job-runner.md)
  Focuses on the runtime execution layer boundary, answering "when changing job_runner, which module the logic should be placed in".
- [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
  Focuses on the provider adapter boundary, answering "where MinerU / Paddle are dispatched and aggregated".
- [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
  Focuses on the Paddle OCR async interface protocol, answering "how submit / poll / result download actually works".
- [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)
  Focuses on the Markdown publishing boundary, answering "why provider raw cannot be used directly as a job markdown artifact".

## Current Recommended Cognitive Path

- To quickly understand the system:
  `README -> RUST_API_DIRECTORY_MAP -> CURRENT_API_MAP -> RUST_API_ARCHITECTURE`
- To change backend code:
  `RUST_API_DIRECTORY_MAP -> RUST_API_ARCHITECTURE -> 10-ranh-gioi-artifact-phia-rust -> CURRENT_API_MAP -> corresponding source code`
- To integrate frontend or third-party:
  `doc/core/api/index.md -> CURRENT_API_MAP`

## Architecture Gatekeeping

Backend changes must run at least these items by default:

- `python3 backend/rust_api/scripts/check_architecture.py`
- `cargo build --manifest-path backend/rust_api/Cargo.toml`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib job_runner::process_runner::tests::execute_process_job_injects_provider_and_translation_envs`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib routes::jobs::query::tests::job_detail_and_events_routes_redact_secrets`

The first item is responsible for blocking the most common architecture regressions:

- `AppState` flowing back to `services/job_runner/ocr_provider`
- `routes` directly depending on `job_runner`
- `routes/jobs/*` hand-writing local `route_deps(...)`
- `routes` directly accessing `state.db` / `state.config`, or bypassing facade to import internal services
- library / glossary / upload routes not passing through `*_api` entry points
- `ProcessRuntimeDeps::new(...)` being assembled haphazardly outside the `app` boundary layer
- `JobPersistDeps` leaking back from leaf helper boundaries
- `runtime_deps` struct being scattered back across multiple runner files
- `state.rs` mixing stale running job recovery back into bootstrap
- `lifecycle.rs` degenerating back into one large function, losing aggregated helper boundaries
- artifact/download boundary layer starting to understand provider raw internal fields
- published markdown artifact being reverse-engineered from `provider_raw_dir/full.md|images`
