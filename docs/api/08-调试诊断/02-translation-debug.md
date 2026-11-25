# Translation Debug API

> 地址已按 8 类整理（新地址如 `/jobs/{job_id}/translations`）。对应的旧地址已于 2026-10-18 删除（返回 404）。新旧对照见 [任务接口分类](../01-任务/04-任务接口分类.md)。

这些接口用于排查翻译缺失、错误输出、模型异常和 replay，以及人工逐条改译文（`PATCH`）和看修改历史。
契约：[`translation-revisions.v1`](../../../contracts/translation-revisions.v1.schema.json)（列表、单条、重翻、改写、修改历史）。
翻译诊断、质检、精修、排版报告见 [翻译报告](06-翻译报告.md)。

```http
GET   /api/v1/jobs/{job_id}/translations
GET   /api/v1/jobs/{job_id}/translations/{item_id}
PATCH /api/v1/jobs/{job_id}/translations/{item_id}
GET   /api/v1/jobs/{job_id}/translations/{item_id}/revisions
POST  /api/v1/jobs/{job_id}/translations/{item_id}/replay
```

都只读写这个任务自己的目录：条目来自 `translated/translation-manifest.json` 和它指向的页文件。

## 还没产出、不存在

- 任务不存在：普通 `404`，`error.details` 是 `{}`。
- 还没翻译完（没有 manifest）：单条、修改历史、改写（`PATCH`）、重翻（`replay`）都是 `404` + `reason: "not_ready"`，
  提示 `translation manifest not ready`（见 [错误约定](../00-约定/02-认证与错误.md#还没产出404)）。列表是列表，返回 `200` 空列表。
- manifest 在、条目不存在：普通 `404`（`translation item not found: …`），不带 `reason`。
- 条目编号不合法（只能是字母、数字、`-`、`_`、`:`、`.`，最长 128）：`400`。

## Item 列表

```http
GET /api/v1/jobs/{job_id}/translations
```

查询参数（别的参数返回 400）：

- `page`
- `final_status`
- `error_type`
- `route`
- `q`
- `limit`：默认 20，1..=500，越界返回 400
- `offset`

回包带 `items`、`total`、`limit`、`offset`、`has_more`，规矩见 [分页](../00-约定/03-分页.md)。列表项的每个键总在：

```json
{
  "item_id": "p006-b014",
  "page_idx": 5,
  "page_number": 6,
  "block_idx": 14,
  "block_type": "text",
  "math_mode": "direct_typst",
  "continuation_group": "",
  "classification_label": "body",
  "should_translate": true,
  "skip_reason": "",
  "final_status": "kept_origin",
  "source_preview": "Formation of heterocycle 9 improves hyperconjugation...",
  "translated_preview": "",
  "route_path": ["direct_typst", "single_item"],
  "fallback_to": "sentence_level",
  "degradation_reason": "transport_error",
  "error_types": ["TranslationProtocolError"]
}
```

还没翻译完（没有 translation manifest，也没有老的索引文件）时返回 `200` 和空列表（`items: []`、`total: 0`）；
2026-10-19 以前这里是 `404 translation manifest not found`。任务不存在仍是 `404`。

每次按 translation manifest 指向的页文件现算，所以手改、精修（`PATCH`）之后 `translated_preview`、`final_status` 和 `q` 搜索都是最新的；只有找不到 manifest 的老产物才退回读 `translation_debug_index.json`（它只在翻译结束时写一次，不随修订更新）。

## 单 item

```http
GET /api/v1/jobs/{job_id}/translations/{item_id}
```

从 translation manifest 指向的 page payload 里查原始 item，返回 `TranslationDebugItemView`：

```json
{
  "job_id": "20260416034152-d12925",
  "item_id": "p006-b014",
  "page_idx": 5,
  "page_number": 6,
  "page_path": "page-006.json",
  "item": {
    "item_id": "p006-b014",
    "source_text": "Formation of heterocycle 9 improves hyperconjugation...",
    "translated_text": "",
    "final_status": "kept_origin",
    "translation_diagnostics": {"route_path": ["direct_typst", "single_item"], "fallback_to": "sentence_level"}
  }
}
```

`item` 是存下来的条目原样（已脱敏），不是稳定结构。

`{item_id}` 也认阅读页的四位块号（2026-11-19 起）：`p012-b0005`、`p012-b005`、`p012-b5` 是同一块，
和 reader_regions、data API 的 `reader_item_id` 同一规则；一字不差的条目优先。取一条、修改历史、改写（`PATCH`）、
重翻（`replay`）四个接口都这样。返回的 `item_id` 是条目里实际存的写法（可能是三位），修订日志也记这个写法；
拿阅读页块号来改译文，不用再挨个试几种写法。

## 改写（写回）

```http
PATCH /api/v1/jobs/{job_id}/translations/{item_id}
```

```json
{
  "translated_text": "谐振子是描述分子振动的模型体系。",
  "source": "user",
  "reason": "措辞",
  "expected_generation": 48,
  "rerender": false
}
```

- `translated_text`（必填，最长 20000 字）：和条目的 `protected_translated_text` 同样的写法（`direct_typst` 下是显示文本，行内公式写 `$...$`）。
- `source`（必填）：`user` / `agent` / `refine`，只记录，不影响校验。
- `reason`：可选，最长 2000 字。
- `expected_generation`：可选，调用方上次看到的检查点代次（乐观并发）；对不上 409 `generation_mismatch`，带 `current_generation`。
- `expected_translated_text`：可选，调用方读到的旧译文（按内容的乐观并发，2026-11-25 起）。在持锁写回前和当前译文比，不看空白，
  展示形式（行内公式写回）和占位符形式都认；对不上 409 `text_mismatch`，带 `current_translated_text`（当前的展示形式），重读再改。
  给 agent 用：它读的是书文件夹里的译文，拿不到代次。和 `expected_generation` 可以同时带，两个都要对得上。
- `rerender`：可选，`true` 时写成功后再提交一次原地重渲染（同 `POST actions/retry-stage {"stage":"render","create_new_job":false}`）。
  连着改好几块时只在最后一个请求上带，或者改完调一次 retry-stage。

行为：

- 写之前用翻译时同一套校验（`review_translation_item`）检查新译文，只有 error 级问题挡住，warning 不挡。
- 连续段（一段话跨块、跨页）的一个成员改了，整段重建，可能改到别的页。
- 文字和状态都没变时返回 `changed: false`，什么都不写、代次不动。
- 写完后改过的页登记到边翻边看：`GET progress/pages/{page}` 返回新文字和 `page_hash`（成功、失败、取消的任务都一样），
  `progress/stream` 每改一页多一条 `translation_units_committed`。任务状态不变，不新建运行。登记结果在 `live_publication`：
  `status` 是 `published` / `current` / `pending`（这一页属于正在跑的运行，由它的 worker 提交）/ `unavailable`（任务没有可登记的翻译记录）/
  `failed`，另有逐页的 `pages[]`（`page_idx`、`page_hash`、`status`、`attempt`、`generation`）和 `error`。登记失败不回滚写入；
  原样重发同一个请求（得到 `changed: false`）或打开边翻边看时会补登。

返回 `TranslationRevisionView`：`job_id`、`item_id`、`changed`、`generation`（检查点代次）、`item`（改后的条目：`item_id`、`page_idx`、
`translation_unit_id`、`unit_source_text`、`translated_text`、`protected_translated_text`、`final_status`）、`validation`（`passed`、
`error_count`、`warning_count`、`issues[]`）、`revision`（这次的修订记录，没变时 `null`）、`page_hashes`、`live_publication`、
`rerender`（带了 `rerender=true` 且排上队时是 retry-stage 的返回，否则 `null`）、`rerender_error`（重渲染没排上的原因；写入已经生效）。

错误（`error.details.reason`）：

| HTTP | `error.code` | `reason` |
|---|---|---|
| 400（2026-11-25 以前 422） | `TRANSLATION_REVISION_REJECTED` | `validation_failed`（带 `details.validation.issues`）、`item_not_translatable`（策略要这块保留原文） |
| 409 | `TRANSLATION_REVISION_CONFLICT` | `job_running`（任务排队或运行中）、`checkpoint_locked`、`generation_mismatch`（带 `current_generation`）、`text_mismatch`（带 `current_translated_text`，2026-11-25 起）、`translation_not_committed`、`publication_inconsistent`、`group_members_missing`、`translations_owned_by_another_job`（这个任务复用别的任务的译文，去改源任务，带 `source_job_id`）、`read_only_job`（合并阅读的虚拟任务 `merged-…`） |
| 400 | `BAD_REQUEST` | 请求体有 PATCH 不收的字段（`unknown_field`，提示里写字段名）、不合 schema（`schema_mismatch`：缺 `source` 或取值不对，2026-11-24 以前是 `422 UNPROCESSABLE_ENTITY`）、不是 JSON（`invalid_json`）、文字超长 |
| 404 | `NOT_FOUND` | 任务、条目不存在（普通）；还没有 manifest 时 `reason: "not_ready"` |

写入在后台进程里做完：请求断开不会让它停在半路；超过 120 秒算超时（`500`），写入回滚。

## 修改历史

```http
GET /api/v1/jobs/{job_id}/translations/{item_id}/revisions
```

返回 `{ job_id, item_id, revisions: [...], total }`，旧的在前。每条是 `translated/revisions.v1.jsonl` 里的一条 `translation_revision_v1`
记录：`revision_id`（`rev-` 加 32 位十六进制）、`item_id`、`page_idx`、`translation_unit_id`、`ts`、`source`、`reason`、
`previous_text`、`new_text`、`previous_final_status`、`validation`（摘要：`passed`、`error_count`、`warning_count`、`issue_kinds`）、
`previous_generation`、`generation`、`page_hashes`。条目不存在是普通 404（不是空列表，免得编号拼错时静默成功）。

## Replay

```http
POST /api/v1/jobs/{job_id}/translations/{item_id}/replay
```

Replay 是一次即时调试调用：

- 不创建新 job。
- 不进入队列。
- 不修改原任务状态。
- 没有请求体（带了也忽略）。
- 后端同步调用 `backend/pipeline/devtools/replay_translation_item.py`：按现在的策略重算这条，还该翻译就重新 `translate_batch([item])`。
- 可使用当前 job 的翻译 API key。
- 只重算、不写回；要写回用 `PATCH /jobs/{job_id}/translations/{item_id}`。
- 条目编号不合法返回 400；条目不存在返回 404；合并阅读的虚拟任务（`merged-…`）返回 409 `TRANSLATION_REVISION_CONFLICT` / `read_only_job`（去重翻源任务）。
- 超过 300 秒返回 500，Python 进程随请求一起被杀；请求断开也会杀进程。

返回 `TranslationReplayView`：

```json
{
  "job_id": "20260416034152-d12925",
  "item_id": "p006-b014",
  "candidate": {"translated_text": "杂环 9 的形成增强了超共轭作用……", "decision": "translate"},
  "payload": {
    "policy_before": {"should_translate": true, "final_status": "kept_origin"},
    "policy_after": {"should_translate": true, "final_status": "translated"},
    "replay_result": {"translated_text": "杂环 9 的形成增强了超共轭作用……"},
    "replay_error": null
  }
}
```

- `candidate`（2026-11-12 加）是给客户端的稳定字段：`{translated_text, decision}` 或 `null`。`translated_text` 已经是 `PATCH` 要的写法，
  「重翻 → 用户认可 → `PATCH` 写回（`source: "user"`）」不用读 `payload`。`decision: "keep_origin"` 表示模型判断这块该保留原文，别写回。
  模型调用失败（看 `payload.replay_error`）、这条不翻译、模型返回空译文时是 `null`。模型调用失败仍是 `200`。
- `payload` 是脚本的输出（已脱敏），不是稳定结构。

这些接口给本地排查和自动化回归用，没有为批量导出、高吞吐重放做优化。

## 脱敏规则

debug/replay 返回前会对 job request 里的敏感值脱敏：结构化的密钥字段（`api_key`、`mineru_token`、`paddle_token`）清空，
文字里夹带的密钥换成 `[REDACTED]`。前端不要假设能拿到原始 API key 或 provider token。
