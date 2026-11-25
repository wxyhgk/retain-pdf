# RetainPDF API Wiki

这套文档面向前端、桌面端和第三方集成方，描述 RetainPDF 后端对外 HTTP API 的稳定契约。

**这里是唯一的对外接口说明**（2026-11-24 起，见 [接口文档以 docs/api 为准](../ops/planning/api-reorg/20261124-接口文档以docs-api为准.md)）：
改了接口行为就改这里对应的篇。`docs/core/api/` 只放内部设计（架构、实现思路、配置、存储），见
[后端 API 的内部设计](../core/api/README.md)；`backend/api/API_SPEC.md`、`backend/api/docs/api-spec/` 不再写内容。
字段级的 JSON Schema 以 [`contracts/`](../../contracts/README.md) 为准。

## 基础信息

- Base URL: `/api/v1`
- 健康检查: `GET /health`
- 接口默认需要 `X-API-Key`，下面这些不要（详见 [认证与错误](00-约定/02-认证与错误.md#认证)）：
  - `GET /health`、`GET /ready`（第二个端口上也有）；
  - 登录注册 `GET /api/v1/auth/session`、`POST /api/v1/auth/login`、`POST /api/v1/auth/register`；
  - 模型执行器的三个内部接口 `/api/v1/internal/model/jobs/{job_id}/requests…`：凭只对一个任务有效的能力令牌
    （`Authorization: Bearer …`），不收 API 密钥。
  - 上面前五个在接口登记表里是 `public`（[登录和健康检查](00-接口目录/01-登录和健康检查.md)）；登记表的「谁能用」
    只管多用户模式下网站账号能不能用，不等于要不要 Key。
- 除文件下载接口外，接口默认返回 JSON 包装对象

## 快速入口

- [接口目录](00-接口目录.md)：全部接口，总目录放说明、统计和分组表，每组一个文件在 `00-接口目录/` 下（方法、地址、谁能用、负责、谁在用、说明、旧地址），从后端的接口登记表自动生成
- [响应格式](00-约定/01-响应格式.md)
- [认证与错误](00-约定/02-认证与错误.md)
- [分页](00-约定/03-分页.md)：所有列表回显 `limit`、给 `has_more`，`limit` 越界返回 400
- [限制](00-约定/04-限制.md)：请求体大小、上传大小、各列表 `limit` 上限、超时，以及对应的环境变量
- [健康检查、端口与跨域](00-约定/05-健康检查与跨域.md)：`/health`、`/ready`、第二个端口、单机模式的 CORS 和 `Host` 校验
- [防重复提交](00-约定/06-防重复提交.md)：建任务、续跑、重试的 `Idempotency-Key` 请求头，续跑 / 重试的查重（409 `derived_job_active`）
- [创建任务](01-任务/01-创建任务.md)：上传、完整请求、上限、超时、凭据、复用 OCR 产物、返回
- [查询任务详情](01-任务/02-查询任务详情.md)
- [任务列表](01-任务/03-任务列表.md)
- [任务接口分类](01-任务/04-任务接口分类.md)：`/jobs/{job_id}` 下 8 类接口的新地址，以及已删除的旧地址对照
- [删除任务](01-任务/05-删除任务.md)：`DELETE /jobs/{job_id}`，删一个任务和它的 OCR 子任务，书留着
- [通用取数](01-任务/06-通用取数.md)：`/jobs/{job_id}/data/{dataset}`，读任务里已有的数据（契约 `job-data.v1`）
- [事件总览](02-进度事件/01-事件总览.md)
- [display_stage 与 lane](02-进度事件/02-display-stage与lane.md)
- [编辑部事件（翻译 agent）](02-进度事件/03-编辑部事件.md)
- [边翻边看（实时译文）](02-进度事件/04-实时译文.md)：`progress/layout`、`progress/pages/{page}`、`progress/stream`
- [OCR Provider 列表](03-OCR/01-provider列表.md)
- [OCR-only 任务](03-OCR/02-OCR-only任务.md)
- [local_command 插件](03-OCR/04-local-command插件.md)
- [remote_command 插件](03-OCR/05-remote-command插件.md)
- [GLM-OCR（智谱）](03-OCR/06-GLM-OCR.md)
- [翻译参数](04-翻译/01-翻译参数.md)
- [翻译并发与批次](04-翻译/02-并发与批次.md)
- [术语表](04-翻译/03-术语表.md)：契约 `glossaries.v1`（列表、新建、读、整份保存、删、导出和解析 CSV）
- [上下文术语记忆模式](04-翻译/04-上下文术语记忆模式.md)
- [translate.stage.v1](04-翻译/05-translate-stage-spec.md)
- [翻译工作流](04-翻译/06-翻译工作流.md)
- [翻译事件](04-翻译/07-翻译事件.md)
- [阶段操作总览](06-阶段操作/01-stage-actions.md)：契约 `job-actions.v1`（能做哪些操作、续跑、取消、重试、OCR 歧义处理）
- [阶段重试](06-阶段操作/02-retry-stage.md)
- [续跑、取消与 OCR 歧义处理](06-阶段操作/03-续跑取消与OCR歧义.md)
- [下载总览](07-产物下载/01-下载总览.md)
- [失败结构](08-调试诊断/01-失败结构.md)：契约 `job-reports.v1`（失败原因、质量体检卡和清单、翻译诊断）
- [Translation Debug API](08-调试诊断/02-translation-debug.md)
- [服务商错误码](08-调试诊断/03-服务商错误码.md)：`GET /providers/error-codes`，契约 `provider-error-codes.v1`（各家 OCR、翻译模型的错误码、给用户的提示、我们怎么处理，可按厂商、码筛）
- [服务商校验](08-调试诊断/05-服务商校验.md)：MinerU、Paddle、翻译接口的检测，DeepSeek 余额，拉模型列表，问模型
- [翻译报告](08-调试诊断/06-翻译报告.md)：翻译诊断、质检、精修、排版缩放四份报告
- [运维指标](08-调试诊断/04-运维指标.md)：`GET /metrics`（要 Key，多用户下只给管理员），Prometheus 文本格式的按接口请求数、状态码分类、耗时直方图和任务数；怎么接 Prometheus
- [多设备同步](09-同步/01-多设备同步.md)：契约 `platform-settings.v1`（和字体列表、数据库备份、健康检查同一份）
- [数据库备份](10-备份/01-数据库备份.md)：契约 `platform-settings.v1`
- [模型用量](11-用量/01-模型用量.md)：`GET /usage`、一本书、一个任务的 token 用量，契约 `token-usage.v1`
- [阅读接口](12-阅读/01-阅读接口.md)：`reader/regions`、`reader/metadata`、`reader/markdown`、详情的 `artifacts` 链接，契约 `reader-data.v1`
- [书与文档](13-书库/01-书与文档.md)：`/documents`、书的任务列表、阅读入口、译文版本，契约 `library-documents.v1`
- [合集、标签与检索](13-书库/02-合集标签与检索.md)
- [元数据建议](13-书库/03-元数据建议.md)
- [字体与运行资源](13-书库/04-字体与运行资源.md)
- [书文件夹](13-书库/05-书文件夹.md)：`POST /book-folder/export`，把书库导出成给 AI 读的 Markdown（`<数据目录>/books/`）
- [凭据](14-凭据/01-凭据.md)：`/credentials`，契约 `credentials.v1`
- [多用户模式](15-多用户/01-多用户.md)：网站账号能访问什么、页数额度、管理后台、平台设置（商业版已停，代码留着）
- [阅读页提问](16-AI/01-阅读页提问.md)：`/ai/agents` 列 agent、`/ai/agents/{id}/acp` 的 ACP 桥（WebSocket），契约 `ai-agents.v1`；问答记录 `/documents/{document_id}/ask-threads`，契约 `ask-threads.v1`
- [服务商密钥校验的细节](08-调试诊断/05-服务商校验.md)：请求体、各家 `status` 取值；契约 `provider-probes.v1`
- 登录状态 `GET /auth/session`：契约 `auth-session.v1`；上传 `POST /uploads` 的返回：契约 `uploads.v1`（2026-11-24）

## 当前 API 分区

### 任务

按 8 类分前缀，完整的新旧对照见 [任务接口分类](01-任务/04-任务接口分类.md)：

- `POST /api/v1/jobs`、`GET /api/v1/jobs`、`GET /api/v1/jobs/{job_id}`、`DELETE /api/v1/jobs/{job_id}`
- 操作 `/api/v1/jobs/{job_id}/actions/…`（取消、重跑、续跑、重试阶段）
- 进度 `/api/v1/jobs/{job_id}/progress/…`（事件、实时推送、边翻边看）
- 文件 `/api/v1/jobs/{job_id}/files/…`
- 报告 `/api/v1/jobs/{job_id}/reports/…`
- 阅读 `/api/v1/jobs/{job_id}/reader/…`
- 译文 `/api/v1/jobs/{job_id}/translations/…`
- 数据 `/api/v1/jobs/{job_id}/data/…`

### 文档与版本

- `GET /api/v1/documents`
- `GET|PATCH|DELETE /api/v1/documents/{document_id}`
- `POST /api/v1/documents/{document_id}/ocr`
- `POST /api/v1/documents/{document_id}/translate`
- `GET /api/v1/documents/{document_id}/jobs`

### 安全凭据引用

- `POST|GET /api/v1/credentials`
- `GET|PUT|DELETE /api/v1/credentials/{credential_ref}`

新翻译客户端应提交 `translation.credential_ref`，不要长期保存或重复发送内联
`translation.api_key`。凭据查询只返回元数据，不返回原始值。

### AI 问答与 PDF operation（已删）

RetainPDF 自己的 AI（`/api/v1/ai/*`：问答、会话、文档操作、终端、运行配置）2026-11-03 删了，对应的数据库表
2026-11-20 也删了（v31）。Studio 2026-11-06 起不再嵌 RetainPDF，也不调这里的接口；RetainPDF 里留下的模型调用只有
翻译（含翻译 agent）和问模型的调试接口 `POST /providers/translation/ask`。

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
