# Rust API Directory Map

这份文档只回答一个问题：

**现在要改 `rust_api`，应该先进哪个目录。**

## 最常见入口

- 改 HTTP 接口：
  [`src/routes`](src/routes)
- 改 jobs 用例编排：
  [`src/services/jobs`](src/services/jobs)
- 改图书馆域（文档/收藏/检索/资产/会话/合集）：
  [`src/services/library/api.rs`](src/services/library/api.rs) +
  [`src/services/library`](src/services/library)
- 改 worker 运行链路：
  [`../packages/retain-jobs/src/job_runner`](../packages/retain-jobs/src/job_runner)
- 改 OCR provider 分发和适配：
  [`../packages/retain-data/src/ocr_provider`](../packages/retain-data/src/ocr_provider)
- 改后端运行参数、provider 超时/重试、路径和认证配置：
  [`../packages/retain-core/src/config`](../packages/retain-core/src/config)
- 改 Python worker 入口命令或 stage spec：
  [`../packages/retain-data/src/worker_command`](../packages/retain-data/src/worker_command)

## 目录地图

### `src/runtime`

- `ai_supervisor.rs`、`jobsd_supervisor.rs`：子进程启动、探活、退避重启和退出回收。
- `app/server.rs` 持有 shutdown 通道并等待监督任务结束；`app/state.rs` 给 AI 网关注入状态读取函数。
- `services/health_api.rs` 保留 HTTP 健康状态投影；任务控制接口 `services/runtime_gateway.rs` 不属于进程监督器，不随目录名搬迁。
- 当前状态仍由进程级原子量持有；本批不改变默认启动方式和 in-process/remote 语义。

### `src/app`

jobs 的依赖装配由 `app/jobs.rs` 完成；依赖定义在 `services/jobs/deps/`：
`command.rs` 管提交、快照与控制，`query.rs` 管查询/下载及 owned 快照，
`replay.rs` 管重放所需路径和命令。查询模块不依赖 `creation` 的内部上下文。
稳定 facade 位于 `services/jobs/facade/mod.rs`，其 command/query 实现继续分区。

- 作用：
  应用启动、`AppState` 组装、router 挂载、服务启动。
- 进入条件：
  只有在改全局资源、启动逻辑、路由挂载时才进这里。
- 关键文件：
  - [`src/app/state.rs`](src/app/state.rs)
    `AppState` 和全局资源初始化。
  - [`src/app/router.rs`](src/app/router.rs)
    axum 路由总挂载点。
  - [`src/app/jobs.rs`](src/app/jobs.rs)
    jobs facade 组合根。这里负责把 `AppState` 装成 `JobsFacade`，`routes` 不再直接碰 `job_runner`。

### `../packages/retain-core/src/config.rs` + `config/*`

- 作用：
  运行时配置入口。API crate 通过 `crate::config` re-export 保持调用兼容，
  实际配置分组位于 `retain-core`。
- 进入条件：
  改 env、部署参数、provider timeout/retry、路径、auth、上传限制、worker 运行参数时进这里。
- 当前子边界：
  - `config.rs`
    `AppConfig` 兼容层；`from_env()` / `from_desktop()` 只解析来源，统一通过内部 `AppConfigParts` 组装。不要继续往这里堆具体 env 解析。
  - `config/env_vars.rs`
    env 读取 helper；统一处理空字符串和正整数 fallback。
  - `config/paths.rs`
    project root、rust_api root、data root、scripts、jobs/uploads/downloads 路径和 runtime 目录创建。
  - `config/auth.rs`
    `auth.local.json`、`RUST_API_KEYS`、`RUST_API_MAX_RUNNING_JOBS`、`RUST_API_SIMPLE_PORT`。
  - `config/server.rs`
    `PYTHON_BIN`、`RUST_API_BIND_HOST`、`RUST_API_PORT`。
  - `config/upload.rs`
    `RUST_API_UPLOAD_MAX_BYTES`、`RUST_API_UPLOAD_MAX_PAGES`。
  - `config/provider.rs`
    MinerU / Paddle / DeepSeek 的 base URL、HTTP timeout、retry、provider 上传门槛和 Paddle input image limit。
  - `config/job_runner.rs`
    队列轮询、worker terminate grace、AI failure diagnosis timeout、同步 bundle 等待间隔。
- 规则：
  新增部署可调参数时，优先放进上述子模块；只有需要保持现有调用方兼容时，才在 `AppConfig` 上暴露字段。
  stage 名、artifact key、API path、schema version、stdout label 这类协议常量不要配置化。

### `src/routes`

