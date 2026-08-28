# Contributing Guide

Thank you for contributing to RetainPDF. This project includes a Rust API, database layer, Python OCR/translation/rendering pipeline, static frontend, desktop app, and Docker delivery. The most important contribution principles are clear boundaries, verifiable changes, and reproducible issues.

## Project Wiki Rule

- Before writing code, fixing bugs, changing configuration, running implementation work, or making architecture decisions, read the relevant pages under [docs/wiki](docs/wiki/README.md). Start with [docs/wiki/README.md](docs/wiki/README.md), then follow the component and interface pages that match the task.
- After adding code, changing behavior, fixing a bug, changing API/data/contracts/configuration/deployment, or discovering that the existing Wiki is stale, update the related Wiki page(s) in the same change.
- If a code change does not require a Wiki update, mention why in the final note or PR description. Examples: formatting-only changes, comments-only changes, or test-only changes that do not alter documented behavior.

## Contribution Areas

- Frontend and desktop: job status, side-by-side reader, glossary UI, download experience, and Electron bundle synchronization.
- Rust API: job management, library APIs, artifact downloads, event streams, reader support, resume/retry flows, and authorization boundaries.
- Database and persistence: job/artifact/event/glossary records, schema compatibility, legacy data recovery, and storage paths.
- Python pipeline: OCR normalization, translation consistency, formula protection, rendering, PDF processing, and failure diagnosis.
- Professional testing: real-sample regression, edge cases, fixtures, automation scripts, performance benchmarks, and acceptance checklists.
- AI-assisted development: Codex or Claude Code are recommended for splitting tasks along project boundaries, generating tests, reviewing code, and updating documentation.
- Docker, CI, documentation, and maintainer release workflows.

## Subdocuments

- [Frontend and desktop contribution guide](doc/core/contributing/frontend.md)
- [Rust API contribution guide](doc/core/contributing/backend.md)
- [Database and persistence contribution guide](doc/core/contributing/database.md)
- [Python pipeline contribution guide](doc/core/contributing/python-pipeline.md)
- [Testing contribution guide](doc/core/contributing/testing.md)
- [AI-assisted development guide](doc/core/contributing/ai-development.md)
- [Issues, PRs, code style, and release notes](doc/core/contributing/process-and-style.md)

Recommended additional reading:

- [README](README.md)
- [Local startup and configuration](doc/core/api/local-dev.md)
- [Runtime storage structure](doc/core/api/storage.md)
- [Main documentation](doc/core/README.md)
- [Technical Wiki](docs/wiki/README.md)

## Minimal Local Startup

Backend:

```bash
cd backend/rust_api
# Prefer absolute DATA_ROOT/SCRIPTS_DIR so DB path storage never sees "../../data/...".
# Relative values still work after startup absolutization, but absolute is clearest.
RUST_API_BIND_HOST=0.0.0.0 \
RUST_API_DATA_ROOT="$(cd ../../data && pwd)" \
RUST_API_SCRIPTS_DIR="$(cd ../scripts && pwd)" \
cargo run
```

Frontend:

```bash
cd frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

Default ports:

- Rust API: `41000`
- Multipart asynchronous submission API: `42000`
- Web frontend: `40001`

Docker delivery uses the same default port set. If Docker Web is already running locally, the local static frontend can temporarily use another available port; changing that port only affects the browser entry point and does not change the Rust API default port.

## Minimum Requirements Before Submission

- Explain what changed, why it changed, and which modules are affected.
- Run the relevant tests or checks for the scope of the change.
- If any expected check was not run, explain why in the PR description.
- Do not commit local secrets, tokens, real user files, `data/db/jobs.db`, `data/jobs/*`, `tmp/*`, or large experiment outputs.
- When changing APIs, events, database schema, artifact structure, module boundaries, or deployment behavior, update the related documentation and Wiki pages.

Maintainer release, Docker delivery, and production operations workflows are not part of the ordinary contributor path. See [operations and process notes](doc/ops/README.md) and the Docker documentation for those records.
