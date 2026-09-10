# RetainPDF 后端架构

> 当前快照：2026-09-02。本文描述现行 `services/` 后端；历史进程拆分决策见
> [ADR-0005](../../adr/0005-shell-and-backends.md)。

## 部署边界

RetainPDF 面向本地桌面与自托管 Docker，不按云端微服务拆库。代码以清晰的
包、crate、进程和协议边界解耦，持久状态仍由同一后端数据根统一管理。

```text
frontend/web 或 frontend/desktop
  └─ rust_api
       ├─ :41000  完整 HTTP API、下载、SSE、健康与就绪检查
       ├─ :42000  仅 POST /api/v1/translate/bundle
       ├─ retain-jobsd :41002（remote 模式、仅回环、可选监督）
       │    └─ Python pipeline workers
       └─ retainpdf-ai :41100（仅回环、可选监督）
```

Rust 的原始配置默认使用进程内 jobs runtime，并关闭两个子服务监督。仓库的权威
开发入口 `python3 ops/development/dev_stack.py` 会显式选择
`remote + supervised`，由 `rust_api` 监督 jobsd 与 AI 服务。当前 Docker 镜像
监督 AI 服务，但 jobs runtime 保持默认进程内模式，除非部署者明确开启 remote。

| 启动形态 | jobs runtime | AI 服务 | 说明 |
| --- | --- | --- | --- |
| 直接运行 `rust_api` | 默认 in-process | 默认不监督 | 由环境变量显式改变 |
| `ops/development/dev_stack.py` | remote，Rust 监督 jobsd | Rust 监督 | 当前权威开发入口 |
| 打包 Electron | remote，Rust 监督 jobsd | Rust 监督 | desktop main 为 packaged 模式注入配置 |
| `ops/deployment/docker/Dockerfile.app` | 默认 in-process | Rust 监督 | jobsd 二进制已打包，但默认不启动 |

`/health` 始终提供诊断视图；`/ready` 只把数据库和当前配置为“受监督”的子服务
列为必需组件。41002、41100 必须保持回环地址。任何非回环 API 部署都必须显式
配置强随机 `RUST_API_KEYS`，不能使用开发启动器的默认 key。

## 目录与职责

| 目录 | 职责 |
| --- | --- |
| `backend/api/` | Rust HTTP 壳、持久化、任务编排、恢复、下载与安全边界 |
| `backend/packages/retain-core/` | 配置、公共模型、路径和失败契约 |
| `backend/packages/retain-data/` | SQLite、OCR provider、worker command 与持久化适配 |
| `backend/packages/retain-jobs/` | worker 生命周期和 pipeline 执行状态机 |
| `backend/jobs/` | 可选的独立 jobs runtime 进程 |
| `backend/packages/retain-proc/` | 进程组与 OS 进程工具 |
| `backend/ai/` | AI turn 编排、检索与 Agent runtime；不拥有业务持久状态 |
| `backend/pipeline/` | OCR 归一化、翻译、修复、渲染与 PDF 处理 |
| `backend/config/` | Rust/Python 共享 provider 配置 |
| `backend/contracts/` | 独立后端包使用的 schema 镜像 |

主 crate 通过兼容 façade 暴露下层 crate，业务代码保持单向依赖。架构门禁位于
`backend/api/scripts/check_architecture.py` 和
`backend/pipeline/devtools/check_pipeline_architecture.py`。

## 状态所有权

- Rust 后端是 document、conversation、credential、job、pipeline attempt/unit、
  document operation、candidate 与 commit 状态的权威来源。
- remote 模式下 API 壳与 jobsd 通过同一 `retain-data` 数据层访问 SQLite；
  AI 服务和浏览器不能直接写数据库。
- `ConversationState` 负责 turn 内的会话协调、摘要和消息提交，但持久化读写经
  Rust API 完成；`app.py` 只做 FastAPI 装配、鉴权和兼容导出。
- pipeline worker 生产 artifact 与 checkpoint 文件并发射受约束事件；Rust
  保存生命周期、attempt、generation、unit 和事件投影。
- SSE、AI `agent_operation` 和类似通知都是刷新提示。断线重连后，消费者必须
  重新读取 Rust 的任务、operation 或 committed translation 快照。
- 页面翻译只在 checkpoint 文件 hash 与 durable committed unit 一致时可见；
  worker 内存、尚未提交文件和模型 token 流都不是可恢复状态。

### 数据根布局

`RUST_API_DATA_ROOT` 是运行数据的共同根。开发启动器默认使用仓库根 `data/`，
Docker 使用 `/data`，桌面端传入应用数据目录；`services/data/` 不是通用运行真值。

