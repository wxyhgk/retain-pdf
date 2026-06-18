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
- 默认 `model`：`deepseek-ai/deepseek-v4-pro`
- API key：环境变量 `ATLASCLOUD_API_KEY` 或 `backend/scripts/.env/atlascloud.env`（模板见 `backend/scripts/.env/atlascloud.env.example`）

> `deepseek-ai/deepseek-v4-pro` 是带推理（reasoning）的模型，调用时要给足 `max_tokens`（建议 ≥ 512），否则 token 可能先耗在思维链上，出现 `finish_reason=length` 且 `content` 为空。

启用方式：

```bash
export RETAIN_TRANSLATION_PROVIDER=atlascloud
export ATLASCLOUD_API_KEY=your-atlascloud-api-key
```

启用后，CLI 入口（如 `translate_page.py`、`run_document_flow.py`）的 `--base-url` / `--model` 默认值会自动切到 Atlas Cloud；也可以在单次调用时显式传 `--base-url https://api.atlascloud.ai/v1 --model deepseek-ai/deepseek-v4-pro`。Atlas Cloud 还提供 DeepSeek、Qwen、GLM、Kimi、MiniMax 等多家模型，完整清单见下方 README 或 [atlascloud.ai/models](https://www.atlascloud.ai/models)。

#### 错误码处理

Atlas Cloud 复用 DeepSeek 那套 OpenAI 兼容 transport（`backend/scripts/services/translation/llm/providers/deepseek/client.py` 的 `request_chat_content`），因此自动继承同一套错误码处理：

- 瞬时错误 `408 / 429 / 500 / 502 / 503 / 504` 会按**指数退避 + 抖动**自动重试（`HTTP_RETRY_ATTEMPTS`，退避上限 `HTTP_RETRY_BACKOFF_MAX_SECS=20s`）；连接/超时类网络错误同样重试。
- `429` 优先读响应头的 `Retry-After` 作为等待时长，并设有累计等待预算 `HTTP_RATE_LIMIT_WAIT_MAX_SECS=300s`，超过即放弃并抛出，避免无限等待。
- `4xx` 客户端错误（`400 / 401 / 403 / 404 / 422` 等）**不重试**，直接抛出，且异常信息会附带响应体摘要与请求元信息便于定位。
- Atlas 网关的错误体形如 `{"code":401,"msg":"unauthorized"}`、`{"code":400,"msg":"bad request"}`，会原样收进异常文本。

Atlas provider 另提供两个 transport-only 辅助（`backend/scripts/services/translation/llm/providers/atlascloud/client.py`），便于上层对失败分类：`is_rate_limited(exc)` 判断是否 429；`describe_api_error(exc)` 给出稳定、不含密钥的失败原因（如 `HTTP 429: rate limited ... [retryable]`）。

#### 余额与用量

- **用量**：Atlas Cloud 是 OpenAI 兼容接口，每次非流式 chat completion 都会在响应里回传 `usage`（`prompt_tokens` / `completion_tokens` / `total_tokens`）。`atlascloud.extract_usage(response_json)` 可从响应取用量；`atlascloud.fetch_usage(messages, api_key=..., model=...)` 会发一次最小请求并返回用量，可用作连通性 + 计量探针。
- **余额**：Atlas Cloud 未提供 OpenAI 风格的 `/v1/dashboard/billing/*` 余额查询接口（这些路由返回 404），剩余额度请在 [Atlas Cloud 控制台](https://www.atlascloud.ai/console/coding-plan) 查看。

#### 并发与稳定性

transport 层为并发做了准备：按配置的 worker 数设置连接池（`pool_maxsize`，上限 `RETAIN_TRANSLATION_HTTP_POOL_MAX`）、每线程独立 `requests.Session`、DNS 预热与 60s 缓存，配合上面的重试/退避，使翻译流水线在多并发下保持稳定。

实测（`deepseek-ai/deepseek-v4-pro`，并发 8、24 个请求，`max_tokens=512`）：成功率 24/24（0 失败），延迟 p50 ≈ 3.6s、p95 ≈ 5.4s，吞吐 ≈ 1.9 req/s。生产中实际并发量请按账户的 rate limit 调整 worker 数；遇到 429 会按上面的退避策略自动让路。

## Docker 配置位置

Compose 实际读取的是：

- `docker/delivery/docker/app.env`
- `docker/delivery/docker/web.env`
- `docker/delivery/docker/auth.local.json`

不是仓库根目录下的 `docker/*.env`。
