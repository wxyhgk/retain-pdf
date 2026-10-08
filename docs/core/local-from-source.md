# 本地从源码运行（无 Docker / WSL2）

不装 Docker，直接把后端与前端跑起来。这份流程同时解决 WSL2 下最常见的一个问题：
Windows 浏览器访问不到 WSL 里的后端端口。

## 一、运行形态

| 组件 | 入口 | 说明 |
| --- | --- | --- |
| 后端 | `ops/development/dev_stack.py` | `uv sync` + `cargo build` 后拉起 `rust_api`，再由 `rust_api` 托管 `jobsd` 与 AI 服务 |
| 前端静态资源 | `frontend/web` | `dist/` 与 `vendor/` 已提交，通常无需重新构建 |
| 同源服务 | `frontend/web/scripts/serve_same_origin.py` | 托管前端静态资源，并把 `/api` 转发到后端；浏览器只需访问一个端口 |

同源服务复用 `frontend/web/scripts/serve_static.py` 的静态托管、`runtime-config`
注入与缓存头，只额外加上 `/api` 转发。

## 二、前置依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Rust | 1.70+ | 编译根 Cargo workspace |
| uv | 最新 | 创建 `backend/.venv`，由 `dev_stack.py` 调用 |
| Python | 3.11（`backend/pyproject.toml` 要求 `>=3.11,<3.12`） | 运行 `retainpdf-pipeline` 与 AI 服务 |
| Typst | 0.14.2（与 Docker / CI 一致） | PDF 重排渲染 |
| Node.js | 20+ | 仅当需要重新构建前端时才用到 |

Typst 需要落在 `PATH` 上，或用 `TYPST_BIN` 指定可执行文件；两者都没有时流水线会渲染失败。

## 三、启动

```bash
ops/development/run_from_source.sh
```

脚本做四件事：

1. 写入 `frontend/web/runtime-config.local.js`（只写同源 `apiBase`，不含任何密钥）；
2. 经 `dev_stack.py` 拉起后端，日志 `data/dev-stack.log`；
3. 拉起前端同源服务，日志 `data/frontend.log`；
4. 打印浏览器访问地址。

首次启动要 `uv sync` + `cargo build`，会比较慢；之后的启动会复用已有产物。脚本是幂等的，
重复执行不会重复拉起已在运行的服务。

### 等价的手动步骤

```bash
# 后端（官方入口；首次会 uv sync + cargo build）
npm run dev:backend

# 前端同源服务（另一个终端）
python3 frontend/web/scripts/serve_same_origin.py \
  --root frontend/web \
  --api-base http://127.0.0.1:41000 \
  --port 40001
```

### 可调项

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `WEB_PORT` | `40001` | 前端端口 |
| `RUST_API_PORT` | `41000` | 后端端口 |
| `RUST_API_SIMPLE_PORT` | `42000` | 同步翻译端口 |
| `RUST_API_KEYS` | `dev-local-key` | 后端鉴权 key，由 `dev_stack.py` 兜底 |
| `TYPST_BIN` | `PATH` 上的 `typst` | Typst 可执行文件 |
| `NO_BUILD` | 未设置 | 设为 `1` 跳过 `uv sync` / `cargo build` |

## 四、WSL2 下浏览器「无法连接后端」

**现象**：后端已启动，在 WSL 内 `curl http://127.0.0.1:41000/health` 正常，但 Windows
浏览器里前端一直报「当前前端无法连接后端」。

**根因**：WSL2 的 localhost 转发可能按端口失效——出现「前端端口（40001）能转发、
后端端口（41000）不能」的不对称情况。此时 Windows 侧 `127.0.0.1:41000` 到不了 WSL
里的服务，而浏览器默认就按同 host 的 `:41000` 直连后端。

**解决**：让前端与后端**同源**。浏览器只访问 `40001`，由 `serve_same_origin.py` 在 WSL
内把 `/api` 转发到 `127.0.0.1:41000`，绕开 localhost 转发。副作用是后端可以只绑
`127.0.0.1`，不必暴露到局域网。

如果 40001 本身也转发不了，用 WSL 的 IP 访问：`http://<WSL-IP>:40001`
（脚本启动后会打印该地址）。

## 五、鉴权与凭据

- **后端 key**：由 `dev_stack.py` 经 `RUST_API_KEYS` 配置（未设置时为 `dev-local-key`）。
  同源服务在转发 `/api` 时补上 `X-API-Key`，因此浏览器不需要持有它——请求里已经带了
  key 的（例如在「设置 → 凭据」里配过）会原样透传，不会被覆盖。
- **模型 / OCR 凭据**：填在「设置 → 凭据」。按
  `frontend/web/runtime-config.local.example.js` 的约定，**不要**把
  `modelApiKey`、`mineruToken`、`paddleToken` 写进 `runtime-config.local.js`。

## 六、常见问题

| 现象 | 处理 |
| --- | --- |
| `required backend artifacts are missing` | 先让 `dev_stack.py` 完成一次完整构建（不要加 `NO_BUILD=1`） |
| 渲染阶段报找不到 typst | 把 typst 放进 `PATH`，或设 `TYPST_BIN` 指向可执行文件 |
| 端口被占用 | 用 `WEB_PORT` / `RUST_API_PORT` 换端口；两个端口都要换 |
| 前端改动没生效 | `dist/` 是提交产物，改源码后需要在仓库根执行 `npm run build:web` |
| 后端起来了但前端 502 | 前端同源服务连不上 `--api-base`；确认后端端口与 `RUST_API_PORT` 一致 |