- 作用：
  HTTP 参数提取、请求转发、统一响应封装。
- 不该做的事：
  不直接碰 `job_runner`，不自己拼底层业务逻辑，不 `state.db` / 内部 service，
  models 只经 `models::api` / `domain` / `request`。

#### `src/routes/jobs`

- `json_response/`
  jobs JSON 查询 / detail / cancel / retry 的响应出口，只调用 `JobsFacade`
  并封装 `ApiResponse`。
- `create.rs` / `download.rs` / `query.rs` / `control.rs` / `translation_debug.rs`
  真正的 axum route 入口。

#### `src/routes` library 面

- `library.rs`
  books 投影 API；只调 `library_api`；cover/thumbnail 走 `download_response`。
- `library_data.rs`
  documents / media / translate-from-library / favorites / search；只调 `library_api`。
- `library_extras.rs`
  assets / conversations；multipart 解包留在 route，业务进 `library_api`。
- `collections.rs`
  合集 CRUD 与成员关系；只调 `library_api`。
- deps：`routes/common.rs::build_library_route_deps`（`LibraryDeps` + `JobsFacade`）。

#### `src/routes` AI / Agent 面

- `ai_proxy.rs`
  `/api/v1/ai/ask` 与 runtime-config 代理；只调 `services::ai::api`。
- `public_document_operations.rs`
  面向浏览器的 operation 查询、CAS 动作与 candidate 下载；只调
  `public_document_operations_api`。
- `document_operations.rs` / `agent_capabilities.rs` /
  `agent_runtime_sessions.rs`
  backend-only CLI/host 路由；不允许被前端当作公开操作接口。

#### `src/routes/download_response`

- 作用：
  文件下载、markdown、preview、cover、thumbnail 的响应出口。
- 使用方：
  `routes/jobs/*` 和 `routes/library.rs` 都可以调用它；route 模块之间不要互相复用私有 helper。

### `src/services`

- 作用：
  application service 入口和内部业务实现。

#### `src/services/uploads` 与 `src/services/ai`

- 路由分别调用 `uploads::api` 和 `ai::api`；装配和跨业务调用通过模块根部的
  明确能力导出，不访问私有实现文件。
- `uploads` 的 `service/capacity/staging/pdf/error` 分别负责流程、处理容量、
  文件发布与清理、PDF 处理和业务错误；独立上传、OCR、Bundle 共享服务实例。
- `ai` 的 `gateway` 持有 HTTP 客户端和启动配置；`api` 处理 HTTP/SSE 适配。
  `AppState` 装配共享网关，健康状态来源仍由现有监督器提供，本轮没有迁移监督器。
- 迁移状态及后续批次见
  [业务目录与边界统一迁移计划](../../docs/ops/planning/api-boundary-migration.md)。

#### `src/services/jobs/facade`

- 作用：
  给 route 提供统一 jobs 入口。
- `command/*`
  创建、取消、同步 bundle 这类命令型能力。
- `query/*`
  列表、详情、下载、artifacts、translation debug 这类查询型能力。

#### `src/services/library/api.rs` + `src/services/library/*`

- 作用：
  给 route 提供统一 **Library** 入口（与 `JobsFacade` / `glossaries::api` 同级）。
- 进入条件：
  改文档、馆藏翻译入口、收藏、全文检索、资产、会话、合集业务时进这里；
  **不要** 把逻辑写回 `routes/library_*`。
- 子模块：
  - `books.rs` — library books 列表/详情/删除（投影委托 `book_projection`）
  - `documents.rs` / `media.rs` — 文档 CRUD 与 source.pdf/cover/thumbnail
  - `translate.rs` — 绑定文档 upload 后调 `JobsFacade::create_submission`
  - `favorites.rs` / `search.rs` — 锚点收藏与 blocks FTS
  - `assets.rs` / `conversations.rs` / `collections.rs` — 资产、会话、合集
- 规则：
  route 只 import `library_api::`；`derived_artifacts` 只允许在 service 内部使用。

#### `src/services/jobs/creation`

- `submit.rs`
  创建并启动任务。
- `bundle.rs`
  同步跑完整链路并产出 bundle。
- `prepare.rs`
  输入解析、存在性检查、前置校验，只产出 `Prepared*` 输入，不生成 `JobSnapshot`。
- `job_builders.rs`
  workflow 级快照编排；只消费 `Prepared*` 输入并调用 snapshot factory，不再自己做前置校验。
- 上传持久化委托 `services/uploads`；已有 upload record 的输入查询在 `prepare.rs`。
- `context.rs`
  creation 侧显式 deps。

#### `src/services/jobs/presentation`

