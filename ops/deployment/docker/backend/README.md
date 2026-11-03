# Backend container

Build from the repository root or the extracted backend source archive root.
Both preserve the aggregate Cargo, backend, database and resource layout:

```bash
docker build -f ops/deployment/docker/backend/Dockerfile.app -t retainpdf-app:local .
```

Run a local smoke instance:

```bash
docker run --rm \
  -e RUST_API_KEYS=replace-with-a-random-local-key \
  -p 127.0.0.1:41000:41000 \
  -p 127.0.0.1:42000:42000 \
  -v retainpdf-data:/data \
  retainpdf-app:local
```

Port `41000` serves the full API and health/readiness endpoints. Port `42000`
serves only `/health` and `/ready`. Jobs execute
in-process unless remote jobs mode is explicitly enabled; a remote jobsd uses
loopback `41002` and should not be exposed publicly.

Runtime credentials and provider secrets must be supplied as environment
variables or mounted configuration. `RUST_API_KEYS` is required because the
image does not contain `auth.local.json`; the example value must be replaced.
Do not bake keys into the image or publish the API with a placeholder key.
The container listens on `0.0.0.0`, so the backend refuses `dev-local-key` and
keys shorter than 16 characters.

With the delivery `docker-compose.yml`, a mounted `auth.local.json` that still
holds the bundle placeholder (`replace-with-your-backend-key`) is replaced at
startup by a random key stored in `RETAINPDF_SHARED_KEY_DIR`
(`/run/retainpdf-key/backend-api-key`); the web image reads the same file.
`RUST_API_KEYS` always wins and disables the generation.

The `/data` volume contains `db/jobs.db`, job artifacts/checkpoints, managed
uploads/downloads, both credential stores, and caches. Persist the whole
volume; copying only the SQLite file is not sufficient to preserve resumable
artifacts.

The application, pipeline workers, and Typst run as the
unprivileged `retainpdf` user (`10001:10001`). Fresh named volumes inherit the
correct ownership from the image. Before reusing a bind mount or a volume
created by an older root-running image, migrate it once:

```bash
docker run --rm --user root --entrypoint chown \
  -v retainpdf-data:/data \
  retainpdf-app:local \
  -R 10001:10001 /data
```

The entrypoint fails with a writable-directory diagnostic instead of starting
an API that cannot update SQLite, job checkpoints, the Typst cache,
or its private runtime home. `RETAINPDF_UID` and `RETAINPDF_GID` are image build
arguments when a deployment needs different fixed IDs.

The image also bundles `retainpdf-agent`.（以前镜像里由 Rust API 监督的 AI 服务 `retainpdf-ai`、FX 二进制和
`RETAIN_AI_*` 环境变量 2026-11-03 跟 RetainPDF 自己的 AI 服务一起删了，产品里只留 Studio 的 AI。）
