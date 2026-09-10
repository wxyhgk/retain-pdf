# OCR-only 任务

## 创建接口

```http
POST /api/v1/ocr/jobs
```

用于只执行 OCR provider 和 normalized document 生成，不进入翻译和渲染。

## 查询接口

```http
GET /api/v1/ocr/jobs/{job_id}
GET /api/v1/ocr/jobs/{job_id}/events
GET /api/v1/ocr/jobs/{job_id}/artifacts
GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest
GET /api/v1/ocr/jobs/{job_id}/normalized-document
GET /api/v1/ocr/jobs/{job_id}/normalization-report
POST /api/v1/ocr/jobs/{job_id}/cancel
```

## 请求重点

OCR-only 的 `workflow` 语义固定为 `ocr`，OCR provider 仍然由 `ocr.provider` 决定。

## 产物

成功后核心产物：

- `source_pdf`
- `provider_result_json`
- `provider_raw_dir`
- `normalized_document_json`
- `normalization_report_json`

其中 `normalized_document_json` 是后续翻译和渲染唯一应消费的 OCR 中间契约。
