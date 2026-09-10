# RetainPDF 后端 API 总入口

这份文档是前端接入和第三方调用的公共入口。字段级 JSON Schema 以
[`contracts`](../../../contracts/README.md) 为准；Rust 编排、恢复和
内部 Agent 契约以 [`backend/api/API_SPEC.md`](../../../backend/api/API_SPEC.md)
及其分领域页面为准。其它 API 文档只作为专题页或历史兼容入口。

## 1. 基础约定

- 完整 API 默认端口：`41000`
- multipart 异步提交 API 默认端口：`42000`
- 健康检查：`GET /health`
- 就绪检查：`GET /ready`
- 业务前缀：`/api/v1`
- 除 `GET /health` 外，业务 API 默认需要 `X-API-Key`

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
- `50000`：内部错误

`X-API-Key` 是访问 Rust API 的后端白名单 key，不是 OCR Provider token，也不是模型 API key。

## 2. 推荐前端接入路径

图书馆页面优先使用“书籍语义”接口：

- `GET /api/v1/library/books`
- `GET /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}`
- `POST /api/v1/library/books/delete`
- `GET /api/v1/library/books/{job_id}/cover`
- `GET /api/v1/library/books/{job_id}/thumbnail`

任务创建和执行仍走 job API：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. `GET /api/v1/jobs/{job_id}`
4. `GET /api/v1/jobs/{job_id}/events`
5. 根据 `actions` / `artifacts` / `artifacts_display` 下载产物
6. 阅读问答和受限 PDF 操作统一使用 `POST /api/v1/ai/ask`；旧的
   `/api/v1/jobs/{job_id}/reader/ai/chat` 只保留兼容

## 3. 图书馆接口

列表：

`GET /api/v1/library/books?limit=20&offset=0&q=physics`

查询参数：

- `limit` / `offset`：分页。
- `q`：可选，全库搜索书名、源文件名、job_id、源 URL 和状态文本。

返回 `data.items[]`：

```json
{
  "id": "job-id",
  "job_id": "job-id",
  "title": "book title",
  "display_name": "book title",
  "source_file_name": "source.pdf",
  "authors": null,
  "page_count": 533,
  "status": "succeeded",
  "stage": "finished",
  "stage_detail": "done",
  "progress": {
    "current": 533,
    "total": 533,
    "percent": 100.0
  },
  "cover_url": "/api/v1/library/books/job-id/cover",
  "thumbnail_url": "/api/v1/library/books/job-id/thumbnail",
  "output_pdf_ready": true,
  "markdown_ready": true,
  "bundle_ready": true,
  "created_at": "2026-05-16T00:00:00Z",
  "updated_at": "2026-05-16T00:10:00Z"
}
```

详情：

`GET /api/v1/library/books/{job_id}`

返回重点字段：

- `id`
- `job_id`
- `title`
- `authors`
- `source_file_name`
- `page_count`
- `source_language`
- `target_language`
- `file_size_bytes`
- `status`
- `stage`
- `progress`
- `cover_url`
- `thumbnail_url`
- `artifacts`

删除：

- `DELETE /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}?force=true`
- `POST /api/v1/library/books/delete`

删除行为：

- 删除主 job 记录
- 删除关联 `artifacts` / `job_artifact_entries` / `events`
- 删除 `DATA_ROOT/jobs/{job_id}`
- 删除 `DATA_ROOT/downloads/{job_id}.zip`
- 如果存在 `{job_id}-ocr` 子任务，一并删除
- 默认不删除 `uploads` 源文件
- `queued` / `running` 默认拒绝删除，除非传 `force=true`

### 文档身份与文档级任务历史

图书馆的兼容 `book/job` 视图之外，AI 会话、版本和继续处理统一使用稳定的
`document_id`：

- `GET /api/v1/documents`
- `GET|PATCH|DELETE /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/source.pdf`
- `GET /api/v1/documents/{document_id}/cover`
- `GET /api/v1/documents/{document_id}/thumbnail`
- `POST /api/v1/documents/{document_id}/ocr`
- `POST /api/v1/documents/{document_id}/translate`
- `GET /api/v1/documents/{document_id}/jobs`
- `GET /api/v1/documents/{document_id}/agent-versions`
- `POST|GET /api/v1/documents/{document_id}/metadata-suggestions`
- `POST /api/v1/documents/{document_id}/metadata-suggestions/{suggestion_id}/apply`

