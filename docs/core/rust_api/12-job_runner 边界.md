# job_runner 边界

这份文档只回答一个问题：

**改 `backend/packages/retain-jobs/src/job_runner` 时，逻辑应该放在哪里。**

`job_runner` 是运行态执行层，不是 HTTP API 层，也不是 view/presentation 层。它负责把已经创建好的 job 真正跑起来：排队、分派 workflow、启动 Python worker、消费 stdout/stderr、同步运行态、处理 OCR provider transport、处理失败/取消/超时。

## 总规则

`job_runner` 只做运行态执行，不做这些事：

- 不解析 HTTP request。
- 不组装对外 API view。
- 不直接依赖 `AppState`。
- 不理解前端展示细节。
- 不把 provider raw 私有结构暴露成 published artifact。
- 不在 leaf helper 里随手接收整包 `ProcessRuntimeDeps`。

依赖方向保持：

```text
services/jobs -> job_runner -> worker_command / ocr_provider / db facade
```

`job_runner` 内部尽量按两类依赖区分：

- `ProcessRuntimeDeps`
  orchestrator 层使用，例如 workflow 分派、OCR flow、process runner 主入口。
- `JobPersistDeps`
  leaf helper 使用，只需要 `db + data_root + output_root` 时不要拿整包 runtime deps。

## 顶层模块

### `mod.rs`

作用：

- `job_runner` facade。
- 对外导出 runner 入口和少量运行态 helper。
- 挂载内部子模块。

不要放：

- workflow 业务逻辑。
- provider 分支细节。
- stdout 规则。
- 文件下载/解包实现。

### `lifecycle.rs`

作用：

- job 排队。
- 执行槽控制。
- cancel 短路。
- 按 workflow 分派到 OCR / translation / render / process runner。

不要放：

- 具体 OCR provider 逻辑。
- Python stdout 解析规则。
- 单个 worker 的完成态细节。

## process runner

入口：

- `process_runner.rs`

边界：

- `process_runner.rs`
  只保留 worker 执行 orchestrator：启动、收集执行结果、分派 timeout/completion。
- `process_runner/startup.rs`
  worker 启动、pid 持久化、启动前 cancel 检查。
- `process_runner/execution.rs`
  等待进程、收集 stdout/stderr、区分 completed/timed out。
- `process_runner/completion.rs`
  完成态分类、shutdown noise 判定、终态应用。
- `process_runner/completion_pipeline.rs`
  完成后的总收口：挂载 stdout/stderr、校验 worker output contract、应用完成态、失败 AI 诊断。
- `process_runner/timeout_support.rs`
  timeout 失败落态。
- `process_runner/io_support.rs`
  stdout/stderr 消费。
- `process_runner/result_support.rs`
  process 结果写回 job。
- `process_runner/failure_ai_diagnosis.rs`
  失败 AI 诊断。

规则：

- 新增 worker 成功后必需产物校验，放 `process_contract.rs`，由 `completion_pipeline.rs` 调用。
- 新增 stdout label 解析，不要放 process runner，放 `stdout_parser/*`。
- 新增 Python worker 命令参数，不要放 process runner，放 `worker_command/*`。

## workflow flow

### `translation_flow.rs` + `translation_flow_*.rs`

作用：

- book / translate-only workflow 编排。
- OCR child job 创建和父任务状态同步。
- OCR 完成后进入 translation。
- translation 完成后按 `PipelinePlan` 决定是否进入 render。

边界：

- `translation_flow.rs`
  orchestrator。
- `translation_flow_child.rs`
  upload source 读取、父任务进入 OCR submitting、OCR child 创建。
- `translation_flow_artifacts.rs`
  从已有 OCR artifacts 继续翻译的输入准备。
- `translation_flow_stage.rs`
  translation/render stage 调用和 `ocr_child_finished` 事件。
- `translation_flow_executor.rs`
  translation 后续 plan 执行。
- `translation_flow_support.rs`
  OCR child 终态判断和父任务收口。

规则：

- 不要在 `translation_flow.rs` 里直接读写 artifact 细节；已有产物复用放 `translation_flow_artifacts.rs`。
- 不要在这里拼 Python 命令；命令构造在 `worker_command/*`。

### `render_flow.rs` + `render_flow_artifacts.rs`

作用：

- render-only workflow 编排。
- 从已有 translation artifacts 准备 render 输入。

规则：

- `render_flow.rs` 只负责构造 render command、设置 running/rendering 状态、调用 process runner。
- 读取源 job、复制 translation inputs、校验 translations dir/source pdf 放 `render_flow_artifacts.rs`。

## OCR flow

入口：

- `ocr_flow/mod.rs`

边界：

- `ocr_flow/mod.rs`
  OCR child job orchestrator：初始化状态、准备 workspace、执行 provider transport、进入 normalize worker。
- `ocr_flow/provider_transport.rs`
  本地上传/远程 URL、MinerU/Paddle provider 分发。
- `ocr_flow/workspace.rs`
  OCR job 路径和目录准备。
- `ocr_flow/transport.rs`
  source pdf 准备与远程 source 恢复。
- `ocr_flow/support.rs`
  OCR job 保存、父任务 OCR 状态镜像、transport/source-pdf 失败处理。
