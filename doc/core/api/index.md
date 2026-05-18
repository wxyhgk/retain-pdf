# RetainPDF 后端 API 总入口

这份文档是前端接入、第三方调用和后端联调用的唯一入口。其它 API 文档只作为专题页或历史兼容入口。

## 1. 基础约定

- 完整 API 默认端口：`41000`
- multipart 异步提交 API 默认端口：`42000`
- 健康检查：`GET /health`
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

## 3. 图书馆接口

列表：

`GET /api/v1/library/books?limit=20&offset=0`

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
    "api_key": "sk-xxxx",
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

`workflow`：

- `book`：OCR -> Normalize -> Translate -> Render
- `translate`：OCR -> Normalize -> Translate
- `render`：基于已有任务 artifact 重跑渲染

阶段恢复：

- `POST /api/v1/jobs/{job_id}/rerun`
- 有 `translations_dir + source_pdf` 时，复用原 `job_id` 原地重渲染并替换渲染产物
- 只有 `normalized_document_json + source_pdf` 时，创建新的 `book` 恢复任务
- `workflow=translate` + `source.artifact_job_id`：复用 OCR checkpoint
- `workflow=book` + `source.artifact_job_id`：复用 OCR checkpoint 后继续翻译并渲染
- `workflow=render` + `source.artifact_job_id`：复用翻译产物后只重跑渲染

## 6. 任务查询与事件

任务查询：

- `GET /api/v1/jobs?limit=20&offset=0&status=&workflow=&provider=`
- `GET /api/v1/jobs/{job_id}`

详情重点字段：

- `job_id`
- `workflow`
- `status`
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

阶段事件稳定字段：

- `user_stage`
- `stage`
- `substage`
- `stage_detail`
- `event_type`
- `progress_current`
- `progress_total`
- `progress_unit`

`progress_unit` 可为：

- `page`
- `batch`
- `step`
- `percent`
- `none`

主任务事件流会合并 OCR 子任务页进度。任务完成后仍保留历史事件。

## 7. 产物与下载

产物接口：

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown`
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
```

预览图按 job 缓存在 `DATA_ROOT/jobs/{job_id}/artifacts/` 下。前端可先请求第一页预览图实现秒开，再后台加载 PDF.js。

## 8. OCR-only 接口

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

## 9. 术语表接口

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`

任务提交时可通过 `translation.glossary_id` 引用命名术语表，也可通过 `translation.glossary_entries` 传 inline 条目。

## 10. Provider 校验

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

## 11. Simple App 入口

`POST /api/v1/translate/bundle`

该接口属于 simple app，通常监听 `42000`。它接受 multipart 扁平字段，适合脚本直接上传 PDF 并创建后台翻译任务。

该接口返回 `ApiResponse<JobSubmissionView>`，不会等待 Python OCR / 翻译 / 渲染完成，也不会同步返回 ZIP。

## 12. 存储与所有权

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

## 13. 专题文档

- [本地启动与配置](./local-dev.md)
- [存储结构](./storage.md)
- [错误排查](./troubleshooting.md)
- [Rust API 架构边界](../rust_api/README.md)
- [当前运行主链](../../../backend/rust_api/CURRENT_API_MAP.md)
- [Stage 执行契约](../../../backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider 契约](../../../backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- [渲染参数契约](../../../backend/rust_api/RENDER_OPTIONS_CONTRACT.md)
