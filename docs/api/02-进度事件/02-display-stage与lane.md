# display_stage 与 lane

## display_stage

`display_stage` 是前端展示层稳定大阶段。

允许值：

- `ocr`
- `translation`
- `render`

`done` 以前列在这里，现在哪儿都不会出现：事件算不出大阶段时没有 `display_stage` 这个键；任务详情、列表的 `stage_snapshot`
对终态任务是空的（终态看 `status`，不把「完成」当成一个阶段；完成时的补充说明在 `completion_note`），
见 `backend/packages/retainpdf-jobs/src/views/job_types.rs`。

它和后端内部 `stage` 不同。前端主状态不要直接使用内部 `stage`。

阶段该怎么报（worker 和前端的共同约定）：

- OCR 上传、服务商处理、规范化报 `display_stage=ocr`；服务商的页进度用 `stage=ocr_processing`、`progress.unit=page`。
- 翻译批次报 `display_stage=translation`、`stage=translating`、`progress.unit=batch`；`continuation_review`、`page_policies`、
  `domain_inference`、`garbled_repair` 这些页级小阶段用 `progress.unit=page`。
- 渲染页进度报 `display_stage=render`、`stage=rendering`、`progress.unit=page`；Typst 编译、叠加、保存拿不到页进度时可以用 `step`。

## status 和 stage

任务的 `status`：`queued`、`running`、`succeeded`、`failed`、`canceled`。新任务先 `queued`，同时最多
`RUST_API_MAX_RUNNING_JOBS` 个 `running`，有空位自动开跑。

`stage` 是后端内部阶段名，常见的有 `queued`、`startup`、`ocr_upload`、`ocr_submitting`、`ocr_processing`、`ocr_result_ready`、
`normalization`、`normalizing`、`translation_prepare`、`domain_inference`、`continuation_review`、`page_policies`、`translating`、
`render_prepare`、`rendering`、`compile`、`overlay`、`saving`、`finished`、`failed`、`canceled`。服务商私有的进度不进这个枚举，
走 `provider` + `provider_stage`。

它用于诊断和日志归类，不保证适合直接作为 UI 大阶段。

## substage

`substage` 是机器可读的小阶段，例如：

- `ocr_upload`
- `ocr_processing`
- `translation_batches`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

## lane

`lane` 用于解决“翻译和渲染预处理同步进行”的显示问题。

- `main`: 当前任务主线。
- `background`: 后台辅助阶段（渲染预热 `render_prewarm`）。
- `artifact`: 产物发布事件。
- `diagnostic`: 诊断、失败分类事件。

例子：

```json
{
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main"
}
```

```json
{
  "display_stage": "render",
  "stage": "rendering",
  "substage": "render_prewarm",
  "lane": "background"
}
```

前端应把第一条作为主状态，把第二条作为后台准备状态。
