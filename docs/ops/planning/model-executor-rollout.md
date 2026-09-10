# 轻量模型执行器迁移

更新：2026-09-05。状态：**第二阶段已接入可选 worker 链路，默认仍关闭；整项迁移尚未完成。**

## 目标与边界

复用现有 Rust API 和 SQLite；不安装第三方网关、不增加监听服务或数据库。
Python 保留翻译业务逻辑，Rust 最终统一负责模型凭据、供应商参数、请求执行、限流和请求日志。
本轮不改 Docker、AI 问答服务或 Windows 发布流程，不发起计费模型测试。

## 当前已落地

- `backend/api/src/services/model_executor/`：连接快照、参数校验、连接池、跨任务/配置版本共享的并发上限。
- Qwen、DeepSeek、OpenAI-compatible 的 chat-completions 传输；已知供应商默认 SSE，自定义默认非流式。
- Qwen3.8-flash 的 Qwen 策略默认关闭 thinking，不靠 hostname 猜测策略。DeepSeek 当前仅支持 auto；显式 on/off 暂时拒绝，自定义连接不注入 thinking 字段。
- HTTP 客户端禁用环境代理、重定向及底层自动重试。解析并固定目标 IP，私有/保留地址需显式允许；拒绝 URL 内凭据、查询串和片段。
- 仅显式 HTTP 429 最多重试一次，遵守 Retry-After 和剩余总截止时间。默认 queue/connect/idle/total 为 30/10/60/180 秒。
- 新增 SQLite v13 迁移：任务能力 token 只存哈希；操作按 job/operation 去重，内容不一致冲突。操作保留请求哈希，不保存 prompts、API key 或推理正文。
- 状态 queued/running/succeeded/failed/ambiguous/cancelled；先记录 running 再发请求，重启后 running 转 ambiguous，queued 取消，绝不自动重发。
- 不确定响应暂停新操作，取消排队操作；已在途的其他操作可以完成。运行中主动取消也按 ambiguous 处理，不能证明上游未收费。
- 同一 unit 最多一份 primary 和一份 repair；repair 必须在 primary 已成功返回内容之后提交。网络失败不能用 repair 绕过预算。
- 聚合 SSE 正文与 usage，不保存 reasoning_content；空正文、截断、异常终止和缺少 DONE 不算成功。独立 connect timing、非流式 first-token timing 不可观测时保留 null。
- `rust_executor.py` 已接入生产 Python 请求入口：新模式仅接收本机 API 地址、任务能力、稳定操作 ID 和消息，无模型密钥、供应商 URL 或直连回退。
- 任务提交契约包含完整 `execution_connection`；launcher 验证快照，worker 自动获得短期能力，退出时撤销能力并隔离未完成请求。OCR 凭据通道不变。
- Python 新模式禁用网络尾部重试；错误锁存阻止旧 fallback 冒充成功，批次排空后保存其他成功结果。校验失败最多一次内容修复，网络失败不进入内容修复。
- Rust 请求状态已接入任务详情和诊断的恢复视图，数据库统计不暴露正文或凭据；旧 Python 日志缺失不再被视为新模式可安全重试的证据。
- 新模式的旧 rerun/resume、翻译及整条 OCR 重试入口暂时禁用，即使显式接受重复计费风险也不能绕过；仅重渲染保留。待跨任务成功回执复用及风险审计完成后再开放恢复，现阶段 supported_retry_policies 只提供 block。
- 排队期间能力过期或被暂停时，操作落为 cancelled/dispatch_fenced，不再永远停留在 queued；轮换 token 不会解除暂停。
- Rust 模式使用单个有界共享线程池，按起始页、阅读顺序派发；不再为 batch/single 固定分配线程。普通传输批次按页边界拆开，语义跨页单元保持完整；不设置逐页完成屏障，因此并发完成次序仍可能不同。旧 transport 的分池策略保持兼容。诊断使用 `scheduler=shared_page_order` 与 `shared_workers`，旧专属池计数为零；缓存身份包含调度版本。
- 测速报告 v2 读取新请求日志的指标白名单；总时长改用 created_at → finished_at，旧 duration_seconds 单列为末阶段时长。跨口径报告不再计算 server-duration 加速比。未知费用/指标不补零。

## 内部接口（默认关闭）

仅当 API 启动配置显式设置 `RETAIN_MODEL_EXECUTOR_ENABLED=1` 时初始化执行器。
仅开启它不会切换现有任务。实验任务还必须提交完整 `translation.execution_connection`，API 设置 `RETAIN_MODEL_WORKER_ENABLED=1`，实际启动 worker 的 API/jobsd 设置 `RETAIN_MODEL_EXECUTOR_URL=http://127.0.0.1:<API端口>`。缺少条件会拒绝执行，不回退直连；未提供快照的旧任务维持旧路径。
单个数据目录只允许一个 API 执行器拥有者；jobsd 不实例化执行器。

