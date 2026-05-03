# 后端 API 主文档

本文档面向前端接入、第三方调用和后端联调。完整路由清单见 [接口说明](./endpoints.md)。

## 基础规则

- 完整 API 默认端口：`41000`。
- 简便同步 API 默认端口：`42000`。
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

## 任务详情契约

`GET /api/v1/jobs/{job_id}` 是前端轮询主接口。关键字段：

- `job_id`
- `workflow`
- `status`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `links`
- `actions`
- `artifacts`
- `ocr_job`
- `runtime`
- `failure`
- `failure_diagnostic`
- `normalization_summary`
- `glossary_summary`
- `invocation`
- `log_tail`

前端规则：

- 终态判断看 `status`。
- 阶段展示看 `stage_detail`。
- 时间线看 `runtime.stage_history`。
- 按钮可用性看 `actions.*.enabled`。
- 产物可用性看 `artifacts.*.ready` 或 `artifacts-manifest.items[].ready`。
- 失败详情优先看 `failure`，旧 UI 可继续读 `failure_diagnostic`。

## Actions 与 Artifacts

常用 actions：

- `actions.download_pdf`
- `actions.open_markdown`
- `actions.open_markdown_raw`
- `actions.download_bundle`
- `actions.cancel`

常用 artifacts：

- `artifacts.pdf`
- `artifacts.markdown`
- `artifacts.bundle`
- `artifacts.normalized_document`
- `artifacts.normalization_report`

`artifacts.markdown` 会包含：

- `json_url` / `json_path`
- `raw_url` / `raw_path`
- `images_base_url` / `images_base_path`
- `ready`
- `file_name`
- `size_bytes`

兼容字段如 `pdf_url`、`markdown_url`、`bundle_url`、`pdf_ready`、`markdown_ready`、`bundle_ready` 仍可能存在，但新前端不应只依赖这些别名。

## Artifacts Manifest

正式机器发现入口：

- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`

item 字段：

- `artifact_key`
- `artifact_group`
- `artifact_kind`
- `ready`
- `file_name`
- `content_type`
- `size_bytes`
- `relative_path`
- `checksum`
- `source_stage`
- `updated_at`
- `resource_path`
- `resource_url`

调用方应先查 manifest，确认 `ready=true`，再使用 `resource_path` 或 `resource_url`。

## 事件流

接口：

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/events`

事件字段：

- `seq`
- `ts`
- `level`
- `stage`
- `stage_detail`
- `provider`
- `provider_stage`
- `event_type`
- `event`
- `message`
- `progress_current`
- `progress_total`
- `retry_count`
- `elapsed_ms`
- `payload`

`seq` 在单个任务内递增。新前端应优先看 `event_type`，`event` 保留兼容语义。

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

## 简便同步接口

`POST /api/v1/translate/bundle` 属于 simple app，通常监听 `42000`。它接受 multipart 扁平字段，适合脚本直接上传 PDF 并等待 ZIP。

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
