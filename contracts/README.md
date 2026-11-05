# Schemas — 单一真值契约

本目录是 **RetainPDF 跨进程契约的唯一真相源**（JSON Schema）。

这里锁定 wire payload 的结构，不替代完整 HTTP 协议文档。路由、认证、错误、
下载、恢复和 SSE 行为仍以 `backend/api/API_SPEC.md`、
`backend/api/docs/api-spec/` 及对应实现契约测试为准。

| 文件 | 作用 | 消费者 | 生产者 |
|------|------|--------|--------|
| `create-job.v1.schema.json` | POST /api/v1/jobs 的**请求**体（CreateJobInput 六个顶层字段 + 五个段），每段 additionalProperties:false 对应后端 deny_unknown_fields | `frontend/web` 的 payload 构造器（`features/ingest/domain/workflow/payload.ts`，用生成的 TS 类型）与 mock 层（`platform/api/mocks/job-payload-contract.ts`，用生成的运行期字段名清单） | `backend/packages/retainpdf-core/src/models/input/request.rs` 的 `contract_tests` |
| `glossaries.v1.schema.json` | 术语表 `/api/v1/glossaries`：列表（带筛选）、新建、读一张、整份保存（`expected_updated_at` 防覆盖，409 `glossary_changed`）、删除、导出 CSV（`binary`，直接是文件）、解析 CSV；词条 `GlossaryEntryInput` 从 `create-job.v1` 抄（`tests/glossaries-shared-definitions.test.mjs` 锁成一致）；请求体和查询参数 `additionalProperties: false` 对应 `deny_unknown_fields`。设置类第 2 批第 1 组（2026-10-29），7 条都有 `client_name` | `@retainpdf/contracts/glossaries`（前端换掉 `frontend/packages/api/src/glossaries.ts` 里手写的请求） | `backend/packages/retainpdf-glossaries/src/views.rs`、`api.rs`，`backend/api/src/routes/glossaries.rs`；`backend/api/src/api_tests/glossaries_contract.rs` 钉键集合 |
| `library-books.v1.schema.json` | 删任务 `DELETE /api/v1/jobs/:job_id` 的返回；任务列表 `GET /api/v1/jobs` 和它的定义只在 `job-status.v1`（这里重复的端点和抄过来的 14 个定义 2026-10-23 删了）；名字沿用书架时期，书架 `/api/v1/library/books` 和它的类型 2026-10-22 删了 | `@retainpdf/api`（`LibraryDeleteResultView`） | `backend/packages/retainpdf-jobs/src/views/common.rs`（删任务的返回 `JobDeleteResultView`） |
| `library-documents.v1.schema.json` | 书 `/api/v1/documents`（列表、单本、改、删）、阅读入口 `/reading`、翻译覆盖 `/translation-coverage`、书的文件清单 `/files`、元数据建议、全文检索 `/api/v1/search`、合集 `/api/v1/collections`；书的任务列表 `/jobs`、翻译这本书 `/translate`、给这本书做 OCR `/ocr`（第 1b 期，请求体 `CreateJobInput` 从 `create-job.v1` 抄、任务列表条目和提交结果的链接从 `job-status.v1` 抄，`tests/library-documents-shared-definitions.test.mjs` 锁成一致；402 页数额度错误的 `error.details` 是 `PageQuotaExceededErrorDetails`）；请求体和查询参数 `additionalProperties: false` 对应 `deny_unknown_fields` | `@retainpdf/contracts/library-documents`（前端以后换掉 `frontend/packages/api` 里手写的类型） | `backend/packages/retainpdf-core/src/models/library.rs`、`backend/packages/retainpdf-library/src/views.rs`、`merge/reading.rs`、`merge/coverage.rs`、`media.rs`；`backend/api/src/api_tests/library_documents_contract.rs` 钉键集合 |
| `ocr-providers.v1.schema.json` | OCR 提供方清单 `GET /api/v1/providers/ocr`（不分页）：凭据字段、选项（带 `client_settable`，只能服务器定的不给默认值）、能力、产物布局 | `@retainpdf/contracts/ocr-providers`（前端现在用写死的 `frontend/web/src/platform/config/providers.ts`，要不要换由前端定） | `backend/packages/retainpdf-core/src/models/ocr.rs`、`backend/packages/retainpdf-data/src/ocr_provider/catalog.rs`（`provider_client_definitions`）；`backend/api/src/api_tests/providers.rs` 钉键集合 |
| `job-status.v1.schema.json` | 任务详情、脱敏请求参数与阶段进度 | `@retainpdf/api`、`frontend/packages/domain`、`frontend/web`、`frontend/web-react` | `backend/api` public view models |
| `job-events.v2.schema.json` | 普通/OCR 事件游标分页、稳定事件身份 | `@retainpdf/api`、`frontend/web` | `backend/api` event feed |
| `job-actions.v1.schema.json` | 任务操作 `/api/v1/jobs/:job_id/actions`（能做哪些操作）、`actions/cancel`、`actions/resume`（GET 续跑计划、POST 续跑）、`actions/retry-stage`、`actions/resolve-ocr-ambiguity`；409 的 `error.details.reason` 取值 `ActionBlockReason` | `@retainpdf/contracts/job-actions`（前端以后换掉 `frontend/packages/api/src/jobs-actions.ts` 里手写的类型） | `backend/packages/retainpdf-jobs/src/views/job_types.rs`、`views/common.rs`（`JobSubmissionView`）、`backend/api/src/routes/jobs/actions.rs`（续跑请求体）；`backend/api/src/api_tests/job_actions_reports_contract.rs` 钉键集合 |
| `job-reports.v1.schema.json` | 任务报告 `reports/failure`（失败原因、OCR 歧义）、`reports/quality`（质量体检卡）、`reports/quality/items`（逐条清单）、`reports/translation`（翻译诊断） | `@retainpdf/contracts/job-reports`（前端以后换掉 `quality.ts`、`jobs-actions.ts` 里手写的类型） | `backend/packages/retainpdf-jobs/src/views/job_types.rs`、`reports/quality/mod.rs`、`views/translation.rs`；同上测试钉键集合 |
| `jobs-control.v1.schema.json` | shell↔jobsd 控制面 | `backend/api/src/api_tests/jobs_control_contract.rs` | `backend/jobs/src/contract_lock.rs` |
| `pipeline-stdout.v1.schema.json` | Python stdout 协议 | `backend/packages/retainpdf-runner/src/job_runner/stdout_parser/contract_lock.rs` | `backend/pipeline` worker 与对应 contract test |
| `translation-revisions.v1.schema.json` | 译文条目列表 `GET /api/v1/jobs/:job_id/translations`、单条 `GET .../translations/:item_id`、重放一条 `POST .../replay`（不带请求体，第 1b 期）；单块译文修订写回 `PATCH /api/v1/jobs/:job_id/translations/:item_id`、修订历史 `GET .../revisions`、`translated/revisions.v1.jsonl` 行格式与 409/422 结构化错误 | 前端任务详情的翻译调试、阅读页编辑、终端 agent | `backend/api/src/api_tests/translation_debug/revisions.rs`、`translation_debug/items_contract.rs`、`backend/translation/retainpdf_translation/workflow/revision.py` |
| `refine-report.v1.schema.json` | 译后精修报告 `artifacts/refine_report.v1.json` 与 `GET /api/v1/jobs/:job_id/reports/refine`（挑错发现、定点修改的采纳/拒绝及原因、token 用量、精修前后 QA 对比） | `GET .../reports/refine` 的调用方（以前的终端 agent 命令行 `retainpdf-agent` 2026-11-03 删了） | `backend/translation/retainpdf_translation/workflow/refine.py` |
| `reader-data.v1.schema.json` | Reader 宿主读模型：产物、Markdown、区域、页面元数据、实时译文布局/快照/SSE | Reader host adapter、后续 `@retainpdf/reader` ports | `backend/api` Reader 查询视图 |
| `studio-bridge.v1.schema.json` | RetainPDF 网页放在笔记（Studio）的 iframe 里时两边的 `postMessage` 消息：握手 `hello`/`ready`、`theme`、`navigate`、`quote`、唤出笔记 `open-notes`/`close-notes`/`notes`、眼下读到哪 `reading`、打开 Studio 自己的 AI `ask-ai`、书库里点书交给 Studio `open-book`（2026-11-03）、阅读页有焦点时把它不处理的快捷键转给 Studio `shortcut`（2026-11-04）、摘录栏里摘过的段落让阅读页标出来 `quoted`（2026-11-05）、书这一侧的控件由 Studio 画 `reader-state`/`reader-command`（2026-11-05）；地址参数 `embed=studio`；只认本机回环地址的父窗口。没有端点，不生成 TS 类型，不进 `backend/contracts` 镜像（后端不用）。方案见 [书和笔记接在一起](../docs/ops/planning/studio-workbench/20261101-书和笔记接在一起.md)、[阅读页唤出笔记](../docs/ops/planning/studio-workbench/20261101-阅读页唤出笔记.md) | `frontend/`（阅读页、嵌入模式）和 notes-studio 仓库各写一侧；`tests/studio-bridge-contract.test.mjs` 钉消息的样子 | 同左，两边都发 |

