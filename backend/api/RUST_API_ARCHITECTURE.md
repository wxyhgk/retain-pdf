# Rust API Architecture

这份文档只回答一个问题：

**`rust_api` 现在的团队协作边界是什么，改哪里才是对的。**

不讲历史，不讲兼容迁移，默认只看当前主干代码。

相关文档：

- 文档总入口：
  [`README.md`](README.md)
- 目录地图：
  [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
- 当前运行主链：
  [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
- OCR provider 边界：
  [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
- stage 运行时契约：
  [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
- Rust 侧 artifact boundary：
  [`../../docs/core/rust_api/10-Rust 侧 Artifact Boundary.md`](../../docs/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
- 外部 API 协议：
  [`API_SPEC.md`](API_SPEC.md)

## 1. 总体分层

当前 `rust_api` 分成 6 层：

1. `app`
2. `routes`
3. `services` 中的 application 入口
4. `services` 中的内部实现
5. `job_runner`
6. `ocr_provider`

依赖方向必须保持单向：

```text
app -> routes -> application services -> internal services -> job_runner / ocr_provider
```

禁止反向依赖。

例如：

- `routes` 不应该知道 Python worker 命令怎么拼
- `job_runner` 不应该知道 HTTP Header 和 JSON envelope
- `ocr_provider` 不应该知道路由层返回结构

## 1.1 `AppState` 允许出现的位置

`AppState` 不是通用依赖注入容器，当前只允许停留在这些位置：

- `app/*`
  负责组装和持有全局资源
- `axum` route 入口函数
  也就是 `State(AppState)` 解包的那一层
- 少量边界层装配口
  用来把 `AppState` 压缩成更窄的 deps 结构
- 测试辅助代码

禁止直接把 `AppState` 往下传到：

- `services` 的业务实现主链
- `job_runner` 的运行时主链
- `ocr_provider`
- presentation / view 组装层

如果某个模块需要资源，正确做法是：

1. 在边界层从 `AppState` 取出需要的字段
2. 组装成显式 deps struct
3. 业务模块只接收这个更窄的 deps

当前已经固定的公共模式：

- `routes/common.rs`
  负责 route 侧公共轻量 deps builder、`request_base_url(...)` 和 `ok_json(...)`
  - `build_jobs_route_deps` → `JobsFacade`
  - `build_library_route_deps` → `LibraryDeps` + `JobsFacade`（馆藏发起翻译等 library→job 场景）
  - `build_glossary_route_deps` / `build_upload_route_deps` / `build_health_route_deps`
- `routes/download_response.rs` / `routes/download_response/**`
  负责文件下载、markdown、preview、cover、thumbnail 的 response boundary
- 服务商包 `retainpdf-providers` 的 `provider_api.rs`
  负责 provider 凭据探测的 application facade；route 只接触窄化后的
  `ProviderApiDeps` 和公开 DTO，不直接依赖 provider client / probe 实现
- 服务商包 `retainpdf-providers` 的 `provider_probe.rs` / `provider_probe/*`
  是包内部实现边界，按 `types / url_policy / ocr / deepseek` 分离；
  新 provider 不应把 URL 策略、HTTP 分类和公开 DTO 重新堆回单文件
- 平台包 `retainpdf-platform` 的 `fonts/api.rs` / `fonts/service.rs`
  分别负责字体 application facade 与内部扫描/持久化；`routes/fonts.rs`
  只保留有界 multipart 消费和 HTTP envelope，不执行 fontconfig 或文件业务
- 平台包 `retainpdf-platform` 的 `health_api.rs`
  负责 liveness/readiness 投影和 supervisor 状态聚合；公共 health route
  只做 HTTP 状态码映射，不直接读取数据库或 supervisor 全局状态
- `routes/common/response.rs`
  负责 JSON 响应的统一包装（`ok_json`，套 `ApiResponse` 信封）
- `app/jobs.rs::build_process_runtime_deps(...)`
  负责 runner 装配

其中 runner 侧规则已经固定为：

- `job_runner` 只暴露 `ProcessRuntimeDeps::new(...)`
- `AppState -> ProcessRuntimeDeps` 的装配责任留在 `app/*` 边界层
- `ProcessRuntimeDeps`
  只保留 orchestrator 级入口使用
- `JobPersistDeps`
  负责 `db + data_root + output_root` 这组持久化/事件资源；叶子 helper 优先拿它，不再顺手拿整包 runtime deps
  - `ocr_flow/bundle_events`、`render_flow_artifacts`、`translation_flow_artifacts`
    已固定为 persistence-only 边界；调用方传 `&deps.persist`。这些模块不能再接收
    `ProcessRuntimeDeps`、全局配置或执行控制资源；拆成子模块后规则仍然适用。
- `app/state.rs`
  只负责 `AppState` 组装；启动期遗留 running 任务恢复已经下沉到运行器包的 `job_runner/startup_recovery.rs`
- `job_runner/lifecycle.rs`
  只保留 runner 顶层编排；其中“queued 持久化/取消短路”和“按 workflow 分派执行”应继续保持为小 helper，而不是重新塞回一个大函数

不要再把 `AppState` 直接引进 `job_runner`。

禁止在每个 route 文件里重复手写一套局部 `route_deps(...)`。

## 1.2 内部契约 vs 对外契约

这条边界必须明确：

- `CreateJobInput` / `ResolvedJobSpec` / `JobSnapshot`
  是**内部运行契约**
- `JobDetailView` / `JobEventListView` / `TranslationDiagnosticsView`
  是**对外 API 契约**

内部契约允许持有真实 credential：

- `translation.api_key`
- `ocr.mineru_token`
- `ocr.paddle_token`

但这些字段只能存在于：

- 运行态内存
- SQLite job record
- worker env 注入
- stage spec 的 `credential_ref`

禁止直接进入：

- HTTP JSON response
- 对外 diagnostics / replay / debug payload
- events API payload

当前的安全适配层分两类：

1. `public_request_payload(...)`
   负责把内部 `ResolvedJobSpec` 投影成对外可返回的 request payload
2. `models/redaction.rs`
   负责对任意字符串 / JSON payload 做统一脱敏

团队协作规则：

- 如果新增一个对外 view，先决定它消费的是内部契约还是对外契约
- 任何从内部对象直接序列化到 HTTP 的改动，都默认视为错误
- 新增 secret 字段时，必须同步更新 redaction 模块，而不是在路由里局部打补丁

## 1.3 配置层边界

`../packages/retainpdf-core/src/config.rs` 是配置 facade，API crate 通过 `crate::config`
re-export 保持调用方兼容。真实配置分组在 `../packages/retainpdf-core/src/config/*`：

- `paths.rs`
  只处理 root/data/scripts/jobs/uploads/downloads 这类路径和 runtime 目录创建。
- `auth.rs`
  只处理 `auth.local.json`、API keys、并发数和 simple port。
- `server.rs`
  只处理 bind host、API port、Python binary。
- `upload.rs`
  只处理全局上传大小/页数限制。
- `provider.rs`
  只处理 MinerU / Paddle / DeepSeek provider runtime、HTTP timeout、retry 和 provider 上传门槛。
- `job_runner.rs`
  只处理队列轮询、worker terminate、AI failure diagnosis、同步等待这类 runner 运行参数。
- `env_vars.rs`
  只放 env 读取 helper。

新增部署可调参数时，先判断属于哪个子模块，不要继续把 env 解析写回 `config.rs`。`config.rs` 只负责：

1. `from_env()` 解析服务端环境来源
2. `from_desktop()` 解析桌面端来源
3. 通过内部 `AppConfigParts` 组装兼容的 `AppConfig`

不要把以下内容配置化：

- API path
- stage 名
- artifact key / artifact group
- schema version
- stdout label
- 对外 JSON 字段名

这些是协议常量，不是部署参数。把它们做成 env 会让前端、Python worker、测试和历史 job 解释同时失去稳定锚点。

## 1.4 架构门禁

这套边界不只靠文档约定，还靠硬性检查：

- 本地命令：
  `python3 backend/api/scripts/check_architecture.py`
- CI workflow：
  `.github/workflows/rust-api-architecture.yml`

当前门禁最少覆盖：

- `AppState` 不允许回流到 `services/job_runner/ocr_provider` 主链
- `routes` 不允许直接依赖 `job_runner`
- `routes` 不允许用 `crate::services::*` 全限定调用绕过 application facade allowlist
- `routes/jobs/*` 不允许重复定义局部 `route_deps(...)`
- 业务 route 不允许直接使用 Axum `Json` / `Query` / `Path` / `Multipart`
  输入 extractor；必须通过 `routes/common/extractors.rs` 的安全包装，
  确保 handler 前的 rejection 也返回统一 JSON 错误契约
- Multipart 文件和文本字段必须通过 `routes/common/extractors.rs` 的有界
  流式读取 helper 消费；禁止直接调用 `field.bytes()` / `field.text()`，避免
  在业务大小校验前先把整个字段分配到内存
- artifact / download 边界层不允许开始理解 provider raw 内部字段
- published markdown artifact 不允许重新从 `provider_raw_dir/full.md` 或 `provider_raw_dir/images` 反推

如果后续要调整白名单，必须同步改脚本和这份文档，不能只改其中一个。

## 1.4 Artifact Boundary

Rust 侧和产物直接相关的边界固定为四层：

1. `provider raw`
2. `normalized`
3. `published artifact`
4. `download API`

依赖和职责必须保持单向：

```text
provider raw -> normalized -> published artifact -> download API
```

每层的最小定义：

- `provider raw`
  provider 原始结果快照，只用于保真、回溯、排错、normalize 输入
- `normalized`
  OCR 到翻译/渲染的统一文档契约
- `published artifact`
  Rust 对任务文件的 artifact key 注册、发现和导出层
- `download API`
  最外层 HTTP 下载暴露层

Rust 侧关键落点：

- [../packages/retainpdf-core/src/storage_paths.rs](../packages/retainpdf-core/src/storage_paths.rs)
  facade；现在已拆成 `constants / job_paths / path_ops / resolvers / registry`
- [../packages/retainpdf-files/src/artifacts/mod.rs](../packages/retainpdf-files/src/artifacts/mod.rs)
  artifact facade（文件已拆成独立的包 `retainpdf-files`）；现在已拆成 `registry / bundle / response`
- [src/routes/download_response.rs](src/routes/download_response.rs)
  负责文件下载、markdown、preview、cover、thumbnail 的 HTTP 响应出口
- [src/routes/common/response.rs](src/routes/common/response.rs)
  负责 JSON 响应的统一包装（`ok_json`）

边界规则：

- `storage_paths.rs` 和文件包的 `src/artifacts/*`
  只处理文件、artifact key、稳定资源，不解释 provider raw 内部 JSON 结构
- `storage_paths::resolve_*` 只给出口模块调：任务的下载出口、原文 Markdown、书的文件、文件包的产物清单和派生产物。
  任务包、书库包内部要读已经落盘的产物，调任务包的
  [`stored_path(任务, data_root, StoredFile::…)`](../packages/retainpdf-jobs/src/files/downloads/stored.rs)，
  只说要哪个产物，不用知道存放规则（2026-10-17 起，`check_artifact_path_ownership` 管着；
  2026-10-19 起出口模块以外的字符串字面量里写 `ocr/normalized`、`document.v1.json` 这类产物存放位置也算自己拼）
- `db.rs`
  现在也只保留 `Db` facade；row decode 和 schema 检查分别下沉到
  `../../database/retainpdf-db/src/db/rows.rs`、`../../database/retainpdf-db/src/db/schema/`
- `routes/jobs/files.rs`
  只暴露稳定下载入口，不承诺 provider 私有字段语义
- `normalized-document` / `normalization-report`
  属于 normalized 边界，不属于 provider raw
- `provider_result_json` / `provider_raw_dir`
  属于 provider raw 边界，只能作为显式 artifact 下载，不是统一文档接口
- published markdown materialize
  必须保留 provider 返回的图片相对路径语义；允许增加页作用域前缀，但不允许把内部路径模式固定改写成自定义目录规则

快速判定：

- 如果一个改动要求下载层理解 `layoutParsingResults`、`prunedResult` 之类的 provider 字段名，说明边界已经穿透了
- 如果一个改动只是新增 artifact key、调整资源路径、调整稳定下载入口，通常应该落在 published artifact 或 download API 层

## 1.4 Published Markdown Artifact Boundary

这一条是最近重点收紧的边界：

- `provider_result_json`
- `provider_raw_dir`

属于 provider raw。

- `ocr/normalized/document.v1.json`

属于 normalize 后的统一契约。

- `md/full.md`
- `md/images/`
- `markdown_bundle_zip`

属于已经发布出来的 job artifact。

规则：

1. `provider_raw_dir` 可以保留 provider 原始回包和调试材料。
2. `provider_raw_dir` 不能被当成 published markdown artifact 的回退来源。
3. `resolve_markdown_path()` / `resolve_markdown_images_dir()` 这类对外资源解析函数，只能解析 `job_root/md/*` 这类已发布路径。
4. 如果某个 provider 将来要暴露 Markdown，应该显式新增一个 publish/materialize 步骤，而不是让下载层或 storage path 层去猜 provider raw 布局。

补充约束：

- publish/materialize 可以做“防冲突包装”，例如多页任务下给图片路径增加 `page-N/`
- markdown 内图片路径必须指向已发布目录 `md/images/`
- 但不能重写 provider 返回的内部相对路径结构
- 例如 Paddle 返回 `<img src="imgs/foo.jpg">` 时，发布后可以是 `images/page-6/imgs/foo.jpg`
- 不能变成我们自定义拍板的固定模式，比如 `assets/foo.jpg` 或其他仓库私有命名

这样做的原因很简单：

- provider raw 变化频繁
- published artifact 是外部稳定下载口径
- 两层一旦混在一起，`markdown_ready` 就会失真，下载接口也会和 provider 私有结构耦合

## 2. 模块职责

### 2.1 `app/`

文件：

- [src/app/mod.rs](src/app/mod.rs)
- [src/app/state.rs](src/app/state.rs)
- [src/app/router.rs](src/app/router.rs)
- [src/app/endpoints.rs](src/app/endpoints.rs)（接口登记表的定义；路由都登记在 `app/router/**` 的表里）
- [src/app/server.rs](src/app/server.rs)

职责：

- 组装 `AppState`
- 启动 HTTP server
- 挂载路由
- 启动时恢复遗留 running job

不该做的事：

- 不写业务校验
- 不拼 job view
- 不决定 worker workflow

### 2.2 `routes/`

目录：

- [src/routes](src/routes)

职责：

- HTTP 请求解析
- Header / Query / Multipart 提取
- 把请求转给 service
- 返回统一 JSON / file response

不该做的事：

- 不直接访问 SQLite 细节
- 不自己读 artifacts 文件
- 不自己拼 Python 命令

当前路由已经统一收口到 application facade：

- jobs → [packages/retainpdf-jobs/src/facade.rs](../packages/retainpdf-jobs/src/facade.rs)
- library → [packages/retainpdf-library/src/api.rs](../packages/retainpdf-library/src/api.rs)
- glossaries → [../packages/retainpdf-glossaries/src/api.rs](../packages/retainpdf-glossaries/src/api.rs)
  → `retainpdf-glossaries` 包里的 `{records,entries,csv}.rs`
- uploads → [../packages/retainpdf-ingest/src/uploads/api.rs](../packages/retainpdf-ingest/src/uploads/api.rs)（入口已拆成独立的包 `retainpdf-ingest`）

（AI 代理、Agent 文档操作、运行时会话这些入口 2026-11-03 跟 RetainPDF 自己的 AI 服务一起删了，产品里只留 Studio 的 AI。）

也就是：

- `routes/jobs/*` 只通过 response boundary 调 `JobsFacade`
- `routes/library.rs` / `library_data.rs` / `collections.rs`
  只调书库包 `retainpdf-library` 的 `src/api.rs`（经 `build_library_route_deps`）
- `routes/common.rs`
  作为稳定导出入口；`routes/common/**` 按领域保留 deps builder、
  base URL、统一 HTTP envelope 和安全输入 extractor
- `routes/download_response/**`
  只保留文件响应出口
- `routes/common/response.rs`
  只保留 JSON 响应包装（`ok_json`）
- `routes/glossaries.rs`
  只调术语表包（`retainpdf-glossaries`）的门面
- `routes/uploads.rs`
  只调入口包（`retainpdf-ingest`）的门面

**Library route 文件分工（HTTP 边界，业务不进 route）：**

| Route 文件 | HTTP 面 |
|------------|---------|
| `library.rs` | books 列表/详情/删除、book cover/thumbnail |
| `library_data.rs` | documents CRUD/media/translate、favorites、search |
| `collections.rs` | 合集 CRUD 与文档成员 |

快速判断：

- 要改 HTTP 入参/出参，先看 `routes/*`
- 要改用例编排，先看 application service
- 要改 provider / worker / stage 行为，不要先从 route 下手

### 2.3 `services/` 中的 application 入口

目录：

- [src/services](src/services)（只剩 `mod.rs`，把 8 个领域包接成 `crate::services::<领域>`；代码在 `../packages/retainpdf-<领域>/src`）

职责：

- 给 route 提供稳定调用入口
- 负责用例编排和返回对外 view
- 屏蔽 `db/config/data_root/storage` 等资源拼装细节

当前已经成型的 application 入口：

- [packages/retainpdf-jobs/src/facade.rs](../packages/retainpdf-jobs/src/facade.rs)
- [packages/retainpdf-library/src/api.rs](../packages/retainpdf-library/src/api.rs)
- [../packages/retainpdf-glossaries/src/api.rs](../packages/retainpdf-glossaries/src/api.rs)
- [../packages/retainpdf-ingest/src/uploads/api.rs](../packages/retainpdf-ingest/src/uploads/api.rs)

词汇表应用入口使用 `GlossaryApiDeps` 隐藏 `Db`，HTTP route 只能持有该窄依赖；
内部实现按职责拆为 `records.rs`（持久化 CRUD）、`entries.rs`（任务合并与规范化）
和 `csv.rs`（导入解析），避免路由、存储与文本解析再次聚回单文件。

规则：

- route 优先只依赖这些入口
- 不要让 route 直接再去拼 `db + config + helper + artifact service`
- application service 内部如果继续长大，优先拆 facade 子模块或 deps 子结构，不要再回退成一个总入口文件加一个总 deps
- library 域的请求、返回类型（文档列表、检索、文件夹、书架）在书库包 `src/views.rs`；
  库里存的记录（`DocumentRecord` 等）留在核心包，`db/*` 要用。route 照旧经 rust_api 的
  `models::api`（`src/models.rs`）导入，不用知道类型在哪个包

#### 书库包 `retainpdf-library`（`api.rs` + 其余模块）

模块化单体下的 Library 域（**不是**微服务拆分）：

```text
routes/library*.rs, collections.rs
  → library/api.rs (view 级 API)
      → library 包内部模块
           books | documents | media | translate
           favorites | search | assets | collections
      → JobsFacade   (仅 translate-from-library 创建 job)
      → derived_artifacts (仅 media 内部使用 cover/thumbnail)
```

- [packages/retainpdf-library/src/api.rs](../packages/retainpdf-library/src/api.rs)
  route 唯一允许的 library service import
- [packages/retainpdf-library/src/](../packages/retainpdf-library/src)
  内部实现；`LibraryDeps` 持有 `db + data_root + output_root + downloads_dir + scripts_dir + python_bin`
- 从馆藏发起翻译：`library/translate.rs` 绑定文档 upload 后只调用
  `JobsFacade::create_submission`，不绕过 job 创建管线；传入
  `source.artifact_job_id` 时由 `ocr_artifact_reuse.rs` 验证文档归属、
  成功 OCR 阶段、必需产物、provider 兼容性和页码覆盖，失败不会
  静默退回重新 OCR
- 文件流式响应仍在 route：`stream_file` / download response；service 只返回路径或字节

其他跨域正确性边界：

- live translation 由 `services/jobs/progress/live_translation.rs` 从已提交的
  `pipeline_units` 选择 immutable checkpoint；SSE 只是刷新提示，route
  不能直接把 worker 可变文件当权威译文；多页 flush 通过
  `pipeline_checkpoint_v1.committed_pages` 在一个 SQLite transaction 和
  authority generation 内整批提交，任一页无效时不得部分可见
- 统一错误形状由 `AppError` 与安全 extractor 边界生成；route 不得
  回显 Serde/Axum 解析细节、secret、签名 URL 或绝对文件路径

### 2.4 `services/` 中的内部实现

当前关键分工：

- [packages/retainpdf-jobs/src/lifecycle/snapshot_factory.rs](../packages/retainpdf-jobs/src/lifecycle/snapshot_factory.rs)
  负责 job snapshot / command 组装
- [packages/retainpdf-jobs/src/lifecycle/launcher.rs](../packages/retainpdf-jobs/src/lifecycle/launcher.rs)
  负责 job 持久化与执行启动
- [packages/retainpdf-jobs/src/runtime_gateway.rs](../packages/retainpdf-jobs/src/runtime_gateway.rs)
  负责 services 侧 runtime 能力收口
- [packages/retainpdf-jobs/src](../packages/retainpdf-jobs/src)
  负责 jobs 相关业务
- [packages/retainpdf-library/src](../packages/retainpdf-library/src)
  负责图书馆域业务（见 2.3）
- [../packages/retainpdf-files/src/artifacts/presentation.rs](../packages/retainpdf-files/src/artifacts/presentation.rs)
  只将 `ArtifactLinksView` 转为公共产物展示数据，通过文件包门面（`services::files`）的
  导出供任务投影用；不读取 DB、任务状态或文件系统，也不能回调任务、书库这些业务模块。
  （书架投影 `book_projection` 2026-10-22 跟 `/library/books` 一起删了。）
- [../packages/retainpdf-files/src/derived_artifacts](../packages/retainpdf-files/src/derived_artifacts)
  负责 cover/thumbnail/page preview 等派生产物（由 library media / jobs downloads 调用，**不**被 route 直连）

下面凡是 `services/<领域>/...` 都是**逻辑路径**：8 个领域都是独立的包，真实代码在
`backend/packages/retainpdf-<领域>/src/...`（`services/mod.rs` 只负责把包接成 `crate::services::<领域>`）。

其中 `services/jobs` 和 `routes/jobs/`、`app/router/jobs/` 一样按 8 类分目录（2026-10-16 定的 9 类，2026-11-03 删了 `ai/`；
见 `docs/ops/planning/api-reorg/20261016-任务接口分类实现记录.md`）：

| 目录 | 类 | 主要内容 |
|---|---|---|
| `lifecycle/` | 任务 | `creation/`（唯一入口 `submit_job`）、`validation`、`snapshot_factory`、`launcher`、列表和详情、`/jobs` 等提交入口 |
| `actions/` | 操作 | 取消、整个重跑、重试阶段、续跑计划、阶段计划、OCR 歧义处理 |
| `progress/` | 进度 | `event_feed/`、`live_stage`、`live_translation`、`stage_view` |
| `files/` | 文件 | `downloads/`（唯一下载入口 `JobDownloads::open`）、文件列表、是否就绪 |
| `reports/` | 报告 | 失败原因、翻译诊断和质检、排版缩放、精修报告 |
| `reader/` | 阅读 | `reader_regions/`、原文 Markdown |
| `translations/` | 译文 | 逐条看、人工改、修改历史、重翻一条 |
| `data/` | 数据 | 按登记表通用取数 |

根目录只放各类共用的：`facade.rs`、`deps/`、`presentation/`、`query.rs`、`runtime_gateway.rs`、
`summary_loaders/`、`support.rs`。

#### `services/jobs/facade.rs`

文件：

- [packages/retainpdf-jobs/src/facade.rs](../packages/retainpdf-jobs/src/facade.rs)

职责：

- 给路由层提供统一入口 `JobsFacade`
- 屏蔽 `db/config/data_root` 等底层细节
- `facade.rs` 只放结构体；各个 use case 的 `impl JobsFacade` 写在所属类的目录里
  （例如 `lifecycle/submission.rs`、`actions/rerun.rs`、`translations/edits.rs`）
- 只读查询的入口是 `query.rs` 的 `JobQueries`，各类的查询方法写在各自目录的 `queries.rs`
- 命令侧和查询侧依赖分离，避免一个总 deps 同时拖着 create/query/debug/download 一起膨胀

规则：

- 新增 job 路由能力，先判断属于 8 类中的哪一类，加到那一类的目录里，再由 route 调用
- 需要创建 / 取消类资源，优先放进 `CommandJobsDeps`
- 需要查询 / 下载 / debug 类资源，优先放进 `QueryJobsDeps`

#### `services/jobs/lifecycle/creation`

目录：

- [packages/retainpdf-jobs/src/lifecycle/creation](../packages/retainpdf-jobs/src/lifecycle/creation)

职责：

- `submit.rs`
  建新任务的唯一入口 `submit_job`，和原地重跑已有任务的 `relaunch_in_place`
- `job_builders.rs`
  只负责把输入解析成 `JobSnapshot`
- `prepare.rs`
  按 workflow 校验输入、找上传、检查能否复用已有 OCR 产物
- `ocr_credentials.rs`
  明文 key 导入凭据库、加使用锁
- `dev_defaults.rs`
  开发栈的默认值

规则：

- 别处要建新任务，调 `submit_job`；`check_architecture.py` 的 `check_job_entry_ownership` 会拦
- 不要在 facade 或 route 里重新拼 upload 存储细节

#### `services/jobs/presentation`

目录：

- [packages/retainpdf-jobs/src/presentation](../packages/retainpdf-jobs/src/presentation)

职责：

- `views.rs`
  负责 API view 组装
- `mod.rs`
  负责 presentation 对外边界

从 manifest / report / summary 文件读取摘要信息的是任务包根目录的 `summary_loaders/`（各类共用，不在
`presentation/` 里）。

规则：

- 改 JSON 返回结构，优先改 `views.rs`
- 改从磁盘补充的摘要字段，优先改 `summary_loaders/`
- 不要把文件读取逻辑重新塞回 view 组装函数

### 2.5 `job_runner/`

目录：

- [../packages/retainpdf-runner/src/job_runner](../packages/retainpdf-runner/src/job_runner)

职责：

- job 运行时调度
- Python worker 启动
- stdout/stderr 解析
- 取消、超时、失败归因
- OCR child job / translate / render 的运行链路

当前拆分：

- `lifecycle`
  任务排队、取执行槽、按 workflow 分发
- `cancel_registry`
  取消请求注册表
- `execution_queue`
  并发槽位等待
- `worker_command`
  stage command / stage spec / worker 入口命令统一工厂；这是 `services` 和 `job_runner` 共同依赖的中性契约层
- `worker_process`
  进程启动、环境注入、进程树终止
- `process_runner`
  真实 worker 执行 orchestrator
- `process_runner/completion.rs`
  cancel / success / shutdown noise / failed 的完成态归类与回填
- `process_runner/timeout_support.rs`
  timeout 文案和 timeout failure 落态
- `process_runner/failure_ai_diagnosis.rs`
  失败 AI 诊断 request/response 与 event 记录
- `process_runner/io_support.rs`
  stdout/stderr 消费与 cancel 期间的流读取策略；这里只再拿 `JobPersistDeps + canceled_jobs`
- `runtime_state`
  运行态 snapshot 变更
- `translation_flow`
  translate / book 相关 orchestrator；只负责串 OCR child -> translate -> optional render
- `translation_flow_child.rs`
  upload source 读取、父任务进入 `ocr_submitting`、OCR child 构造与 `ocr_child_created` 事件
- `translation_flow_stage.rs`
  translate stage command 准备、`ocr_child_finished` 事件、translate 后 render stage 准备
- `translation_flow_support.rs`
  OCR 终态判定、translate 输入提取这类纯规则辅助
- `render_flow`
  render-only 链路
- `ocr_flow`
  OCR provider 运行链路
- `ocr_flow/support.rs`
  OCR job 保存、parent OCR 状态镜像、transport/source-pdf 失败处理、`sync_parent_with_ocr_child(...)`
- `ocr_flow/workspace.rs`
  只负责 OCR workspace 路径与目录准备；现在只拿 `output_root`
- `ocr_flow/polling.rs`
  只负责轮询等待与 cancel 检查；`should_stop_polling(...)` 现在只拿 cancel handle
- `stdout_parser`
  stdout 解析 facade
- `stdout_parser/labels.rs` / `state.rs` / `stage_rules.rs` / `artifact_rules.rs` / `failure.rs`
  stdout 行标签、共享解析状态、stage/artifact/failure 规则

#### `worker_command`

目录：

- [../packages/retainpdf-data/src/worker_command](../packages/retainpdf-data/src/worker_command)

职责：

- `stage_specs.rs`
  写 `provider/normalize/translate/render` 的 spec 文件
- `entrypoints.rs`
  选 Python 脚本入口，拼入口参数
- `command_builder.rs`
  只做命令行构建细节
- [../packages/retainpdf-data/src/worker_command.rs](../packages/retainpdf-data/src/worker_command.rs)
  只保留对外 `build_*` facade

规则：

- 改 spec 字段，改 `stage_specs.rs`
- 改 worker 入口脚本，改 `entrypoints.rs`
- 不要在 facade 层重新写 JSON

#### `job_runner/process_runner`

文件：

- [../packages/retainpdf-runner/src/job_runner/process_runner.rs](../packages/retainpdf-runner/src/job_runner/process_runner.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/startup.rs](../packages/retainpdf-runner/src/job_runner/process_runner/startup.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/execution.rs](../packages/retainpdf-runner/src/job_runner/process_runner/execution.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/completion.rs](../packages/retainpdf-runner/src/job_runner/process_runner/completion.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/timeout_support.rs](../packages/retainpdf-runner/src/job_runner/process_runner/timeout_support.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/failure_ai_diagnosis.rs](../packages/retainpdf-runner/src/job_runner/process_runner/failure_ai_diagnosis.rs)
- [../packages/retainpdf-runner/src/job_runner/process_runner/io_support.rs](../packages/retainpdf-runner/src/job_runner/process_runner/io_support.rs)

职责：

- `process_runner.rs`
  只保留 worker 执行 orchestrator
- `startup.rs`
  处理 worker 启动、pid 持久化和启动后取消短路；只拿 `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`
- `execution.rs`
  处理 stdout/stderr task、进程等待和 timeout 分流；只拿 `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`
- `completion.rs`
  处理 timeout 之外的完成态归类、shutdown noise 成功判定、failure 回填
- `timeout_support.rs`
  处理 timeout 失败落态；只拿 `JobPersistDeps + project_root`
- `failure_ai_diagnosis.rs`
  处理 AI 辅助失败诊断
- `io_support.rs`
  处理 stdout/stderr 消费和 cancel 特判；叶子 helper 不再拿整包 `ProcessRuntimeDeps`

规则：

- 不在这里写新的命令构建逻辑
- 不在这里维护取消注册表
- 不在这里决定执行槽策略
- `execute_process_job(...)`
  可以保留整包 `ProcessRuntimeDeps`，但下传到叶子 helper 前必须转换成 `persist`、cancel handle 或窄 config projection
- `spawn_worker_process(...)` / `spawn_started_process(...)` / `collect_process_execution(...)` / `read_stdout(...)`
  这类叶子 helper 应只拿自己真正需要的 config / persist / cancel 依赖

#### `job_runner` Stop Line

最后一轮去耦合做到这里就应该停止：

- orchestrator 级入口继续拿 `ProcessRuntimeDeps`
- 叶子 helper 改拿 `JobPersistDeps`、`&Db`、窄 config projection 或 cancel handle
- 不再继续把 orchestrator 再拆成更多跨文件小函数
- 不再为了少传 1-2 个字段继续引入 trait / wrapper / facade

#### `job_runner/translation_flow_*`

文件：

- [../packages/retainpdf-runner/src/job_runner/translation_flow.rs](../packages/retainpdf-runner/src/job_runner/translation_flow.rs)
- [../packages/retainpdf-runner/src/job_runner/translation_flow_child.rs](../packages/retainpdf-runner/src/job_runner/translation_flow_child.rs)
- [../packages/retainpdf-runner/src/job_runner/translation_flow_stage.rs](../packages/retainpdf-runner/src/job_runner/translation_flow_stage.rs)
- [../packages/retainpdf-runner/src/job_runner/translation_flow_support.rs](../packages/retainpdf-runner/src/job_runner/translation_flow_support.rs)

职责：

- `translation_flow.rs`
  只保留 parent translation job 的 orchestrator。
- `translation_flow_child.rs`
  负责 upload source 读取、parent 进入 `ocr_submitting`、OCR child job 创建与 `ocr_child_created` 事件。
- `translation_flow_stage.rs`
  负责 OCR child 结束事件、translate stage command 准备、translate 后 render stage 准备。
- `translation_flow_support.rs`
  负责 `finalize_parent_after_ocr(...)`、`translation_inputs_from_artifacts(...)` 这类纯规则辅助。

规则：

- 不在 orchestrator 里重复堆 OCR child 构造细节
- 不在 support helper 里做持久化入口选择
- translate/render 的 command 改写统一收口在 stage helper

#### `job_runner/ocr_flow/*`

文件：

- [../packages/retainpdf-runner/src/job_runner/ocr_flow/mod.rs](../packages/retainpdf-runner/src/job_runner/ocr_flow/mod.rs)
- [../packages/retainpdf-runner/src/job_runner/ocr_flow/support.rs](../packages/retainpdf-runner/src/job_runner/ocr_flow/support.rs)
- 以及 `transport / polling / mineru / paddle / artifacts / provider_result / workspace / markdown_bundle / bundle_download / status / page_subset / mineru_retry / mineru_polling / paddle_markdown`

职责：

- `ocr_flow/mod.rs`
  只保留 OCR orchestrator，串 transport -> normalize -> process runner。
- `ocr_flow/support.rs`
  负责 OCR job 保存、parent OCR 状态镜像、transport/source-pdf 失败处理、`sync_parent_with_ocr_child(...)`。
- 其他子文件
  分别处理 provider transport、轮询、下载、raw 结果落位、markdown materialize、workspace 和状态回填。

#### `job_runner/stdout_parser/*`

文件：

- [../packages/retainpdf-runner/src/job_runner/stdout_parser/mod.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/mod.rs)
- [../packages/retainpdf-runner/src/job_runner/stdout_parser/labels.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/labels.rs)
- [../packages/retainpdf-runner/src/job_runner/stdout_parser/state.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/state.rs)
- [../packages/retainpdf-runner/src/job_runner/stdout_parser/stage_rules.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/stage_rules.rs)
- [../packages/retainpdf-runner/src/job_runner/stdout_parser/artifact_rules.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/artifact_rules.rs)
- [../packages/retainpdf-runner/src/job_runner/stdout_parser/failure.rs](../packages/retainpdf-runner/src/job_runner/stdout_parser/failure.rs)

职责：

- `mod.rs`
  facade；按行调用 artifact/stage 规则。
- `labels.rs`
  stdout contract 标签常量。
- `state.rs`
  artifact/provider diagnostics 共享解析状态。
- `stage_rules.rs`
  stage/progress 相关规则。
- `artifact_rules.rs`
  artifact/metric 相关规则。
- `failure.rs`
  provider failure 归因与 detail 提取。

### 2.5 `ocr_provider/`

目录：

- [../packages/retainpdf-data/src/ocr_provider](../packages/retainpdf-data/src/ocr_provider)

职责：

- Provider transport 抽象
- MinerU / Paddle 的客户端、状态映射、错误归类

规则：

- 这里只处理 provider 通信和 provider 语义
- 不处理翻译、渲染、HTTP 返回结构

## 3. 当前主调用链

主链：

1. `POST /api/v1/jobs`
2. `routes/jobs/lifecycle.rs`
3. `services/jobs/facade.rs`、`services/jobs/lifecycle/submission.rs`
4. `services/jobs/lifecycle/creation/submit.rs`（`submit_job`）
5. `services/jobs/lifecycle/snapshot_factory.rs`
6. `services/jobs/lifecycle/launcher.rs`
7. `job_runner/lifecycle.rs`
8. `worker_command.rs`
9. `job_runner/process_runner.rs`
10. Python worker

也就是：

- route 只进 facade
- facade 只进 service
- service 只进 runner

## 4. 团队协作红线

下面这些是硬约束：

### 红线 1

`routes/*` 不直接读：

- `Db`
- `job_paths`
- manifest/report JSON 文件
- Python worker 命令细节

### 红线 2

`job_runner/*` 不依赖：

- `axum`
- `HeaderMap`
- HTTP response model

### 红线 3

`ocr_provider/*` 不做：

- job view 组装
- 翻译策略
- 渲染策略

### 红线 4

如果一个改动同时要碰：

- route
- service
- runner

先停一下，先问是不是边界放错了。

### 红线 5

新增文件读取摘要逻辑，优先放：

- `services/jobs/summary_loaders/`（任务包根目录）

不要散落到：

- route
- facade
- `views.rs`

## 5. 改动指南

### 场景 1：新增一个 jobs 查询接口

改动顺序：

1. 先定属于 8 类中的哪一类，`app/router/jobs/<类>.rs` 和 `routes/jobs/<类>.rs`
2. `services/jobs/<类>/queries.rs`（`JobQueries` 的方法）
3. 需要组装返回视图时改 `services/jobs/presentation/*`

不要直接从 route 跨过 facade 去摸底层。

### 场景 2：新增一个 worker stage spec 字段

改动顺序：

1. `worker_command/stage_specs.rs`
2. Python `stage_specs` loader
3. 对应 worker 消费逻辑

不要在 route/service 层补临时参数。

### 场景 3：新增一个 provider

改动顺序：

1. `ocr_provider/<provider>/`
2. `job_runner/ocr_flow/*`
3. Python provider pipeline

不要把 provider 判断散落到 route 或 facade。

### 场景 4：调整 job detail 返回字段

改动顺序：

1. `services/jobs/presentation/views.rs`
2. 如果字段来自磁盘摘要，再改 `summary_loaders/`

## 6. 当前建议

如果后面继续重构，优先级建议是：

1. 给 `services/jobs` 增加更明确的 request/response DTO 边界
2. 给 `job_runner` 增加 stage execution contract 文档
3. 给 `ocr_provider` 定统一 trait / capability contract

但当前这一版已经足够支撑多人并行开发，前提是遵守上面的依赖方向和红线。

相关补充文档：

- [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
- [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