- 作用：
  对外 view 组装、摘要读取、响应投影。
- 进入条件：
  改 API 返回结构、摘要字段、脱敏展示时进这里。

#### 其他 service 入口

- [`src/services/uploads/api.rs`](src/services/uploads/api.rs)
  上传接口入口。
- [`src/services/glossaries/api.rs`](src/services/glossaries/api.rs)
  术语表接口入口。
- [`src/services/fonts/api.rs`](src/services/fonts/api.rs)
  字体查询入口，具体发现逻辑位于私有 `service.rs`。
- [`src/services/credentials/api.rs`](src/services/credentials/api.rs)
  HTTP 凭据入口；jobs 所需凭据使用锁等能力由模块根部明确导出，不经 HTTP 入口。
- [`src/services/agent_calculations/api.rs`](src/services/agent_calculations/api.rs)
  Agent 计算记录与产物接口，内部只依赖数据库和目录，不接收完整配置。
- [`src/services/library/api.rs`](src/services/library/api.rs)
  图书馆接口入口（见上）。
- [`src/services/job_snapshot_factory.rs`](src/services/job_snapshot_factory.rs)
  job snapshot/command 构造边界。
- [`src/services/job_launcher.rs`](src/services/job_launcher.rs)
  job 持久化与启动边界。
- [`src/services/runtime_gateway.rs`](src/services/runtime_gateway.rs)
  services 访问 runtime 能力的收口层。
- [`src/services/ai/api.rs`](src/services/ai/api.rs)
  Rust 到受监督 AI sidecar 的 HTTP 代理入口。
- [`src/services/public_document_operations_api.rs`](src/services/public_document_operations_api.rs)
  浏览器安全 operation 投影、显式动作 CAS 与 candidate 读取入口。
- [`src/services/document_operation_api.rs`](src/services/document_operation_api.rs)
  internal CLI operation lifecycle 入口。
- [`src/services/agent_runtime_session_api.rs`](src/services/agent_runtime_session_api.rs)
  opaque runtime cursor revision CAS 入口。

### `../packages/retain-data/src/worker_command.rs` + `worker_command/*`

- 作用：
  Python worker 命令、worker 入口脚本和 stage spec 文件构造。
- 进入条件：
  改 `normalize/translate/render/provider` spec 字段、Python entrypoint、命令行参数时进这里。
- 边界：
  这是 `services` 和 `job_runner` 共同依赖的中性契约层，不属于 `services`，避免 `job_runner -> services` 的反向依赖。
- 当前子边界：
  - `worker_command.rs`
    对外 `build_ocr_command` / `build_translate_only_command` / `build_render_only_command` / `build_normalize_ocr_command` facade。
  - `worker_command/stage_specs.rs`
    写 stage spec JSON。
  - `worker_command/entrypoints.rs`
    选择 Python 脚本入口并拼入口参数。
  - `worker_command/command_builder.rs`
    命令行拼装细节。

### `../packages/retain-jobs/src/job_runner`

- 作用：
  任务排队、worker 启动、stdout/stderr 消费、失败归因、取消、超时。
- 快速判断：
  改 stage 执行顺序、并发槽位、进程控制、运行态同步时进这里。