- `POST /api/v1/internal/model/jobs/:job_id/capability`：需应用 API key，目标 job 必须存在且活动。请求连接必须与提交时完整快照相同；仅可轮换 token，不可改变快照。接口能力有效期一小时，worker 自动签发的能力按任务超时设置并限制在 1–24 小时；尚无自动续期。
- `POST /api/v1/internal/model/jobs/:job_id/requests`：仅接受该任务 Bearer capability，提交后返回持久化操作，不等待上游结束。不能传入供应商 URL、model 或 API key。
- `GET /api/v1/internal/model/jobs/:job_id/requests/:operation_id`：以同一任务能力读取状态/结果。
- `POST /api/v1/internal/model/jobs/:job_id/requests/:operation_id/cancel`：幂等取消。

操作 ID 由调用方稳定提供；同 ID、同内容可安全再次读取或提交，不生成新请求。
新的修复操作使用新 ID，但 unit ID 不变。不要从不稳定的请求日志标签猜 unit 身份。

## 开启生产切换前必须完成

- [x] 连接配置进入任务提交契约，提交时冻结完整 profile。
- [x] jobsd/进程内 launcher 自动签发任务能力；worker 不再收到翻译 API key，OCR 凭据通道不变；退出时撤销能力。自动续期另待实现。
- [ ] Python 所有模型调用点传递稳定 unit/operation 身份；包括 domain、跨页处理、batch、single、协议修复。不能只在旧 HTTP 函数外围包一层。
- [x] 新模式绕过 Python 网络重试并禁用网络尾部补偿；执行器错误贯穿调度层，旧 fallback 不能以保留原文记为成功。
- [ ] 将执行器 paused 与现有 durable attempt/stage/checkpoint 接通：停止新单元、保存已完成结果、drain 在途操作；任务取消同步关闭执行器操作。
- [ ] 人工恢复 API/UI：明确重复计费提示、记录风险确认、新 attempt/op 身份、复用成功单元；当前没有解锁 paused 的接口，不能手改 SQLite 解锁。
- [ ] 完成配置界面多连接新增/编辑/复制/删除/默认；浏览器本地存储、桌面现有持久化/vault、旧配置无损迁移及重新打开时回填。
- [ ] 接通显式连接测试（提示可能计费）；细化供应商安全错误分类，当前 HTTP 400 返回通用 provider_rejected_request，不宣称已精确区分欠费/参数错误。
- [ ] 客户端/能力过期恢复、真实 job 取消与 API 重启端到端测试，以及 Windows 本地启动/持久化验证。
- [ ] 最后再运行获准的少量真实 Qwen 请求和 test1.pdf；不能将 mock 通过或两条思考模式探针称为整本 PDF 的性能结论。

剩余边界：已覆盖 domain、classification、continuation、batch/single、agent 的显式作用域，但跨阶段补修与分组拆分的全局单元预算仍需统一审计。相同作用域再次提交不同正文会冲突并停止，不会自动生成新请求。当前错误会令任务失败并保留执行器暂停状态；尚不是用户可操作的 durable pause/resume。能力过期、取消与重启完整竞态验证完成前不要默认启用。

## 不计费验证

恢复安全补强验证：API 361 项、retain-data 98 项通过；contracts 8 项及构建通过。新增覆盖风险确认不能绕过旧重试封锁、恢复统计不泄露正文、成功回执保留、轮换能力不解锁，以及排队过期终态。此轮未运行真实供应商请求。

本轮验证：Rust core/data/jobs/API 共 621 项通过，包括真实 Python 进程 → 本地 Rust API → mock 上游；contracts 8 项测试和构建通过。Python 翻译与测速回归 733 项通过、1 项既有失败：`test_sentence_fallback_chunks_long_group_when_no_sentence_split_exists` 的极短 mock 译文触发截断校验。未为使测试变绿而放宽校验，未执行真实 Qwen/PDF 性能测试。

仓库根目录：

```bash
PYTHONPATH=backend/pipeline .venv/bin/python -m pytest \
  backend/pipeline/devtools/tests/translation/test_rust_executor_client.py \
  backend/pipeline/devtools/tests/translation/test_executor_context.py \
  tests/performance/pipeline/tests/test_run.py -q
```

在 `backend/api`：

```bash
cargo test -p retain-data --lib --offline
cargo test -p rust_api --lib services::model_executor --offline
PATH="$(pwd)/../.venv/bin:$PATH" cargo test -p rust_api --lib --offline
```

最后一条完整 API 测试需要已安装的 `retainpdf-pipeline` 命令在 PATH 中，否则三个 document-operation 用例会报 executor profile unavailable；这与模型供应商连接无关。
