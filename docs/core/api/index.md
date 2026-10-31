# RetainPDF 后端 API 总入口

这份文档是前端接入和第三方调用的公共入口。字段级 JSON Schema 以
[`contracts`](../../../contracts/README.md) 为准；Rust 编排、恢复和
内部 Agent 契约以 [`backend/api/API_SPEC.md`](../../../backend/api/API_SPEC.md)
及其分领域页面为准。其它 API 文档只作为专题页或历史兼容入口。

## 1. 基础约定

- 完整 API 默认端口：`41000`
- 第二个端口默认 `42000`：只有 `GET /health`、`GET /ready`
- 健康检查：`GET /health`
- 就绪检查：`GET /ready`
- 业务前缀：`/api/v1`
- 除下面这些外，接口都要 `X-API-Key`：`GET /health`、`GET /ready`；登录注册（`GET /api/v1/auth/session`、
  `POST /api/v1/auth/login`、`POST /api/v1/auth/register`）；模型执行器的三个内部接口
  `/api/v1/internal/model/jobs/{job_id}/requests…`（凭任务的能力令牌，见
  [runtime-and-events](../../../backend/api/docs/api-spec/runtime-and-events.md#model-executor-worker-routes)）

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误响应：

```json
{
  "code": 40000,
  "message": "invalid request"
}
```

常见错误码：

- `40000`：请求错误
- `40100`：鉴权失败
- `40400`：资源不存在
- `40900`：状态冲突
- `42900`：模型或外部服务限流
- `50200`：模型或外部服务失败
- `50300`：服务没就绪（`GET /ready` 不就绪时，2026-10-22 起；以前 503 时信封仍是 `0`）
- `50000`：内部错误。原因不回给调用方（底层报错里常带服务器路径、SQL、上游返回），`message` 是
  `internal server error (ref <编号>)`，`error.details.error_id` 是同一个编号；拿编号去后端日志里搜
  `error_id=<编号>` 就能找到完整原因。

`X-API-Key` 是访问 Rust API 的后端白名单 key，不是 OCR Provider token，也不是模型 API key。

### 健康和就绪

两个都不要密钥，第二个端口上也有。

`GET /health`（进程活着）总是 `200`，`data`：

| 字段 | 说明 |
|---|---|
| `status` | `up`；任务库 ping 不通是 `degraded` |
| `db` | `ok` / `error`，同一个检查 |
| `queue_depth`、`running_jobs` | 排队、在跑的任务数。读不出来时是 `null`（2026-10-22 以前当 `0`，看着像空闲） |
| `provider_backends` | 这个版本支持的 OCR 服务商 |
| `ai_service`、`jobsd` | 监督器的状态：`starting`、`healthy`、`unhealthy`、`unsupervised` |
| `disk` | 数据目录所在磁盘（2026-10-24 起）：`free_bytes` 剩余可用字节（拿不到是 `null`）、`min_free_bytes` 下限（`RUST_API_MIN_FREE_DISK_MB`，`0` 不查）、`low` 低于下限。低于下限时新上传、新任务 503 `insufficient_storage`；`status` 和 `/ready` 不跟着变（磁盘满了更要能打开页面删任务） |
| `time` | 服务器时间 |

`GET /ready`（能接请求了）就绪 `200`，不就绪 `503`。**看 HTTP 状态码**（Docker 用 `curl -f`，开发栈等 2xx）。
`data` 是 `status`（`ready` / `not_ready`）、`components`（`db` 总是必需；AI 服务、jobsd 只在本进程监督它们时必需，
否则 `status` 是 `not_required`）、`reasons`（`db_unavailable`、`ai_service_not_healthy`、`jobsd_not_healthy`）、`time`。
不就绪时信封是 `code: 50300`、`message: "not ready"`，带 `error`（`SERVICE_UNAVAILABLE`，`details.reasons` 和 `data.reasons`
一样），`data` 照旧给全；2026-10-22 以前 503 时信封仍是 `code: 0`、`message: "ok"`。

### 1.1 单机模式的来源和主机

2026-10-22 起，单机模式不再对任何来源都回 CORS 头（以前是 `CorsLayer::permissive()`）。规则（方案见
[单机来源和主机校验](../../ops/planning/api-reorg/20261022-单机来源和主机校验.md)）：

- **CORS 只回给三类来源**：回环页面（`localhost`、`127.0.0.0/8`、`[::1]`，端口、http/https 不限）；
  主机和请求的 `Host`（或反向代理写的 `X-Forwarded-Host`）相同、只是端口不同的页面（局域网 / 公网 IP、
  域名分两个端口访问开发栈）；`RUST_API_ALLOWED_ORIGINS` 列出的来源。`null`、`file://` 不放行。
  来源不在名单里只是**不回 CORS 头**，请求照常处理（同源代理会把页面的 `Origin` 原样转发过来）。
  方法、请求头照预检回显（`X-API-Key`、`Content-Type`、`Range`……），响应头全部暴露
  （`Access-Control-Expose-Headers: *`），不回 `Access-Control-Allow-Credentials`。
- **助手终端 WebSocket**（`/api/v1/ai/terminal`）：浏览器不对 WebSocket 做 CORS，所以握手时带了
  `Origin` 且不在上面同一份名单里就 `403`（`error.code = "FORBIDDEN"`，`message` 为
  `request origin is not allowed`）；不带 `Origin` 的命令行客户端照旧只看 key。AI 服务自己的
  `/v1/fx/terminal` 带 `Origin` 一律拒（浏览器从不直连它）。
- **`Host` 校验（防 DNS rebinding）**：后端监听回环地址时，`Host` 必须是 `localhost`、IP 字面量或
  `RUST_API_ALLOWED_HOSTS` 里的主机名，否则所有地址（含 `/health`、第二个端口）都回 `403`
  （`message` 为 `request host is not allowed`）。监听非回环地址时只有配了 `RUST_API_ALLOWED_HOSTS`
  才查。不带 `Host` 的请求（HTTP/1.0 直连）不查。

多用户模式不受这些影响：跨域照旧只认 `RETAIN_ALLOWED_ORIGINS` 并带凭据，不查 `Host`。

## 2. 推荐前端接入路径

图书馆页面（2026-10-19 起，见 [书架冻结与删任务新地址](../../ops/planning/api-reorg/20261019-书架冻结与删任务新地址.md)）：

- 书用 `/api/v1/documents`（列表、一本书的读改删），见下面「文档身份与文档级任务历史」；
- 书名下任务的活态（状态、进度、阶段）用 `GET /api/v1/jobs?job_ids=a,b&limit=n&include_live_stage=true`，
  见 [任务列表](../../api/01-任务/03-任务列表.md)；它不排除 OCR 任务；
- 删单个任务用 `DELETE /api/v1/jobs/{job_id}`，见 [删除任务](../../api/01-任务/05-删除任务.md)；
- 书架 `/api/v1/library/books` **已删**：`GET /api/v1/library/books/{job_id}` 2026-10-19 删，列表
  `GET /api/v1/library/books` 和删除的旧地址 `DELETE /api/v1/library/books/{job_id}` 2026-10-22 删（前端已改调
  上面两条），现在都返回 `404`，见 [删书架旧地址](../../ops/planning/api-reorg/20261022-删书架旧地址.md)。

封面和缩略图用 `/documents/{document_id}/files/cover.jpg`、`thumbnail.jpg`（原 `/library/books/{job_id}/cover`、`/thumbnail` 已于 2026-10-18 删除；任务列表、详情里的 `cover_url`、`thumbnail_url` 已是新地址，查不到书编号时为 `null`）。

所有文件下载统一走 `/jobs/{job_id}/files/…`（任务产出的文件）和 `/documents/{document_id}/files/…`
（书本身的原文、封面、缩略图、原文页），见 [下载总览](../../api/07-产物下载/01-下载总览.md)。

任务创建和执行仍走 job API：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. `GET /api/v1/jobs/{job_id}`
4. `GET /api/v1/jobs/{job_id}/progress/events`
5. 根据 `actions` / `artifacts` / `artifacts_display` 下载产物
6. 阅读问答和受限 PDF 操作统一使用 `POST /api/v1/ai/ask`；旧的
   `/api/v1/jobs/{job_id}/reader/ai/chat` 只保留兼容

Reader 宿主接入 job/artifact、Markdown、区域、页面元数据和实时译文时，使用
[Reader read model](../../../backend/api/docs/api-spec/reader-read-model.md)；它锁定
`document_id`/`job_id` 身份、页码坐标、可用性与 SSE 恢复语义。

## 3. 图书馆接口

### 书架（已删）

`/api/v1/library/books` 是旧的一套：每一项其实是一个任务（`id` 和 `job_id` 都是任务编号，没有 `document_id`），
而且排除 OCR 任务。2026-10-19 冻结、删了单本详情，2026-10-22 列表和删除旧地址也删了，两个路径上不剩任何方法，
请求一律 `404`。用 `/documents` 和 `GET /jobs?job_ids=`（见上一节）。

以前读书架的字段换到任务列表：标题读 `display_name`，阶段和进度读 `stage_snapshot`（`stage`、`stage_detail`、
`progress`），`has_more` 告诉有没有下一页；`job_ids` 每次最多 500 个（`limit` 只收 1..=500，前端分批）。

契约 [`library-books.v1.schema.json`](../../../contracts/library-books.v1.schema.json) 文件名和 `$id` 沿用，现在只登记
删任务（返回 `LibraryDeleteResultView`）；书架的 `LibraryBookListView`、`LibraryBookDetailView` 等定义 2026-10-22 一起删了。
任务列表只登记在 [`job-status.v1.schema.json`](../../../contracts/job-status.v1.schema.json)（`library-books` 里重复的一条
和抄过来的任务列表定义 2026-10-23 删了）。

### 删除一个任务

- `DELETE /api/v1/jobs/{job_id}`
- `DELETE /api/v1/jobs/{job_id}?force=true`

旧地址 `DELETE /api/v1/library/books/{job_id}` 2026-10-22 删了（现在 `404`，删不掉任务）。批量删除在前端逐个调用
（`POST /api/v1/library/books/delete` 三周零调用，已删）。完整说明见 [删除任务](../../api/01-任务/05-删除任务.md)。

删除行为：

- 删除主 job 记录（任何工作流，OCR 任务也行）
- 删除关联 `artifacts` / `job_artifact_entries` / `events`
- 删除 `DATA_ROOT/jobs/{job_id}`
- 删除 `DATA_ROOT/downloads/{job_id}.zip`
- 如果存在 `{job_id}-ocr` 子任务，一并删除
- 默认不删除 `uploads` 源文件，书（文档行）留着
- `queued` / `running` 默认拒绝删除（`409` + `error.details.reason = "job_active"`），除非传 `force=true`；`force=true` 时先对运行中的任务走和 `actions/cancel` 同一条路径（登记取消 + 终止 worker 进程）再删，
  runner 的落库写在行不存在时不会再把任务写回来
- 别的任务还在用被删任务的产物（`request_payload.source.artifact_job_id` 指向它，例如重新排版的 render 任务；或者单删 OCR 子任务 `P-ocr` 而父任务 `P` 还在）时，不带 `force` 返回 `409` + `error.details.reason = "job_has_dependents"`
- 同时清掉被删任务在全文索引（`blocks_fts`）里的行，并按这本书剩下的成功任务重建

### 文档身份与文档级任务历史

图书馆的兼容 `book/job` 视图之外，AI 会话、版本和继续处理统一使用稳定的
`document_id`：

- `GET /api/v1/documents`
- `GET|PATCH|DELETE /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/files/source.pdf`
- `GET /api/v1/documents/{document_id}/files/cover.jpg`
- `GET /api/v1/documents/{document_id}/files/thumbnail.jpg`
- `POST /api/v1/documents/{document_id}/ocr`
- `POST /api/v1/documents/{document_id}/translate`
- `GET /api/v1/documents/{document_id}/jobs`
- `GET /api/v1/documents/{document_id}/agent-versions`
- `DELETE /api/v1/documents/{document_id}/favorites`
- `POST|GET /api/v1/documents/{document_id}/metadata-suggestions`
- `POST /api/v1/documents/{document_id}/metadata-suggestions/{suggestion_id}/apply`

`GET /api/v1/documents` 返回 `{ "documents": [...], "total": 128, "limit": 50, "offset": 0, "has_more": true }`。
`total` 是应用 `reading_status`、`collection_id` 以及有效 upload
约束后的跨页总数；`limit` 和 `offset` 只裁剪 `documents`。使用 `job_id`
直查时，命中返回 `total: 1`，未命中返回 `total: 0`。

2026-10-22 起书库的列表照[分页约定](../../api/00-约定/03-分页.md)：

- `/documents`、`/search`、`/documents/{id}/metadata-suggestions` 回显 `limit`（`/documents` 还有 `offset`），给 `has_more`；
  `limit` 越界 400（以前静默夹）。`/documents` 按 `added_at DESC, document_id DESC` 排，同一秒入库的书翻页不乱。
- 带 `job_id` 时其余参数（`reading_status`、`collection_id`、`q`、`offset`）不起作用，`limit` 照样校验，
  `limit`、`offset` 照请求回显，`has_more` 恒为 `false`。
- `/documents/{id}/jobs` 的 `has_more` 改成多取一条判断，`total` 照旧。
- 这几个接口和书、合集的请求体（`PATCH /documents/{id}`、`POST|PATCH /collections`、
  `POST /collections/{id}/documents`）、`DELETE /documents/{id}` 的查询参数，不认识的字段一律 400。
  `PATCH /collections/{id}` 只认 `name`、`sort_order`，`parent_id` 400。

书、合集、全文检索、阅读入口（`/documents/{id}/reading`）、翻译覆盖（`/documents/{id}/translation-coverage`）、
书的文件清单（`/documents/{id}/files`）、元数据建议的请求和返回，2026-10-22 起有契约
[`library-documents.v1.schema.json`](../../../contracts/library-documents.v1.schema.json)（TS 类型
`@retainpdf/contracts/library-documents`）。同一天第 1b 期补上书的任务列表（`/documents/{id}/jobs`）、翻译这本书（`/translate`）、
给这本书做 OCR（`/ocr`）：请求体是 `POST /jobs` 的 `CreateJobInput`，返回 `JobSubmissionView`，多用户模式下页数额度不够 402
`PAGE_QUOTA_EXCEEDED`（顶层 `code` 是字符串，`error.details` 是 `{required_pages, balance}`）。空值的写法照契约：类型带 `null` 的键总在、空时是 `null`；
`DocumentRecord.active_version_id`、元数据建议的 `source_job_id` 和证据里的可选项没有时整个键不出现。
`DocumentRecord` 的 `authors_json`（恒为 `"[]"`）、`year`（恒 `null`）、`doi`（恒 `""`）、`last_opened_at`（恒 `null`）
没有功能，留着不删。Rust 侧 `backend/api/src/api_tests/library_documents_contract.rs` 钉住真实返回的键集合。

文档级任务列表是刷新页面后恢复当前 OCR、翻译和渲染状态的权威入口；不要只保留
浏览器内存中的最后一个 `job_id`。Agent 版本列表投影 candidate/committed 版本元数据
和当前 active version，不暴露内部 workspace 或 artifact 路径。

元数据建议接口从 PDF Info 和规范化 OCR 的
`structure_role=document_title` 生成可审查、可恢复的标题候选。请求可使用
`apply_if_default=true` 自动命名，但只会修改书名来源还是文件名（`title_source=filename`）且未被用户锁定的文档
（不再拿书名和当前文件名比：同一本书换个文件名再传，书名照旧能自动命名）；
手工 `PATCH title` 后不会被自动结果覆盖。请求体不认识的字段返回 400；错误都带
`error.details.reason`，apply 返回的 `document` 和 `GET`/`PATCH` 一样带三个链接。完整字段和冲突码见
[Document metadata suggestions](../../../backend/api/docs/api-spec/document-metadata.md)。

## 4. 上传接口

`POST /api/v1/uploads`

`multipart/form-data`：

- `file`：必填，PDF
- `developer_mode`：可选，`true/false`

返回重点字段：

- `upload_id`
- `filename`
- `bytes`
- `page_count`
- `uploaded_at`

## 5. 创建任务

`POST /api/v1/jobs`

只接受 grouped JSON，不接受旧扁平 JSON。

顶层结构：

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "upload-id"
  },
  "ocr": {
    "provider": "paddle",
    "paddle_token": "paddle-access-token",
    "language": "ch",
    "page_ranges": ""
  },
  "translation": {
    "mode": "sci",
    "math_mode": "direct_typst",
    "model": "deepseek-flash",
    "base_url": "https://api.deepseek.com/v1",
    "credential_ref": "cred_translation_primary",
    "batch_size": 1,
    "workers": 50
  },
  "render": {
    "render_mode": "auto",
    "compile_workers": 8
  },
  "runtime": {
    "timeout_seconds": 1800,
    "no_output_timeout_seconds": 0
  }
}
```

`timeout_seconds` 是整段执行的上限，必须按最坏情况给（大部头翻译几小时是正常的），
必须为正整数。`no_output_timeout_seconds` 是独立的空闲检测：每收到一行 stdout 就
重新计时，只有 worker 彻底不出声才触发，于是"卡在第一页"不必等满那几小时。
默认 `0` 表示关闭——各阶段正常静默时长差别很大，没有安全的统一默认值，按工作流
显式设定。两者都判为 `failed` / `process_timeout`，但 `stage_detail` 不同：总超时是
`provider timeout`，空闲超时是 `no output for {N}s`。

推荐先通过 `POST /api/v1/credentials` 创建 `translation_api_key` 凭据，再把返回的
`credential_ref` 放进任务。凭据接口和任务详情只返回元数据，任何接口都不回凭据值
（`GET /api/v1/credentials` 以前的 `?include_values=true` 会回全部明文，2026-10-22 删了，
现在带任何查询参数都是 `400`）。`PUT` 不能改凭据的 `kind`（带同样的值可以，换种类 `400`）；
凭据接口的三种 `409` 带 `error.details.reason`。建任务时内联的密钥会被导入成托管凭据，
什么时候清见 [凭据规范](../../../backend/api/docs/api-spec/credentials.md#when-credentials-imported-by-job-creation-are-removed)。`translation.api_key` 仍是兼容输入，但不能和 `credential_ref`
同时提交，也不应作为新客户端的持久化方案。

`ocr.options` 只放客户端可填的提供方选项。只能服务器定的——本地 / 命令型 OCR 要执行的 `command`、
原始结果的转换器名 `raw_provider`、`ocr_providers.json` 里带 `env` 的——带了返回 400
`ocr.options.<键> is server-owned; …`（2026-10-22，书的 `/translate`、`/ocr` 和重试的 `overrides` 同样）。
`GET /api/v1/providers/ocr` 里每个选项的 `client_settable` 说明它属于哪类。老任务请求里存着的，重跑、阶段重试复制时去掉。

凭据管理接口为：

- `GET|POST /api/v1/credentials`
- `GET|PUT|DELETE /api/v1/credentials/{credential_ref}`

`workflow`：

- `book`：OCR -> Normalize -> Translate -> Render
- `translate`：OCR -> Normalize -> Translate
- `render`：基于已有任务 artifact 重跑渲染

阶段恢复：

- `POST /api/v1/jobs/{job_id}/actions/cancel`
- `POST /api/v1/jobs/{job_id}/actions/rerun`（`actions/resume` 的旧名，2026-10-19 起标成旧地址）
- `GET /api/v1/jobs/{job_id}/actions`
- `POST /api/v1/jobs/{job_id}/actions/retry-stage`
- `GET /api/v1/jobs/{job_id}/actions/resume`
- `POST /api/v1/jobs/{job_id}/actions/resume`

（旧地址 `/cancel`、`/rerun`、`/stage-actions`、`/retry-stage`、`/resume-plan`、`/resume` 已于 2026-10-18 删除，对照见
[任务接口分类](../../api/01-任务/04-任务接口分类.md)。）

- 有 `translations_dir + source_pdf` 时，复用原 `job_id` 原地重渲染并替换渲染产物
- 只有 `normalized_document_json + source_pdf` 时，创建新的 `book` 恢复任务
- `workflow=translate` + `source.artifact_job_id`：复用 OCR checkpoint
- `workflow=book` + `source.artifact_job_id`：复用 OCR checkpoint 后继续翻译并渲染
- `workflow=render` + `source.artifact_job_id`：复用翻译产物后只重跑渲染

`actions/rerun` 是 `actions/resume` 的旧名，两者是同一个处理函数；任务视图的 `actions.resume` 给出续跑链接，`actions.rerun` 暂时同值。`GET actions/resume` 用于前端先展示“会从哪里恢复、会复用哪些产物、会重跑哪些阶段”。

主动阶段重试：

`GET /api/v1/jobs/{job_id}/actions`

返回每个阶段当前是否能主动重跑。前端按钮优先读这个接口，不要自己猜可重试阶段。

```json
{
  "job_id": "job-id",
  "stages": [
    {
      "stage": "translation",
      "label": "重试翻译",
      "can_retry": true,
      "disabled_reason": "",
      "disabled_code": null,
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/job-id/actions/retry-stage",
        "body": {
          "stage": "translation",
          "mode": "from_stage",
          "create_new_job": true
        }
      }
    }
  ]
}
```

`POST /api/v1/jobs/{job_id}/actions/retry-stage`

```json
{
  "stage": "render",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "render": {
      "compile_workers": 8
    }
  }
}
```

返回新任务或原地任务的 `job_id`。前端拿到响应后直接按返回的 `job_id`
进入 `GET /jobs/{job_id}` 和 `GET /jobs/{job_id}/progress/events` 轮询。

## 6. 任务查询与事件

> `/jobs/{job_id}` 下的接口已按 9 类分前缀（`actions`、`progress`、`files`、`reports`、`reader`、
> `translations`、`data`、`ai`），旧地址已于 2026-10-18 删除，本节已改成新地址。新旧对照见
> [任务接口分类](../../api/01-任务/04-任务接口分类.md)。

任务查询：

- `GET /api/v1/jobs?limit=20&offset=0&status=&workflow=&provider=&q=`：`limit` 1..=500（越界 400），回包带 `limit`、`offset`、`has_more`；`q` 和 `job_ids` 生效，见 [任务列表](../../api/01-任务/03-任务列表.md)
- `GET /api/v1/jobs/{job_id}`

列表项直接返回 `attempt`、`retry_count` 和 `last_retry_at`，用于稳定展示重试状态。
详情中的重试时间线继续位于 `runtime` 投影。

失败任务的列表项带精简的 `failure`（`category`、`stage`、`retryable`、`summary`，可选 `root_cause`、`suggestion`、`provider`；
成功、进行中的任务没有这个键），`GET /api/v1/documents/{document_id}/jobs` 的列表项同此。契约见
[`job-status.v1.schema.json`](../../../contracts/job-status.v1.schema.json) 的 `#/definitions/JobFailureBriefView`。
完整错误（含 traceback）仍读详情的 `failure`。