`contracts/*.schema.json` 是 monorepo 上游真值；
`backend/contracts/*.schema.json` 是可独立提取后端使用的字节级镜像。
当前仓库不再依赖 `backend/contracts` 兼容路径。镜像一致性由
`python3 backend/contracts/check_parity.py --require-upstream` 检查。

**规则**：改契约先改 schema，再让两端测试变绿。

**地址**：`endpoints[].path` 只写现用地址。2026-10-18 起旧地址都已删除，契约里不再有 `deprecated_aliases`；
接口换了新地址就直接改 `path`。返回形状不一样的新接口（比如 `/files` 和已删除的 `/artifacts-manifest`）要另写一条
endpoint 和它自己的 definition。全部接口见 `docs/api/00-接口目录.md`。

**端点表**：`endpoints[]` 每条至少有 `method`、`path`，请求体、查询参数、返回分别写 `input`、`query`、`output`（定义名）。
给前端生成请求函数用的两个字段（方案见
[从契约生成前端请求函数](../docs/ops/planning/api-client-codegen/20261022-从契约生成前端请求函数.md)）：

| 字段 | 说明 |
|------|------|
| `client_name` | 前端生成的函数名，小驼峰（`listDocuments`），显式写、不从地址推；**全部契约里不许重名**。不复用 `op`（那是 jobs-control.v1 里 jobsd 的内部操作名） |
| `transport` | 返回方式：`json`（不写等于它，`{code, data}` 信封）、`sse`、`binary`、`websocket`、`raw_json`（JSON 但不带信封）。不叫 `response`（jobs-control.v1 的 `response` 是返回类型） |

