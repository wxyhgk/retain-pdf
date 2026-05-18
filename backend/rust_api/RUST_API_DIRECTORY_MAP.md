# Rust API Directory Map

这份文档只回答一个问题：

**现在要改 `rust_api`，应该先进哪个目录。**

## 最常见入口

- 改 HTTP 接口：
  [`src/routes`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes)
- 改 jobs 用例编排：
  [`src/services/jobs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs)
- 改 worker 运行链路：
  [`src/job_runner`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)
- 改 OCR provider 分发和适配：
  [`src/ocr_provider`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider)
- 改后端运行参数、provider 超时/重试、路径和认证配置：
  [`src/config`](/home/wxyhgk/tmp/Code/backend/rust_api/src/config)
- 改 Python worker 入口命令或 stage spec：
  [`src/worker_command`](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command)

## 目录地图

### `src/app`

- 作用：
  应用启动、`AppState` 组装、router 挂载、服务启动。
- 进入条件：
  只有在改全局资源、启动逻辑、路由挂载时才进这里。
- 关键文件：
  - [`src/app/state.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/state.rs)
    `AppState` 和全局资源初始化。
  - [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
    axum 路由总挂载点。
  - [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
    jobs facade 组合根。这里负责把 `AppState` 装成 `JobsFacade`，`routes` 不再直接碰 `job_runner`。

### `src/config.rs` + `src/config/*`

- 作用：
  运行时配置入口。`config.rs` 是兼容 facade，继续暴露原来的 `AppConfig` 字段；`src/config/*` 才是实际配置分组。
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
  不直接碰 `job_runner`，不自己拼底层业务逻辑。

#### `src/routes/jobs`

- `common.rs`
  jobs route 共享轻量入口，只拿现成 facade，不再自己装 runtime。
- `download_adapter.rs`
  文件下载类 route adapter。
- `query_adapter.rs`
  JSON 查询 / debug / cancel 类 route adapter。
- `create.rs` / `download.rs` / `query.rs` / `control.rs` / `translation_debug.rs`
  真正的 axum route 入口。

### `src/services`

- 作用：
  application service 入口和内部业务实现。

#### `src/services/jobs/facade`

- 作用：
  给 route 提供统一 jobs 入口。
- `command/*`
  创建、取消、同步 bundle 这类命令型能力。
- `query/*`
  列表、详情、下载、artifacts、translation debug 这类查询型能力。

#### `src/services/jobs/creation`

- `submit.rs`
  创建并启动任务。
- `bundle.rs`
  同步跑完整链路并产出 bundle。
- `prepare.rs`
  输入解析、存在性检查、前置校验，只产出 `Prepared*` 输入，不生成 `JobSnapshot`。
- `job_builders.rs`
  workflow 级快照编排；只消费 `Prepared*` 输入并调用 snapshot factory，不再自己做前置校验。
- `upload.rs`
  upload 持久化和 upload record 读取。
- `context.rs`
  creation 侧显式 deps。

#### `src/services/jobs/presentation`

- 作用：
  对外 view 组装、摘要读取、响应投影。
- 进入条件：
  改 API 返回结构、摘要字段、脱敏展示时进这里。

#### 其他 service 入口

- [`src/services/upload_api.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/upload_api.rs)
  上传接口入口。
- [`src/services/glossary_api.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/glossary_api.rs)
  术语表接口入口。
- [`src/services/job_snapshot_factory.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_snapshot_factory.rs)
  job snapshot/command 构造边界。
- [`src/services/job_launcher.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_launcher.rs)
  job 持久化与启动边界。
- [`src/services/runtime_gateway.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/runtime_gateway.rs)
  services 访问 runtime 能力的收口层。

### `src/worker_command.rs` + `src/worker_command/*`

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

### `src/job_runner`

- 作用：
  任务排队、worker 启动、stdout/stderr 消费、失败归因、取消、超时。
- 快速判断：
  改 stage 执行顺序、并发槽位、进程控制、运行态同步时进这里。
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

### `src/ocr_provider`

- 作用：
  OCR provider 分发、provider 特定协议转换、provider 输出收口。
- 快速判断：
  改 MinerU / Paddle 接入细节时进这里。

### `src/storage_paths.rs` + `src/storage_paths/*`

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

### `src/db.rs` + `src/db/*`

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
  先看 `src/job_runner`

## 一张更直观的目录地图

当前建议按这条线理解后端：

1. `src/routes`
   HTTP 适配层，只做参数提取和响应封装。
2. `src/services/jobs/facade`
   jobs 用例总入口，route 只和 facade 说话。
3. `src/services/jobs/creation` / `src/services/jobs/presentation`
   前者负责创建与提交，后者负责 detail/list/events 对外投影。
4. `src/job_runner`
   运行态编排、子进程、OCR flow、translation/render flow。
5. `src/ocr_provider`
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

1. [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
   先知道有哪些 HTTP 入口。
2. [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
   再看 jobs 相关依赖是怎么装起来的。
3. [`src/routes/jobs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs)
   看 route 只是怎么转发。
4. [`src/services/jobs/facade`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade)
   看 command/query 用例入口。
5. [`src/services/jobs/creation`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)
   看创建链路的准备、快照、提交、bundle。
6. [`src/job_runner`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)
   最后再进 runtime 执行层。
