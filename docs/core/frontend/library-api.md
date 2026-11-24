# 前端对接说明：图书馆数据层 API

> 2026-11-24 起，书库接口的对外用法（书列表、读改删、书的任务列表、阅读入口、译文版本、合集、标签、全文检索、删除保护、
> 重复上传）统一写在 [`docs/api/13-书库/`](../../api/13-书库/01-书与文档.md)，这里不再重复，只留前端接入时要记住的几点。
> 决定见 [接口文档以 docs/api 为准](../../ops/planning/api-reorg/20261124-接口文档以docs-api为准.md)。
> 原来这篇（更新于 2026-09-02）的全文在 git 历史里。

字段以契约为准：[`library-documents.v1.schema.json`](../../../contracts/library-documents.v1.schema.json)，TS 类型从
`@retainpdf/contracts/library-documents` 导入；任务列表见 `job-status.v1.schema.json`。所有业务接口用 `X-API-Key`，
JSON 响应包在 `{code, message, data}` 里。

## 前端要记住的

- **document = 一篇 PDF 的稳定身份**（按文件内容 sha256 去重）：同一篇 PDF 上传几次都是同一个 `document_id`，
  所以「上传成功」不等于「列表多一条」。任务是书名下的处理记录。
- **打开阅读器**用 `GET /api/v1/documents/:id/reading` 给的 `job_id`（分段翻译时是合并后的虚拟任务），不要直接用书卡的
  `active_job_id`。见 [阅读入口与翻译覆盖](../../api/13-书库/01-书与文档.md#阅读入口与翻译覆盖)。
- **任务编号反查书**用 `GET /api/v1/documents?job_id=`，不要扫列表比 `active_job_id`。
- **书卡叠任务活态**：拿到的 `active_job_id` 拼进 `GET /api/v1/jobs?job_ids=a,b&include_live_stage=true`（≤ 500 个一批），
  标题读 `display_name`，阶段和进度读 `stage_snapshot`。
- **译文版本**（2026-11-18）：书详情「概览」的「译文版本」卡（`TranslationVersionsPanel`、`use-translation-versions.ts`）列
  `GET .../translation-versions?include_hidden=true`，切换走 `PUT .../translation-version`（「自动（最新）」= `version_id: null`），
  改名、隐藏、恢复走 `PATCH .../translation-versions/:version_id`。阅读入口照旧调 `/reading`（不带 `version`）就读到当前版本，
  `resolve-reading-target.ts` 不用改；只有一份译文的书不显示这张卡。
- **不要显示的字段**：`authors_json`（恒为 `"[]"`）、`year`、`doi`、`last_opened_at` 没有写入点；`active_version_id` 2026-11-21 起恒不出现。
- **删除保护**：书或任务名下还有排队、运行中的任务时 409 `job_active`，别的任务还在用它的产物时 409 `job_has_dependents`，
  按 `error.details.reason` 分开提示；前端不自动带 `force=true`。
- **全文检索跳转**：跳到 `/reading` 给的阅读任务用 `document_page - 1`，直接打开命中的 `job_id` 才用 `page_idx`。
- 已删、不要再调：书架 `/api/v1/library/books`（2026-10-22）、收藏 `/api/v1/favorites`（2026-09）、资产 `/api/v1/assets`（2026-10-19）、
  `/api/v1/ai/*` 和合集的 `agent-workspace`（2026-11-03）。
