# 本地启动与配置

## 1. 启动后端

```bash
cd /home/wxyhgk/tmp/Code/backend/rust_api
RUST_API_BIND_HOST=0.0.0.0 \
DATA_ROOT=/home/wxyhgk/tmp/Code/data \
RUST_API_SCRIPTS_DIR=/home/wxyhgk/tmp/Code/backend/scripts \
cargo run
```

## 2. 启动前端

```bash
cd /home/wxyhgk/tmp/Code/frontend
python3 -m http.server 8080 --bind 0.0.0.0
```

## 3. 鉴权

除 `GET /health` 外，其余接口默认都需要：

```http
X-API-Key: your-rust-api-key
```

注意区分：

- `X-API-Key`：访问 Rust API 的后端凭证
- 请求体里的 `api_key`：下游模型服务的 API Key
- 请求体里的 `mineru_token`：MinerU Token

## 4. 本地 key 来源

本地后端 key 一般来自：

- `backend/rust_api/auth.local.json`
- 或环境变量 `RUST_API_KEYS`

## 5. 当前常用环境变量

- `RUST_API_BIND_HOST`
- `DATA_ROOT`
- `RUST_API_SCRIPTS_DIR`
- `RUST_API_PORT`
- `RUST_API_SIMPLE_PORT`
