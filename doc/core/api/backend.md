# 后端 API 主文档

本文档面向前端接入、第三方调用和后端联调。更细的任务详情、事件流、生命周期、失败协议，请看 [Rust API 说明](../rust_api/README.md)。

## 基础规则

- 完整 API 默认端口：`41000`。
- multipart 异步提交 API 默认端口：`42000`。
- 健康检查：`GET /health`。
- 业务前缀：`/api/v1`。
- 除 `GET /health` 外，业务 API 默认需要 `X-API-Key`。

`X-API-Key` 是访问 Rust API 的后端白名单 key，不是 OCR Provider token，也不是模型 API key。

## 成功与错误响应

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误：

```json
{
  "code": 40000,
  "message": "invalid request"
}
```

常见错误码：

- `40000`：请求错误。
- `40100`：鉴权失败。
- `40400`：资源不存在。
- `40900`：状态冲突。
- `50000`：内部错误。

## 创建任务契约

`POST /api/v1/jobs` 只接受 grouped JSON。旧扁平字段会被拒绝。

顶层结构：

- `workflow`
- `source`
- `ocr`
- `translation`
- `render`
- `runtime`

字段概览：

```text
workflow: book | translate | render
source: upload_id | source_url | artifact_job_id
ocr: provider, mineru_token, paddle_token, model_version, language, page_ranges, poll_interval, poll_timeout
translation: mode, math_mode, api_key, model, base_url, batch_size, workers, glossary_id, glossary_entries
render: render_mode, compile_workers, typst_font_family, pdf_compress_dpi
runtime: job_id, timeout_seconds
```

OCR-only 不走这个 JSON 入口，使用 `POST /api/v1/ocr/jobs`。

阶段恢复约定：

- `POST /api/v1/jobs/{job_id}/rerun`：自动根据源任务已有产物创建新的恢复任务，不覆盖原任务。
- `workflow=translate` + `source.artifact_job_id`：复用指定任务的 OCR checkpoint，只重跑翻译，不重跑 OCR。
- `workflow=book` + `source.artifact_job_id`：复用指定任务的 OCR checkpoint，继续翻译并渲染。
- `workflow=render` + `source.artifact_job_id`：复用指定任务的 `translations_dir`，只重跑渲染。

`rerun` 的自动选择策略：如果源任务有 `translations_dir + source_pdf`，创建 `workflow=render`；否则如果有 `normalized_document_json + source_pdf`，创建 `workflow=book`；否则返回不可恢复错误。

OCR checkpoint 要求源任务已有 `source_pdf` 和 `normalized_document_json` artifact。渲染恢复要求源任务已有 `source_pdf` 和 `translations_dir` artifact。从 artifact 恢复时仍需要 `translation.base_url` / `translation.api_key` / `translation.model`，但不再要求 OCR provider token。

## 术语表

命名术语表接口：

- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`
- `POST /api/v1/glossaries/parse-csv`

条目字段：

- `source`
- `target`
- `note`
- `level`
- `match_mode`
- `context`

任务提交时可通过 `translation.glossary_id` 引用命名术语表，也可通过 `translation.glossary_entries` 传 inline 条目。

## multipart 异步提交接口

`POST /api/v1/translate/bundle` 属于 simple app，通常监听 `42000`。它接受 multipart 扁平字段，适合脚本直接上传 PDF 并创建后台翻译任务。

该接口现在返回 `ApiResponse<JobSubmissionView>`，不会等待 Python OCR / 翻译 / 渲染完成，也不会同步返回 ZIP。调用方应读取返回的 `job_id`，再轮询任务详情，任务成功后通过 actions / artifacts 下载 ZIP 或 PDF。

正式前端和第三方集成优先使用异步三段式：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. `GET /api/v1/jobs/{job_id}`
4. 根据 `actions` / `artifacts` 下载

## 相关文档

- [接口说明](./endpoints.md)
- [存储结构](./storage.md)
- [错误排查](./troubleshooting.md)
- [Rust API 说明](../rust_api/README.md)
- [backend/rust_api/API_SPEC.md](../../backend/rust_api/API_SPEC.md)
