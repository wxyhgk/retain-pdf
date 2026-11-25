# retry-stage

> 地址已按 8 类整理（新地址如 `/jobs/{job_id}/actions/retry-stage`）。对应的旧地址已于 2026-10-18 删除（返回 404）。新旧对照见 [任务接口分类](../01-任务/04-任务接口分类.md)。

契约：[`job-actions.v1`](../../../contracts/job-actions.v1.schema.json)（请求体 `RetryStageRequest`，返回 `RetryStageSubmissionView`，前端类型从 `@retainpdf/contracts/job-actions` 导入）。

## 接口

```http
POST /api/v1/jobs/{job_id}/actions/retry-stage
```

用于用户主动从某个阶段重新执行后续流程。

## 请求示例

```json
{
  "stage": "translation",
  "mode": "from_stage",
  "create_new_job": true,
  "ambiguous_request_policy": "block",
  "overrides": {
    "translation": {
      "model": "deepseek-flash",
      "glossary_id": "glossary-xxx",
      "workers": 100
    },
    "render": {
      "compile_workers": 8
    }
  }
}
```

## 请求字段

- `stage`：`ocr`、`translation`、`render`、`refine`。
- `mode`：可省，目前只支持 `from_stage`。
- `create_new_job`：可省。省略时 `refine` 是 `false`（只能原地），其余是 `true`；`ocr`、`translation` 不能 `false`，`refine` 不能 `true`（都是 400）。
- `ambiguous_request_policy`：`block`（默认）或 `accept_duplicate_risk`。翻译请求日志里有结果不确定的请求时，翻译重试要显式带
  `accept_duplicate_risk` 才放行，否则 409 `ambiguous_translation_request`；OCR 派发结果不确定时 OCR 重试同理（`ambiguous_ocr_dispatch`），
  也可以先走 [OCR 歧义处理](03-续跑取消与OCR歧义.md#ocr-请求结果不确定)。
- `refine`：只能和 `stage=refine` 一起用，见下面「阶段语义」。
- `overrides`：可省，按段写要改的字段，合并进原任务的设置。段名只能是 `ocr`、`translation`、`render`、`runtime`（别的 400），
  每段的字段同建任务时的那一段（不认识的字段 400，`render.engine` 等枚举不合法 400）；`runtime.job_id` 会被清掉。
  - `overrides.ocr.credential_ref` 可以替换原来的内联 OCR token，内联 token 也可以临时替换原来的凭据引用；后端把被替换的那个清掉，不会两个都存。
  - `overrides.ocr.options` 里只能服务器定的选项（`command`、`raw_provider`、配置里带 `env` 的）400，和建任务一样。
  - `overrides.translation.glossary_id` 可以换术语表或填空串（源任务的表已删或停用时 409 `glossary_missing` / `glossary_disabled`）。

## 阶段语义

- `ocr`: 复用原来的上传或 `source_url`，重跑 OCR -> translation -> render，出一个新的 `book` 任务。
- `translation`: 复用 source PDF + OCR 结果，重跑 translation -> render，出一个新的 `book` 任务。
  边识别边翻译（GLM-OCR）的书翻译失败时，2026-11-03 以前 OCR 的产物没并回父任务，记录里没有 source PDF 和规范化文档、
  这一项判成 `artifacts_missing`。现在 `GET .../actions` 从成功的 OCR 子任务（`{job_id}-ocr`）补上再判；提交重试时补上并写回父任务
  （只写已经失败、取消的任务）。
- `render`: 复用 source PDF + OCR 结果 + 翻译结果，只重跑 render（不精修，哪怕任务建的时候开了 `translation.refine`）。默认出一个新的 `render` 任务；
  `create_new_job=false` 时原地重渲染（任务编号不变，见下面「原地重跑」）。
- `refine`: 复用全部产物，原地（只能 `create_new_job=false`，省略时默认就是 false）先精修已提交的译文、再渲染一次。
  可带 `"refine": {"mode": "review_only" | "review_and_fix" | "editorial", "start_page": 3, "end_page": 5, "max_items": 0, "max_tokens": 0}`，
  页码 1-based 闭区间，省略 = 全书、`review_and_fix`；`refine` 里不认识的键 400。
  `max_items` / `max_tokens` 是这次精修的上限（`0` = 不限），省略 = 不限（审全书）；**不沿用**任务里存的
  `refine_max_items` / `refine_max_tokens`。上次精修中途停了的，报告里 `review.next_page` 是没审到的第一页，
  用 `start_page` 从那一页接着精修。
  这次的精修参数是一次性的，不会写进任务的 `translation.refine`；报告见 [精修报告](../08-调试诊断/06-翻译报告.md#精修报告)。
  精修在渲染阶段、真正渲染之前跑（挑错，`review_and_fix` 再定点修改），然后渲染一次。采纳的修改走译文修订历史（`source=refine`），
  原译文可以找回；流程结束（成功、失败、取消）后改过的页会登记到边翻边看。精修要调模型，所以任务要还留着 `translation.credential_ref` /
  `reviewer_credential_ref`（`overrides` 里不收内联 key）；之前的普通重渲染已经把它们清掉的，要在
  `overrides.translation` 里给 `model`、`base_url`、`credential_ref`，否则 400。排队、运行中的任务 409。

## 原地重跑：旧 PDF 怎么处理

`render` 带 `create_new_job=false`、`refine`、以及 `resume` 选中的原地重渲染，任务编号不变，在原任务上再跑一次：

- **落库是 CAS**：只有库里还是读到时的那个终态、那一次运行，才改成 `queued` 开跑。两个请求同时来，只有一个开跑；
  后到的返回 `409`：前一个还在排队/运行是 `job_active`，前一个已经跑完是 `stale_resolution`。不会把已经开跑的那一次盖回 `queued`。
- **被拒时什么都不动**（`409`、`503` 模型执行器没开、额度不够、落库失败）：上一份译文 PDF、`<id>-ocr` 子任务都原样留着，
  任务还是原来的状态，`files/output/translated.pdf` 照常能下载。以前续跑在校验之前就删了 `rendered/` 和 `-ocr` 子任务，被拒后 PDF 就 404 了。
- **开跑以后**：上一份 PDF 挪到同目录的 `<名>.previous.pdf`（渲染要写的名字空出来，不会截断旧文件），排队期间书的合并阅读接着用它；
  `rendered/` 里其它文件不删，渲染覆盖写。续跑的原地重渲染在开跑以后才删上一轮遗留的 `-ocr` 子任务。
- **没跑成**（`failed` / `canceled`）：`artifacts.output_pdf` 指回上一份 PDF，`translated.pdf`、页预览、Word 导出照旧用它。
  跑成功了就是新的 PDF。只有排队和运行期间 `translated.pdf` 是 `404 … not ready`。

## 请求规则

- 可以带 `Idempotency-Key` 请求头：同一次点击的网络重试复用同一把 key，只建一个任务、第二次原样重放第一次的结果
  （响应头 `Idempotent-Replayed: true`），见 [防重复提交](../00-约定/06-防重复提交.md)。

- 请求体里不认识的字段一律返回 `400`（例如把 `create_new_job` 拼成 `createNewJob`）。可用字段：`stage`、`mode`、`create_new_job`、`overrides`、`ambiguous_request_policy`、`refine`。
- 请求本身写错了返回 `400`：`mode` 不是 `from_stage`、`refine` 对象用在非 `refine` 阶段、`create_new_job=false` 用在 `ocr` / `translation`、`create_new_job=true` 用在 `refine`、`overrides` 不合法。这些和任务当前状态无关。
- 请求没问题但任务或产物现在不允许返回 `409`，`error.details.reason` 说明原因：`job_active`（任务在跑，或另一个原地重跑抢先开跑了）、
  `stale_resolution`（原地重跑：读到之后任务又跑过一次，刷新再试）、
  `artifacts_missing`（要用的产物或来源不在）、`translations_not_owned`（精修的任务渲染的是别的任务的译文）、
  `ambiguous_translation_request`（翻译请求结果不确定，要带 `ambiguous_request_policy=accept_duplicate_risk`）、
  `ambiguous_ocr_dispatch`（OCR 派发结果不确定，OCR 重试带 `accept_duplicate_risk` 或先 `resolve-ocr-ambiguity`）、
  `glossary_missing` / `glossary_disabled`（出新任务时源任务的术语表已删 / 停用）、
  `request_journal_corrupt`（翻译请求日志损坏）、`model_executor_unsupported`（绑定了 Rust 模型执行器）、
  `derived_job_active`（出新任务时：这个任务已经续跑 / 重试出一个还在排队或在跑的新任务，`error.details.active_job_id` 是它，
  等它结束或先取消；2026-11-24 起）。
  完整表格见 [错误约定](../00-约定/02-认证与错误.md#任务操作的-409-原因)。以前这些情况里「任务在跑」「产物不在」返回 400，现在统一 409。

## 响应示例

```json
{
  "job_id": "20260519010202-ef3456",
  "source_job_id": "20260519010101-abcd12",
  "status": "queued",
  "workflow": "book",
  "rerun_from_stage": "translation",
  "reused_artifacts": ["source_pdf", "ocr_result"],
  "rerun_stages": ["translation", "render"],
  "ambiguous_request_policy": "block",
  "links": {},
  "actions": {}
}
```

`links`、`actions` 和任务详情里的同名字段一样（示例里省略了）。原地执行（`render` 带 `create_new_job=false`、`refine`）时
`job_id` 就是原任务。前端拿到 `job_id` 后直接进入正常轮询（`GET /jobs/{job_id}`、`GET /jobs/{job_id}/progress/events`）。

## 与 resume 的区别

- `resume`（[续跑](03-续跑取消与OCR歧义.md#续跑)）更偏失败后的恢复，从哪里续由后端定。
- `retry-stage` 是用户主动从指定阶段重跑，成功任务也可以用；要选阶段、改参数、或显式接受翻译请求重复的风险时用它。
