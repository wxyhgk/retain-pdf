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
  "job_id": "20260519010101-abcd12",
  "stages": [
    {
      "stage": "translation",
      "label": "重试翻译",
      "can_retry": true,
      "reason": "",
      "disabled_reason": "",
      "disabled_code": null,
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
        "body": {"stage": "translation", "ambiguous_request_policy": "block"}
      }
    },
    {
      "stage": "refine",
      "label": "精修译文",
      "can_retry": true,
      "reason": "",
      "disabled_reason": "",
      "disabled_code": null,
      "will_reuse": ["source_pdf", "ocr_result", "translation_result"],
      "will_rerun": ["refine", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260519010101-abcd12/actions/retry-stage",
        "body": {"stage": "refine", "create_new_job": false, "ambiguous_request_policy": "block", "refine": {"mode": "review_and_fix"}}
      },
      "last_refine": {
        "status": "stopped",
        "generated_at": "2026-11-20T08:00:00Z",
        "finding_count": 12,
        "applied": 9,
        "reviewed_item_count": 180,
        "candidate_item_count": 400,
        "unreviewed_item_count": 220,
        "next_page": 31,
        "stopped_reason": "max_items",
        "mode": "review_and_fix",
        "escalated_count": 0,
        "escalated": []
      }
    }
  ]
}
```

`stages` 依次是 `ocr`（「重试 OCR」）、`translation`（「重试翻译」）、`render`（「重新渲染」）、`refine`（「精修译文」）四项：

- `action`：可以点时给出现成的请求（`url` 是绝对地址，`body` 能原样 POST 给 [retry-stage](02-retry-stage.md)）；`can_retry=false` 时是 `null`。
  精修的 `body` 是原地、全书、`review_and_fix`；其余阶段只带 `stage` 和 `ambiguous_request_policy: "block"`。
- `reason`：和 `disabled_reason` 同值的旧字段。
- `last_refine`：只在 `refine` 这一项上、而且精修过才有，是上次精修报告的摘要：`status`（`completed` / `stopped` / `failed`）、
  `generated_at`、`finding_count`、`applied`、`reviewed_item_count` / `candidate_item_count`（审了多少块 / 范围内一共多少块）、
  `unreviewed_item_count` 和 `next_page`（没审到的块数、没审到的第一页，1 起；全审到时 0 / `null`）、`stopped_reason`（`max_items`、`max_tokens`、`llm_unavailable`、`llm_error`、`error`，没停是 `null`）、
  `mode`（`review_only` / `review_and_fix` / `editorial`，老报告是空串）、`escalated_count` 和 `escalated`（编辑部留给人确认的块，
  最多 50 条，每条 `item_id`、`page_number`、`reason`）。中途停了的，用 `next_page` 作 `refine.start_page` 接着精修。

## 各阶段什么时候能重试

- 任务排队或运行中：所有阶段都不能点（`disabled_code=job_active`），先取消。
- `ocr`：要求任务上原来的 `upload_id` 或 `source_url` 还在；只剩 `source_pdf` 产物的任务 OCR 一项可能是禁用的。
- `translation`：要求 `source_pdf` + `normalized_document_json`。
- `render`：要求 `source_pdf` + `translations_dir`。
- `refine`：要求 `source_pdf` + 已提交的 `translations_dir`，而且译文目录必须是任务自己的 `<job_root>/translated`（精修要写回那里；
  用 `create_new_job=true` 派生出来的渲染任务要去精修它的源任务，否则 `translations_not_owned`）。绑定了 Rust 模型执行器
  （`execution_connection`）的任务不能精修（`model_executor_unsupported`）。精修的进度显示为 `stage=rendering`、`substage=refining`
  （`display_stage=render`，单位 `step`）。

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