现在 `library-documents.v1` 的 17 条都有 `client_name`；第 1a 期（2026-10-22）给 `job-status`、`create-job`、`library-books`、`job-data`、`job-events`、`reader-data`、`token-usage` 的 16 条补上了（`GET /api/v1/jobs` 只在 `job-status.v1`；`library-books.v1` 以前重复登记的一条 2026-10-23 删了）；第 1b 期给 `translation-revisions.v1` 加了译文条目的 3 条（`listTranslationItems`、`getTranslationItem`、`replayTranslationItem`；同一份契约里的写回、修订历史前端没要名字，没起），给 `library-documents.v1` 在原来 17 条后面加了 `listDocumentJobs`、`translateDocument`、`ocrDocument`；`reader-data.v1` 的 `progress/stream` 是 `sse`
（2026-10-22 以前下载写的是 `response_body: "binary"`，已并进 `transport`；当时用它的 `agent-calculation.v1` 2026-11-03 跟 AI 服务一起删了）。
第 1b 期（2026-10-22）新建 `job-actions.v1`（6 条）、`job-reports.v1`（4 条），每条都有 `client_name`。
设置类第 2 批（2026-10-29 起，按前端排的顺序一组一组补）：第 1 组新建 `glossaries.v1`（7 条，导出 CSV 是 `binary`）。
`scripts/lint-schemas.mjs` 查端点的键（有白名单，拼错的键直接红）、`method`、`transport` 的取值、`client_name` 的格式和重名；带 `client_name` 的端点，`query`/`input`/`output` 必须是本契约 definitions 里的名字（生成器按名字取类型，写说明文字会让它报错）。

