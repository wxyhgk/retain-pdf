# Translation 说明

这一层只做一件事：把 OCR payload 变成可落盘、可回填、可渲染的翻译结果。

这里不负责 PDF 读取和写回，也不负责 MinerU 解包。

## 阶段边界

Translation 阶段的正式输入和输出固定为：

- 输入：
  `document.v1.json`、翻译策略参数、翻译输出目录
- 输出：
  逐页 translation payload、翻译摘要、翻译诊断

明确不负责的事情：

- 不直接消费 provider raw JSON、zip 或 unpacked 目录
- 不负责源 PDF 的页面写回、排版覆盖和最终 PDF 交付
- 不负责 OCR provider 上传、轮询、下载和 normalize 产物生成

## 默认翻译策略

默认策略按人工翻译流程设计，而不是把整页信息全部塞给模型：

1. 当前块优先
   每次翻译以当前 item 的原文为唯一输出对象。上下文、术语和文档记忆只能辅助理解，不能被翻译进当前块。
2. 术语按命中注入
   用户词汇表和自动文档记忆不会全量进入 prompt。主翻译链会先用当前 item 或当前 batch 的 source text 匹配术语，只把命中的 `preferred` 术语作为翻译偏好注入；`preserve/canonical` 这类硬约束优先通过占位保护处理。
3. 上下文按需注入
   完整普通正文段默认不带前后文，减少 prompt 体积并避免邻近段落被误翻进当前块。只有跨栏/跨页续接、候选续接、图注、连接词开头片段、短的不完整片段等场景才会带 reading-order 前后文。需要调试旧行为时可用 `mode="all"` 保留全量邻居上下文。
4. 质量兜底不可关闭
   `should_translate=true` 的 item 不能以空译文结束。普通翻译、短文本 retry、乱码修复和 agent repair 都应把空译视为可修复问题；高级选项可以控制上下文/术语/质量预算，但不应关闭最终空译修复保证。

### 高级选项

后端翻译请求支持三个高级选项，Rust API 会写入 stage spec 并传给 Python 翻译执行层：

| 字段 | 默认值 | 可选值 | 含义 |
| --- | --- | --- | --- |
| `context_mode` | `needed` | `needed` / `all` / `off` | 控制 reading-order 前后文。`needed` 只给不完整片段、续接段和图注等需要上下文的块；`all` 退回旧的邻居上下文行为；`off` 完全关闭前后文。 |
| `glossary_mode` | `matched` | `matched` / `all` / `off` | 控制用户词汇表注入。`matched` 只注入当前 item/batch 命中的术语；`all` 把整张表交给 prompt；`off` 不注入词汇表。 |
| `memory_mode` | `matched` | `matched` / `broad` / `off` | 控制自动文档记忆。`matched` 只注入当前 item/batch 命中的历史术语；`broad` 注入文档级摘要；`off` 关闭记忆注入。 |

这些选项只影响 prompt 上下文预算和术语/记忆注入范围，不影响最终质量兜底。空译、严重英文残留和占位符错误仍然必须进入后续修复链路。

默认执行时，自动文档记忆只在任务开始时读取一次 `JobMemorySnapshot`，worker 并发翻译期间不会实时写回
`job-memory.json`。这样可以避免大 PDF 高并发时反复锁文件、刷新 prompt 记忆和拖慢尾批次。需要调试旧行为时，
可以设置 `RETAIN_TRANSLATION_LIVE_MEMORY_UPDATES=1`，让结果回填阶段继续实时更新 job memory。

当前稳定交接点：

- 上游 OCR 阶段应先把 provider 结果收敛成 `document.v1.json`
- 下游渲染阶段应只消费这里落盘的翻译产物，不应再回头理解 OCR provider 私有字段

当前默认翻译产物协议：

- `translation-checkpoint.v1.json`
  翻译开始即创建，记录输入指纹、attempt、当前 phase、页级 pending item 和持久化进度。
  每次 dirty-page flush 后原子更新；它是恢复协议，不代表产物已经可以渲染。
- `translation-request-journal.v1.jsonl`
  独立于 checkpoint 的请求级 write-ahead journal。每次 LLM 调用在发出前持久化 `dispatch`，收到响应或明确失败后持久化 `terminal`；只记录请求哈希、阶段和结果类别，不保存 prompt、响应、API key 或 provider URL。