- 详细边界：
  [`../../docs/core/rust_api/12-job_runner 边界.md`](../../docs/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
- 当前目录地图：
  - `mod.rs`
    runner facade、公共 deps、对外导出；这里的 `ProcessRuntimeDeps` 只给 orchestrator 用，`JobPersistDeps` 是叶子 helper 的持久化资源边界。
  - `lifecycle.rs`
    任务排队、执行槽、workflow 分发。
  - `process_runner.rs` + `process_runner/*`
    真实 worker 执行器；`process_runner.rs` 只保留 orchestrator，并通过 `ProcessRuntimeDeps` 的窄 accessor 下传依赖。`startup.rs` 负责 worker 启动和 pid 持久化，`execution.rs` 负责进程等待和 timeout 分流，`completion.rs` 负责完成态归类与 shutdown-noise 判定，`timeout_support.rs` 负责超时落态，`failure_ai_diagnosis.rs` 负责失败 AI 诊断，`io_support.rs` 负责 stdout/stderr 消费。叶子 helper 只拿 `JobPersistDeps`、cancel handle 或 `WorkerProcessRuntimeConfig` 这类窄依赖。
  - `translation_flow.rs` + `translation_flow_*.rs`
    OCR 后续的翻译/渲染父任务编排；`translation_flow.rs` 保留 orchestrator，`translation_flow_child.rs` 负责 upload source 读取、父任务进入 `ocr_submitting`、OCR child 创建，`translation_flow_stage.rs` 负责 translate/render stage 准备和 `ocr_child_finished` 事件，`translation_flow_support.rs` 负责 OCR 终态判定和翻译输入提取。
  - `ocr_flow/*`
    OCR child job 执行链路、provider 轮询/下载/markdown materialize；其中 `ocr_flow/mod.rs` 是 orchestrator，`ocr_flow/support.rs` 负责 OCR job 保存、parent OCR 状态镜像、transport/source-pdf 失败处理和 `sync_parent_with_ocr_child(...)`，`workspace.rs` 只管路径和目录，`polling.rs` 只管轮询等待和 cancel 检查。
  - `stdout_parser/*`
    stdout 行级规则解析；`mod.rs` 是 facade，`labels.rs` 管 stdout 标签常量，`state.rs` 管解析共享状态，`stage_rules.rs` / `artifact_rules.rs` 管行级规则，`failure.rs` 管 provider failure 归因。
  - `runtime_state.rs`
    runtime snapshot / failure / artifact 的统一更新工具。
  - `worker_process.rs`
    子进程启动、env 注入、进程树终止；现在只拿 `WorkerProcessRuntimeConfig + job`，不再依赖整包 runtime deps。

### `../packages/retain-data/src/ocr_provider`

- 作用：
  OCR provider 分发、provider 特定协议转换、provider 输出收口。
- 快速判断：
  改 MinerU / Paddle 接入细节时进这里。

### `../packages/retain-core/src/storage_paths.rs` + `storage_paths/*`

- 作用：
  artifact key、路径归一化、路径解析、artifact registry 收集。
- 现在的子边界：
  - `constants.rs`
    artifact key / group / kind 常量。
  - `job_paths.rs`
    `JobPaths` 和任务目录创建。
  - `path_ops.rs`
    相对路径规范化、存储归一化、legacy 判定。
  - `resolvers.rs`
    各类 published artifact 路径解析。
  - `registry.rs`
    把任务文件投影成 artifact entry 列表。

### `../../database/retain-db/src/db.rs` + `db/*`

- 作用：
  SQLite 持久化入口。
- 现在的子边界：
  - `rows.rs`
    SQLite row -> 领域模型解码。
  - `schema.rs`
    schema 检查和启动期迁移保护。
  - `db.rs`
    主 `Db` facade 和具体读写用例。

## 三条快速判断

- “这是 HTTP 行为变化吗？”
  先看 `src/routes`
- “这是 jobs 用例编排变化吗？”
  先看 `src/services/jobs/facade` 和 `src/services/jobs/creation`
- “这是 worker / Python 执行变化吗？”
  先看 `../packages/retain-jobs/src/job_runner`
- “这是 AI 对话、runtime 或 PDF operation 变化吗？”
  先分清 `src/services/ai/api.rs`、
  `public_document_operations_api.rs` 和 backend-only
  `document_operation_api.rs` 三个边界

## 一张更直观的目录地图

当前建议按这条线理解后端：

1. `src/routes`
   HTTP 适配层，只做参数提取和响应封装。
2. `src/services/jobs/facade`
   jobs 用例总入口，route 只和 facade 说话。
3. `src/services/jobs/creation` / `src/services/jobs/presentation`
   前者负责创建与提交，后者负责 detail/list/events 对外投影。
4. `../packages/retain-jobs/src/job_runner`
   运行态编排、子进程、OCR flow、translation/render flow。
5. `../packages/retain-data/src/ocr_provider`
   provider 协议和 provider 输出归一化。

新人如果只想快速定位修改入口，可以先问自己是在改：

- HTTP 适配
- 用例编排
- 展示投影
- 运行时执行
- provider 协议

然后再进对应目录，不要一上来横跨 `routes -> services -> job_runner` 多层同时改。

## 新人阅读顺序

如果第一次进这个后端，建议按这个顺序看：

1. [`src/app/router.rs`](src/app/router.rs)
   先知道有哪些 HTTP 入口。
2. [`src/app/jobs.rs`](src/app/jobs.rs)
   再看 jobs 相关依赖是怎么装起来的。
3. [`src/routes/jobs`](src/routes/jobs)
   看 route 只是怎么转发。
4. [`src/services/jobs/facade`](src/services/jobs/facade)
   看 command/query 用例入口。
5. [`src/services/jobs/creation`](src/services/jobs/creation)
   看创建链路的准备、快照、提交、bundle。
6. [`../packages/retain-jobs/src/job_runner`](../packages/retain-jobs/src/job_runner)
   最后再进 runtime 执行层。
