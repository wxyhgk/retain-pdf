# RetainPDF backend workspace

`backend/` owns backend services and shared implementation. The Rust workspace
is rooted at the repository root; Python is rooted here. Source archives retain
the required root manifests, database and resources alongside this directory.

The workspace contains:

- `api/`: Rust HTTP API.
- `jobs/`: Rust job process entrypoint.
- `packages/`: backend shared Rust crates.
- `pipeline/`: Python OCR, translation, and rendering package.
- `config/`: backend-owned runtime configuration shared by Rust and Python.
- `contracts/`: backend-local JSON contract mirror plus monorepo parity check.

Shared fonts live in `../resources/fonts`, database code in `../database`,
deployment tools in `../ops`, and project-level fixtures and smoke runners in
`../tests`. Module-specific tests and tools remain with their owner.

## Start the backend locally

From the monorepo root, the authoritative launcher prepares the locked Python
environment and Rust binaries, starts `rust_api`, and lets Rust supervise jobsd:

```bash
python3 ops/development/dev_stack.py
```

For the default loopback launch, the script injects a development key when
`RUST_API_KEYS` is unset. Set an explicit, non-default key before using
`--host 0.0.0.0` or any other non-loopback bind address; both the launcher and
Rust reject the default development key on non-loopback listeners.

Explicit `RUST_API_KEYS`, `RUST_API_SIMPLE_PORT`, and
`RUST_API_MAX_RUNNING_JOBS` override `api/auth.local.json`. The launcher sets
the key and listener ports explicitly (including its loopback development
default); pass `RUST_API_KEYS` to select a different key. Raw Rust launches
still use the local file when these environment variables are absent.

Startup succeeds only after `http://127.0.0.1:41000/ready` reports that the
database and supervised services are ready. `Ctrl+C` stops the complete process
tree. Use `--no-sync --no-build` for a prepared checkout, or `--prepare-only`
to install/build without starting services.

The launcher uses the full API on `41000`, the internal jobs service on
loopback `41002`, and the
second listener on `42000` (serves only `/health` and `/ready`). Raw Rust configuration
still defaults to in-process jobs and disabled child supervision; the launcher
explicitly selects `remote + supervised` for the complete development stack.

（已删）RetainPDF 自己的 AI 服务（FX / OpenAI 兼容运行时、Agent 端到端工具）2026-11-03 删了，产品里只留 Studio 的 AI。

`/health` is a liveness/diagnostic endpoint. `/ready` is the startup gate for
the database and locally supervised backend children. The legacy
`backend/api/scripts/dev-remote.sh` entrypoint forwards to the same launcher.

## Local verification

Run Python commands from this directory, or pass `--project backend` from the
monorepo root:

```bash
uv sync --locked --all-extras
uv run retainpdf-pipeline --help
uv run python -c "import retainpdf_pipeline"
uv run cargo test --locked --workspace --manifest-path ../Cargo.toml
python3 api/scripts/check_architecture.py
PYTHONPATH=pipeline uv run python pipeline/devtools/check_pipeline_architecture.py
uv run python -m pytest pipeline/devtools/tests -q
```

Rust integration tests launch Python helpers and therefore need the locked
Python environment on `PATH`. From the monorepo root, `npm run test:api`
sets this up through `uv run --locked --all-extras`.

From the monorepo root, the extraction smoke test builds a clean Git snapshot
of the explicit backend delivery file set and verifies that it does not import source
files from the parent checkout:

```bash
python3 ops/release/check_standalone.py
python3 backend/contracts/check_parity.py --require-upstream
```

Contracts use the local `contracts/` mirror. Golden regression data lives at
`../tests/fixtures/golden-jobs`. Standalone validation verifies the archive
without reaching back into the original checkout.

## Backend container

Build the backend image from the repository root as Docker context:

```bash
docker build -f ops/deployment/docker/backend/Dockerfile.app -t retainpdf-app:local .
```

The image contains `rust_api`, `retain-jobsd`, `retainpdf-agent`, and the Python
pipeline.（镜像里的 Python AI 服务 2026-11-03 删了，`/api/v1/ai/*` 也一起删了。）
The current container leaves the jobs runtime in its default in-process mode;
the included `retain-jobsd` binary is used only when deployment configuration
explicitly selects remote jobs mode and supervision.

## Durable state ownership

The Rust backend owns durable documents, credentials, job and pipeline state.
Pipeline workers own artifact
and checkpoint file production; Rust records lifecycle, attempts, units, and
events. Frontends treat Rust projections as authoritative and use SSE events
only as refresh hints.（AI 对话、PDF 文档操作的表还留在数据库里，但读写它们的服务 2026-11-03 跟 AI 服务一起删了。）

## Runtime data root

`RUST_API_DATA_ROOT` is the single runtime storage root. The development
launcher defaults it to the product-level `data/` directory; the container
uses `/data`; desktop packaging supplies its application-data directory. The
important children are:

- `db/jobs.db`: SQLite authority for documents, jobs, and pipeline
  attempts/units/events.（以前 AI 用的对话、文档操作表还在，不再有接口读写。）
- `jobs/<job_id>/`: stage specs, provider snapshots, checkpoints, and published
  artifacts.
- `uploads/` and `downloads/`: managed ingress and derived downloads.
- `secrets/credentials.json`: the Rust-owned credential vault, stored outside
  SQLite with restrictive file permissions and never returned as plaintext.

Do not treat `services/data/` or a worker's memory as an authoritative runtime
location. Recovery and live views may expose only committed database state and
matching durable checkpoint files.

## Source archive

Create a provenance-stamped archive containing only the tracked backend tree:

```bash
python3 scripts/build_source_archive.py
```

The command refuses dirty tracked backend state by default, validates the
archive layout, embeds `SOURCE.json` with the Git revision and services tree
hash, and writes a matching `.sha256` sidecar.
