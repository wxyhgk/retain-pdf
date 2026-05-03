# 接口说明

除 `GET /health` 外，下面接口都需要 `X-API-Key`。

## 健康检查

- `GET /health`

用于前端和运维检查后端连通性。

## 上传

- `POST /api/v1/uploads`

`multipart/form-data`：

- `file`：必填，PDF。
- `developer_mode`：可选，`true/false`。

返回重点字段：

- `upload_id`
- `filename`
- `bytes`
- `page_count`
- `uploaded_at`

示例：

```bash
curl -X POST http://127.0.0.1:41000/api/v1/uploads \
  -H "X-API-Key: your-rust-api-key" \
  -F "file=@/path/to/paper.pdf"
```

## 主任务

### 创建任务

- `POST /api/v1/jobs`

只接受 grouped JSON，不接受旧扁平 JSON。

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "20260402073151-a80618"
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
    "skip_title_translation": false,
    "batch_size": 1,
    "workers": 50,
    "classify_batch_size": 12,
    "rule_profile_name": "general_sci",
    "custom_rules_text": "",
    "glossary_entries": []
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

- `book`：完整链路。
- `translate`：只到翻译。
- `render`：基于 `source.artifact_job_id` 重跑渲染。

常见必填：

- `source.upload_id`：`book` / `translate` 常用。
- `source.artifact_job_id`：`render` 使用。
- `ocr.provider`：`mineru` 或 `paddle`。
- `ocr.mineru_token`：MinerU provider 需要。
- `ocr.paddle_token`：Paddle provider 需要。
- `translation.base_url` / `translation.api_key` / `translation.model`：需要翻译时使用。

响应重点：

- `job_id`
- `status`
- `workflow`
- `links`
- `actions`

### 查询任务

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
- `ocr_job`
- `runtime`
- `failure`
- `failure_diagnostic`
- `normalization_summary`
- `glossary_summary`
- `invocation`
- `log_tail`

敏感字段会被脱敏；例如 `request_payload.translation.api_key` 不会原样返回。

### 事件

- `GET /api/v1/jobs/{job_id}/events?limit=200&offset=0`

事件字段：

- `job_id`
- `seq`
- `ts`
- `level`
- `stage`
- `stage_detail`
- `provider`
- `provider_stage`
- `event`
- `event_type`
- `message`
- `progress_current`
- `progress_total`
- `retry_count`
- `elapsed_ms`
- `payload`

新前端应优先读取 `event_type`；`event` 保留兼容语义。

### 产物

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

`artifacts-manifest.items[]` 重点字段：

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

Markdown 注意：

- `/markdown` 默认返回 JSON 包装。
- `/markdown?raw=true` 返回原始 Markdown。
- 图片通过 `/markdown/images/*path` 读取。

### 取消任务

- `POST /api/v1/jobs/{job_id}/cancel`

## OCR-only

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

`POST /api/v1/ocr/jobs` 是 multipart，可带 `file` 或已有 source 字段。`GET /api/v1/ocr/jobs` 会强制按 `workflow=ocr` 查询。

## 术语表

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`

术语条目字段：

- `source`
- `target`
- `note`
- `level`
- `match_mode`
- `context`

最小创建请求：

```json
{
  "name": "semiconductor",
  "entries": [
    {
      "source": "band gap",
      "target": "带隙",
      "note": "materials"
    }
  ]
}
```

CSV 解析：

```json
{
  "csv_text": "source,target,note\nband gap,带隙,materials\n"
}
```

## Provider 校验

- `POST /api/v1/providers/mineru/validate-token`
- `POST /api/v1/providers/paddle/validate-token`
- `POST /api/v1/providers/deepseek/validate-token`

MinerU：

```json
{
  "mineru_token": "mineru-token",
  "base_url": "",
  "model_version": "vlm"
}
```

Paddle：

```json
{
  "paddle_token": "paddle-access-token",
  "base_url": "https://paddleocr.aistudio-app.com"
}
```

DeepSeek：

```json
{
  "api_key": "sk-xxxx",
  "base_url": "https://api.deepseek.com/v1"
}
```

响应重点：

- `ok`
- `status`
- `summary`
- `retryable`
- `provider_code`
- `provider_message`
- `operator_hint`
- `trace_id`
- `base_url`
- `checked_at`

## 翻译调试

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items?limit=&offset=&page=&final_status=&error_type=&route=&q=`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

这些接口用于开发和排障。前端调试页会读取诊断摘要、单条翻译输入输出和 replay 结果。

## 简便同步接口

- `POST /api/v1/translate/bundle`

这个接口运行在 simple app，通常是 `42000` 端口；不是 `41000` 完整 API 的路由。

它接受 multipart 表单，支持扁平字段映射，适合脚本一次性上传并等待 ZIP 结果。正式前端主流程仍推荐：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. 轮询任务详情
4. 读取 actions / artifacts 下载
