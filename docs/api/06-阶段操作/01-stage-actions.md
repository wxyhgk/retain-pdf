# stage-actions

## 接口

```http
GET /api/v1/jobs/{job_id}/stage-actions
```

用于查询每个阶段是否可以主动重试，以及重试会复用和重跑哪些产物。

## 响应示例

```json
{
  "job_id": "xxx",
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
        "url": "/api/v1/jobs/xxx/retry-stage",
        "body": {
          "stage": "translation"
        }
      }
    }
  ]
}
```

## 前端规则

- 按后端返回的 `can_retry` 决定按钮是否可点。
- 不要前端自己猜哪些产物能复用。
- `will_reuse` 和 `will_rerun` 只用于展示和确认。
- 真正执行以 `action` 和 [retry-stage](02-retry-stage.md) 为准。
