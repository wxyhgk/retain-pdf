# 任务查询、重试与译文修订：内部设计

对外接口用法看 [`docs/api/`](../../api/README.md)：任务详情 [查询任务详情](../../api/01-任务/02-查询任务详情.md)、
[任务列表](../../api/01-任务/03-任务列表.md)、阶段操作 [actions](../../api/06-阶段操作/01-stage-actions.md) /
[retry-stage](../../api/06-阶段操作/02-retry-stage.md) / [续跑、取消与 OCR 歧义处理](../../api/06-阶段操作/03-续跑取消与OCR歧义.md)、
[失败结构](../../api/08-调试诊断/01-失败结构.md)、[Translation Debug API](../../api/08-调试诊断/02-translation-debug.md)、
[翻译报告](../../api/08-调试诊断/06-翻译报告.md)。这里只写这些接口背后怎么实现、为什么这样设计。

2026-11-24 从 `backend/api/docs/api-spec/` 的 `jobs-query.md`、`jobs-retry-and-control.md`、`translation-diagnostics.md` 挪过来，
对外用法已并进上面那几篇。代码在任务包 `backend/packages/retainpdf-jobs/src/`（逻辑路径 `services/jobs/…`）。

## 1. 列表和详情的投影

- 列表（`JobListItemView`）是给书库首页的稳定卡片投影：前端不再从 `request_payload`、原始产物或事件内部推卡片字段。
  失败只带精简的 `JobFailureBriefView`：书的任务列表每 2 秒轮询一次，完整 `JobFailureInfo` 带 traceback、`raw_excerpt`，
  一条就是几 KB，乘以轮询频率和列表长度不划算；要完整错误按需打详情。
- 精简失败的 `category` / `stage` 优先取正式字段（`failure_category` / `failed_stage`），旧字段在一部分任务上是 `unknown`。
- 当前阶段只在 `stage_snapshot`：`build_public_stage_snapshot` 对终态一律返回 `None`（终态看 `status`，不把 `done` 当阶段），
  顶层那组 `display_stage`/`stage`/`substage`/`lane`/`stage_detail`/`progress`/`background_stages` 由
  `backend/api/src/api_tests/jobs_live_stage.rs` 的 `assert_no_legacy_top_level_stage_fields` 钉住不许回流。
  成功收尾时写进 `job.stage_detail` 的「有 N 个内容块保留原文」因此另开 `completion_note` 送出去。
- `stage_snapshot` 是当前阶段和进度的权威来源；历史事件只用于展示和排障，不能用来推当前阶段（事件可能乱序、可能来自 OCR 子任务）。
- `stages.ocr.state` 在 OCR 跑在子任务 `<job_id>-ocr` 时跟着子任务的状态走（2026-11-02 起）；以前按阶段顺序推断，
  翻译一开始就显示 `completed`，而边识别边翻译（GLM-OCR）时 OCR 其实还在跑。
- `normalization_summary` 从 `document.v1.report.json` 取；`glossary_summary`、`invocation` 先读 `translation-manifest.json`，
  没有再退回流水线摘要，所以只重渲染的任务只要译文产物还在，也能显示原来翻译用的术语表。
- `contracts`（`job_stage_contracts.v1`）是 Rust 对阶段边界的产物校验：worker 说成功了但产物不全时 Rust 会拒，前端拿它解释原因。
  检查点感知的任务在 `translation_ready_for_render` 还要求 `translation_checkpoint_json` 已完成 / 已提交，`in_progress` 的检查点永远不能渲染。

## 2. 原地重跑（`relaunch_in_place`）

`retry-stage` 的 `render` + `create_new_job=false`、`refine`，以及续跑选中的原地重渲染，都保留任务编号在原任务上再跑一次，
统一走 `services/jobs/lifecycle/creation/submit.rs` 里的 `relaunch_in_place`（建新任务走同一文件的 `submit_job`）。

- 把任务改回 `queued` 的那次写是 CAS：只有库里还是读到时的那个终态、那一次运行代次才成功。两个并发请求只有一个开跑，
  另一个 409（赢家还在排队 / 运行时 `job_active`，已经跑完时 `stale_resolution`），赢家的行不会被盖回 `queued`。
- 被拒（409、`503` 模型执行器没开、额度不够、落库失败）时什么都不动：上一份译文 PDF、`<id>-ocr` 子任务和它的目录原样保留，
  `files/output/translated.pdf` 照旧能下载。以前续跑在校验之前就删了 `rendered/` 和 `-ocr` 子任务。
