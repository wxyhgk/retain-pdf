# RetainPDF API Wiki

这套文档面向前端、桌面端和第三方集成方，描述 RetainPDF 后端对外 HTTP API 的稳定契约。

`backend/api/API_SPEC.md` 保留为后端工程规格和实现备忘；本目录按使用场景拆分，作为联调和接入时优先阅读的 Wiki。

## 基础信息

- Base URL: `/api/v1`
- 健康检查: `GET /health`
- 除 `/health` 外，接口默认需要 `X-API-Key`
- 除文件下载接口外，接口默认返回 JSON 包装对象

## 快速入口

- [响应格式](00-约定/01-响应格式.md)
- [认证与错误](00-约定/02-认证与错误.md)
- [创建任务](01-任务/01-创建任务.md)
- [查询任务详情](01-任务/02-查询任务详情.md)
- [任务列表](01-任务/03-任务列表.md)
- [事件总览](02-进度事件/01-事件总览.md)
- [display_stage 与 lane](02-进度事件/02-display-stage与lane.md)
- [OCR Provider 列表](03-OCR/01-provider列表.md)
- [OCR-only 任务](03-OCR/02-OCR-only任务.md)
- [local_command 插件](03-OCR/04-local-command插件.md)
- [remote_command 插件](03-OCR/05-remote-command插件.md)
- [翻译参数](04-翻译/01-翻译参数.md)
- [翻译并发与批次](04-翻译/02-并发与批次.md)
- [术语表](04-翻译/03-术语表.md)
- [上下文术语记忆模式](04-翻译/04-上下文术语记忆模式.md)
- [translate.stage.v1](04-翻译/05-translate-stage-spec.md)
- [翻译工作流](04-翻译/06-翻译工作流.md)
- [翻译事件](04-翻译/07-翻译事件.md)
- [阶段操作总览](06-阶段操作/01-stage-actions.md)
- [阶段重试](06-阶段操作/02-retry-stage.md)
- [下载总览](07-产物下载/01-下载总览.md)
- [失败结构](08-调试诊断/01-失败结构.md)
- [Translation Debug API](08-调试诊断/02-translation-debug.md)

## 当前 API 分区

### 任务

- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `POST /api/v1/jobs/{job_id}/rerun`
- `GET /api/v1/jobs/{job_id}/live-translation/layout`
- `GET /api/v1/jobs/{job_id}/live-translation/pages/{page_idx}`
- `GET /api/v1/jobs/{job_id}/live-events`

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

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`
- `GET /api/v1/providers/ocr`

### 事件与诊断

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/jobs/{job_id}/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

### 阶段操作

- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`

### 产物下载

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`
- `GET /api/v1/jobs/{job_id}/preview/pages/{page}`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown/images/{path}`
- `GET /api/v1/jobs/{job_id}/download`

## 前端读取原则

- 主状态优先读 `display_stage`，不要从 `message` 或 `stage_detail` 正则猜阶段。
- 子阶段优先读 `substage`。
- 主线进度只读 `lane=main` 的事件或详情快照。
- `lane=background` 只用于后台预处理、预热、缓存等辅助状态。
- `message` 和 `stage_detail` 只作为人类文案，不参与业务判断。
- 文件和图片展示优先使用 API 返回的 URL，不直接拼本地文件路径。
