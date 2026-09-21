# Schemas — 单一真值契约

本目录是 **RetainPDF 跨进程契约的唯一真相源**（JSON Schema）。

这里锁定 wire payload 的结构，不替代完整 HTTP 协议文档。路由、认证、错误、
下载、恢复和 SSE 行为仍以 `backend/api/API_SPEC.md`、
`backend/api/docs/api-spec/` 及对应实现契约测试为准。

| 文件 | 作用 | 消费者 | 生产者 |
|------|------|--------|--------|
| `ai-ask.v1.schema.json` | `/v1/ask` SSE 协议 | `frontend/web/tests/contracts/ai-ask-contract.test.mjs` | `backend/ai/tests/test_contract_schema.py` |
| `ai-conversations.v1.schema.json` | 会话 CRUD | `frontend/web` 与 `backend/ai` | `backend/api/src/api_tests/conversations_contract.rs` |
| `create-job.v1.schema.json` | POST /api/v1/jobs 的**请求**体（CreateJobInput 六个顶层字段 + 五个段），每段 additionalProperties:false 对应后端 deny_unknown_fields | `frontend/web` 的 payload 构造器（`features/ingest/domain/workflow/payload.ts`） | `backend/packages/retain-core/src/models/input/request.rs` 的 `contract_tests` |
| `library-books.v1.schema.json` | 图书馆书架 `/api/v1/library/books` + `/api/v1/jobs` 列表 | `@retainpdf/api`、`frontend/web`、`frontend/web-react` | `backend/packages/retain-core/src/models/view/job_types.rs` |
| `job-status.v1.schema.json` | 任务详情、脱敏请求参数与阶段进度 | `@retainpdf/api`、`frontend/packages/domain`、`frontend/web`、`frontend/web-react` | `backend/api` public view models |
| `job-events.v2.schema.json` | 普通/OCR 事件游标分页、稳定事件身份 | `@retainpdf/api`、`frontend/web` | `backend/api` event feed |
| `jobs-control.v1.schema.json` | shell↔jobsd 控制面 | `backend/api/src/api_tests/jobs_control_contract.rs` | `backend/jobs/src/contract_lock.rs` |
| `pipeline-stdout.v1.schema.json` | Python stdout 协议 | `backend/packages/retain-jobs/src/job_runner/stdout_parser/contract_lock.rs` | `backend/pipeline` worker 与对应 contract test |
| `public-document-operation.v1.schema.json` | 浏览器安全的 PDF operation 查询、分页与 CAS action | `frontend/packages/api`、Reader/网页宿主 | `backend/api/src/services/public_document_operations.rs` |
| `runtime-config.v1.schema.json` | AI runtime 配置更新与受鉴权的本机可见 Key 视图 | `backend/api` 透明代理、设置客户端 | `backend/ai/retainpdf_ai/runtime_config_api.py` |
| `reader-data.v1.schema.json` | Reader 宿主读模型：产物、Markdown、区域、页面元数据、实时译文布局/快照/SSE | Reader host adapter、后续 `@retainpdf/reader` ports | `backend/api` Reader 查询视图 |

`contracts/*.schema.json` 是 monorepo 上游真值；
`backend/contracts/*.schema.json` 是可独立提取后端使用的字节级镜像。
当前仓库不再依赖 `backend/contracts` 兼容路径。镜像一致性由
`python3 backend/contracts/check_parity.py --require-upstream` 检查。

**规则**：改契约先改 schema，再让两端测试变绿。

## npm 包

本目录发布为 `@retainpdf/contracts`。Wire DTO 从 `@retainpdf/contracts/job-status`、`@retainpdf/contracts/job-events`、`@retainpdf/contracts/library-books` 与 `@retainpdf/contracts/reader-data` 导出；原始 schema 以文件名子路径显式导出。包没有根 DTO 入口、wildcard export 或 runtime dependency。

事件 v2 在原有普通/OCR `/events` 路径替换 offset 协议：首次用 `start=tail`（默认）或 `start=head`，后续只传不透明 `cursor`；`limit` 默认 500、限制为 1–500。`has_more` 只追平游标的固定批次上界。410 `error.code=EVENT_CURSOR_EXPIRED` 表示只需重置事件缓存并按原模式重新初始化；其他错误保留已有展示。API 与第一方客户端必须同时升级。翻译 `live-events` SSE 不受此次版本升级影响。

```bash
npm --prefix contracts run lint:schemas
npm --prefix contracts run generate
npm --prefix contracts run generate:check
npm --prefix contracts run typecheck
npm --prefix contracts test
npm --prefix contracts run build
```

`src/job-status.ts`、`src/job-events.ts`、`src/library-books.ts` 与 `src/reader-data.ts` 由固定版本的 `json-schema-to-typescript` 生成并入库，禁止手改。`generate:check` 阻止生成漂移；测试还会锁定 `job-status` 与 `library-books` 重复 Job definitions 的结构一致性。`frontend/packages/domain` 保留的是归一化模型，不应替代 wire DTO。
