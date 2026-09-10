# retry-stage

## 接口

```http
POST /api/v1/jobs/{job_id}/retry-stage
```

用于用户主动从某个阶段重新执行后续流程。

## 请求示例

```json
{
  "stage": "translation",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "translation": {
      "model": "deepseek-v4-flash",
      "workers": 100
    },
    "render": {
      "compile_workers": 8
    }
  }
}
```

## 阶段语义

- `ocr`: 复用 source PDF，重跑 OCR -> translation -> render。
- `translation`: 复用 source PDF + OCR 结果，重跑 translation -> render。
- `render`: 复用 source PDF + OCR 结果 + 翻译结果，只重跑 render。

## 响应示例

```json
{
  "job_id": "new-job-id",
  "source_job_id": "old-job-id",
  "status": "queued",
  "workflow": "book",
  "rerun_from_stage": "translation",
  "reused_artifacts": ["source_pdf", "ocr_result"],
  "rerun_stages": ["translation", "render"]
}
```

前端拿到新 `job_id` 后直接进入正常轮询。

## 与 resume 的区别

- `resume` 更偏失败后的恢复。
- `retry-stage` 是用户主动从指定阶段重跑，成功任务也可以用。
