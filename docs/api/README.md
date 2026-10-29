# RetainPDF API Wiki

这套文档面向前端、桌面端和第三方集成方，描述 RetainPDF 后端对外 HTTP API 的稳定契约。

`backend/api/API_SPEC.md` 保留为后端工程规格和实现备忘；本目录按使用场景拆分，作为联调和接入时优先阅读的 Wiki。

## 基础信息

- Base URL: `/api/v1`
- 健康检查: `GET /health`
- 除 `/health` 外，接口默认需要 `X-API-Key`
- 除文件下载接口外，接口默认返回 JSON 包装对象

## 快速入口

- [接口目录](00-接口目录.md)：全部接口一张表（方法、地址、谁能用、说明、旧地址），从后端的接口登记表自动生成
- [响应格式](00-约定/01-响应格式.md)
- [认证与错误](00-约定/02-认证与错误.md)
- [分页](00-约定/03-分页.md)：所有列表回显 `limit`、给 `has_more`，`limit` 越界返回 400
- [创建任务](01-任务/01-创建任务.md)
- [查询任务详情](01-任务/02-查询任务详情.md)
- [任务列表](01-任务/03-任务列表.md)
- [任务接口分类](01-任务/04-任务接口分类.md)：`/jobs/{job_id}` 下 9 类接口的新地址，以及已删除的旧地址对照
- [删除任务](01-任务/05-删除任务.md)：`DELETE /jobs/{job_id}`，删一个任务和它的 OCR 子任务，书留着
- [事件总览](02-进度事件/01-事件总览.md)
- [display_stage 与 lane](02-进度事件/02-display-stage与lane.md)
- [OCR Provider 列表](03-OCR/01-provider列表.md)
- [OCR-only 任务](03-OCR/02-OCR-only任务.md)
- [local_command 插件](03-OCR/04-local-command插件.md)
- [remote_command 插件](03-OCR/05-remote-command插件.md)
- [翻译参数](04-翻译/01-翻译参数.md)
- [翻译并发与批次](04-翻译/02-并发与批次.md)
- [术语表](04-翻译/03-术语表.md)：契约 `glossaries.v1`（列表、新建、读、整份保存、删、导出和解析 CSV）
- [上下文术语记忆模式](04-翻译/04-上下文术语记忆模式.md)
- [translate.stage.v1](04-翻译/05-translate-stage-spec.md)
- [翻译工作流](04-翻译/06-翻译工作流.md)
- [翻译事件](04-翻译/07-翻译事件.md)
- [阶段操作总览](06-阶段操作/01-stage-actions.md)：契约 `job-actions.v1`（能做哪些操作、续跑、取消、重试、OCR 歧义处理）
- [阶段重试](06-阶段操作/02-retry-stage.md)
- [下载总览](07-产物下载/01-下载总览.md)
- [失败结构](08-调试诊断/01-失败结构.md)：契约 `job-reports.v1`（失败原因、质量体检卡和清单、翻译诊断）
- [Translation Debug API](08-调试诊断/02-translation-debug.md)
- [多设备同步](09-同步/01-多设备同步.md)
- [数据库备份](10-备份/01-数据库备份.md)
- [模型用量](11-用量/01-模型用量.md)：`GET /usage`、一本书、一个任务的 token 用量，契约 `token-usage.v1`
- [服务商密钥校验](../core/rust_api/08-Provider%20校验接口.md)：MinerU、Paddle、翻译接口的检测和 DeepSeek 余额，各家 `status` 取值

## 当前 API 分区

### 任务

按 9 类分前缀，完整的新旧对照见 [任务接口分类](01-任务/04-任务接口分类.md)：

- `POST /api/v1/jobs`、`GET /api/v1/jobs`、`GET /api/v1/jobs/{job_id}`、`DELETE /api/v1/jobs/{job_id}`
- 操作 `/api/v1/jobs/{job_id}/actions/…`（取消、重跑、续跑、重试阶段）
- 进度 `/api/v1/jobs/{job_id}/progress/…`（事件、实时推送、边翻边看）
- 文件 `/api/v1/jobs/{job_id}/files/…`
- 报告 `/api/v1/jobs/{job_id}/reports/…`
- 阅读 `/api/v1/jobs/{job_id}/reader/…`
- 译文 `/api/v1/jobs/{job_id}/translations/…`
- 数据 `/api/v1/jobs/{job_id}/data/…`
- AI `/api/v1/jobs/{job_id}/ai/…`