- `translation-manifest.json`
  只在未翻译条目校验通过后提交，记录页索引到翻译 payload 文件的稳定映射，供渲染阶段读取
  还会附带轻量元数据，例如 glossary 摘要、诊断摘要，以及 `invocation` 字段
  当前正式路径统一标记为 `stage_spec`
- 逐页 translation payload
  当前仍按每页一个 JSON 落盘，manifest 负责声明这些文件该如何被渲染阶段发现
- 阶段 spec
  `translate-only` 入口已支持 `job_root/specs/translate.spec.json`（`translate.stage.v1`）
- 调试产物
  - `artifacts/translation_diagnostics.json`
  - `artifacts/translation_debug_index.json`

## Translation Payload 口径

逐页 translation payload 现在分成两层：

1. 顶层 contract 字段
2. `metadata` 调试/桥接字段

顶层 contract 字段包括：

- `block_kind`
- `block_class`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

当前约定：

- translation 的分类、style hint、policy、payload 回填和 diagnostics 主链优先只读这些顶层 contract 字段；宽泛载体/行为分类统一读 `block_class`
- `metadata` 可以继续保留，但职责只限于 debug、provider trace 和桥接 `continuation_hint/provider warning`
- `raw_block_type`、`normalized_sub_type` 继续写入以恢复旧 cache/retry/checkpoint，但只允许用于兼容投影和诊断，不作为新任务的权威业务分类
- 新逻辑不要再把 `metadata.layout_role`、`metadata.semantic_role`、`metadata.structure_role` 当正式语义入口
- 如果后续 block 语义变更，优先只改 `document.v1 -> TextItem -> payload` 这条 contract 投影，不要让下游模块各自再翻 `metadata`

恢复与兼容约定：

- 新任务先生成 `translation-checkpoint.v1.json`；通过导出校验后原子写 manifest，再把 checkpoint 提交为 `complete/committed`，渲染入口只接受二者同时完成
- worker 使用进程级文件锁保证同一 attempt 同时只有一个 checkpoint writer；进程崩溃后锁由操作系统释放
- 新 retry attempt 只读复制旧 attempt 的 checkpoint 和页 payload；输入指纹不匹配时显式放弃副本并从空目录开始，旧 attempt 保持不变
- 输入指纹同时包含 prompt hash、翻译协议/策略版本和路由策略版本；部署改变翻译语义后不会混用旧 attempt 的页结果
- checkpoint 的 phase 只能沿 `preparing -> policy_ready -> translating -> repairing -> validating -> committed` 前进，已经完成的 item 不允许重新退回 pending
- 通过校验的逐条译文会原子写入 unit cache 并 fsync；它是页级 flush 之间更细粒度的恢复层，但不能消除“上游已处理、响应在断线途中丢失”造成的重复请求歧义
- retry attempt 会一并复制 `translation-request-journal.v1.jsonl`；没有配对 terminal 的 dispatch 会被标为历史歧义，同一请求哈希再次发送时明确记录 `prior_ambiguous=true`。这能审计断网窗口，但在 provider 没有正式幂等协议时不能保证去重或避免重复计费
- Rust API 会把 journal 注册为 `translation_request_journal_jsonl` artifact，并在 Job Detail / diagnostics 返回 `translation_request_recovery`。活动歧义或 journal 损坏时，普通 rerun 和默认 translation retry 都会暂停；只有显式提交 `ambiguous_request_policy=accept_duplicate_risk` 才创建恢复任务，该接受记录会持久化到新任务的 `request_payload.translation.accepted_ambiguous_request_risk`
- 没有 checkpoint 的历史成功任务仍按旧 manifest 协议读取
- 翻译产物协议固定为 `translation-manifest.json` + 每页 payload，渲染阶段不再兼容旧的逐页 JSON 直扫模式
- 默认加载口径已经是 strict contract；缺少上述顶层字段的 payload 会直接报错
- Rust 主工作流调用的 `translate-only` worker 现在要求 `--spec`
- `translate_book.py`（script-mode，仅桌面兼容，无 console 等价物）现在也是 spec-only 包装入口
- API 凭证不再要求写入 stage spec；spec 中使用 `credential_ref`，由运行时环境注入真实 key

## 调试闭环

现在有一套最小可复现链路，专门用来定位“某个 item 为什么没翻 / 降级 / 保留原文”：

1. 先看调试产物
   - `translation_diagnostics.json` 看全局统计
   - `translation_debug_index.json` 看 item 级索引
2. 再看单 item
   - `backend/pipeline/devtools/replay_translation_item.py`