详情重点字段：

- `job_id`
- `workflow`
- `status`
- `ocr_reused` / `source_artifact_job_id`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `request_payload`
- `actions`
- `artifacts`
- `artifacts_display`
- `book_summary`（`document_id` 是书的编号，原文、封面在 `/documents/{document_id}/files/` 下；查不到书时是 null）
- `contracts`
- `ocr_job`
- `runtime`
- `failure`
- `failure_diagnostic`
- `normalization_summary`
- `glossary_summary`
- `invocation`
- `log_tail`

事件：

`GET /api/v1/jobs/{job_id}/progress/events?limit=200`（游标翻页，不认 `offset`，`limit` 1..=500，越界 400；见 [事件游标](event-feed-v2.md)）

前端应消费的稳定字段：

- `stage`
- `substage`
- `lane`
- `stage_detail`
- `event_type`
- `raw_event_type`
- `progress`
- `message`
- `payload`

其中：

- `stage`：公共展示阶段，当前只按 `ocr` / `translation` / `render` / `done` 理解。
- `substage`：机器可读子阶段。
- `lane`：事件所属通道，主状态卡只消费 `main`。
- `progress`：唯一推荐进度对象。
- `message`：只给人看，前端不要靠它判断阶段。

`stage` 枚举：

- `ocr`
- `translation`
- `render`
- `done`