`GET /api/v1/documents` 返回 `{ "documents": [...], "total": 128 }`。
`total` 是应用 `reading_status`、`tag`、`collection_id` 以及有效 upload
约束后的跨页总数；`limit` 和 `offset` 只裁剪 `documents`。使用 `job_id`
直查时，命中返回 `total: 1`，未命中返回 `total: 0`。

文档级任务列表是刷新页面后恢复当前 OCR、翻译和渲染状态的权威入口；不要只保留
浏览器内存中的最后一个 `job_id`。Agent 版本列表投影 candidate/committed 版本元数据
和当前 active version，不暴露内部 workspace 或 artifact 路径。

元数据建议接口从 PDF Info 和规范化 OCR 的
`structure_role=document_title` 生成可审查、可恢复的标题候选。请求可使用
`apply_if_default=true` 自动命名，但只会修改仍为上传文件名且未被用户锁定的文档；
手工 `PATCH title` 后不会被自动结果覆盖。完整字段和冲突码见
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
    "model": "deepseek-v4-flash",
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
    "timeout_seconds": 1800
  }
}
```

推荐先通过 `POST /api/v1/credentials` 创建 `translation_api_key` 凭据，再把返回的
`credential_ref` 放进任务。`GET /api/v1/credentials` 和任务详情只返回元数据，
不会返回凭据值。`translation.api_key` 仍是兼容输入，但不能和 `credential_ref`
同时提交，也不应作为新客户端的持久化方案。

凭据管理接口为：

- `GET|POST /api/v1/credentials`
- `GET|PUT|DELETE /api/v1/credentials/{credential_ref}`

`workflow`：

- `book`：OCR -> Normalize -> Translate -> Render
- `translate`：OCR -> Normalize -> Translate
- `render`：基于已有任务 artifact 重跑渲染

阶段恢复：

- `POST /api/v1/jobs/{job_id}/cancel`
- `POST /api/v1/jobs/{job_id}/rerun`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`
- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- 有 `translations_dir + source_pdf` 时，复用原 `job_id` 原地重渲染并替换渲染产物
- 只有 `normalized_document_json + source_pdf` 时，创建新的 `book` 恢复任务
- `workflow=translate` + `source.artifact_job_id`：复用 OCR checkpoint
- `workflow=book` + `source.artifact_job_id`：复用 OCR checkpoint 后继续翻译并渲染
- `workflow=render` + `source.artifact_job_id`：复用翻译产物后只重跑渲染

`/resume` 当前复用 `/rerun` 的恢复执行契约；`/resume-plan` 用于前端先展示“会从哪里恢复、会复用哪些产物、会重跑哪些阶段”。

主动阶段重试：

`GET /api/v1/jobs/{job_id}/stage-actions`

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
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/job-id/retry-stage",
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

`POST /api/v1/jobs/{job_id}/retry-stage`

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
进入 `GET /jobs/{job_id}` 和 `GET /jobs/{job_id}/events` 轮询。

## 6. 任务查询与事件

任务查询：

- `GET /api/v1/jobs?limit=20&offset=0&status=&workflow=&provider=`
- `GET /api/v1/jobs/{job_id}`

列表项直接返回 `attempt`、`retry_count` 和 `last_retry_at`，用于稳定展示重试状态。
详情中的重试时间线继续位于 `runtime` 投影。

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
- `book_summary`
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

`GET /api/v1/jobs/{job_id}/events?limit=200&offset=0`

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

`GET /api/v1/jobs/{job_id}/diagnostics`

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

`POST /api/v1/jobs/{job_id}/ocr/resolve-ambiguity`

请求必须带诊断接口返回的 `resolution_revision`。状态已被其他请求解决或 revision
变化时返回 `409`；响应、日志和审计事件均不得回显 `upload_url` 等敏感字段值。

断点恢复计划：

`GET /api/v1/jobs/{job_id}/resume-plan`

```json
{
  "can_resume": true,
  "job_id": "job-id",
  "from_stage": "render",
  "resume_workflow": "render",
  "reuses_artifacts": ["source_pdf", "translations_dir", "normalized_document_json"],
  "reruns_stages": ["rendering"],
  "reason": null
}
```

执行恢复：

`POST /api/v1/jobs/{job_id}/resume`

响应同 `POST /api/v1/jobs/{job_id}/rerun`，返回 `JobSubmissionView`。