3. 需要批量回归时再接 promptfoo
   - `backend/pipeline/devtools/promptfoo/`
   - 先用 `scan_drift.py` 找 saved vs replay 漂移项，再用 `capture_case.py` 固化成 case artifact

Rust API 对应暴露了：

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

## 子目录与边界

一级目录按稳定职责划分。新代码优先放入这些目录，不要在根目录继续增加大文件。

根目录只保留 `README.md` 和包初始化。新代码不要再新增 `translation/*.py`
大文件；外部模块需要 translation 能力时，优先走 `public/`。

| 目录 | 职责 | 不该做的事 |
| --- | --- | --- |
| `entrypoints/` | Python worker 入口脚本实现，例如 translate-only、book translation pipeline。根目录同名文件只是兼容 shim。 | 不放业务规则；不被 workflow 反向依赖。 |
| `workflow/` | 翻译流程编排、阶段调度、batch/worker 分配和主流程落盘。 | 不直接拼 provider HTTP payload；不写具体 policy 规则。 |
| `core/` | 稳定领域模型和数据协议：item contract、`document.v1` 读取、translation payload、manifest、orchestration。 | 不调用 LLM；不管理 job 生命周期。 |
| `services/` | 翻译业务能力：policy、continuation、classification、context、terms、memory、quality、agents、postprocess、results。 | 不做外部入口解析；不直接依赖 runtime pipeline。 |
| `llm/` | LLM provider、prompt 协议、缓存、响应解析、重试和校验入口。 | 不读取 OCR 文件；不决定页面级 workflow。 |
| `artifacts/` | 结构化诊断、debug index、review artifact、运行统计输出。 | 不承担业务决策；不调用 provider。 |
| `public/` | 给 runtime、rendering、ocr_provider 等 translation 外部生产代码使用的稳定门面。 | 不写业务逻辑；不把内部临时 helper 随手暴露出去。 |

### 外部公开入口

production 代码在 translation 外部引用本模块时，默认只允许：

- `translate.public`
  runtime、rendering、ocr_provider 共享的稳定 contract，例如 glossary entry、provider runtime 默认值、translation manifest 读取、item role helper、公式保护 helper、diagnostics writer。
- `translate.entrypoints.*`
  CLI/worker 入口脚本使用。

以下 production 目录不应直接 import translation 内部实现：

- `runtime/pipeline/**`
- `render/**`
- `ocr/ocr_provider/**`
- `ocr/mineru/**`
- `ocr/document_schema/**`

这些目录禁止直接引用：

- `translate.core`
- `translate.services`
- `translate.llm`
- `translate.workflow`
- `translate.artifacts`

如果这些外部模块确实需要新的 translation 能力，先把它设计成稳定 contract 后加到 `public/`，再由外部调用。

`public/` 必须保持 lazy facade：不要在 `translate/public/__init__.py` 顶层写
`from translate... import ...` 或 `from render... import ...`。新增导出时只登记到
`_EXPORTS`，由 `__getattr__` 按需加载，避免 translation 和 rendering 之间重新形成 import cycle。

### Devtools 与测试例外

`backend/pipeline/devtools/**` 和 `backend/pipeline/devtools/tests/**` 可以直接 import translation 内部模块，用来做：

- 单元测试内部规则、payload helper、LLM 协议和 policy 分支
- replay / promptfoo / repair runner 这类调试工具
- golden flow 或 schema 回归检查

这些是 debug/test-only 例外，不代表 production 代码可以照抄。新增普通运行链路、worker、OCR/normalize、rendering 或 runtime 代码时，
默认仍必须走 `translate.public`。如果某个 devtools 脚本将来会被 production 调用，应先把它需要的 translation 能力收口到
`public/`，再接入主链。

### 依赖方向

目标依赖方向：

```text
entrypoints
  -> workflow / pipeline_shared / foundation
workflow
  -> core / services / llm / artifacts
core
  -> core
services
  -> core / llm / artifacts
llm
  -> core / artifacts
artifacts
  -> core
public
  -> core / workflow / llm provider runtime / artifacts
```

当前仍有少量过渡例外：

- `workflow/execution_runner.py` 会启动 render source prewarm，这是为了和翻译并行预热渲染输入，例外必须保持窄范围。

已经收口的边界：

- `core` 只放纯 contract、数据读取、payload 数据操作和文本规则，不 import `services`、`workflow` 或 `llm`
- `llm` 不再读取 `services/context`、`services/memory`、`services/quality`、`services/terms`
- `artifacts` 不再读取 `services/agents` 或 LLM control context；review 摘要构造在 `services/agents/review_artifact.py`
- `services` 可以组合 `core`、`llm` 和 `artifacts`，但不反向依赖 `workflow`