`substage` 是机器可读子阶段，例如：

- `ocr_processing`
- `translation_batches`
- `translation_tail_retry`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

`lane` 可为：

- `main`：主状态卡可展示。
- `background`：后台预热或缓存构建，不应覆盖主状态。
- `artifact`：产物发布。
- `diagnostic`：诊断信息。

`event_type` 可为：

- `progress`
- `artifact`
- `terminal`
- `error`
- `diagnostic`

`progress` 对象：

```json
{
  "unit": "page",
  "current": 37,
  "total": 142,
  "percent": 26.056338028169012
}
```

`progress_unit` 可为：

- `page`
- `batch`
- `step`
- `percent`
- `none`

兼容说明：

- API 输出中的 `progress_current` / `progress_total` / `progress_unit` 是内部兼容字段，默认不序列化；前端优先读 `progress`。
- `message` 只给人看，前端不要靠它判断阶段。
- Python 原始事件里的 `user_stage` 不作为公共 API 字段暴露；排障时看 `payload.raw_user_stage`。

主任务事件流会合并 OCR 子任务页进度。任务完成后仍保留历史事件。

前端接入最小规则：

1. 状态卡阶段只认 `stage`。
2. 子阶段卡片只认 `substage`。
3. 进度条只认 `progress.unit/current/total/percent`。
4. 后台预热、缓存、并行渲染准备类事件如果 `lane != "main"`，不能覆盖主状态卡。
5. 事件排序优先读 `seq`，没有 `seq` 时再用 `created_at`。

