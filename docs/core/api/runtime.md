# 运行时与实现备忘

**对外接口用法看 [docs/api/](../../api/README.md)**，这里只记 rust_api 内部怎么分工、怎么配置、为什么这样做。
2026-11-24 从 `backend/api/docs/api-spec/` 的 `runtime-and-events.md`、`jobs-submission.md`（上传的处理）、`storage-and-errors.md`
（实现备忘）、`live-translation.md`（生产方要求）、`reader-read-model.md`（端口交接）、`artifacts.md`（下载出口）里属于内部设计的部分
整理过来；对外的部分已经并进 docs/api 对应的篇。

相关：[存储结构](storage.md)、[本地启动与配置](local-dev.md)、[事件游标 v2](event-feed-v2.md)、
[当前运行主链](../../../backend/api/CURRENT_API_MAP.md)、[Rust API 架构边界](../rust_api/README.md)、
[Stage 执行契约](../../../backend/api/STAGE_EXECUTION_CONTRACT.md)。

## Rust 和 Python 的分工

- Rust（rust_api / retain-jobsd）：对外 HTTP 接口、认证、排队、SQLite 任务状态（持久化分 `jobs`、`artifacts`、`events` 三块）、
  OCR 服务商的传输（提交、上传、轮询、下载压缩包）、任务编排、对外暴露资源。Rust 不解析、不改 PDF 内部。
- Python worker：OCR 规范化成 `document.v1.json`、翻译、Typst 渲染、PDF 合并和后处理，是唯一的执行实现，由阶段 spec 文件驱动。
- Rust 用 `python -m retainpdf_pipeline.<stage>` 启动阶段 worker（`RUST_API_PYTHON_ENTRYPOINT_MODE` 已废弃、忽略），参数一律是
  `--spec <job_root>/specs/*.spec.json`，不再拼长命令行。手工跑用 `retainpdf-pipeline normalize-ocr` / `translate-only` / `render-only`，
  spec 和 stdout 契约完全一样；`retainpdf-pipeline provider-case` 只给本地手工跑，不是生产编排路径。
  `backend/pipeline/devtools/` 下的回归脚本不属于运行时契约。
- 以后要把 Python worker 拆成独立服务也直接：对外 API 已经稳定，换的只是 Rust 怎么调 worker。

阶段契约：

1. `normalize.stage.v1`：OCR 原始结果 → `ocr/normalized/document.v1.json`
2. `translate.stage.v1`：`document.v1.json` → `translated/`
3. `render.stage.v1`：译文 + 原文 PDF → `rendered/*.pdf`。`params.refine` 总是写全：
   `{"mode": "off|review_only|review_and_fix", "trigger": "auto|manual", "start_page": null|int, "end_page": null|int, "max_items": int, "max_tokens": int, "reviewer_model": str, "reviewer_base_url": str, "reviewer_credential_ref": "" | "env:RETAIN_REVIEWER_API_KEY"}`。
   `mode != off` 时 worker 在渲染前精修已提交的译文。模式由 Rust 定：`retry-stage stage=refine` 的一次性覆盖
   （`specs/refine-override.json`）→ 覆盖值、`trigger=manual`；紧跟翻译的那次渲染（Book、带 `render_after_translation` 的 Translate，
   含它的续跑）→ 任务的 `translation.refine`、`trigger=auto`；其余渲染（单纯重渲染、重跑）→ `off`。页码从 1 起、含两端。
   翻译模型照旧用 `params.model/base_url/credential_ref`；密钥只走环境变量（`RETAIN_TRANSLATION_API_KEY`、`RETAIN_REVIEWER_API_KEY`）。

下游 worker 读 `document.v1` 的正式字段：`geometry`、`content`、`layout_role`、`semantic_role`、`structure_role`、`policy`、`provenance`。
`type/sub_type/bbox/text/lines/segments` 这类兼容字段可能还在，但不再是规范化和翻译、渲染之间的主契约。

Python worker 往 stdout 打的结构化 `artifact_published` 记录是 Rust/Python 之间的内部契约，形状和 `pipeline_events.jsonl` 里的
`event_type`、`payload.artifact_key` / `payload.path` 一样。

## 模块边界

