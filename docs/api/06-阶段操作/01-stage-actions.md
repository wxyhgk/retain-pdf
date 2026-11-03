# 阶段操作列表（actions）

> 地址已按 8 类整理（新地址如 `/jobs/{job_id}/actions`）。对应的旧地址已于 2026-10-18 删除（返回 404）。新旧对照见 [任务接口分类](../01-任务/04-任务接口分类.md)。

契约：[`job-actions.v1`](../../../contracts/job-actions.v1.schema.json)（前端类型从 `@retainpdf/contracts/job-actions` 导入，返回 `StageActionsView`；
续跑计划、续跑、取消、OCR 歧义处理也在这份契约里）。409 的 `error.details.reason` 取值见契约的 `ActionBlockReason`。

## 接口

```http
GET /api/v1/jobs/{job_id}/actions
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
      "disabled_code": null,
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/xxx/actions/retry-stage",
        "body": {
          "stage": "translation"
        }
      }
    }
  ]
}
```

## 不能重试的原因

`disabled_reason` 是给人看的文字，`disabled_code` 是同一件事的机器可读版本（`disabled_reason` 为空时是 `null`），
取值和 `retry-stage` 被拒时 409 的 `error.details.reason` 一致，见 [错误约定](../00-约定/02-认证与错误.md#任务操作的-409-原因)：
`job_active`、`artifacts_missing`、`translations_not_owned`、`model_executor_unsupported`、`request_journal_corrupt`、`ambiguous_translation_request`。

一个例外：翻译阶段在请求结果不确定时 `can_retry` 仍是 `true`（带 `ambiguous_request_policy=accept_duplicate_risk` 就能重试），
此时 `disabled_code` 是 `ambiguous_translation_request`、`danger` 是 `true`。

## 前端规则

- 按后端返回的 `can_retry` 决定按钮是否可点；要区分原因（比如「任务在跑」和「产物不在」）读 `disabled_code`，不要解析 `disabled_reason`。
- `action.body` 可以原样 POST 给 `retry-stage`；`retry-stage` 不认识请求体里的其他字段（返回 400）。
- 不要前端自己猜哪些产物能复用。
- `will_reuse` 和 `will_rerun` 只用于展示和确认。
- 真正执行以 `action` 和 [retry-stage](02-retry-stage.md) 为准。
