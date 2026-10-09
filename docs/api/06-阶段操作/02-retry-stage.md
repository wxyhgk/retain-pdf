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
      "model": "deepseek-flash",
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
- `render`: 复用 source PDF + OCR 结果 + 翻译结果，只重跑 render（不精修）。
- `refine`: 复用全部产物，原地（只能 `create_new_job=false`，省略时默认就是 false）先精修已提交的译文、再渲染一次。
  可带 `"refine": {"mode": "review_only" | "review_and_fix", "start_page": 3, "end_page": 5, "max_items": 0, "max_tokens": 0}`，页码 1-based 闭区间，省略 = 全书、`review_and_fix`。
  `max_items` / `max_tokens` 是这次精修的上限（`0` = 不限），省略 = 不限（审全书）；**不沿用**任务里存的
  `refine_max_items` / `refine_max_tokens`。上次精修中途停了的，报告里 `review.next_page` 是没审到的第一页，
  用 `start_page` 从那一页接着精修。
  这次的精修参数是一次性的，不会写进任务的 `translation.refine`；报告见 `GET /api/v1/jobs/{job_id}/translation/refine-report`。

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
