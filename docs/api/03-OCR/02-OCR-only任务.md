# OCR-only 任务

> `/ocr/jobs/…` 这组地址已于 2026-10-18 删除（返回 404）。OCR-only 任务现在和别的任务走同一组 `/jobs` 地址，只是 `workflow` 填 `ocr`。
> `/jobs/{job_id}` 下 8 类地址对照见[任务接口分类](../01-任务/04-任务接口分类.md)，全部接口见[接口目录](../00-接口目录.md)。

## 创建

分两步：

```http
POST /api/v1/uploads
POST /api/v1/jobs
```

1. `POST /api/v1/uploads`（`multipart/form-data`，字段 `file`）上传 PDF，拿到 `upload_id`。
2. `POST /api/v1/jobs`，JSON 请求体，`workflow` 填 `ocr`，`source.upload_id` 填上一步的编号（也可以用 `source.source_url` 提交远程 PDF，不用上传）。

```json
{
  "workflow": "ocr",
  "source": { "upload_id": "upload-xxx" },
  "ocr": { "provider": "mineru", "mineru_token": "secret" },
  "runtime": { "timeout_seconds": 1800 }
}
```

只执行 OCR provider 和 normalized document 生成，不进入翻译和渲染，所以不需要 `translation`、`render`。
OCR provider 由 `ocr.provider` 决定。完整字段和 curl 示例见 `backend/api/OCR_Service_API.md`。

## 查询和取消

```http
GET  /api/v1/jobs?workflow=ocr
GET  /api/v1/jobs/{job_id}
GET  /api/v1/jobs/{job_id}/progress/events
GET  /api/v1/jobs/{job_id}/files
GET  /api/v1/jobs/{job_id}/files/internal/normalized-document.json
GET  /api/v1/jobs/{job_id}/files/internal/normalization-report.json
POST /api/v1/jobs/{job_id}/actions/cancel
```

| 已删除的旧地址 | 现在用 |
|---|---|
| `POST /ocr/jobs`（multipart） | `POST /uploads` + `POST /jobs` |
| `GET /ocr/jobs` | `GET /jobs?workflow=ocr` |
| `GET /ocr/jobs/{job_id}` | `GET /jobs/{job_id}` |
| `GET /ocr/jobs/{job_id}/events` | `GET /jobs/{job_id}/progress/events` |
| `GET /ocr/jobs/{job_id}/artifacts`、`/artifacts-manifest` | `GET /jobs/{job_id}/files` |
| `GET /ocr/jobs/{job_id}/normalized-document` | `GET /jobs/{job_id}/files/internal/normalized-document.json` |
| `GET /ocr/jobs/{job_id}/normalization-report` | `GET /jobs/{job_id}/files/internal/normalization-report.json` |
| `POST /ocr/jobs/{job_id}/cancel` | `POST /jobs/{job_id}/actions/cancel` |

`/files/internal/…` 只给管理员（多用户模式）；单机模式都能取。

## 产物

成功后核心产物：

- `source_pdf`
- `provider_result_json`
- `provider_raw_dir`
- `normalized_document_json`
- `normalization_report_json`

其中 `normalized_document_json` 是后续翻译和渲染唯一应消费的 OCR 中间契约。