已删除的兼容 shim：

- `translation/from_ocr_pipeline.py` -> `translation/entrypoints/from_ocr_pipeline.py`
- `translation/translate_only_pipeline.py` -> `translation/entrypoints/translate_only_pipeline.py`
- `translation/item_reader.py` -> `translation/core/item_reader.py`
- `translation/session_context.py` -> `translation/services/context/session_context.py`
- `translation/services/context/models.py` -> `translation/core/context/models.py`
- `translation/services/context/unit_context.py` -> `translation/core/context/unit_context.py`
- `translation/services/terms/glossary.py` -> `translation/core/terms/glossary.py`
- `translation/services/terms/abbreviations.py` -> `translation/core/terms/abbreviations.py`
- `translation/services/terms/injection.py` -> `translation/core/terms/injection.py`
- `translation/services/quality/checks.py` -> `translation/llm/validation/quality.py`

这些 shim 已经退出主线。架构门禁会拒绝继续引用这些旧路径；新代码应直接引用真实路径。

### payload/parts 边界

`core/payload/` 只保留 payload contract 和数据操作：

- `manifest.py` 负责 translation manifest 读写协议。
- `ops.py` 负责通用 payload 字段读写。
- `translations.py` 负责翻译结果回填和状态字段。
- `formula_protection.py` 负责 payload 内公式保护标记。
- `template_contract.py`、`template_records.py`、`template_sync.py` 负责模板 contract、记录和同步。
- `parts/` 负责 payload 内部拆分后的纯数据处理，例如 apply、result entry、group split、result status、summary、translation units。

policy 相关 mutation/check/default 已迁到 `services/policy/payload_rules/`，统一策略状态写入在
`core/payload/parts/policy_state.py`，运行时策略判定在 `services/policy/verdict.py`：

- `policy_mutations.py`、`legacy_policy_mutations.py` 负责 policy 阶段写字段。
- `policy_defaults.py` 负责 reset 阶段的 foundational/default translatable 判定。
- `legacy_policy_checks.py` 负责 legacy policy 中 CJK、引用条目、mixed literal 的纯判定。
- `core/payload/parts/policy_state.py` 负责统一写入 `classification_label`、`should_translate`、
  `skip_reason`、`final_status`。
- `services/policy/verdict.py` 负责统一回答是否调用模型、是否允许保留原文、是否阻塞导出。

禁止方向：

- `llm/providers/**` 不应 import `workflow`、`runtime.pipeline`、`rendering`。
- `policy/**` 不应 import `llm/providers` 或 `runtime.pipeline`。
- `payload/**` 不应 import `llm/providers`、`workflow`、`rendering`。
- `memory/**` 不应 import `llm/providers`、`workflow`、`rendering`。
- `translation/**` 整体不应 import `render`。

这些规则由 `backend/pipeline/devtools/check_pipeline_architecture.py` 逐步收紧。当前先卡住新增越界依赖，历史兼容入口会分批迁移。

当前架构门禁已经覆盖：

- translation 根目录只允许包初始化和 README，不允许新增根部大文件
- production 外部目录只能通过 `translate.public` 使用 translation contract
- `public/` 必须保持 lazy export，避免 eager import 拉起 workflow/rendering
- 已删除 shim 路径不可再引用
- translation 内部不得直接 import `runtime.pipeline`
- translation 整体不得直接 import `render`，唯一窄例外是 `workflow/execution_runner.py` 的 render source prewarm

## 主要流程

1. `core/ocr/` 读取统一中间层 `document.v1.json` 并抽取页面块
2. 如果入口给的是 provider 原始 JSON，则先由 `document_schema/adapters.py` 转成 `document.v1`
3. `workflow/translation_workflow.py` 生成每页翻译模板并加载 payload
4. `core/orchestration` 补齐布局区和编排元数据
5. `services/continuation` 先消费上游 `continuation_hint`，再用规则兜底，把连续段落合并成统一 translation unit
6. `services/policy` 根据模式决定跳过哪些块
7. `llm` 按 batch 调模型翻译、缓存和重试，并统一处理 placeholder/segment/fallback 控制
8. `core/payload` 把翻译结果回填到 page payload，并保存最终 JSON

补充约定：

