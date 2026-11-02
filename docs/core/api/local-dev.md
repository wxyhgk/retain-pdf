# 本地启动与配置

## 后端

从仓库根目录启动：

```bash
python3 ops/development/dev_stack.py --runtime python
```

该入口准备锁定的 Python 环境及 Rust 二进制，再由 Rust 监督 jobsd 和 AI。
默认只监听回环。需要局域网访问时，先设置强随机的 `RUST_API_KEYS`，再传
`--host 0.0.0.0`；启动器和 Rust 都拒绝非回环监听使用默认开发 key。

默认监听：

- 完整 API：`http://127.0.0.1:41000`
- 第二个端口（只有 `/health`、`/ready`）：`http://127.0.0.1:42000`

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

除 `GET /health`、`GET /ready`、登录注册（`/api/v1/auth/session`、`login`、`register`）和模型执行器的内部接口
（`/api/v1/internal/model/jobs/{job_id}/requests…`，凭任务的能力令牌）外，其余 API 默认需要：

```http
X-API-Key: your-rust-api-key
```

`X-API-Key` 是访问 Rust API 的后端白名单 key，不是 DeepSeek / MinerU / Paddle 的模型或 OCR key。

本地 key 来源：

- 显式环境变量 `RUST_API_KEYS` 优先；值为空会报错。
- 未设置环境变量时读取 `backend/api/auth.local.json`（可由 `RUST_API_ROOT` 改变位置）。
- 开发启动器会显式设置 key：未提供 `RUST_API_KEYS` 时，在回环使用开发默认值。

`RUST_API_SIMPLE_PORT`、`RUST_API_MAX_RUNNING_JOBS` 同样以显式环境变量优先，
不再被本地文件覆盖。损坏的本地文件仍会阻止启动，不静默忽略配置错误。

Docker 中 `ops/deployment/docker/delivery/docker/auth.local.json` 的 `api_keys` 必须和 `ops/deployment/docker/delivery/docker/web.env` 里的 `RETAINPDF_PROXY_API_KEY` 对上；
两边都还是占位 key `replace-with-your-backend-key` 时，app 容器第一次启动生成一把随机 key 代替（见交付包 README 的「后端 key」）。

非回环监听（例如容器里的 `0.0.0.0`）时，后端拒绝 `dev-local-key` 和短于 16 个字符的 key；还在用上面那个占位 key 只打一条警告（旧 compose 换不掉它，得能起来）。

## 常用环境变量

数字和开关类的变量，设了但解析不了时后端**不启动**，把这些变量和取值一个个列出来（例如 `RUST_API_PORT="abc"`、
`RUST_API_UPLOAD_MAX_BYTES="200MB"`、`RUST_API_JOBS_SUPERVISE="enabled"`）。以前会悄悄换成默认值。
没设、空白和以前一样用默认值；数字类大多数 `0` 也是用默认值，`0` 有别的意思的在下面写明了。
开关认 `1/true/yes/on` 和 `0/false/no/off`，不分大小写。`RUST_API_JOBS_MODE` 只认 `remote` 和 `in_process`。
启动以后才读的几个（备份、同步的间隔，默认的翻译并发数）取值不对时不拦启动，在 stderr 报一次、用默认值。

- `RUST_API_ROOT`：Rust API 根目录。
- `RUST_API_PROJECT_ROOT`：项目根目录。
- `RUST_API_BIND_HOST`：监听 IP 地址，默认 `127.0.0.1`。监听回环地址时会校验 `Host`（见下面两条）。
- `RUST_API_ALLOWED_ORIGINS`：单机模式额外放行的网页来源，逗号分隔，写全 `scheme://host[:port]`，
  例如 `https://pdf.example.com,http://10.0.0.2:8080`；不支持通配，`null`、`file://` 会被丢掉。
  回环页面、和 API 同主机只是端口不同的页面不用写。只在页面和 API 不同主机时要配；
  它管 CORS 和助手终端 WebSocket 的握手。多用户模式用的是 `RETAIN_ALLOWED_ORIGINS`，两个互不影响。
