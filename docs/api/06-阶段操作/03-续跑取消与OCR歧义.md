# 续跑、取消与 OCR 歧义处理

契约：[`job-actions.v1`](../../../contracts/job-actions.v1.schema.json)（续跑计划 `JobResumePlanView`、续跑请求 `ResumeJobInput`、
取消和续跑的返回 `JobSubmissionView`、OCR 歧义处理 `OcrAmbiguityResolutionRequest` / `OcrAmbiguityResolutionView`）；
`reports/failure` 里的 `ocr_ambiguity` 在 [`job-reports.v1`](../../../contracts/job-reports.v1.schema.json)。
409 的 `error.details.reason` 取值见 [错误约定](../00-约定/02-认证与错误.md#任务操作的-409-原因)。

```http
GET  /api/v1/jobs/{job_id}/actions/resume
POST /api/v1/jobs/{job_id}/actions/resume
POST /api/v1/jobs/{job_id}/actions/rerun            （actions/resume 的旧名）
POST /api/v1/jobs/{job_id}/actions/cancel
POST /api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity
```

旧地址 `/resume-plan`、`/resume`、`/rerun`、`/cancel`、`/ocr/resolve-ambiguity` 已于 2026-10-18 删除，对照见
[任务接口分类](../01-任务/04-任务接口分类.md)。

## 续跑

### 续跑计划

`GET /api/v1/jobs/{job_id}/actions/resume` 只读，告诉前端「会从哪里恢复、复用哪些产物、重跑哪些阶段」：

```json
{
  "can_resume": true,
  "job_id": "20260519010101-abcd12",
  "from_stage": "render",
  "resume_workflow": "render",
  "reuses_artifacts": ["source_pdf", "translations_dir", "normalized_document_json"],
  "reruns_stages": ["rendering"],
  "reason": null,
  "reason_code": null
}
```

- 不能续跑时 `can_resume=false`，`reason` 是给人看的说明，`reason_code` 是机器可读版本（能续跑时 `null`）：
  `job_active`、`model_executor_unsupported`、`ambiguous_translation_request`、`request_journal_corrupt`、`artifacts_missing`。

### 执行续跑

`POST /api/v1/jobs/{job_id}/actions/resume` 执行后端选好的计划，返回 `JobSubmissionView`（同建任务的返回：`job_id`、`status`、
`workflow`、`ocr_reused`、`source_artifact_job_id`、`stages`、`links`、`actions`）。`actions/rerun` 是同一个处理函数的旧名
（2026-10-19 起在接口登记表里标成旧地址）；新代码 POST `actions/resume`，读任务视图里的 `actions.resume` 链接（`actions.rerun` 暂时同值）。

请求体可以不带（等于 `{}`）。唯一能带的是换模型 key：

```json
{
  "overrides": {
    "translation": {
      "credential_ref": "cred_0123456789abcdef",
      "reviewer_credential_ref": ""
    }
  }
}
```

- `overrides` 只有 `translation` 一段，里面只认 `api_key`、`credential_ref`、`reviewer_api_key`、`reviewer_credential_ref`；别的段、别的字段 400。
- `api_key` 和 `credential_ref` 不能都非空，`reviewer_api_key` 和 `reviewer_credential_ref` 也一样（400）。明文 key 照建任务的规则导入凭据库。
- 续跑出新任务时用它替换原任务的旧凭据。

后端怎么选：

- 已有提交过的译文（`translations_dir` + `source_pdf`）：用同一个 `job_id` **原地重渲染**，替换渲染产物，旧 PDF 的处理见
  [原地重跑](02-retry-stage.md#原地重跑旧-pdf-怎么处理)。
- 只有可复用的 OCR 产物（`normalized_document_json` + `source_pdf`）：建一个新的 `book` 恢复任务；失败 / 取消的源任务有翻译检查点时，
  新任务带着一份拷贝，翻译输入的指纹对得上才复用。

被拒（都是 409）：

- 排队、运行中：`job_active`。
- 没有能用的产物：`artifacts_missing`（不是 400）。
- OCR 派发或翻译请求的结果不确定：`ambiguous_ocr_dispatch` / `ambiguous_translation_request`（请求日志损坏是
  `request_journal_corrupt`）。通用续跑一律挡住，要走下面的 [OCR 歧义处理](#ocr-请求结果不确定)，或用
  [retry-stage](02-retry-stage.md) 显式接受重复风险。
- 绑定了 Rust 模型执行器：`model_executor_unsupported`。
- 原地重渲染时读到之后任务又跑过一次：`stale_resolution`；出新任务时源任务的术语表已删 / 停用：`glossary_missing` / `glossary_disabled`。

要选阶段、改参数、或接受翻译请求重复的风险，用 [retry-stage](02-retry-stage.md)。

## 取消

`POST /api/v1/jobs/{job_id}/actions/cancel`，没有请求体，返回 `JobSubmissionView`。

- 只能取消排队、运行中的任务；别的状态 409，`error.details.reason = "job_not_active"`。
- 取消总是终止 worker 进程，没有「让这一段跑完再停」的阶段（以前只做 OCR 的任务在 `normalizing` 时不杀进程，已取消这条豁免）。
- 只做 OCR 的任务（`workflow=ocr`）只在还在 `queued` 时由取消接口直接写成 `canceled`；已经开跑的，进程被杀以后由 runner 看到退出再写终态，
  所以取消后马上轮询可能还会读到一次 `running`。
- 返回的 `status` 是取消之后库里的状态，不是固定的 `canceled`（2026-10-19 起）：一般是 `canceled`；开跑后的 OCR 任务是 `running`；
  任务恰好在取消落地前自己跑完了，就是它自己的终态（例如 `succeeded`）。

```json
{
  "job_id": "20260327190500-ef3456",
  "status": "canceled",
  "workflow": "book",
  "ocr_reused": false,
  "source_artifact_job_id": null,
  "stages": {},
  "links": {},
  "actions": {}
}
```

（`stages`、`links`、`actions` 同任务详情，示例里省略了。）

## OCR 请求结果不确定

向 OCR 服务商提交的请求结果说不清（不知道服务商收没收下，重试可能再提交一次、重复计费）时，这次派发记为「不确定」：

- 提交意图已经记下、调用却以说不清的方式失败：响应超时、连接被重置、5xx、读不出响应，或者上传到一半被取消；
- 运行时重启时，意图还没有回执。

能证明请求没发出去或被服务商拒了的（连不上、请求没建成、4xx / 鉴权 / 额度拒绝）直接丢掉意图，普通重试照常可用。
上传中途被取消的任务也记为不确定，要重试就用 `retry-stage` 带 `ambiguous_request_policy=accept_duplicate_risk`。

接口里的 `{job_id}` 都是用户看到的任务编号；书籍、翻译任务的 OCR 在子任务 `{job_id}-ocr` 里跑，后端自己找到它（先找 `{job_id}-ocr`，再找 `{job_id}`），
书籍任务的 OCR 失败就在书籍任务上报告和处理。

### 读：`reports/failure` 的 `ocr_ambiguity`

任务失败或已取消、且最近一次 OCR 提交还处在不确定状态时，[`GET /jobs/{job_id}/reports/failure`](../08-调试诊断/01-失败结构.md#任务诊断)
返回 `ocr_ambiguity`，否则是 `null`：

```json
{
  "ocr_ambiguity": {
    "status": "ambiguous",
    "provider": "mineru",
    "operation": "apply_upload_url",
    "resolution_revision": 3,
    "allowed_resolutions": ["bind_existing_receipt", "accept_duplicate_risk"],
    "receipt_fields": [
      {"name": "batch_id", "label": "…", "required": true, "secret": false},
      {"name": "upload_url", "label": "…", "required": true, "secret": true},
      {"name": "trace_id", "label": "…", "required": false, "secret": false}
    ]
  }
}
```

能绑定的回执：

| 服务商 / 操作 | 必填 | 可选 |
|---|---|---|
| Paddle `submit_local_file` / `submit_remote_url` | `task_id` | `trace_id` |
| MinerU `create_extract_task` | `task_id` | `trace_id` |
| MinerU `apply_upload_url` | `batch_id`、`upload_url`（机密） | `trace_id` |

### 处理：`POST …/actions/resolve-ocr-ambiguity`

```json
{
  "resolution": "bind_existing_receipt",
  "resolution_revision": 3,
  "batch_id": "provider-batch-id",
  "upload_url": "<secret-upload-target>",
  "trace_id": "optional-provider-trace"
}
```

- `resolution`：
  - `bind_existing_receipt`：只收诊断里声明的回执字段，绑上以后从「轮询服务商」接着走，不再提交；
  - `accept_duplicate_risk`：不能带回执字段，建一个新的 OCR 重试，明确接受可能重复提交。
- `resolution_revision` 必须等于诊断里给的值。不认识的字段 400；回执字段和服务商 / 操作对不上 400。
- 409 的原因：`job_active`（排队、运行中）、`no_ocr_dispatch`（任务既不是失败也不是已取消，或没有不确定的派发）、
  `stale_resolution`（revision 对不上，或已被别的请求处理）、`ocr_dispatch_unsupported`（这家 / 这个操作不支持绑定回执）、
  `glossary_missing` / `glossary_disabled`（绑定回执出的新任务要按现在的术语表重新解析，表已删 / 停用）。
- 返回只有 `resolution`、`provider`、`operation` 和新重试的 `submission`（同 retry-stage 的返回），**不回显回执的值**。
  诊断和处理结果都不会返回 `upload_url`、请求哈希、已有回执 JSON、服务商凭据或原始请求；审计事件只记绑定了哪些字段名，不记值。

## 重启后的自动续跑

运行时重启后停在半路的任务默认自动续跑，两种情况不续：翻译请求日志里有结果不明的请求（落 `translation_request_ambiguous`），
同一次运行连续 3 次自动续跑都没进展（落 `auto_resume_limit_exceeded`）。两者的失败字段和处理办法见
[失败结构](../08-调试诊断/01-失败结构.md#重启后的自动续跑与-translation_request_ambiguous)。
