# 本地启动与配置

## 后端

从仓库根目录启动：

```bash
cd /path/to/retain-pdf/backend/rust_api
RUST_API_BIND_HOST=0.0.0.0 \
RUST_API_DATA_ROOT=../../data \
RUST_API_SCRIPTS_DIR=../scripts \
cargo run
```

默认监听：

- 完整 API：`http://127.0.0.1:41000`
- multipart 异步提交 API：`http://127.0.0.1:42000`

## 前端

```bash
cd /path/to/retain-pdf/frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

前端 API base 规则：

- 优先读取 `window.__FRONT_RUNTIME_CONFIG__.apiBase`。
- 如果没有配置，回落到当前 host 的 `41000`。
- Docker 交付默认 `FRONT_API_BASE=` 为空，由 Nginx 同源 `/api/` 代理到后端。

## 鉴权

除 `GET /health` 外，其余 API 默认需要：

```http
X-API-Key: your-rust-api-key
```

`X-API-Key` 是访问 Rust API 的后端白名单 key，不是 DeepSeek / MinerU / Paddle 的模型或 OCR key。

本地 key 来源：

- `backend/rust_api/auth.local.json`
- 环境变量 `RUST_API_KEYS`

Docker 中 `docker/delivery/docker/auth.local.json` 的 `api_keys` 必须和 `docker/delivery/docker/web.env` 里的 `FRONT_X_API_KEY` 对上。

## 常用环境变量

- `RUST_API_ROOT`：Rust API 根目录。
- `RUST_API_PROJECT_ROOT`：项目根目录。
- `RUST_API_BIND_HOST`：监听地址，默认 `0.0.0.0`。
- `RUST_API_PORT`：完整 API 端口，默认 `41000`。
- `RUST_API_SIMPLE_PORT`：multipart 异步提交端口，默认 `42000`。
- `RUST_API_DATA_ROOT`：运行时数据根目录。
- `RUST_API_DATA_DIR`：旧别名，仅在 `RUST_API_DATA_ROOT` 未设置时使用。
- `RUST_API_SCRIPTS_DIR`：Python 脚本目录。
- `PYTHON_BIN`：Python 可执行文件。
- `RUST_API_UPLOAD_MAX_BYTES`：普通上传大小限制，`0` 表示不限制。
- `RUST_API_UPLOAD_MAX_PAGES`：普通上传页数限制，`0` 表示不限制。
- `RUST_API_MAX_RUNNING_JOBS`：最大并发任务数。

## 翻译 provider

翻译走 OpenAI 兼容的 chat completions 接口，`base_url` / `model` / `api_key` 可以从请求参数或环境变量传入。激活的 provider 由 `RETAIN_TRANSLATION_PROVIDER` 决定，默认 `deepseek`，运行时不传时行为不变。

- `RETAIN_TRANSLATION_PROVIDER`：激活的翻译 provider，取值 `deepseek`（默认）或 `atlascloud`。

### DeepSeek（默认）

- 默认 `base_url`：`https://api.deepseek.com/v1`
- 默认 `model`：`deepseek-v4-flash`
- API key：环境变量 `DEEPSEEK_API_KEY` 或 `backend/scripts/.env/deepseek.env`

### Atlas Cloud（可选，OpenAI 兼容）

[Atlas Cloud](https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=retain-pdf) 通过统一的 OpenAI 兼容接口提供多种模型，可作为翻译后端直接接入。

- 默认 `base_url`：`https://api.atlascloud.ai/v1`
- 默认 `model`：`deepseek-ai/DeepSeek-V3-0324`
- API key：环境变量 `ATLASCLOUD_API_KEY` 或 `backend/scripts/.env/atlascloud.env`（模板见 `backend/scripts/.env/atlascloud.env.example`）

启用方式：

```bash
export RETAIN_TRANSLATION_PROVIDER=atlascloud
export ATLASCLOUD_API_KEY=your-atlascloud-api-key
```

启用后，CLI 入口（如 `translate_page.py`、`run_document_flow.py`）的 `--base-url` / `--model` 默认值会自动切到 Atlas Cloud；也可以在单次调用时显式传 `--base-url https://api.atlascloud.ai/v1 --model deepseek-ai/DeepSeek-V3-0324`。

## Docker 配置位置

Compose 实际读取的是：

- `docker/delivery/docker/app.env`
- `docker/delivery/docker/web.env`
- `docker/delivery/docker/auth.local.json`

不是仓库根目录下的 `docker/*.env`。