- translation 主线不应该直接理解某个 OCR provider 的 raw JSON 结构
- translation 主线当前的默认落盘结果是“逐页 translation payload + translation-manifest.json”；这层负责产物内容和映射协议，不负责最终 PDF 文件名和渲染模式
- `document.v1` 里凡是已经带 `skip_translation` tag 的块，必须在 `core/ocr/json_extractor.py` 抽取阶段就被挡掉，不能再漏进翻译候选
- `abstract` 这类正文扩展语义可以继续进入翻译；`reference_entry`、`formula_number` 这类 provider 已明确标记跳过的块不应进入 payload
- 抽取阶段优先读取显式 `content.kind / layout_role / semantic_role / structure_role / policy.translate`；默认主链不再从 `derived.role / sub_type / raw_type / tags` 反推正文
- 抽取阶段会把 block 上的 `continuation_hint` 展开成 payload 里的 `ocr_continuation_*` 字段
- continuation 当前采用 provider-first 策略：优先消费同页 `intra_page` provider hint；跨页 `cross_page` hint 只在“相邻页 + 顺序明确 + layout_zone 命中页尾/页首阅读边界 + 文本长度足够”时受控消费，其余情况继续保留但不直接驱动拼接
- 如果只想排查 OCR 规范化是否有问题，优先看 `document.v1.report.json`
- Python 侧读取 report 摘要时，优先走 `document_schema/reporting.py`

默认正文白名单现在固定为：

- `content.kind == "text"`
- 且 `policy.translate == true`

这意味着：

- 正文是否进入翻译链，应该在 normalize / adapter 阶段决定
- translation 默认主链不再重新猜 `footer/header/page_number/table/image/code/reference_content`
- `ref_text`、`mixed_literal`、`metadata_fragment` 这类旧本地 skip / rewrite 规则已经退出默认主链

## 术语表 v1

当前术语表链路分成两层输入：

- 命名术语表资源：由 Rust API 先落库，再通过 `glossary_id` 引用
- 任务内 inline 术语：直接随任务一起传入 `glossary_entries`

进入 Python 之前，Rust 侧会先完成：

- 术语条目归一化
- 去重
- 命名术语表与 inline 术语的合并
- 相同 `source` 的覆盖统计

Translation 阶段当前只做两件事：

- 把合并后的术语表注入到 LLM 控制上下文，作为翻译偏好提示
- 在翻译结束后统计术语命中情况，并写入 `translation-manifest.json`、诊断文件和 pipeline summary

运行时注入规则：

- LLM 调用前会按当前 item 或 batch 的源文命中术语，只把命中的 glossary 条目写入提示词
- 缩写表也按源文命中后再注入，避免无关缩写污染当前段落
- `preserve` / `canonical` 这类硬术语仍只对命中的源文片段生效，不做全书无条件替换
- 如果源文没有命中某个术语或缩写，该条目不会进入当前 prompt，也不会影响当前缓存 key

明确不做的事情：

- 不做翻译后强制替换
- 不保证每个术语一定命中
- 不直接解析 Excel 文件

## Agent v1

当前 agent 不是独立进程，也不是新的 provider gateway，而是 translation 服务层里的角色化能力封装。它们复用现有
`llm/shared/provider_runtime.py`，不绕过既有模型、base_url、api_key 和结构化输出协议。

已落地的角色：

- `TerminologyAgent`
  按当前源文命中术语和缩写，避免把整张术语表塞进每次 prompt。
- `ConsistencyReviewerAgent`
  对翻译结果做规则型质量检查，例如英文残留、placeholder 不一致、术语缺失。
- `RepairAgent`
  对可修复问题构造 LLM repair task，只修当前 item，不扩写上下文。
- `TranslationAgentRuntime`
  统一执行 LLM agent task，默认走 active provider 的 `request_chat_content`。
- `TranslationAgentCoordinator`
  作为服务层编排入口，把 terminology/review/repair 串成稳定接口。

第一版边界：

- agent 可以构造 task、执行 task、解析结果、写入诊断或 review artifact
- agent 不直接读取 OCR 文件、不决定页面级 workflow、不写最终 PDF
- agent 不引入新的 SDK；新增 provider 时仍先接 `llm/shared/provider_registry.py`
- 多 agent 编排先保持在 translation 内部，外部 API 只暴露稳定产物和诊断

当前主链接入：