- `routes/*` 只做 HTTP 请求、响应的适配。
- `services/jobs/*`（逻辑路径，代码在 `backend/packages/retainpdf-jobs/src`）负责任务的查询、展示、建任务编排和控制。
- `services/jobs/lifecycle/snapshot_factory` 拼任务快照；`worker_command` 构造 Python worker 的命令和 spec。
- `backend/packages/retainpdf-runner/src/job_runner/*` 负责运行时执行、进程生命周期、OCR 子任务串联和取消。
- `AppState` 只留在路由入口和运行时协调层；纯拼装的函数优先收 `&Db`、窄的配置投影和显式参数。
- 下载都经 `JobDownloads::open`（任务的文件）或 `library::open_document_file`（书的文件）解析，返回的状态码、类型、文件名、
  缓存头钉在 `backend/api/docs/file-responses.txt`。

还没做的：回调 / webhook、产物签名链接、通用的任务状态 SSE 推送（`progress/events` 仍是分页 JSON 历史；边翻边看的 SSE 已经有）。

## 配置

优先级（低到高）：代码默认值 → 本地配置文件 → 环境变量 → 命令行 / 进程启动参数 → 请求里白名单内的业务参数。
请求只能覆盖业务参数；路径、监听地址、数据目录、运行时存储位置不能由请求改。接口地址、阶段名、产物键、schema 版本、stdout 标签
是协议常量，故意不做成环境变量。`DATA_ROOT`（`RUST_API_DATA_ROOT`）是上传、任务、下载、SQLite 的唯一存储根。

