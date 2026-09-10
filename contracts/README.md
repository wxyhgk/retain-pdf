# Schemas — 单一真值契约

本目录是 **RetainPDF 跨进程契约的唯一真相源**（JSON Schema）。

这里锁定 wire payload 的结构，不替代完整 HTTP 协议文档。路由、认证、错误、
下载、恢复和 SSE 行为仍以 `backend/api/API_SPEC.md`、
`backend/api/docs/api-spec/` 及对应实现契约测试为准。

| 文件 | 作用 | 消费者 | 生产者 |
|------|------|--------|--------|
| `ai-ask.v1.schema.json` | `/v1/ask` SSE 协议 | `frontend/web/tests/contracts/ai-ask-contract.test.mjs` | `backend/ai/tests/test_contract_schema.py` |
| `ai-conversations.v1.schema.json` | 会话 CRUD | `frontend/web` 与 `backend/ai` | `backend/api/src/api_tests/conversations_contract.rs` |
| `library-books.v1.schema.json` | 图书馆书架 `/api/v1/library/books` + `/api/v1/jobs` 列表 | `@retainpdf/api`、`frontend/web`、`frontend/web-react` | `backend/packages/retain-core/src/models/view/job_types.rs` |
| `job-status.v1.schema.json` | 任务详情、脱敏请求参数、事件流与阶段进度 | `@retainpdf/api`、`frontend/packages/domain`、`frontend/web`、`frontend/web-react` | `backend/api` public view models |
| `jobs-control.v1.schema.json` | shell↔jobsd 控制面 | `backend/api/src/api_tests/jobs_control_contract.rs` | `backend/jobs/src/contract_lock.rs` |
| `pipeline-stdout.v1.schema.json` | Python stdout 协议 | `backend/packages/retain-jobs/src/job_runner/stdout_parser/contract_lock.rs` | `backend/pipeline` worker 与对应 contract test |
| `public-document-operation.v1.schema.json` | 浏览器安全的 PDF operation 查询、分页与 CAS action | `frontend/packages/api`、Reader/网页宿主 | `backend/api/src/services/public_document_operations.rs` |
| `runtime-config.v1.schema.json` | AI runtime 配置更新与脱敏视图 | `backend/api` 透明代理、设置客户端 | `backend/ai/retainpdf_ai/runtime_config_api.py` |

`contracts/*.schema.json` 是 monorepo 上游真值；
`backend/contracts/*.schema.json` 是可独立提取后端使用的字节级镜像。
当前仓库不再依赖 `backend/contracts` 兼容路径。镜像一致性由
`python3 backend/contracts/check_parity.py --require-upstream` 检查。

**规则**：改契约先改 schema，再让两端测试变绿。

## npm 包

本目录发布为 `@retainpdf/contracts`。Wire DTO 只从 `@retainpdf/contracts/job-status` 与 `@retainpdf/contracts/library-books` 导出；八份原始 schema 以文件名子路径显式导出。包没有根 DTO 入口、wildcard export 或 runtime dependency。

```bash
npm --prefix contracts run lint:schemas
npm --prefix contracts run generate
npm --prefix contracts run generate:check
npm --prefix contracts run typecheck
npm --prefix contracts test
npm --prefix contracts run build
```

`src/job-status.ts` 与 `src/library-books.ts` 由固定版本的 `json-schema-to-typescript` 生成并入库，禁止手改。`generate:check` 阻止生成漂移；测试还会锁定 `job-status` 与 `library-books` 重复 Job definitions 的结构一致性。`frontend/packages/domain` 保留的是归一化模型，不应替代 wire DTO。