失败诊断：

`GET /api/v1/jobs/{job_id}/reports/failure`

返回稳定字段：

```json
{
  "failed_stage": "translation",
  "failed_substage": "continuation_review",
  "summary": "翻译阶段超时",
  "detail": "provider timed out",
  "suggestion": "从断点恢复任务",
  "retryable": true,
  "resume_available": true,
  "render_diagnostics": {
    "typst_cover_fallback_pages": {
      "count": 2,
      "head": [2, 5],
      "tail": []
    },
    "typst_cover_fallback_items": {
      "count": 3,
      "head": ["p002-b002", "p005-b004", "p005-b007"],
      "tail": []
    }
  }
}
```

`render_diagnostics` 是可选字段，只在 `artifacts/pipeline_summary.json`
包含渲染诊断时返回。它用于排查物理删除失败后哪些页或 block
走了 Typst 白底兜底，不表示任务失败。

OCR dispatch 结果不确定时，诊断响应会带脱敏的 `ocr_ambiguity` 描述，其中包含
provider、operation、`resolution_revision`、允许的解决方式和需要填写的字段定义。
提交回执或接受重复风险使用：

`POST /api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity`

请求必须带诊断接口返回的 `resolution_revision`。状态已被其他请求解决或 revision
变化时返回 `409`；响应、日志和审计事件均不得回显 `upload_url` 等敏感字段值。

断点恢复计划：

`GET /api/v1/jobs/{job_id}/actions/resume`

```json
{
  "can_resume": true,
  "job_id": "job-id",
  "from_stage": "render",
  "resume_workflow": "render",
  "reuses_artifacts": ["source_pdf", "translations_dir", "normalized_document_json"],
  "reruns_stages": ["rendering"],
  "reason": null,
  "reason_code": null
}
```

执行恢复：

`POST /api/v1/jobs/{job_id}/actions/resume`

响应同 `POST /api/v1/jobs/{job_id}/actions/rerun`，返回 `JobSubmissionView`。

实时翻译覆盖层只读取已经 durable commit 的页面快照：

- `GET /api/v1/jobs/{job_id}/progress/layout`
- `GET /api/v1/jobs/{job_id}/progress/pages/{page}`
- `GET /api/v1/jobs/{job_id}/progress/stream?after_seq={seq}`

`progress/stream` 是可重放的 SSE 通知，响应带 `X-Accel-Buffering: no`，nginx 这类反向代理不会缓冲它。
它不直接携带非持久化模型 token。客户端收到
`translation_units_committed` 后，再读取对应页面的权威快照；断线后用最后确认的
`seq` 重连。布局、页面快照和事件身份必须匹配同一 `attempt/generation/page_hash`。

## 7. 产物与下载

> 文件下载统一在 `/jobs/{job_id}/files/…`（任务产出的文件）和 `/documents/{document_id}/files/…`（书本身的文件），
> 旧地址（`/pdf`、`/download`、`/markdown`、`/artifacts*` 等）已于 2026-10-18 删除，对照见 [下载总览](../../api/07-产物下载/01-下载总览.md)。

产物接口：

- `GET /api/v1/jobs/{job_id}/files`：文件清单（output、pages、internal 三组）
- `GET /api/v1/jobs/{job_id}/files/output/translated.pdf`
- `GET /api/v1/jobs/{job_id}/files/output/side-by-side.pdf`
- `GET /api/v1/jobs/{job_id}/files/output/translated.docx`
- `GET /api/v1/jobs/{job_id}/files/output/ocr.md`：原文 Markdown（OCR 识别结果，不是译文）
- `GET /api/v1/jobs/{job_id}/files/output/ocr/images/*path`
- `GET /api/v1/jobs/{job_id}/files/output/all.zip`
- `GET /api/v1/jobs/{job_id}/files/pages/{page}.jpg`：译文某一页的预览图
- `GET /api/v1/jobs/{job_id}/files/internal/normalized-document.json`、`normalization-report.json` 等中间产物（多用户下只给管理员）
- `GET /api/v1/jobs/{job_id}/reader/markdown`：Markdown 的 JSON 视图
- `GET /api/v1/documents/{document_id}/files/cover.jpg`、`thumbnail.jpg`、`source.pdf`

前端按钮状态优先读：

- `actions.*.enabled`
- `artifacts.*.ready`
- `artifacts_display[].ready`
- `GET /jobs/{job_id}/files` 里每一项的 `ready`