- 落库成功后才把上一份 PDF 改名成同目录的 `<名>.previous.pdf`，`artifacts.previous_output_pdf` 指向它：渲染器非原子地重写
  `rendered/<名>.pdf`，改名以后不会截断旧文件；排队期间合并阅读接着用它。`rendered/` 其余文件不再清空。续跑只在开跑以后才删过时的 `-ocr` 子任务。
- 这一次以 `failed` / `canceled` 结束、又没有新的 `output_pdf` 时，每次写任务都把 `artifacts.output_pdf` 指回上一份 PDF（文件还在的话），
  所以 `translated.pdf`、页预览、Word 导出继续可用；只有排队和运行期间 `translated.pdf` 是 `not ready`。

## 3. 精修的一次性参数

`retry-stage stage=refine` 的参数是一次性覆盖，写在 `<job>/specs/refine-override.json`，从不写进任务的 `translation.refine`；
渲染流程结束时删掉，运行时重启把任务重新排队时保留。render stage spec 的 `params.refine` 由 Rust 选：有这份覆盖文件就用它
（`trigger=manual`）；紧跟在翻译后面的渲染（book / 带 `render_after_translation` 的 translate，含它的持久续跑）用任务的
`translation.refine`（`trigger=auto`）；其余渲染（普通重渲染、续跑）一律 `off`。采纳的修改走译文修订历史（`source=refine`），
流程结束（成功、失败、取消）后改过的页登记到边翻边看（`pipeline_unit_committed`，`source=translation_revision`）。

## 4. 自动续跑与上限

- 运行时重启后，停在翻译阶段、请求日志里有「已发出、没有终态」的请求的任务不自动续跑（续跑会把这些请求原样再发一遍），
  落成 `failed` / `translation_request_ambiguous`（`resume_from=translation`）；日志干净或还没有日志的照旧自动续跑。渲染、精修阶段不看日志。
- 启动恢复和运行期的「没人在跑」巡检，按 pipeline attempt 数「连续几次放回排队、两次之间没有任何新进度（没提交新单元、没完成新阶段）」。
  到 `MAX_AUTO_RESUMES_WITHOUT_PROGRESS`（3）次后，下次再发现它中断就落 `failed` / `auto_resume_limit_exceeded`
  （`failure_category=internal`、`failed_stage=startup_recovery`、`retryable=true`、`resume_from=null`），不再续跑。
  两次中断之间有进度就清零；手动重试、续跑是新的 attempt，从 0 开始。计数存在 `pipeline_attempts.auto_resume_count` /
  `auto_resume_progress`（迁移 v27）。

## 5. OCR 派发的歧义

- 派发记录写在真正调服务商的那个任务下：书籍 / 翻译任务的 OCR 在子任务 `{job_id}-ocr` 里跑，记录属于子任务；单独的 OCR 任务记在自己身上。
  接口上的 `{job_id}` 是用户看到的编号，解析时先找 `{job_id}-ocr`、再找 `{job_id}`，所以书籍任务的 OCR 失败在书籍任务上报告和拦截。
- `bind_existing_receipt` 出的恢复任务也是书籍任务，带过去的回执挂在它自己的 `{recovery_job_id}-ocr` 子任务上，子任务调服务商时从轮询接着走、不再提交。
- 什么时候记成「不确定」：提交意图已记、调用以不能证明请求留在本地的方式失败（响应超时、连接重置、5xx、读不出响应），或上传中途被取消；
  运行时重启时意图还没有回执。能证明没发到 / 被拒的（连不上、请求没建成、4xx / 鉴权 / 额度拒绝）直接丢掉意图，普通重试照常放行。
- `resolution_revision` 就是派发的代次，处理时必须相等，防止过期的界面状态绑错派发。回执值（尤其 `upload_url`）、请求哈希、
  已有回执 JSON、凭据、原始请求都不出现在诊断和处理结果里；审计事件只记绑定了哪些字段名。

## 6. 取消