实时翻译覆盖层只读取已经 durable commit 的页面快照：

- `GET /api/v1/jobs/{job_id}/live-translation/layout`
- `GET /api/v1/jobs/{job_id}/live-translation/pages/{page_idx}`
- `GET /api/v1/jobs/{job_id}/live-events?after_seq={seq}`

`live-events` 是可重放的 SSE 通知，不直接携带非持久化模型 token。客户端收到
`translation_units_committed` 后，再读取对应页面的权威快照；断线后用最后确认的
`seq` 重连。布局、页面快照和事件身份必须匹配同一 `attempt/generation/page_hash`。

## 7. 产物与下载

产物接口：

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/markdown/images/*path`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/normalized-document`
- `GET /api/v1/jobs/{job_id}/normalization-report`

前端按钮状态优先读：

- `actions.*.enabled`
- `artifacts.*.ready`
- `artifacts_display[].ready`
- `artifacts-manifest.items[].ready`

Markdown 注意：

- `/markdown` 默认返回 JSON 包装
- `/markdown/document` 返回结构化文档视图，包含 `content`、`content_with_absolute_image_urls`、`images[]` 图片直链清单，适合前端预览和 AI 问答
- `/markdown?raw=true` 返回原始 Markdown
- 图片通过 `/markdown/images/*path` 读取

PDF 按需加载：

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/artifacts/source_pdf`

这两个接口支持 HTTP Range Requests。前端 PDF.js 应优先使用 URL 模式，而不是先 fetch 整个 PDF 到 `ArrayBuffer`。

后端会优先返回线性化 PDF 缓存：

- 如果运行环境存在 `qpdf`，首次下载时会懒生成 `*.linearized.pdf`
- 后续下载复用缓存
- 如果没有 `qpdf`，自动回退到原 PDF，不影响接口可用性

请求示例：

```http
GET /api/v1/jobs/{job_id}/pdf
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

跨域读取时，后端会暴露：

- `Accept-Ranges`
- `Content-Range`
- `Content-Length`
- `X-Job-Id`

页级预览：

`GET /api/v1/jobs/{job_id}/preview/pages/{page}?kind=translated`

参数：

- `page`：1-based 页码
- `kind`：`source | translated`，默认 `translated`
- `width`：可选，默认 `1200`，范围 `240..2400`
- `dpi`：可选，优先级高于 `width`，最大 `300`

响应：

```http
200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
```

预览图按 job 缓存在 `DATA_ROOT/jobs/{job_id}/artifacts/` 下。前端可先请求第一页预览图实现秒开，再后台加载 PDF.js。

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
- `POST /api/v1/assets`
- `GET /api/v1/assets/{asset_id}`
- `GET /api/v1/fonts`
- `POST /api/v1/fonts/upload`

查询和关系接口只返回持久化 ID 与安全投影；客户端不得把本地文件路径作为资源 ID。

## 9. OCR-only 接口

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs?limit=20&offset=0&status=&provider=`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`

## 10. 术语表接口

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`
- `POST /api/v1/glossaries/import`
- `GET /api/v1/glossaries/{glossary_id}/export.csv`

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
- `match_mode`：
  - `exact`：默认精确匹配。
  - `case_insensitive`：忽略大小写。
  - `regex`：正则匹配。
- `context`：可选，只在附近上下文包含该词时生效。
- `note`：备注，只给前端和 prompt 说明用。

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

请求体同创建接口。后端按整个 `entries` 数组替换。

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

任务提交时可通过 `translation.glossary_id` 引用命名术语表，也可通过 `translation.glossary_entries` 传 inline 条目。

## 11. Provider 校验

- `GET /api/v1/providers/ocr`
- `POST /api/v1/providers/mineru/validate-token`
- `POST /api/v1/providers/paddle/validate-token`
- `POST /api/v1/providers/deepseek/validate-token`
- `POST /api/v1/providers/deepseek/balance`

推荐返回状态：

- `valid`
- `unauthorized`
- `expired`
- `network_error`
- `provider_error`

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

`POST /api/v1/translate/bundle`

该接口属于 simple app，通常监听 `42000`。它接受 multipart 扁平字段，适合脚本直接上传 PDF 并创建后台翻译任务。

该接口返回 `ApiResponse<JobSubmissionView>`，不会等待 Python OCR / 翻译 / 渲染完成，也不会同步返回 ZIP。

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