- `ocr_flow/status.rs`
  provider status 映射到 job stage/detail/progress。
- `ocr_flow/polling.rs`
  通用 poll 等待、timeout、cancel 检查。

### MinerU

- `ocr_flow/mineru.rs`
  MinerU submit 入口，本地 batch 和远程 task 两条链路的 provider 调用。
- `ocr_flow/mineru_polling.rs`
  MinerU batch/task polling loop。
- `ocr_flow/mineru_status_handlers.rs`
  MinerU batch/task 状态处理，done 后落 provider result，并进入 bundle 下载。
- `ocr_flow/mineru_retry.rs`
  MinerU query retry 策略、可重试错误识别。
- `ocr_flow/bundle_download.rs`
  MinerU bundle 成功后的总编排：readiness wait、download retry、unpack、markdown export。
- `ocr_flow/bundle_ready_wait.rs`
  bundle readiness probe 等待和 degraded fallback。
- `ocr_flow/bundle_download_retry.rs`
  bundle 真实下载重试。
- `ocr_flow/bundle_events.rs`
  bundle retry/degraded 事件和 `ocr_result_ready` 状态标记。
- `ocr_flow/bundle_retry_policy.rs`
  bundle retry/fallback/timeout 纯策略。
- `ocr_flow/markdown_bundle.rs`
  provider raw markdown 导出。

规则：

- provider API 协议字段优先放 `ocr_provider/mineru/*`。
- job 状态更新放 `ocr_flow/status.rs` 或 status handler。
- retry 判定放 retry/policy 模块，不要塞进 polling loop。
- bundle 下载事件统一走 `bundle_events.rs`。

### Paddle

- `ocr_flow/paddle.rs`
  Paddle submit/poll/download 主流程。
- `ocr_flow/paddle_payload.rs`
  Paddle optional payload 构造。
- `ocr_flow/paddle_errors.rs`
  Paddle provider error 挂载到 job。
- `ocr_flow/paddle_markdown.rs`
  Paddle markdown artifact materialize。

规则：

- Paddle 请求参数不要写在 transport orchestrator 外的随机位置，统一放 `paddle_payload.rs`。
- Paddle 错误映射不要散在 polling 中，统一走 `paddle_errors.rs`。

## stdout parser

入口：

- `stdout_parser/mod.rs`

边界：

- `labels.rs`
  stdout label 常量。
- `state.rs`
  stdout parser 共享状态 helper。
- `artifact_fields.rs`
  stdout label / structured artifact key 到内部 artifact field 的映射。
- `artifact_rules.rs`
  artifact 行和 `artifact_published` JSON event 写入 job artifacts。
- `metric_rules.rs`
  `pages processed`、`translated items`、耗时类指标。
- `stage_rules.rs`
  stdout 行触发的 stage 变化。
- `failure.rs`
  provider failure 归因。

规则：

- artifact 模块只写 artifact，不推进 stage。
- stage 推进只放 `stage_rules.rs`。
- metric 不要塞进 artifact。
- 新 stdout label 必须同步考虑是否属于 artifact、metric、stage 还是 failure。

## 契约模块

### `process_contract.rs`

作用：

- 根据 worker command 判断 worker 类型。
- 校验 worker 成功退出后必须存在的产物。

规则：

- Python worker 成功退出但缺关键产物，应在这里失败。
- 不要在 process runner 主流程里手写某个 stage 的产物判断。

### `stage_contract.rs`

作用：

- 从已有 job artifacts 中解析 OCR -> translation、translation -> render 所需输入。
- 校验 source pdf、normalized document、translations manifest 等 stage-ready 条件。

规则：

- 重试、resume、from-artifacts workflow 要复用这里的 ready input 解析。
- 不要在各个 flow 里重复解析 artifact 路径。

### `artifact_requirements.rs`

作用：

- 共享 artifact path 解析和 file/dir existence 检查。

规则：

- 只做路径和存在性检查。
- 不理解具体 workflow。

## 什么时候不该继续拆

不要为了行数继续拆这些情况：

- 模块已经只有单一算法职责，例如 page range 解析、retry 策略。
- 拆完以后调用链比原来更难读。
- 需要引入 trait/generic 才能消除少量重复。
- 只是两个 poll loop 长得像，但参数、错误文案、状态处理不同。

优先拆这些情况：

- 同一个文件同时包含 orchestration 和 provider 协议细节。
- 同一个函数同时做状态判断、事件写入、文件路径解析、进程控制。
- 某个 leaf helper 为了一个路径或 db 写入接收了整包 `ProcessRuntimeDeps`。
- artifact、stage、metric、failure 规则混在一起。

## 最小验证

改 `job_runner` 后至少跑：

```bash
cargo test --manifest-path backend/api/Cargo.toml ocr_flow -- --nocapture
cargo test --manifest-path backend/api/Cargo.toml stdout_parser -- --nocapture
cargo test --manifest-path backend/api/Cargo.toml process_runner -- --nocapture
cargo test --manifest-path backend/api/Cargo.toml
```

如果只改某个小模块，可以先跑对应 filter，但收口前建议跑全量 Rust API 测试。