取消一律终止 worker 进程。以前只做 OCR 的任务在 `normalizing` 阶段不杀进程，理由是怕截断 `document.v1.json`；其实规范化唯一的落盘走
`save_json_atomic()`（同目录临时文件 + `os.replace`），被杀最多留一个孤立的 `.tmp`，目标文件要么完整旧、要么完整新；规范化又是全量重算，
重跑不用续跑簿记。豁免的代价却是真的：进程继续跑、库里既没杀也没终态，用户点了取消要等它自己跑完。所以去掉了。
杀之前核对库里记的 pid 还是这个任务的 worker（`terminate_job_worker`）。OCR 任务过了 `queued` 以后由 runner 观察到进程退出再写终态。
取消和任务自己跑完撞上时，取消标记会被立即清掉，不在内存登记表里留孤儿。

## 7. 译文诊断与修订

### 数据来源

- 翻译诊断：`artifacts/translation_diagnostics.json`；三份报告：`artifacts/translation_qa.v1.json`、`fit_report.v1.json`、`refine_report.v1.json`。
- 条目列表、单条、重翻、修订：`translated/translation-manifest.json` 和它指向的页文件。`artifacts/translation_debug_index.json`
  只在找不到 manifest 时给列表兜底（它在翻译结束时写一次，不随修订更新）。列表每次现算，所以修订后预览和搜索立刻是新的。
- 返回前统一脱敏（`redact_json_value` + 任务请求里的敏感值）。

### 重翻

调 `backend/pipeline/devtools/replay_translation_item.py`：按当前策略重算这条，还该翻译就 `translate_batch([item])`，从不写回任务目录。
进程 `kill_on_drop`，300 秒超时。`candidate` 的判定规则和脚本自己的 `--commit`（`_commit_replay_result`）一致。

### 改写（`PATCH`）的提交协议

Rust 只管「谁能写、什么时候能写」：任务排队 / 运行中 409 `job_running`，只写任务自己的 `translated/`（复用别的任务译文的渲染任务
会悄悄改掉源任务，所以 409 `translations_owned_by_another_job`），然后跑 `retainpdf-pipeline translation-revise`。Python 侧：

- 拿翻译检查点的文件锁（挡住检查之后才启动的 worker），要求检查点已提交、页哈希和页文件一致；用翻译时同一个
  `review_translation_item` 校验新译文，只有 error 级问题挡住。
- 成功时原子重写受影响的页文件（连续段的一个成员会重建整段，可能在别的页），推进 `translation-checkpoint.v1.json`
  （`page_hash`、`generation + 1`、新的代次快照），往 `translated/revisions.v1.jsonl` 追加一行。任何失败都恢复原字节。
- 崩溃安全：动页文件之前先写意图记录 `translated/.translation-revision-intent.v1.json`（上一个检查点的哈希、新代次、完整修订记录）。
  写入顺序：意图 → 页文件 → 新代次快照 → 检查点（提交点）→ `revisions.v1.jsonl` → 删意图。任意两步之间进程死掉（SIGKILL、断电、API 停机），
  下一次修订（持有检查点锁）先确定性地恢复：检查点还是旧的就回滚（从上一代快照恢复页文件，删新快照目录和临时文件），
  检查点已推进就前滚（补上缺的日志行）。结果总是完整旧状态或完整新状态。以前卡住的任务（页文件超前于检查点、没有意图记录）
  用同样办法治好：检查点为准、用它的快照恢复页文件；只有恢复要用的快照没了时才仍是 `publication_inconsistent`。
- `translation-revise` 子进程归后台任务所有，不归请求：客户端断开不会把它杀在提交中途。120 秒超时时 Rust 先 SIGTERM（Python 在进程内回滚），
  宽限期过后 SIGKILL，SIGKILL 留下的半截按上面的恢复处理。

### 登记到边翻边看

写完后 Rust 把改过的页登记进边翻边看的读模型：不新建 pipeline attempt、任务状态不变，原地推进这一页当前那行（实时阅读解析到的那行），
并把它那次 attempt 的 `generation` 加一，保证阅读端看到的 `(attempt, generation)` 单调。属于正在运行的 attempt 的页留给它的 worker。
所有页登记的哈希都和检查点一致以后，删掉比检查点代次旧的 `generation-*` 快照目录。登记失败不回滚写入：页文件和检查点是权威，
旧快照保留让边翻边看继续显示上一版；下一次修订（重发同一请求得到 `changed: false` 也会登记）或打开边翻边看（`GET progress/layout`）
时幂等重试。登记只接受 `revisions.v1.jsonl` 里记过的页哈希，也不让旧的检查点代次覆盖新的。

`rerender: true` 写完后提交一次原地重渲染；`artifacts/render_prewarm` 下的源清理缓存保留，只改文字时还能命中。