API key：`RUST_API_KEYS` 设了就用它（空值报错），没设才读 `auth.local.json`（见 [本地启动与配置](local-dev.md#鉴权)，代码
`backend/packages/retainpdf-core/src/config/auth.rs`）。旧文档写的「`auth.local.json` 存在时覆盖环境变量」已经不对。

默认值在 `backend/packages/retainpdf-core/src/config/*`：

| 文件 | 管什么 |
|---|---|
| `paths.rs` | 项目、数据、脚本、任务、上传、下载目录 |
| `auth.rs` | `auth.local.json`、API key、任务并发、第二个端口 |
| `server.rs` | 监听地址、API 端口、Python 解释器 |
| `upload.rs` | 全局上传大小、页数闸门 |
| `provider.rs` | MinerU / Paddle / DeepSeek 的运行时参数和服务商限制 |
| `job_runner.rs` | 排队轮询、worker 终止、失败诊断、同步等待 |
| `config.rs` | 对外的 `AppConfig` 门面 |

任务运行：

- `RUST_API_MAX_RUNNING_JOBS`：同时跑几个任务，默认 `4`；`RUST_API_QUEUE_POLL_INTERVAL_MS`：排队轮询间隔，默认 `250`。
- `RUST_API_WORKER_TERMINATE_GRACE_SECS`：SIGTERM 后等多久再 SIGKILL，默认 `3`；`RUST_API_WORKER_TERMINATE_POLL_MS`：等 worker 退出的轮询间隔，默认 `100`。
- `RUST_API_WORKER_OUTPUT_DRAIN_SECS`：worker 退出后，stdout 读取方多久没读到新行就放弃，默认 `30`（stderr 是总共等多久）。
  stdout 还在消化积压时会一直等，最多这个值的 20 倍——每一行都要落库，打了几千行进度就退出的 worker 可能留下一串积压，
  最后一行才是 `output_pdf` 的发布（2026-11-04）。正常都是瞬间结束；设上限是因为调了 `setsid()` 的孙进程躲过进程组击杀、
  一直开着管道写端，否则 runner 会在那个任务上无声地挂住。到时丢掉剩下的输出，任务照样落终态。
- `RUST_API_FAILURE_AI_DIAGNOSIS_TIMEOUT_SECS`：失败诊断子进程时限，默认 `60`。
- `RUST_API_SYNC_BUNDLE_WAIT_INTERVAL_MS`：同步打包等任务终态的轮询间隔，默认 `1500`。

OCR 服务商：

- 上传闸门：`RUST_API_MINERU_MAX_BYTES`（`209715200`）、`RUST_API_MINERU_MAX_PAGES`（`600`）、`RUST_API_PADDLE_MAX_BYTES`（`104857600`）、
  `RUST_API_PADDLE_MAX_PAGES`（`999`）。对外的说法见 [限制](../../api/00-约定/04-限制.md)。
- MinerU：`RUST_API_MINERU_BASE_URL`（`https://mineru.net`）、`…_REQUEST_TIMEOUT_SECS`（`120`）、`…_UPLOAD_TIMEOUT_SECS`（`300`）、
  `…_DOWNLOAD_TIMEOUT_SECS`（`300`）、`…_POLL_RETRY_LIMIT`（`5`）、`…_POLL_RETRY_BASE_DELAY_SECS`（`2`）、`…_POLL_RETRY_MAX_DELAY_SECS`（`10`）、
  `…_BUNDLE_DOWNLOAD_RETRY_LIMIT`（`8`）、`…_BUNDLE_DOWNLOAD_BASE_DELAY_SECS`（`2`）、`…_BUNDLE_READY_RETRY_LIMIT`（`8`）、
  `…_BUNDLE_READY_BASE_DELAY_SECS`（`2`）、`…_BUNDLE_READY_TIMEOUT_CAP_SECS`（`120`）、`…_BUNDLE_RETRY_MAX_DELAY_SECS`（`12`）、
  `…_WAITING_FILE_GRACE_SECS`（`90`）。
- Paddle：`RUST_API_PADDLE_BASE_URL`（`https://paddleocr.aistudio-app.com`）、`…_REQUEST_TIMEOUT_SECS`（`120`）、`…_DOWNLOAD_TIMEOUT_SECS`（`300`）、
  `…_REQUEST_RETRY_ATTEMPTS`（`3`）、`…_REQUEST_RETRY_BASE_DELAY_MILLIS`（`500`）、`…_MAX_INPUT_IMAGES`（`999`）。
  `RETAIN_PADDLE_DEFAULT_MODEL` 是 Rust、Python 共用的默认模型覆盖（默认取 `backend/config/ocr_providers.json`），
  `RUST_API_PADDLE_DEFAULT_MODEL` 只在前者没设时当兼容别名。
- 服务商清单：`RETAIN_OCR_PROVIDER_CONFIG`（Rust、Python 共用，默认 `backend/config/ocr_providers.json`），
  `RUST_API_OCR_PROVIDER_CONFIG` 只在前者没设时当兼容别名。
- DeepSeek：`RUST_API_DEEPSEEK_BASE_URL`（`https://api.deepseek.com/v1`）、`RUST_API_DEEPSEEK_BALANCE_URL`（`https://api.deepseek.com/user/balance`）。
- 密钥校验：`RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`（`20`，旧名 `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS`）、
  `RUST_API_ALLOW_PRIVATE_PROVIDER_URLS`，对外的说法见 [服务商校验](../../api/08-调试诊断/05-服务商校验.md)。

日志开关 `RUST_LOG_FORMAT`、`RUST_API_ACCESS_LOG` 由 rust_api 自己读（不在 `retainpdf-core` 的配置里），见 [本地启动与配置](local-dev.md)。

## 上传的处理

对外行为（字段、返回、状态码）见 [创建任务](../../api/01-任务/01-创建任务.md#上传)。内部：

- PDF 解析、算哈希、落文件、写库在阻塞线程上跑，不占 async 执行线程。
- 解析和 Python 修复各有容量，归一个应用级的 `UploadService` 管。主端口、第二个端口、单独上传、OCR 提交、打包提交从同一个 `AppState`
  共用它。修复（含修完再解析）不占普通解析的名额。两段的等待共用一个有界队列，每次等待有期限；队列满、等超时回 503。
- 开始解析之前断开，释放队列和输入预算；一旦开始解析，就算调用方断开也做完，名额归这份工作。断开不代表上传被拒了。
- 等修复之前先放掉原始 PDF 字节。另有按 MiB 取整的输入预算，管住处理层留着的缓冲：暂时用完回 503；单个 PDF 超过整个预算回 413。
  这不是总 RSS 上限：multipart 缓冲在准入之前，解码后的解析内存另算。
- Python 修复 60 秒时限，超时杀掉并回收直接子进程。修复工具不在、超时回 503；修不好、页数超限回 400。Python 的 stdout/stderr 不回给客户端。
- 失败的上传只清自己新建的目录。上传记录和文档记录在一个 SQLite 事务里发布；按内容哈希去重、原始输入哈希的语义不变。
- 同步的 PDF 解析隔离且限并发，但不会被墙钟时限强行打断。进程崩溃、清理没权限仍可能在磁盘上留孤儿；这不是文件系统和数据库的分布式事务。

配置（进程启动前设，改了要重启；在构建 `AppConfig` 时读一次显式传进服务，空闲时和后续请求都不重读）。容量不按目录全局登记：
独立的 `build_state` 各有各的容量，哪怕上传目录相同；要共享容量就显式共用同一个服务实例。这是进程内的限制，不跨 API 进程协调。

| 环境变量 | 默认 | 范围 |
|---|---|---|
| `RUST_API_UPLOAD_PARSE_WORKERS` | 可用 CPU 并行度，最多 4 | 1–32 |
| `RUST_API_UPLOAD_REPAIR_WORKERS` | 2 | 1–8 |
| `RUST_API_UPLOAD_QUEUE_CAPACITY` | 8 个共享等待位 | 0–64（0 不等待） |
| `RUST_API_UPLOAD_QUEUE_WAIT_MS` | 每段等待 5000 | 1–60000 |
| `RUST_API_UPLOAD_BUFFER_MIB` | 512 | 1–16384 |

越界的数字夹到范围内，格式不对用默认值。这些是保守的起点，不是通用的吞吐最优。准入总数 = 解析名额 + 修复名额 + 队列容量
（含发布工作），缓冲压力可能更早拒绝。要收超过 512 MiB 的 PDF，输入预算和单个上传上限一起调。每个上传读页数时从预算里预留文件大小：
整个文件读进内存一次，流内容（图片、页面内容、字体）边解析边丢，峰值约等于文件大小（2026-10-28 以前每个流都多留一份，峰值约翻倍）。
压测要连解析器 RSS 和别的 API 流量一起看，不只看上传吞吐。

## 模型执行器的内部接口

翻译 worker 经 Rust 执行器调上游模型：

- `POST /api/v1/internal/model/jobs/:job_id/requests`
- `GET /api/v1/internal/model/jobs/:job_id/requests/:operation_id`
- `POST /api/v1/internal/model/jobs/:job_id/requests/:operation_id/cancel`

它们在 `X-API-Key` 那一层之外，要 `Authorization: Bearer <能力令牌>`：64 位十六进制，绑定一个任务，由任务运行时在启动 worker 时
进程内签发。应用的 API key 永远不能当能力令牌用。没有签发接口：`POST /api/v1/internal/model/jobs/:job_id/capability` 没有生产调用方，
2026-10-22 删了。多用户下 `closed`。

令牌在解析请求体之前查，没有有效令牌只会得到 `401`，看不到任何关于请求体的信息。令牌有效时，请求体错误照共用的解析规则走统一信封
（见 [响应格式](../../api/00-约定/01-响应格式.md#请求本身解析不了)），不回显请求里的值。成功回裸 JSON（`ModelOperation`，取消是
`{"changed": bool}`），出错是统一信封。时限见 [限制](../../api/00-约定/04-限制.md#时间)。

## 运维指标的计数

`/metrics` 的计数和 `<data_root>/diagnostics/route-usage.json`（`app/route_usage.rs`）是同一份数：从文件的 `since` 起累计，重启不丢。
文件多了 `route_stats`（每个键：`status`、`latency_ms` 分桶 `le_50`/`le_200`/`le_1000`/`le_5000`/`gt_5000`、`latency_us_sum`、`streaming`），
`routes` 不变。对外的说法见 [运维指标](../../api/08-调试诊断/04-运维指标.md)。

## 边翻边看的生产方要求

对外的读法见 [边翻边看](../../api/02-进度事件/04-实时译文.md)。

- 页快照接口先选这一页最新提交的 `translate` 流水线单元，再只读 `.translation-checkpoints/generation-*` 下原始 SHA-256 等于库里
  `page_hash` 的那份不可变快照，不读还会被改写的译文页文件。
- 顺序是有意的：先原子写页快照，再提交流水线单元和事件，再发 SSE 通知，客户端再读权威页。所以断线、服务重启都不会让客户端看到后来又消失的译文。
- 每一页要对阅读层可见，都必须有自己那一页的、带着这页确切快照哈希的已提交 `translate` 单元。只报旧的全局 `last_committed_unit`
  的检查点不能授权别的脏页，哪怕文件已经在盘上；读那些页故意回 `LIVE_TRANSLATION_PAGE_NOT_COMMITTED`。
- 一次刷多页时，worker 在 `pipeline_checkpoint_v1` 里带可选的 `committed_pages` 数组，每项 `unit_key`、`unit_order`、`page_index`、
  `page_hash`、`changed_item_ids`。字节变了但译文指纹没变的页（例如翻译后只加 `translation_diagnostics`、把每页重存一遍的阶段）
  也要报，`changed_item_ids` 为空，这样它提交的 `page_hash` 才能和唯一留着的快照对上；Rust 把事件的 `changed_item_ids` 填成这页的
  `unit_key`，客户端忽略。
- Rust 在一个 SQLite 事务、一个权威代次里校验并提交整个数组，然后每页生成一条持久的刷新事件。旧的顶层单元字段老 worker 照旧能用，
  但一次观测里不能和 `committed_pages` 混用。有一页不合法，整批都不可见。`unit_order` 是稳定的文档顺序，不是完成顺序：并发 worker
  可能先提交后面的页、再提交前面的页，这不会让阶段的最高已提交游标倒退；权威的改动顺序来自带围栏的代次。
- 版面投影：从规范化 OCR 文档读页尺寸、块的 `item_id`、`bbox`、原文、类型；有合法的排版计划时块的 `bbox` 用计划里的背景框，
  `padding_*` 是持久化的背景框和内容框之差；`typography` 的版面值读结构化的渲染预热清单，字体读任务持久化的渲染设置。

## 阅读宿主的端口交接

前端宿主不用解析原始数据就能实现阅读器运行时：

```ts
ReaderDataPort.loadArtifacts(jobId)
ReaderDataPort.loadArtifactManifest(jobId)
ReaderDataPort.loadMarkdownDocument(jobId)
ReaderDataPort.loadRegions(jobId)
ReaderDataPort.loadMetadata(jobId)
ReaderLiveTranslationPort.loadLayout(jobId)
ReaderLiveTranslationPort.loadPage(jobId, pageIdx)
ReaderLiveTranslationPort.streamEvents(jobId, cursor)
```

宿主负责认证、HTTP/SSE 传输、mock，以及把线上契约转成阅读器自己的 DTO。可复用的阅读器包不能引 API 客户端、不能读 RetainPDF 的
产物约定、不能按后端的 message 文字分支。接口见 [阅读接口](../../api/12-阅读/01-阅读接口.md)。

## 备份、恢复和同步

- 恢复数据库、手动 / 自动备份、一次同步周期，都在脱离请求的 `tokio::spawn` 任务里跑，由它持有服务锁、「同步暂停」守卫和 `running`
  标志（drop 守卫复位）；HTTP 处理函数只等结果，所以客户端断开不会在阻塞工作还在跑时释放锁（2026-10-22）。
- 恢复先检查备份，再写 `before-restore` 安全备份；在一个事务里准备好解包的副本（升级 schema、重置同步记账、清掉过期 pid），
  再查一次 `restore_blockers`，然后用一次 SQLite 在线备份把副本换进来，所以前面任何一步失败都不碰正在用的库。最近一次恢复的结果
  留在内存里，就是 `GET /backups` 的 `last_restore`。
- `GET /backups`、`GET`/`PUT /sync` 在阻塞线程上读写 SQLite；`PUT /sync` 先校验整个输入，再一次事务写入。
  `POST /sync/test` 用只做探测的 WebDAV 客户端（每个请求 10 秒、不重试、探测文件用普通 PUT），整体 60 秒时限。
  对外的说法见 [数据库备份](../../api/10-备份/01-数据库备份.md)、[多设备同步](../../api/09-同步/01-多设备同步.md)。

## 协议名

`workflow = "book"` 是完整流程在协议里的名字，为了 API 稳定留着，不代表面向用户的入口要露出服务商名。