### 文档与版本

- `GET /api/v1/documents`
- `GET|PATCH|DELETE /api/v1/documents/{document_id}`
- `POST /api/v1/documents/{document_id}/ocr`
- `POST /api/v1/documents/{document_id}/translate`
- `GET /api/v1/documents/{document_id}/jobs`
- `GET /api/v1/documents/{document_id}/agent-versions`

### 安全凭据引用

- `POST|GET /api/v1/credentials`
- `GET|PUT|DELETE /api/v1/credentials/{credential_ref}`

新翻译客户端应提交 `translation.credential_ref`，不要长期保存或重复发送内联
`translation.api_key`。凭据查询只返回元数据，不返回原始值。

### AI 问答与 PDF operation

- `POST /api/v1/ai/ask`
- `GET|PUT /api/v1/ai/runtime-config`
- `POST|GET /api/v1/ai/conversations`
- `GET|PATCH|DELETE /api/v1/ai/conversations/{conversation_id}`
- `GET /api/v1/ai/conversations/{conversation_id}/operations?limit=&offset=`
- `GET /api/v1/ai/operations/{operation_id}`
- `POST /api/v1/ai/operations/{operation_id}/{run|retry|cancel|commit}`
- `GET /api/v1/ai/operations/{operation_id}/candidate.pdf`

SSE 只负责通知；会话、operation 和文档版本查询才是刷新或断线恢复后的状态真源。
完整契约见[AI 问答与文档操作](../core/api/reader-ai-chat.md)。

### OCR

`/ocr/jobs/…` 这组别名已于 2026-10-18 删除。只做 OCR 的任务和别的任务走同一组 `/jobs` 地址，细节见 [OCR-only 任务](03-OCR/02-OCR-only任务.md)：

- `POST /api/v1/uploads`（先上传 PDF 拿 `upload_id`）
- `POST /api/v1/jobs`（`workflow: "ocr"`，`source.upload_id`）
- `GET /api/v1/jobs/{job_id}`、`GET /api/v1/jobs/{job_id}/progress/events`、`POST /api/v1/jobs/{job_id}/actions/cancel`
- `GET /api/v1/jobs/{job_id}/files`、`GET /api/v1/jobs/{job_id}/files/internal/normalized-document.json`、`.../normalization-report.json`
- `GET /api/v1/providers/ocr`

### 事件与诊断

- `GET /api/v1/jobs/{job_id}/progress/events`
- `GET /api/v1/jobs/{job_id}/reports/failure`
- `GET /api/v1/jobs/{job_id}/reports/translation`
- `GET /api/v1/jobs/{job_id}/translations`
- `GET /api/v1/jobs/{job_id}/translations/{item_id}`
- `POST /api/v1/jobs/{job_id}/translations/{item_id}/replay`

### 阶段操作

- `GET /api/v1/jobs/{job_id}/actions`
- `GET /api/v1/jobs/{job_id}/actions/resume`
- `POST /api/v1/jobs/{job_id}/actions/resume`
- `POST /api/v1/jobs/{job_id}/actions/retry-stage`

### 产物下载

- `GET /api/v1/jobs/{job_id}/files`
- `GET /api/v1/jobs/{job_id}/files/output/{name}`
- `GET /api/v1/jobs/{job_id}/files/pages/{page}.jpg`
- `GET /api/v1/jobs/{job_id}/files/internal/{name}`（多用户下只给管理员）
- `GET /api/v1/jobs/{job_id}/reader/markdown`
- `GET /api/v1/documents/{document_id}/files`
- `GET /api/v1/documents/{document_id}/files/{name}`（原文 `source.pdf`、封面、缩略图）

旧地址（`/pdf`、`/download`、`/markdown`、`/cover`、`/artifacts` 等）已于 2026-10-18 删除，对照见[下载总览](07-产物下载/01-下载总览.md)。

## 前端读取原则

- 主状态优先读 `display_stage`，不要从 `message` 或 `stage_detail` 正则猜阶段。
- 子阶段优先读 `substage`。
- 主线进度只读 `lane=main` 的事件或详情快照。
- `lane=background` 只用于后台预处理、预热、缓存等辅助状态。
- `message` 和 `stage_detail` 只作为人类文案，不参与业务判断。
- 文件和图片展示优先使用 API 返回的 URL，不直接拼本地文件路径。