- 翻译批次和乱码修复结束后，会进入 `agent_repair` 后处理阶段
- 默认 `RETAIN_TRANSLATION_REPAIR_PROFILE=fast`，agent repair 只拿小预算做兜底修复，避免少量异常段落拖慢整本书
- `fast` 默认最多修复 8 个候选项；候选很少时会按阻塞未译项数量收缩
- `quality` 会放大 agent repair 预算，适合重质量的离线任务
- 可通过 `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=0` 彻底关闭
- 可通过 `RETAIN_TRANSLATION_AGENT_REPAIR=0` 跳过 agent repair 阶段
- 只修复英文残留、术语缺失、协议壳等可修复问题
- placeholder 数量/顺序错误、数学分隔符不平衡、上下文串入等硬错误只写 skip 诊断，不让 repair agent 猜

repair profile：

- `RETAIN_TRANSLATION_REPAIR_PROFILE=fast`
  默认模式。跳过重型乱码重构，保留小预算 agent repair 和最终空译收口。
- `RETAIN_TRANSLATION_REPAIR_PROFILE=quality`
  质量优先。启用更大的 agent repair 和最终恢复预算，适合对速度不敏感的任务。
- 单项覆盖：
  `RETAIN_TRANSLATION_GARBLED_RECONSTRUCTION=1`
  `RETAIN_TRANSLATION_AGENT_REPAIR=0|1`
  `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=N`
  `RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS=N`

后续推进顺序：

1. 先把更多现有“翻译后检查 / 修复 / 术语注入”收口到 coordinator。
2. 再把失败重试、英文残留修复、术语一致性修复接成可配置 pipeline。
3. 最后再考虑跨段落一致性 agent 或文档级术语记忆 agent，避免一开始就改主流程太大。

## 并发与失败调度

- DeepSeek 官方 API 的默认翻译 workers 由 Rust API 解析为 `1000`。请求体里的 `translation.workers` 仍然可以覆盖。
- Python HTTP 连接池会按 `configured_workers` 放大，默认上限 `1000`；可用 `RETAIN_TRANSLATION_HTTP_POOL_MAX` 临时压低。
- 主翻译通道的普通预算仍按调用路径设置；timeout、429、5xx、连接错误会进入有界 transport recovery，默认最多 4 次 attempt、从首次 transport failure 起最多等待 60 秒。
- 可用 `RETAIN_TRANSLATION_TRANSPORT_RECOVERY_ATTEMPTS=N` 和 `RETAIN_TRANSLATION_TRANSPORT_RECOVERY_SECONDS=N` 调整；将 seconds 设为 `0` 可关闭这层断网恢复。
- transport attempt 在真正发送前必须先 fsync 请求 journal；并发 dispatch 使用约 5ms 的 group commit 窗口合并 fsync，journal 持久化失败会阻止请求离开进程。
- 尾部 transport retry 会在主队列之后执行，默认允许 2 次 HTTP attempt，并使用更长 timeout。

## 模式说明

- `fast`
  不启用分类器。
- `sci`
  面向论文和技术文档，还会做领域推断。
- `precise`
  启用 LLM 分类器，只对可疑 OCR 块做额外判断。

## Policy Config 兼容说明

`services/policy/config.py` 里的 `build_translation_policy_config()` 目前还保留了几个旧字段，但它们已经不属于默认主链语义：

- `enable_narrow_body_noise_skip`
- `enable_metadata_fragment_skip`
- `metadata_fragment_max_page_idx`
- `enable_reference_zone_skip`
- `enable_reference_tail_skip`

当前约定是：

- 默认主链不会消费这些字段去重建旧 skip 逻辑
- 它们当前只作为 deprecated compatibility surface 保留，主要避免老测试/老调用方立刻报错
- 新代码不要再基于这些字段设计行为

注意：

- 这属于内部 Python translation policy contract，不是外部 HTTP API 契约
- 真实的“是否翻译”主决策仍应来自 `document.v1` 的显式 block policy

## 协作规矩

如果翻译模块单独分人维护，这里只负责“把 `document.v1.json` 变成稳定翻译产物”。

- 允许在这里改策略、并发、术语表、LLM 调度、payload 落盘和翻译诊断
- 不要在这里直接处理 provider raw OCR 结构，也不要把源 PDF 渲染逻辑塞回来
- 当前正式输出协议是“逐页 translation payload + `translation-manifest.json`”；渲染层应只消费这套协议
- 如果修改 payload 结构、manifest 字段语义或默认文件发现方式，必须同步更新 `runtime/pipeline`、`rendering`、README 和测试
- 术语表当前是翻译提示约束，不是渲染层规则，也不是 OCR 层规则；不要把术语逻辑扩散到其他模块