- `RUST_API_ALLOWED_HOSTS`：单机模式额外放行的 `Host` 主机名（不带端口也行，带了会忽略），逗号分隔。
  `localhost` 和 IP 字面量总是放行。后端监听回环地址、前面又有反向代理把域名放进 `Host`
  （例如 nginx `proxy_set_header Host $host` 转发到 `127.0.0.1:41000`）时必须配；监听非回环地址时配了才校验。
  规则见 [API 总入口 1.1](index.md#11-单机模式的来源和主机)。
- `RUST_API_PORT`：完整 API 端口，默认 `41000`。
- `RUST_API_SIMPLE_PORT`：第二个端口（只有 `/health`、`/ready`），默认 `42000`。
- `RUST_API_DATA_ROOT`：运行时数据根目录。
- `RUST_API_DATA_DIR`：旧别名，仅在 `RUST_API_DATA_ROOT` 未设置时使用。
- `RUST_API_SCRIPTS_DIR`：pipeline 包根目录，保留给运行路径和辅助工具配置。
- `RUST_API_PYTHON_ENTRYPOINT_MODE`：已废弃，不再选择 worker 模式；开发启动器不再传递该变量。
- `RUST_API_PIPELINE_COMMAND`：辅助任务（如 document-operation）使用的 `retainpdf-pipeline` 命令路径。OCR、翻译、渲染主阶段固定使用 `PYTHON_BIN -m retainpdf_pipeline.ocr|translate|render --spec ...`，不再回退到旧脚本。
- `PYTHON_BIN`：Python 可执行文件。
- `RUST_API_UPLOAD_MAX_BYTES`：普通上传大小限制（字节，只写数字），不设或 `0` 用默认的 512 MiB。
- `RUST_API_UPLOAD_MAX_PAGES`：普通上传页数限制，`0` 表示不限制。
- `RUST_API_SHUTDOWN_GRACE_SECS`：收到停机信号（Ctrl-C、SIGTERM）以后最多等还没结束的请求多少秒（默认 `3`，`0` 不等），进度流这类长连接到点断开。桌面壳、`docker stop` 只给 10 秒，进程内模式最坏约 7.5 秒（见 `config/server.rs`），改大要算这笔账。
- `RUST_API_MIN_FREE_DISK_MB`：数据目录所在磁盘至少留多少 MiB 才接新上传、新任务（默认 `1024`，`0` 不查）；不够时 503 `insufficient_storage`。
- 定期清理（`RUST_API_CLEANUP_INTERVAL_SECS`，默认 `21600` 即 6 小时一轮，起服务时先跑一轮），三项各自 `0` 关掉：
  - `RUST_API_EVENTS_RETENTION_DAYS`：已结束任务的事件保留几天（默认 `30`）。
  - `RUST_API_ORPHAN_UPLOAD_RETENTION_HOURS`：没被任务、书用上的上传保留几小时（默认 `48`）。
  - `RUST_API_DERIVED_CACHE_RETENTION_DAYS`：已结束任务和书的派生缓存（Word、对照 PDF、线性化 PDF、页预览，2026-10-28 起
    还有渲染的准备缓存 `artifacts/render_prepare/` 和预热 `artifacts/render_prewarm/`）生成后保留几天（默认 `0` 不清）。
    删了下次下载、翻页、原地重渲染时重新生成，整本书的 Word 要几分钟；译文 PDF、原文、翻译结果、封面和缩略图不删。
  - 不用设置、每轮都做的（2026-10-28 起）：成功任务目录里的纯重复文件（OCR 原始压缩包、MinerU 解包目录里布局以外的东西、
    译文旁边的打包副本、重渲染成功后的上一份译文；2026-11-02 起还有 rpr_fit 引擎的工作目录 `rendered/typst/rpr-fit-engine/`）
    删掉，OCR 一片片公布时写的整份文档 `ocr/stream/document.v1.json` 和规范化文档相同时换成硬链接（只在 Unix 上），`downloads/` 里一小时以前的打包 zip 删掉。排队、在跑的任务引用着的
    任务目录不碰。清理间隔 `RUST_API_CLEANUP_INTERVAL_SECS`（默认 21600 秒），启动时也跑一轮。
- `RUST_API_DB_REQUIRE_UPGRADE_BACKUP`：数据库结构升级前的备份存不成时不升级、不启动（默认关：记 `error` 照常升级）。
- `RUST_API_MAX_RUNNING_JOBS`：最大并发任务数。排队的任务按交上来的先后开跑（2026-10-24 起）。
- `RUST_API_MAX_QUEUED_JOBS`：排队（还没开跑）的任务最多多少个（默认 `1000`，`0` 不限）；满了建任务、原地重跑 429 `queue_full`。

## Docker 配置位置

Compose 实际读取的是：

- `ops/deployment/docker/delivery/docker/app.env`
- `ops/deployment/docker/delivery/docker/web.env`
- `ops/deployment/docker/delivery/docker/auth.local.json`

不是仓库根目录下的 `docker/*.env`。

## OpenCode Go compatibility

Select **OpenCode Go** in the API provider menu, or configure
`translation.provider = "opencode"` in the shared config. The preset supplies
the API URL, `deepseek-v4.1-flash`, the OpenAI protocol and 5 workers. Credentials
and model overrides are stored in a separate OpenCode profile.

For an OpenAI-compatible OpenCode Go connection, use the provider API model ID
(e.g. `deepseek-v4.1-flash`) rather than the OpenCode CLI's
`opencode-go/` provider prefix. The base URL excludes `/chat/completions`,
for example `https://opencode.ai/inference/go/v1`.

The API probe, translation transports and reading assistant identify themselves
with a RetainPDF User-Agent and send `x-opencode-session` on requests to the exact
`opencode.ai` host. Translation requests reuse the session within a task, including
concurrent requests and retries; assistant tool rounds reuse it within an ask.
Other provider hosts receive no OpenCode-specific headers. No credential is used
as a session identifier. Follow the provider's current usage terms:
https://opencode.ai/docs/go/#where-can-i-use-it.