**抄定义**：`$ref` 只许指本文件（`lint-schemas.mjs` 只解析本地指针），前端生成器也只读同一份契约的 `definitions`，所以一个契约要用别的契约的类型时原样抄一份，再加一条测试锁住和源头一致（`job-shared-definitions-parity.test.mjs`、`library-documents-shared-definitions.test.mjs`）。要改先改源头，再照抄。

**和接口登记表一致**：rust_api 的 `route_manifest` 测试（`contract_endpoints_are_registered`）读 `backend/contracts/*.schema.json`
的端点表，每条方法加地址都要在接口登记表（`backend/api/src/app/endpoints.rs` 那些 `crate::endpoints!` 表）里、而且不是旧地址；
反过来不要求。删了接口、改了地址却忘了改契约，这条测试红。规则：

- `jobs-control.v1` 排除：jobsd 自己的接口，由 `backend/jobs/src/contract_lock.rs` 对 jobsd 的路由双向比；
- 有 `proxy_path` 的比 `proxy_path`（以前只有 `runtime-config.v1` 用，它 2026-11-03 跟 AI 服务一起删了，现在没有契约带这个键）；
- 地址先归一：`{job_id}` 换成 `:job_id`，`?` 后面的查询串去掉。

## npm 包

本目录发布为 `@retainpdf/contracts`。Wire DTO 从 `@retainpdf/contracts/glossaries`、`@retainpdf/contracts/job-status`、`@retainpdf/contracts/job-events`、`@retainpdf/contracts/job-actions`、`@retainpdf/contracts/job-reports`、`@retainpdf/contracts/library-books`、`@retainpdf/contracts/library-documents`、`@retainpdf/contracts/ocr-providers`、`@retainpdf/contracts/reader-data` 与 `@retainpdf/contracts/translation-revisions` 导出；原始 schema 以文件名子路径显式导出。包没有根 DTO 入口、wildcard export 或 runtime dependency。

`@retainpdf/contracts/create-job-fields` 是唯一导出**运行期值**的子路径：`CREATE_JOB_TOP_LEVEL_FIELDS` 与 `CREATE_JOB_SECTION_FIELDS` 是 `create-job.v1.schema.json` 里各 definition 的 `properties` 键。TS 类型在运行期不存在，而 `frontend/web` 的 mock 要模拟后端的 `deny_unknown_fields`（多一个键 => 400），需要的正是一份运行期能读的白名单——以前那份是手抄在 mock 里的第二真相源。生成器只为 `additionalProperties: false` 的 definition 发这张表：定义本身允许额外字段却发一张封闭清单，就是对下游撒谎。

事件 v2 在原有普通/OCR 事件路径（现为 `/jobs/:id/progress/events`；旧地址 `/jobs/:id/events` 与 `/ocr/jobs/:id/events` 已于 2026-10-18 删除）替换 offset 协议：首次用 `start=tail`（默认）或 `start=head`，后续只传不透明 `cursor`；`limit` 默认 500、限制为 1–500。`has_more` 只追平游标的固定批次上界。410 `error.code=EVENT_CURSOR_EXPIRED` 表示只需重置事件缓存并按原模式重新初始化；其他错误保留已有展示。API 与第一方客户端必须同时升级。翻译实时推送 SSE（`/jobs/:id/progress/stream`，原 `live-events`）不受此次版本升级影响。

```bash
npm --prefix contracts run lint:schemas
npm --prefix contracts run generate
npm --prefix contracts run generate:check
npm --prefix contracts run typecheck
npm --prefix contracts test
npm --prefix contracts run build
```

`src/glossaries.ts`、`src/job-status.ts`、`src/job-events.ts`、`src/job-actions.ts`、`src/job-reports.ts`、`src/library-books.ts`、`src/library-documents.ts`、`src/ocr-providers.ts`、`src/reader-data.ts` 与 `src/translation-revisions.ts` 由固定版本的 `json-schema-to-typescript` 生成并入库，禁止手改。`src/create-job.ts` 与 `src/create-job-fields.ts` 同理。`generate:check` 阻止生成漂移；测试还会锁定 `job-status` 与 `library-books` 重复 Job definitions 的结构一致性，以及 `job-actions`、`job-reports` 抄自 `job-status` 和两者共用的定义的结构一致性（`tests/job-shared-definitions-parity.test.mjs`）。`frontend/packages/domain` 保留的是归一化模型，不应替代 wire DTO。
