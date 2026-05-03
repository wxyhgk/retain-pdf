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
- 简便同步 API：`http://127.0.0.1:42000`

## 前端

```bash
cd /path/to/retain-pdf/frontend
python3 -m http.server 8080 --bind 0.0.0.0
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
- `RUST_API_SIMPLE_PORT`：简便同步端口，默认 `42000`。
- `RUST_API_DATA_ROOT`：运行时数据根目录。
- `RUST_API_DATA_DIR`：旧别名，仅在 `RUST_API_DATA_ROOT` 未设置时使用。
- `RUST_API_SCRIPTS_DIR`：Python 脚本目录。
- `PYTHON_BIN`：Python 可执行文件。
- `RUST_API_UPLOAD_MAX_BYTES`：普通上传大小限制，`0` 表示不限制。
- `RUST_API_UPLOAD_MAX_PAGES`：普通上传页数限制，`0` 表示不限制。
- `RUST_API_MAX_RUNNING_JOBS`：最大并发任务数。

## Docker 配置位置

Compose 实际读取的是：

- `docker/delivery/docker/app.env`
- `docker/delivery/docker/web.env`
- `docker/delivery/docker/auth.local.json`

不是仓库根目录下的 `docker/*.env`。