文件还没产出（任务没跑完、`all.zip` 要求的成功还没到）一律 `404` + `error.details.reason = "not_ready"`，
提示 `<名字> not ready`；任务不存在是不带 `reason` 的普通 `404`（2026-10-19，`all.zip` 以前是 `409`）。
规矩见 [错误约定](../../api/00-约定/02-认证与错误.md#还没产出404)。

Markdown 注意：

- `reader/markdown` 返回结构化文档视图，包含 `content`、`content_with_absolute_image_urls`、`images[]` 图片直链清单，适合前端预览和 AI 问答
- `files/output/ocr.md` 返回原始 Markdown
- 图片通过 `files/output/ocr/images/*path` 读取

PDF 按需加载：

- `GET /api/v1/jobs/{job_id}/files/output/translated.pdf`
- `GET /api/v1/documents/{document_id}/files/source.pdf`

这两个接口支持 HTTP Range Requests。前端 PDF.js 应优先使用 URL 模式，而不是先 fetch 整个 PDF 到 `ArrayBuffer`。

后端会优先返回线性化 PDF 缓存：

- 如果运行环境存在 `qpdf`，首次下载时会懒生成 `*.linearized.pdf`
- 后续下载复用缓存
- 如果没有 `qpdf`，自动回退到原 PDF，不影响接口可用性

请求示例：

```http
GET /api/v1/jobs/{job_id}/files/output/translated.pdf
X-API-Key: your-rust-api-key
Range: bytes=0-65535
```

成功响应：

```http
206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-65535/12345678
Content-Length: 65536
Content-Type: application/pdf
```

跨域读取时（来源在 [1.1](#11-单机模式的来源和主机) 的名单里），后端暴露全部响应头，包括：

- `Accept-Ranges`
- `Content-Range`
- `Content-Length`
- `Content-Disposition`
- `ETag`
- `X-Job-Id`

页级预览：

`GET /api/v1/jobs/{job_id}/files/pages/{page}.jpg`（译文页）

`GET /api/v1/documents/{document_id}/files/pages/{page}.jpg`（原文页）

参数：

- `page`：1-based 页码，地址里写成 `3.jpg`
- `width`：可选，默认 `1200`，范围 `240..2400`
- `dpi`：可选，优先级高于 `width`，最大 `300`

响应：

```http
200 OK
Content-Type: image/jpeg
Cache-Control: private, max-age=0, must-revalidate   # 译文页（job）和原文页（document）都是这个
ETag: "..."
```

- 译文页：`translated.pdf` 和生成缓存图时记下的不一样了（重渲染、原地重跑以后）就重新渲染，同一个地址的内容会变，所以不用强缓存，
  浏览器每次带 `ETag` / `Last-Modified` 校验，没变回 304。
- 原文页：书的原文会变（Agent 文档操作提交新版本，书的编号不变），原文和生成缓存图时记下的不一样了就重新渲染，
  所以和译文页一样不用强缓存（2026-10-19 以前是 `immutable` 一年）；书的封面、缩略图同样按原文判断新鲜、同样的缓存头。
- `page` 超过总页数（任务的 `files` 清单 `pages.page_count`、书的 `pages.page_count`）：返回 404
  `no such file: pages/{page}.jpg`，和 `pages/0.jpg` 一样，不会起渲染进程。

- 渲染一页最多 60 秒，超时整个渲染进程组被杀，返回 `500` `page-preview builder timed out`（封面、缩略图是
  `book-image builder timed out`），生成名额随之释放。

预览图按 job 缓存在 `DATA_ROOT/jobs/{job_id}/artifacts/` 下，旁边的 `.<文件名>.inputs.json` 记着生成时输入的大小、修改时间和 inode。前端可先请求第一页预览图实现秒开，再后台加载 PDF.js。

## 7.5 通用取数（读任务里已有的数据，优先用它）

要读任务目录里已有的数据（质检问题、排版块、精修处理、修订记录、术语表、风格规则、事件、用量、
编辑部台账……），**先看这里，不要再为单个需求加接口**：

- `GET /api/v1/jobs/{job_id}/data`：这个任务有哪些数据集、文件在不在、有哪些字段（能不能筛选）。
- `GET /api/v1/jobs/{job_id}/data/{dataset}`：按名字取。参数：
  - `fields=a,b`：只要这些字段；
  - `<字段>=值[,值…]`：等值筛选，逗号为「或」，只能用登记为可筛选的字段；
  - `group_by=字段`：按字段计数；`sort=字段` / `sort=-字段`；`offset`、`limit`（1..=1000，默认 200，越界 400）。回包带 `has_more`；`group_by` 时 `offset` / `limit` 翻分组，分组个数在 `group_total`，`total` 仍是筛选后的行数。
- 每条记录统一带 `item_id`（三位，改译文用）、`reader_item_id`（四位，阅读页跳转用）、`page`（1 起）。
- 文件不存在时 `available=false`、不报错；未登记的数据集 404，未登记 / 不能筛选的字段 400。

登记表是契约 `contracts/job-data.v1.schema.json` 的 `datasets`：新的读需求在那里加一条（文件位置、
记录位置、字段），后端、前端类型、契约测试都照它走。只开放登记过的数据集，路径限定在任务目录里。
助手也能用：`retainpdf-agent translation data [--dataset 名字 [--query "字段=值&…"]]`（只读，限这本书）。

例：

- 这次精修改了什么：`data/revisions?source=refine&sort=-ts`
- 阅读页标出改过的块：`data/revisions?group_by=item_id`
- 第 9 页溢出的块：`data/layout_blocks?page=9&overflow=true`
- 留给人确认的全部：`data/escalated`
- 锁定的术语：`data/terms?treatment=lock&sort=-frequency`
- 最新一条事件：`data/events?sort=-seq&limit=1`

## 8. 对照阅读辅助接口

阅读区域映射：

`GET /api/v1/jobs/{job_id}/reader/regions`

每项包含：

- `item_id`
- `source.page/bbox/unit/origin/text`
- `translated.page/bbox/unit/origin/text`
- `markdown`
- `region_type`
- `status`

坐标单位固定为 PDF point，原点为左上角。前端可用 `item_id` 做译文 hover 到原文 bbox 的映射，也可以直接使用 `text` / `markdown` 做复制菜单。

PDF 元数据：

`GET /api/v1/jobs/{job_id}/reader/metadata`

返回 source / translated 两侧的页数和每页尺寸：

```json
{
  "source": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  },
  "translated": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  }
}
```

某一侧 PDF 尚未就绪时，该侧返回 `null`。

图书馆和 Reader 的附加资源入口：

- `GET /api/v1/search`
- `GET|POST /api/v1/favorites`
- `PATCH|DELETE /api/v1/favorites/{favorite_id}`
- `GET|POST /api/v1/collections`
- `PATCH|DELETE /api/v1/collections/{collection_id}`
- `POST /api/v1/collections/{collection_id}/documents`
- `DELETE /api/v1/collections/{collection_id}/documents/{document_id}`
- `POST /api/v1/collections/{collection_id}/agent-workspace`（物化合集的 Agent 工作区，见下）
- `GET /api/v1/fonts`
- `POST /api/v1/fonts/upload`

查询和关系接口只返回持久化 ID 与安全投影；客户端不得把本地文件路径作为资源 ID。

合集的 Agent 工作区 `POST /api/v1/collections/{collection_id}/agent-workspace`（多用户下关闭）：在
`<data_root>/collections/<id>/ai/` 下重建 `books/`（每本书一个指向它可读译文目录的链接）并写 `collection.v1.json`，
返回同一份清单 `{ schema, collection_id, books[], skipped[] }`。

- `collection_id` 必须是建合集时生成的形状（`col-` + 14 位数字 + `-` + 6 位小写十六进制），否则 `400 invalid collection_id`，不碰磁盘；
  合集不存在 `404 collection not found`，不建目录。
- `books[]` 只放有可读译文的书（阅读入口 `/documents/{id}/reading` 指的那个任务或合并目录）；还没有可读译文的书、
  超过一次 200 本上限的书都在 `skipped[]`，`reason` 分别是 `还没有可读的译文`、`超过一次最多纳入 200 本的上限`。
- 删合集（`DELETE /api/v1/collections/{collection_id}`）成功后清掉 `<data_root>/collections/<id>/`；清不掉只记日志，删除照样成功。
- 同一路径的 `GET` 是 2026-10-19 前的写法（GET 会改磁盘，换成了 POST），前端改用 POST 以后 2026-10-22 删了，现在 `405`，不碰磁盘。

## 9. OCR-only 接口

`/api/v1/ocr/jobs` 这一组别名已于 2026-10-18 删除（返回 404）。只做 OCR 的任务走 `/jobs`：

- 创建：先 `POST /api/v1/uploads` 上传 PDF，再 `POST /api/v1/jobs`（JSON，`workflow: "ocr"`，`source.upload_id`）
- 列表：`GET /api/v1/jobs?workflow=ocr&limit=20&offset=0&status=&provider=`（分页规矩见 [分页](../../api/00-约定/03-分页.md)）
- 详情、事件、文件、取消：`GET /api/v1/jobs/{job_id}`、`/progress/events`、`/files`、`POST /actions/cancel`（取消按任务类型分支）
- 规范化文档和报告：`/files/internal/normalized-document.json`、`/files/internal/normalization-report.json`

细节见 [OCR-only 任务](../../api/03-OCR/02-OCR-only任务.md)。

## 10. 术语表接口

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`
- `GET /api/v1/glossaries/{glossary_id}/export.csv`

`POST /api/v1/glossaries/import` 2026-10-22 删了。规则、上限、重跑时怎么用术语表见
[术语表](../../api/04-翻译/03-术语表.md)。

术语表用于前端做“自定义词汇表”：

- 不翻译，保留原文：`level=preserve`
- 专业词汇固定译法：`level=canonical`
- 软性偏好译法：`level=preferred`

表格行字段：

```json
{
  "source": "Hartree-Fock",
  "target": "Hartree-Fock",
  "level": "preserve",
  "match_mode": "case_insensitive",
  "context": "",
  "note": "方法名，保留英文"
}
```

字段说明：

- `source`：原文词条，必填。
- `target`：目标译文。`level=preserve` 时可为空，后端会自动设为 `source`。
- `level`：
  - `preserve`：强制保留，不翻译。
  - `canonical`：强制使用固定译法。
  - `preferred`：提示模型优先这样翻译，不保证强制命中。
  - JSON 接口里空串是 `preferred`，不认识的值 `400`；CSV 里没有这一列或不认识的值是 `preferred`。
- `match_mode`：
  - `exact`：精确匹配，区分大小写。JSON 接口、CSV 里空串都是它。
  - `case_insensitive`：忽略大小写。管理界面新加的行默认是这个（前端填的）。
  - `regex`：正则匹配，原词要能编译（编译不过 `400`）。
- `context`：可选，只在附近上下文包含该词时生效，最多 500 字。
- `note`：备注，只给前端和 prompt 说明用。
- 同一条：（原词，上下文），`case_insensitive` 的原词按小写比，其余区分大小写；后面的为准。

创建术语表：

```http
POST /api/v1/glossaries
```

```json
{
  "name": "量子化学术语",
  "entries": [
    {
      "source": "Hartree-Fock",
      "target": "",
      "level": "preserve",
      "match_mode": "case_insensitive",
      "note": "保留英文"
    },
    {
      "source": "density functional theory",
      "target": "密度泛函理论",
      "level": "canonical",
      "match_mode": "case_insensitive",
      "note": "固定专业译法"
    }
  ]
}
```

更新术语表：

```http
PUT /api/v1/glossaries/{glossary_id}
```

请求体同创建接口。后端按整个 `entries` 数组替换；`description`、`source_lang`、`target_lang`、`enabled`
没给时保留原值（2026-10-22 起）。可带 `expected_updated_at`（详情里的 `updated_at`），表被别处改过时
`409 glossary_changed`。表不在是 `404`，不会重新建出来。

CSV 解析：

```http
POST /api/v1/glossaries/parse-csv
```

```json
{
  "csv_text": "原词,译文,类型,匹配模式,备注\nHartree-Fock,,保留,忽略大小写,保留英文\nDFT,密度泛函理论,专业译法,忽略大小写,固定译法\n"
}
```

CSV 表头支持英文和中文别名：

- 原词：`source/src/term/original/原词/原文/术语`
- 译文：`target/translation/translated/译文/翻译/目标译文`
- 类型：`level/mode/action/类型/模式/动作`
- 匹配模式：`match/match_mode/匹配/匹配模式`
- 备注：`note/comment/备注/说明`
- 上下文：`context/上下文/语境`

没有表头时列序是 `原词,译文,备注`（第 4 列以后不读）。分隔符自动识别逗号、制表符和分号：
先按 CSV 引号规则解析，再比表头命中与列数一致性打分，单元格里的逗号不会仅因出现就判成 CSV。
报错带行号（`row 3: …`）。返回 `entries`、`entry_count` 和 `duplicate_count`（去重丢掉的行数）。

上限：每张表去重后 1000 条，建任务时表与内联合并后也是 1000 条（2026-10-30 起，以前是 200）；
原词、译文各 200 字，备注和上下文各 500 字，表名 120 字，描述 500 字。

任务提交时可通过 `translation.glossary_id` 引用命名术语表（不存在或停用 `400`），也可通过
`translation.glossary_entries` 传 inline 条目。重跑、阶段重试出新任务时用现在的表加当时的 inline 条目，
表已删 `409 glossary_missing`。

## 11. Provider 校验

- `GET /api/v1/providers/ocr`（OCR 提供方清单，不分页；契约 `contracts/ocr-providers.v1.schema.json`。选项带 `client_settable`，
  `false` 的只能服务器定、`default` 恒为 `null`）
- `POST /api/v1/providers/mineru/validate-token`
- `POST /api/v1/providers/paddle/validate-token`
- `POST /api/v1/providers/deepseek/validate-token`
- `POST /api/v1/providers/deepseek/balance`

请求体、各家 `status` 的全部取值、地址检查、超时和重定向见 [Provider 校验接口](../rust_api/08-Provider%20校验接口.md)。要点（2026-10-22）：

- 请求体里不认识的字段 400；
- 界面看 `data.ok`，`status` 各家取值不同（MinerU 多一个 `expired`，翻译接口多 `rate_limited`、`model_unavailable`、
  `insufficient_balance`、`invalid_input`），三家都可能是 `redirected`（服务商回了 3xx，校验不跟随）；
- 超时统一 `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`（默认 20 秒，比前端等的 30 秒短），不重试；
- 单机模式能校验本机和内网的模型服务，多用户照旧拦；
- `provider_message`、`operator_hint` 最多 500 字。

## 12. AI 问答、会话与文档操作

推荐入口：

```text
POST /api/v1/ai/ask
```

该接口同时承载带引用的阅读问答和受限 PDF Agent 操作。`assistant_mode` 可取
`reading | operations | auto`。流式响应使用 SSE，`answer_delta.text` 是增量片段；
客户端必须同时看到非空 `conversation_id` 和 `done.persisted=true`，才能把本轮视为
可在刷新后恢复的持久历史。

相关公共接口：

- `GET|PUT /api/v1/ai/runtime-config`
- `POST|GET /api/v1/ai/conversations`
- `POST /api/v1/ai/conversations/fork`
- `GET|PATCH|DELETE /api/v1/ai/conversations/{conversation_id}`
- `POST /api/v1/ai/conversations/{conversation_id}/messages`
- `GET /api/v1/ai/conversations/{conversation_id}/operations?limit=50&offset=0`
- `GET /api/v1/ai/operations/{operation_id}`
- `POST /api/v1/ai/operations/{operation_id}/{run|retry|cancel|commit}`
- `GET /api/v1/ai/operations/{operation_id}/candidate.pdf`

SSE 只负责通知；会话、消息树和 operation 查询结果才是断线重连后的权威状态。
默认 `explicit` 模式下，客户端应渲染后端返回的
`agent_confirmation_required` / `confirmation_requests`，不得根据模型文字猜测确认。
operation 列表响应包含 `operations`、`total`、`limit`、`offset` 和 `has_more`；同一
页按 `updated_at DESC, operation_id DESC` 稳定排序。

完整请求、事件、会话分支、operation 并发保护和旧接口迁移说明见
[AI 问答与文档操作 API](./reader-ai-chat.md)。公开 operation 与 runtime 配置字段
分别以
[`public-document-operation.v1.schema.json`](../../../contracts/public-document-operation.v1.schema.json)
和
[`runtime-config.v1.schema.json`](../../../contracts/runtime-config.v1.schema.json)
为准。

## 13. Simple App 入口

simple app 通常监听 `42000`，现在只有 `GET /health` 和 `GET /ready`，其它地址一律 404。

`POST /api/v1/translate/bundle`（multipart 扁平字段一步上传并建翻译任务）已于 2026-10-19 删除，
全仓没有调用方。要从脚本提交，先 `POST /api/v1/uploads` 拿到 `upload_id`，再 `POST /api/v1/jobs`（见第 4、5 节）。

## 13.4 多用户：网站账号能访问什么

只在多用户模式下生效；单机模式、`X-API-Key`（内部服务）不受这些限制。

每个接口具体开放给谁，写在后端的接口登记表里，[接口目录](../../api/00-接口目录.md)的“谁能用”一列是准的（`public` / `signed` / `admin` / `closed`，没登记的接口当关闭）；下面按资源概述。

- **开放给网站账号的资源**只有：`account`、`auth`、`collections`、`documents`、`fonts`、`glossaries`、
  `jobs`、`search`、`uploads`、`usage`（都在 `/api/v1/` 下；书架 `library` 2026-10-22 删了），以及 `GET /api/v1/providers/ocr`。
  不在这里面的接口对网站账号**一律关闭**（回 404，看起来就是没有这个接口），新加的接口也默认关闭。
- **只给管理员**（普通账号 403）：`credentials`、`sync`、`backups`、`admin`、其余 `providers`、
  `POST /api/v1/fonts/upload`。
- **这一期对网站账号关闭**（管理员也一样）：`ai`、`internal`、
  `.../agent-versions`、`.../agent-workspace`。
- **数据只看自己的**：路径、查询串、JSON 请求体里出现的任务 / 书 / 术语表 / 文件夹 / 上传编号必须是自己的，
  别人的一律当不存在（404）；列表和搜索只返回自己的。管理员的网站会话也一样（见 13.6）。

## 13.5 多用户：页数额度

只在多用户模式（`RETAIN_DEPLOYMENT_MODE=multi`）下计费；单机模式、管理员不限额。多用户模式怎么部署见
[Docker 部署说明的「多用户模式」](../../../ops/deployment/docker/delivery/README.md#多用户模式商业版)。

计费规则：

- 单位是一次提交**实际选中的页数**（OCR 的 `ocr.page_ranges`，翻译的 `translation.page_ranges`
  或 `start_page..end_page`）。内部派生的 OCR 子任务、文档翻译拆出的多段不重复计。
- 提交时预扣，余额不够直接拒绝（不留任务）；任务失败、取消、被删全额退回。
- 纯 OCR 和翻译各算一次。
- 只重新渲染（含精修）不计费；源任务失败退过款、再用渲染把它做完的，补扣原来的页数。
- 新账号 0 页，由管理员发放。

余额不够时 `POST /api/v1/jobs` 等建任务接口返回 **402**：

```json
{
  "code": "PAGE_QUOTA_EXCEEDED",
  "message": "页数额度不够：这次要 12 页，还剩 3 页，请联系管理员",
  "error": { "code": "PAGE_QUOTA_EXCEEDED", "http_status": 402,
             "details": { "required_pages": 12, "balance": 3 } }
}
```

### `GET /api/v1/account/pages`

自己的剩余页数和最近 50 条账目（新的在前）。单机模式、管理员返回 `unlimited: true`、`balance: null`。

```json
{
  "unlimited": false,
  "balance": 288,
  "entries": [
    { "entry_id": 3, "delta": -12, "kind": "charge", "job_id": "20261010…", "note": "",
      "actor_user_id": "", "created_at": "2026-10-10T12:00:00Z" },
    { "entry_id": 1, "delta": 300, "kind": "grant", "job_id": "", "note": "内测",
      "actor_user_id": "u_…", "created_at": "2026-10-10T11:00:00Z" }
  ]
}
```

`kind`：`grant`（管理员发放 / 扣减，`delta` 可正可负）、`charge`（任务预扣，负数）、
`refund`（退回，正数；`note` 为 `failed` / `canceled` / `deleted` / `submit_failed`）。

### 管理员

- `GET /api/v1/admin/users`：每个账号多一个 `page_balance`（管理员为 `null`）；搜索筛选排序分页见 13.6。
- `GET /api/v1/admin/users/:user_id/pages`：同 `GET /api/v1/account/pages`，看指定账号。
- `POST /api/v1/admin/users/:user_id/pages`，请求体 `{ "delta": 300, "note": "内测" }`：
  正数发放、负数扣减，返回 `{ "balance": 300 }`。错误（400）：`INVALID_PAGE_DELTA`（0 或绝对值
  超过 1000000）、`PAGE_BALANCE_NEGATIVE`（扣完会变负数，`details.balance` 是当前余额）、
  `NOTE_TOO_LONG`（备注超过 200 字）、`ADMIN_UNLIMITED`（给管理员发放）；账号不存在 404。

## 13.6 多用户：管理后台

都在 `/api/v1/admin/users*` 下：只在多用户模式、只给管理员（普通账号 403，单机模式 404）。
错误都是 `{ code, message（中文）, error: { code, http_status, details } }`。

**账号状态**：`status` 为 `active` / `disabled` / `deleted`。`deleted` 是软删除：不能登录、会话作废、
不算可用管理员；数据、账目、任务都保留，用户名继续占用；可以恢复（回到删之前的启用 / 停用）。
删了的账号不能停用 / 启用、重置密码、发页数、改身份（409 `ACCOUNT_DELETED`），要先恢复。

**身份与额度**：升成管理员后不限额（`page_balance` 为 `null`，账本不动）；降回普通账号，余额就是
账本里原来的数（管理员不能被发放，所以一般是升级前剩下的）。改身份立即生效，不用重新登录。

管理员看得到别人的账号和任务列表，但**打不开别人的任务详情**（`/api/v1/jobs/:id` 这类按数据归属，
管理员的网站会话也只认自己的数据），前端列任务时不要给链接。

### `GET /api/v1/admin/users`

查询参数都可选；不带参数时和以前一样返回没删的全部账号（按建号时间、再按用户名排）。

| 参数 | 说明 |
| --- | --- |
| `q` | 用户名包含这段，不区分大小写 |
| `status` | `active` / `disabled` / `deleted`；不传 = 没删的（启用 + 停用） |
| `role` | `admin` / `user` |
| `sort` | `created_at`（默认）/ `username` / `last_login_at` / `page_balance`（管理员排最后） |
| `order` | `asc`（默认）/ `desc` |
| `limit` / `offset` | 分页，`limit` 1～500；不传 `limit` 不分页 |

返回 `{ users: [...], total }`，`total` 是符合条件的总数。每个账号：`user_id`、`username`、`role`、
`status`、`must_change_password`、`created_at`、`last_login_at`、`deleted_at`（没删为空串）、
`page_balance`（管理员为 `null`）。参数取值不对：400 `INVALID_QUERY`，`details.param` 是参数名。

### `GET /api/v1/admin/users/:user_id`

删了的也能看。返回 `{ user, page_balance, stats }`，`stats`：

| 字段 | 说明 |
| --- | --- |
| `jobs_total`、`jobs_by_status` | 任务总数；按 `queued` / `running` / `succeeded` / `failed` / `canceled` 计数（没有的不出现）。含书籍任务自动派生的 OCR 子任务 |
| `documents`、`uploads` | 书的数量、上传数 |
| `upload_bytes` | 上传的原始 PDF 合计字节数（不含任务产物） |
| `pages_charged` | 实际扣掉的页数：已确认 + 预扣中（退回的不算） |
| `pages_reserved` | 其中还在预扣中、任务没跑完的 |
| `last_submitted_at` | 最近一次建任务的时间，没有为 `null` |

### `GET /api/v1/admin/users/:user_id/jobs?limit=&offset=`

新的在前，`limit` 默认 20、最多 200。返回 `{ jobs, total }`，每条：`job_id`、`workflow`、`status`、
`title`（书名，没有就是上传的文件名）、`document_pages`（源 PDF 总页数）、`charged_pages` 与
`charge_status`（`reserved` / `settled` / `refunded`；不计费的任务为 `null`）、`created_at`、`finished_at`。

### `POST /api/v1/admin/users/:user_id/role`

请求体 `{ "role": "admin" | "user" }`，返回 `{ user }`。错误（400）：`INVALID_ROLE`、
`CANNOT_CHANGE_OWN_ROLE`、`LAST_ADMIN`（会让系统没有可用管理员）。

### `DELETE /api/v1/admin/users/:user_id`

软删除，踢掉它所有会话，并**取消它还在排队 / 在跑的任务**（按页数规则全额退回）。返回
`{ user, canceled_jobs: ["job_id", ...] }`。已经删了的再删原样返回。错误（400）：`CANNOT_DELETE_SELF`、
`LAST_ADMIN`。

### `POST /api/v1/admin/users/:user_id/restore`

恢复，返回 `{ user }`；没删的原样返回。被删期间取消的任务不会自动恢复。

### 批量操作

没有批量接口：前端逐个调用上面这些（以及发放页数、停用、启用），每个请求各自成功或失败。

## 13.7 多用户：平台设置（翻译模型与 OCR）

多用户模式下，所有网站账号的任务统一用平台的翻译模型和 OCR（平台出钱），客户端传来的模型、地址、
密钥一律不认。只给多用户模式下的管理员（普通账号 403，单机模式 404）。

- **来源**：管理后台保存过的优先；从没保存过就用 `RETAIN_PLATFORM_*` 环境变量（已有部署不受影响）。
  第一次保存时以环境变量的值为底，没填的密钥沿用环境变量里的凭据。
- **生效**：每次建任务时现读，保存后下一个任务就用新的，不用重启。已经提交的任务用提交那一刻的值。
- **密钥**：存进凭据库，接口只返回是否已配置和末 4 位提示，永远不返回明文。换密钥会新建一条凭据，
  排队中的任务仍用旧的；被换下来的旧凭据（管理后台建的、没任务再用）自动清掉，环境变量里的不碰。
- **平台统一管的翻译参数**：模型、接口地址、协议、密钥、思考深度、单个任务的并发上限（用户填得更大
  或没填，都按上限）。其余参数（翻译模式、公式、术语表、规则、精修、页范围、批大小）照用户提交的。

### `GET /api/v1/admin/platform`

```json
{
  "source": "database",
  "translation": { "model": "deepseek-chat", "base_url": "https://api.deepseek.com/v1",
                   "api_protocol": "openai", "thinking": "off", "max_workers": 4,
                   "api_key_configured": true, "api_key_hint": "…1234" },
  "ocr": { "provider": "mineru", "token_configured": true, "token_hint": "…9876" },
  "ready": true,
  "missing": [],
  "updated_at": "2026-10-11T08:00:00Z",
  "updated_by": { "user_id": "u_…", "username": "admin" },
  "options": { "api_protocols": ["openai", "openai_responses", "anthropic"],
               "thinking_levels": ["auto", "off", "low", "medium", "high", "max"],
               "ocr_providers": ["mineru", "paddle"], "max_workers_limit": 64 }
}
```

`source` 为 `database`（管理后台保存过）或 `environment`。`missing` 可能含 `translation_model`、
`translation_base_url`、`translation_api_key`、`ocr_provider`、`ocr_token`（密钥在凭据库里找不到或
OCR token 不是这个服务商的，也算缺）。`updated_at` / `updated_by` 只在 `source` 为 `database` 时有值。

### `PUT /api/v1/admin/platform`

请求体：

```json
{
  "translation": { "model": "…", "base_url": "…", "api_protocol": "openai", "thinking": "off",
                   "max_workers": 4, "api_key": "sk-…（选填）" },
  "ocr": { "provider": "mineru", "token": "…（选填）" }
}
```

非密钥字段整体替换（空串 = 不设；`thinking` 空串 = 任务默认的 `auto`）；`api_key` / `token` 不传或空串 = 保留原来的。返回同 GET。
错误（400）：`INVALID_API_PROTOCOL`、`INVALID_THINKING`、`INVALID_MAX_WORKERS`（0～64，0 = 不限）、
`INVALID_BASE_URL`（要 http(s)、不能带账号密码；内网地址默认不允许，部署时可用
`RUST_API_ALLOW_PRIVATE_PROVIDER_URLS=1` 放开）、`INVALID_OCR_PROVIDER`（只能 `mineru` / `paddle`）、
`OCR_TOKEN_REQUIRED`（换了 OCR 服务商必须同时填新 token——OCR 凭据带服务商标签）、`INVALID_SETTING`。

### `POST /api/v1/admin/platform/test`

请求体 `{ "target": "translation" | "ocr", 以及可选的 model、base_url、api_protocol、api_key、provider、token }`：
没传的用已保存的值，实际请求一次服务商。返回 `{ target, ok, status, summary, hint }`，`summary` 是中文。
`status` 例如 `ok`、`unauthorized`、`model_not_found`、`rate_limited`、`missing_input`（缺必填项，没有发请求）、
`invalid_input`（地址不合规）。`target` 不对：400 `INVALID_TEST_TARGET`。

环境变量（从没在管理后台保存过时生效）：`RETAIN_PLATFORM_TRANSLATION_MODEL`、`…_BASE_URL`、
`…_API_PROTOCOL`、`…_THINKING`、`…_MAX_WORKERS`、`…_CREDENTIAL_REF`、`RETAIN_PLATFORM_OCR_PROVIDER`、
`RETAIN_PLATFORM_OCR_CREDENTIAL_REF`。

## 14. 存储与所有权

后端是书籍、PDF、产物和封面的唯一真源。前端不持久化真实文件。

主要存储：

- `DATA_ROOT/uploads/`：上传文件
- `DATA_ROOT/jobs/{job_id}/`：任务工作目录
- `DATA_ROOT/downloads/`：下载缓存
- `DATA_ROOT/db/jobs.db`：SQLite 数据库

SQLite 主要表：

- `uploads`：源文件名、源 PDF 大小、页数
- `jobs`：任务状态、阶段、进度、时间戳、请求/runtime 状态
- `artifacts`：任务产物路径和缓存的书籍展示元数据
- `job_artifact_entries`：规范化产物 manifest
- `events`：完整历史进度流

## 15. 专题文档

- [本地启动与配置](./local-dev.md)
- [存储结构](./storage.md)
- [错误排查](./troubleshooting.md)
- [AI 问答与文档操作](./reader-ai-chat.md)
- [Rust API 架构边界](../rust_api/README.md)
- [当前运行主链](../../../backend/api/CURRENT_API_MAP.md)
- [Stage 执行契约](../../../backend/api/STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider 契约](../../../backend/api/OCR_PROVIDER_CONTRACT.md)
- [渲染参数契约](../../../backend/api/RENDER_OPTIONS_CONTRACT.md)