| 路径 | 所有者与语义 |
| --- | --- |
| `db/jobs.db` | Rust/retain-data 的 SQLite 权威状态；remote jobsd 通过 WAL 访问同一库 |
| `jobs/<job_id>/` | stage spec、provider 快照、checkpoint 与发布产物 |
| `uploads/`、`downloads/` | 受管理的输入和派生下载 |
| `secrets/credentials.json` | Rust 管理的凭据 vault；位于 SQLite 外，要求受限权限且不回显明文 |
| `secrets/ai-runtime.json` | AI runtime/模型配置及 provider 凭据；监督模式与 Rust 共用 data root，文件权限受限 |
| `agent-runtime/fx/` | 仅在 `RETAIN_AI_FX_STATE_ROOT` 指向此处时保存 FX 子进程状态；开发启动器会显式设置，不替代 Rust conversation/operation 真值 |

恢复需要数据库状态和匹配的 job/checkpoint 文件，因此备份或迁移必须覆盖整个数据根，
不能只复制 `jobs.db`。

这套边界允许 API 壳重启而不终止 remote jobsd 中的 worker，也允许服务重启后
从 durable attempt/unit 与匹配的 translation checkpoint 恢复。未提交的模型
输出不会被伪装成已完成状态；远程 provider 请求处于不确定状态时仍需显式解决
歧义，不能自动重复提交。

## 协议真值

| 边界 | 协议真值 | 关键门禁 |
| --- | --- | --- |
| Web/desktop ↔ Rust API | `backend/api/API_SPEC.md` 及 `backend/api/docs/api-spec/` | Rust API contract tests、前端 API tests |
| monorepo wire DTO | `contracts/*.schema.json` | `npm --prefix contracts test` |
| 独立后端 schema 镜像 | `backend/contracts/*.schema.json` | `python3 backend/contracts/check_parity.py --require-upstream` |
| Rust ↔ jobsd | `jobs-control.v1.schema.json` | shell/jobsd 双端 contract lock |
| Rust ↔ pipeline stdout | `pipeline-stdout.v1.schema.json` | retain-jobs 与 pipeline 双端 contract tests |
| Rust ↔ pipeline stage input | versioned stage spec 与对应 Rust/Python模型 | stage-spec checks 与 worker tests |
| Paddle raw ↔ `document.v1` | [PaddleOCR 官方布局标签与归一化基线](../paddle_ocr_api/layout-labels.md) | adapter 映射、归一化报告与全量标签契约测试 |
| MinerU raw ↔ `document.v1` | [MinerU 官方输出类型与归一化基线](../../reference/mineru_api/output-types.md) | block/span 目录、层级去重、bbox 与 adapter 契约测试 |
| AI ↔ Rust operations | Rust capability、public operation API 与 broker grammar | Rust operation tests、AI broker/runtime tests |
| 浏览器安全 PDF operation | `public-document-operation.v1.schema.json` | schema test、Rust public operation contract test |
| AI ↔ Rust calculations | `agent-calculation.v1.schema.json` | AI client contract、Rust lifecycle/scope/artifact tests |
| AI runtime 配置 | `runtime-config.v1.schema.json` | schema test、Python runtime config contract test |

修改 schema 时先更新 `contracts`，同步 `backend/contracts` 镜像，再让
生产者、消费者和 parity 门禁全部通过。API 细节不能只靠 schema 推断；路径、
认证、错误、恢复和下载行为以 Rust API spec 与实现契约测试为准。

## AI 模块化边界

`backend/ai/retainpdf_ai/app.py` 装配 `AskOrchestrator`、`ConversationState` 和
选定 runtime。`runtimes/` 分别实现 Python retrieval、OpenAI-compatible Agent
和 FX ACP；`agent_command_broker.py` 与 `agent_broker_*` 只允许受限的宿主命令。
模型拿不到 Rust API key、capability 或任意 shell。Rust 验证 operation scope、
幂等键、状态前置条件、candidate 和 commit；显式确认/绿灯模式只改变授权策略，
不改变这些安全与持久化边界。

## 当前验证命令

从仓库根目录运行：

```bash
python3 backend/api/scripts/check_architecture.py
cargo test --locked --workspace --manifest-path backend/api/Cargo.toml
PYTHONPATH=backend/pipeline uv run --project backend python backend/pipeline/devtools/check_pipeline_architecture.py
uv run --project backend python -m pytest backend/ai/tests backend/pipeline/devtools/tests -q
python3 backend/contracts/check_parity.py --require-upstream
npm --prefix contracts test
```

固定测试数量不是契约，文档只记录应执行的 suite。需要真实 provider 凭据的
live OCR/翻译/Agent 验证必须单独报告，不能用离线单测通过替代。
