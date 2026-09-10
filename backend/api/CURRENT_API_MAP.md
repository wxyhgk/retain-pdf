# Current API Map

这份文档只回答一个问题：

**现在这套 Rust API + Python worker，到底是怎么跑起来的。**

不讲历史，不展开兼容细节，优先看当前正式主链。

## 快速导航

- 文档总入口：
  [`README.md`](README.md)
- 只看当前运行主链：
  [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
- 只看 Rust 模块边界：
  [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
- 只看 OCR provider 边界：
  [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
- 只看 stage 运行时契约：
  [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
- 只看外部 API 协议：
  [`API_SPEC.md`](API_SPEC.md)
- 只看渲染参数规范：
  [`RENDER_OPTIONS_CONTRACT.md`](RENDER_OPTIONS_CONTRACT.md)

## 1. 当前系统分层

现在后端分两层：

### Rust 层

职责：

- 对外 HTTP API
- 鉴权
- job 创建 / 排队 / 状态机
- SQLite 持久化
- artifact / event 查询
- 启动 Python worker

代码主入口：

- [`src/routes/jobs/mod.rs`](src/routes/jobs/mod.rs)
- [`src/services/jobs/*`](src/services/jobs)
- [`../packages/retain-jobs/src/job_runner/*`](../packages/retain-jobs/src/job_runner)

### Python 层

职责：

- OCR provider 调用
- raw OCR -> normalized `document.v1.json`
- 翻译
- 渲染
- PDF merge / post-process

代码主入口（`retainpdf-pipeline` console-mode 为主）：

- `retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json`
- `retainpdf-pipeline provider-ocr --spec <job_root>/specs/provider.spec.json`
- `retainpdf-pipeline normalize-ocr --spec <job_root>/specs/normalize.spec.json`
- `retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json`
- `retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json`

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python services/pipeline/entrypoints/run_*.py --spec <job_root>/specs/<stage>.spec.json。

## 2. 当前正式 workflow

现在真正对外可认为稳定的 workflow 只有这几个：

- `book`
  含义：provider-backed 全流程
  链路：OCR -> Normalize -> Translate -> Render

- `translate`
  含义：OCR -> Normalize -> Translate
  不做 render

- `render`
  含义：复用已有翻译产物，只做 render

- `ocr`
  含义：OCR-only / provider-only 子流程

注意：

- `book` 是现在完整主链路的正式 API 标识
- **不是** `mineru`
- OCR provider 选择不靠 workflow，而靠 `ocr.provider`

## 3. 当前 provider 选择方式

当前 provider 分发口径：

- `workflow = book`
- `ocr.provider = mineru | paddle | local | <configured local_command provider>`

也就是：

- `workflow` 决定跑哪条大流程
- `ocr.provider` 决定 OCR 用哪个 provider
- `GET /api/v1/providers/ocr` 是前端和外部集成方发现 provider credential/options/capabilities 的入口
- provider-specific 非密钥参数统一放在 `ocr.options`；multipart helper 使用 JSON 字符串字段 `ocr_options`
- Paddle 默认 transport 仍是 `ocr.options.transport=official_http`；可选 `official_cli` 只允许 `workflow=ocr` 的 Markdown/粗粒度提取，不进入依赖 `bbox`/`prunedResult` 的翻译和渲染链

关键代码：

- Rust 写 spec：
  - [`../packages/retain-data/src/worker_command.rs`](../packages/retain-data/src/worker_command.rs)
- Python 按 provider 分发：
  - [`services/pipeline/retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py`](../pipeline/retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py)

注意：生产主链的 `book` job 不再以 `retainpdf-pipeline provider-case` 作为初始命令。`book` job 创建时只保存
`book-workflow-rust-orchestrated` 占位命令，真正执行由 Rust `job_runner` 串联 OCR child、normalize、
translate、render stage。

## 4. 当前正式协议：Stage Spec

Rust 和 Python worker 之间的正式协议已经不是长 CLI 参数，而是：

```bash
retainpdf-pipeline <subcommand> --spec <job_root>/specs/<stage>.spec.json
```

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python services/pipeline/entrypoints/run_*.py --spec <job_root>/specs/<stage>.spec.json。

当前正式 stage：

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`

legacy/local helper stage：

- `provider.stage.v1`
- `book.stage.v1`

对应 Python loader：

- [`services/pipeline/retainpdf_pipeline/foundation/shared/stage_specs.py`](../pipeline/retainpdf_pipeline/foundation/shared/stage_specs.py)

## 5. Rust 到 Python 的真实执行链

以最重要的 `book` 为例：

### 第一步：前端 / 调用方发请求

典型入口：

- `POST /api/v1/jobs`

Rust 路由：

- [`src/routes/jobs/create.rs`](src/routes/jobs/create.rs)
- [`src/services/jobs/facade/mod.rs`](src/services/jobs/facade/mod.rs)

### 第二步：Rust 创建 job

负责：

- 校验请求
- 生成 job snapshot
- 持久化到 DB
- 进入队列

主要代码：

- [`src/services/jobs/creation`](src/services/jobs/creation)
- [`src/services/job_snapshot_factory.rs`](src/services/job_snapshot_factory.rs)
- [`src/services/job_launcher.rs`](src/services/job_launcher.rs)

注意：

- route 层现在尽量只做 HTTP 适配
- `jobs` 相关用例已经统一先经过 `JobsFacade`
- `uploads` / `glossaries` 也分别经过 `uploads::api` / `glossaries::api`

### 第三步：Rust 组装 workflow plan

Rust 根据 workflow 选择运行计划：

- `book` -> Rust 编排 `OCR child -> normalize -> translate -> render`
- `translate` -> Rust 编排 `OCR child -> normalize -> translate`
- `render` -> Rust 复用 artifact 后启动 `render`
- `ocr` -> Rust 编排 `provider transport -> normalize`

主要代码：

- [`../packages/retain-jobs/src/job_runner/lifecycle.rs`](../packages/retain-jobs/src/job_runner/lifecycle.rs)
- [`../packages/retain-jobs/src/job_runner/translation_flow.rs`](../packages/retain-jobs/src/job_runner/translation_flow.rs)
- [`../packages/retain-jobs/src/job_runner/ocr_flow/mod.rs`](../packages/retain-jobs/src/job_runner/ocr_flow/mod.rs)
- [`../packages/retain-jobs/src/job_runner/render_flow.rs`](../packages/retain-jobs/src/job_runner/render_flow.rs)

### 第四步：Rust 按 stage 写 spec 并启动 worker

`book` 主链会按阶段写：

- OCR child/provider transport：Rust 内部 provider transport，不通过 `provider.stage.v1`
- `DATA_ROOT/jobs/<job_id>/specs/normalize.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/translate.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/render.spec.json`

`provider.spec.json` / `provider.stage.v1` 用于 OCR-only provider worker 和 legacy provider-case/local helper。
当前 `book` orchestrator 仍然走 Rust 内部 OCR child transport，再进入 normalize/translate/render stage。

渲染策略也在 `render` 中集中配置。当前默认：

- `render.source_cleanup_strategy = "pikepdf_text_strip"`
- 含义：默认先用 pikepdf 按 bbox 删除原 PDF content-stream text-op，再由 Typst 翻译块自带背景色做视觉覆盖
- 可选值：`typst_fill | pikepdf_text_strip | bbox_text_strip | legacy | redact_restore_formulas`
- `pikepdf_text_strip` 表示渲染前用 pikepdf 做路径级 content-stream text-op 删除，再由 Typst 背景块做视觉覆盖；`bbox_text_strip`、`legacy`、`redact_restore_formulas` 当前都是兼容别名，行为等同 `pikepdf_text_strip`

### 第五步：job_runner 进入运行时主链

当前真实入口：

- [`src/app/jobs.rs`](src/app/jobs.rs)
  把 `AppState` 压缩成 `ProcessRuntimeDeps`
- [`../packages/retain-jobs/src/job_runner/lifecycle.rs`](../packages/retain-jobs/src/job_runner/lifecycle.rs)
  负责 queued、执行槽位、workflow 分发

### 第六步：Rust 启动 Python worker

这里会把必要 env 注入进去：

- `RETAIN_TRANSLATION_API_KEY`
- `RETAIN_MINERU_API_TOKEN`
- `RETAIN_PADDLE_API_TOKEN`

主要代码：

- [`../packages/retain-jobs/src/job_runner/process_runner.rs`](../packages/retain-jobs/src/job_runner/process_runner.rs)
- [`../packages/retain-jobs/src/job_runner/process_runner/startup.rs`](../packages/retain-jobs/src/job_runner/process_runner/startup.rs)
- [`../packages/retain-jobs/src/job_runner/process_runner/execution.rs`](../packages/retain-jobs/src/job_runner/process_runner/execution.rs)
- [`../packages/retain-jobs/src/job_runner/worker_process.rs`](../packages/retain-jobs/src/job_runner/worker_process.rs)

### 第七步：Python stage worker 执行

当前生产主链使用这些 stage worker：

- `retainpdf-pipeline normalize-ocr --spec specs/normalize.spec.json`
- `retainpdf-pipeline translate-only --spec specs/translate.spec.json`
- `retainpdf-pipeline render-only --spec specs/render.spec.json`

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python services/pipeline/entrypoints/run_*.py --spec <job_root>/specs/<stage>.spec.json；两种启动方式
消费同一份 stage spec，产物校验不依赖物理脚本路径。

`retainpdf-pipeline provider-case` 仍保留 legacy/local wrapper 用于本地一次性验证 provider-backed 全流程（`run_provider_case.py` 仅桌面兼容）；不要把它当成
Rust API 生产主链入口。

## 6. 当前最重要的产物目录

每个 job 的标准目录：

- `DATA_ROOT/jobs/<job_id>/source`
- `DATA_ROOT/jobs/<job_id>/ocr`
- `DATA_ROOT/jobs/<job_id>/translated`
- `DATA_ROOT/jobs/<job_id>/rendered`
- `DATA_ROOT/jobs/<job_id>/artifacts`
- `DATA_ROOT/jobs/<job_id>/logs`
- `DATA_ROOT/jobs/<job_id>/specs`

最重要的几个文件：

- `specs/normalize.spec.json`
- `specs/translate.spec.json`
- `specs/render.spec.json`
- `ocr/result.json`
- `ocr/normalized/document.v1.json`
- `ocr/normalized/document.v1.report.json`
- `translated/translation-manifest.json`
- `artifacts/render_config.json`
- `artifacts/pipeline_summary.json`
- `rendered/*.pdf`

## 7. 当前最重要的数据契约

现在 translation / rendering 主链真正依赖的是 normalized document。

正式字段口径：

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

兼容字段还可能存在：

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`

但这些已经不是推荐主契约。

## 8. 现在的入口口径

生产主链入口：

- Rust job_runner 按 workflow 编排
- Python stage worker 只执行单 stage

保留的 local / legacy wrapper：

- `retainpdf-pipeline provider-case`（`run_provider_case.py` 仅桌面兼容）
- `run_document_flow.py`（script-mode，仅桌面兼容，无 console 等价物）

当前原则：

- 主入口认 Rust `job_runner`
- 主协议认 `normalize.stage.v1`、`translate.stage.v1`、`render.stage.v1`
- `provider.stage.v1` 仅作为 legacy provider-case/local helper 契约
- 主 summary 文件认 `pipeline_summary.json`

## 9. 当前事件与失败收口

当前正式事件流已经是：

- Python worker 写 `DATA_ROOT/jobs/<job_id>/logs/pipeline_events.jsonl`
- Rust 查询层合并 DB events 和 `pipeline_events.jsonl`
- 对 `book` / `translate` 这类会创建 OCR child 的主任务，`GET /api/v1/jobs/<job_id>/events` 还会合并 `{job_id}-ocr` 的 OCR 子任务事件
- OCR 子任务事件会映射成主任务 `job_id`；原始来源放在 `payload.source_job_id` 和 `payload.source_event`
- Rust detail/list 优先使用 live pipeline stage 快照，而不是陈旧的 DB `job.stage`

前端进度展示的推荐入口：

- 当前状态只读 `GET /api/v1/jobs/<job_id>` 或 `GET /api/v1/jobs` 里的 `stage_snapshot`
- `events` 只做历史、时间线和排障，不参与当前阶段判断
- 不需要额外轮询 `{job_id}-ocr`
- OCR / 翻译 / 渲染历史事件仍统一看事件里的：
  - `display_stage`
  - `stage`
  - `substage`
  - `lane`
  - `stage_detail`
  - `event_type`
  - `progress.unit`
  - `progress.current`
  - `progress.total`

当前推荐的进度单位：

- OCR provider 页进度：`display_stage=ocr`, `stage=ocr_processing`, `progress.unit=page`
- 翻译批次进度：`display_stage=translation`, `stage=translating`, `progress.unit=batch`
- 翻译页级子阶段：`continuation_review`, `page_policies`, `domain_inference`, `garbled_repair`, `progress.unit=page`
- 渲染页进度：`display_stage=render`, `stage=rendering`, `progress.unit=page`
- Typst compile / overlay / saving：无法按页汇报时使用 `progress.unit=step`

当前正式失败口径已经是：

- `data.failure`

兼容字段仍保留，但角色已经固定：

- `data.failure_diagnostic`
  仅作为 `failure` 的兼容投影
- `events[*].event`
  兼容旧客户端；新客户端应优先读 `event_type`
- `events[*].message`
  调试/兼容文案；正式语义优先看 `stage_detail` + `event_type`
- `events[*].raw`
  保存 DB / pipeline jsonl / OCR child 的来源信息；前端展示不要靠它判断阶段

阶段分层规则也已经固定：

- 当前前端显示阶段放在 `stage_snapshot.display_stage`
- 机器阶段放在 `stage`
- `stage_snapshot` 是 current stage and progress 的唯一真理
- `background_snapshots` 只显示后台辅助进度，例如翻译期间的 `render_prewarm`
- provider 私有状态放在 `provider_stage`
- `message` / `stage_detail` 只当文案，不参与阶段判断

## 10. 现在最该记住的三句话

1. `workflow=book` 才是 provider-backed 全流程，不再是 `mineru`
2. OCR provider 选择看 `ocr.provider`，不是看 workflow 名字
3. Rust 和 Python 的稳定边界是 `--spec <stage>.spec.json`

## 11. 排查时先看哪几个文件

如果你只想快速定位问题，优先按这个顺序看：

### 看 API 请求长什么样

- [`API_SPEC.md`](API_SPEC.md)

### 看 Rust 到底起了哪个 Python 脚本

- [`../packages/retain-data/src/worker_command.rs`](../packages/retain-data/src/worker_command.rs)

### 看 Python provider 总入口怎么分发

- [`services/pipeline/retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py`](../pipeline/retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py)

### 看 stage spec 长什么样

- [`services/pipeline/retainpdf_pipeline/foundation/shared/stage_specs.py`](../pipeline/retainpdf_pipeline/foundation/shared/stage_specs.py)

### 看最终主链结果

- `DATA_ROOT/jobs/<job_id>/artifacts/pipeline_summary.json`

## 12. 当前本地 Agent document-operation 链

后端已经有一条不经过 MCP、也不经过前端的本地控制链：

```text
retainpdf-agent CLI
  <- RETAINPDF_AGENT_CAPABILITY (1..300 秒，conversation/document/action scoped)
  -> /api/v1/internal/agent/operations/*
  -> Rust document_operations service
  -> SQLite operation/attempt/event/version tables
  -> restricted_page_program_v1 executor
  -> validated immutable candidate.pdf
```

模型可以提交 `retainpdf_page_program_v1`，按顺序组合 `select_pages` 与
`rotate_pages`，实现整页删除、重排、复制和旋转。Rust 会持久化不可变源文件、
规范化程序及 dispatch identity；固定 Python worker 只解释这套封闭数据协议，
生成的 candidate 还会逐页按批准的页面映射和旋转规则进行 PyMuPDF 栅格化
（整页等比例缩放，最长边最大 512px）；
预期页与输出页的 RGB 像素必须一致。Rust 会复核 compact visual report 的 hash、
页面计划、几何摘要和零 mismatch 结论，再结合大小、文件数、非 symlink、PDF
可读性与页数验证，之后才进入 `result_ready`。任意 Python、Typst、Ghostscript
等生成代码仍未开放，
必须等独立 OS/container 隔离完成后再接入。

`operation.run` 现在也承担显式重试，但不会增加一个新的模型工具：`failed`
会保留旧 attempt 并创建新 attempt；`ambiguous` 只有在请求明确携带
`accept_duplicate_risk=true` 时才允许。新 attempt 持久化 retry idempotency
key，因此断网后重复同一请求只会回放原 attempt；活动文档版本已变化则 409
拒绝，避免在过期 base 上继续执行。

Rust 已实现 `POST /api/v1/internal/agent/capabilities`。完整 API key 只在可信
后端签发阶段使用；CLI 优先发送短期 capability。token 不入库，API 重启或
过期即失效，并且不能访问 runtime-session、不能再次签发、不能越过绑定的
conversation/document/action。OpenAI-compatible / FX 模型进程都拿不到 token；
共享宿主 broker 会验证精确命令并代执行，不能把 capability 放进模型环境变量
或命令参数。每次实际调用只签发一个 action、60 秒的 capability，并在模型
运行时之外启动真实 CLI。

关键代码：

- [`src/bin/retainpdf-agent.rs`](src/bin/retainpdf-agent.rs)
- [`src/app/router/internal_agent.rs`](src/app/router/internal_agent.rs)
- [`src/app/router/ai.rs`](src/app/router/ai.rs)
- [`src/routes/document_operations.rs`](src/routes/document_operations.rs)
- [`src/routes/public_document_operations.rs`](src/routes/public_document_operations.rs)
- [`src/services/document_operations`](src/services/document_operations)
- [`src/services/public_document_operations.rs`](src/services/public_document_operations.rs)
- [`../../database/retain-db/src/db/document_operations.rs`](../../database/retain-db/src/db/document_operations.rs)

对外入口与实际 runtime 链如下：

```text
POST /api/v1/ai/ask
  -> Rust byte-stream proxy -> AI /v1/ask
  -> AskOrchestrator selects python / openai / fx for this request
     -> python: Markdown reading only
     -> openai: host chat transport + shared exact-grammar broker
     -> fx ACP: private HOME/workspace + single-use Unix-socket wrapper
  -> host broker mints one-action capability and runs retainpdf-agent
  -> Rust persists operation / attempt / event / candidate version
  -> FX only: Rust runtime-session cursor API (revision CAS)
```

对应内部 cursor 接口：

```text
GET/PUT/DELETE /api/v1/internal/agent/runtime-sessions/:conversation_id
```

除严格匹配的 `document inspect` 和 operation lifecycle 命令外，broker
仍全部 fail closed。当前用户消息会在启动 operation-capable runtime 前先写入
Rust 对话，模型无法伪造 document/conversation/message scope；默认 explicit
模式下 run/commit/retry 还需要请求级显式确认。
这使模型可以管理并执行 durable 的受限整页变换，但仍不能直接执行任意 PDF
代码。浏览器断线不取消 operation；API 重启后会从 run index、terminal result
和 SQLite 事件恢复。candidate 只会在显式 commit 后成为文档的 active source，
下一次文档操作和翻译都会以该版本为基础。

浏览器不直接调用 internal capability/operation 路由。公开控制面使用
`/api/v1/ai/conversations/:conversation_id/operations` 和
`/api/v1/ai/operations/:operation_id/*`：查询只返回安全投影，run/retry/cancel/
commit 请求必须回传最后观察到的 status、attempt、program SHA-256 和稳定
idempotency key；状态被其他请求推进时返回 409。详细字段见
[`docs/api-spec/ai-control-plane.md`](docs/api-spec/ai-control-plane.md)。
