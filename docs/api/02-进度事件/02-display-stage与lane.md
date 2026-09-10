# display_stage 与 lane

## display_stage

`display_stage` 是前端展示层稳定大阶段。

允许值：

- `ocr`
- `translation`
- `render`
- `done`

它和后端内部 `stage` 不同。前端主状态不要直接使用内部 `stage`。

## stage

`stage` 是后端内部阶段名，例如：

- `ocr_processing`
- `translating`
- `rendering`
- `saving`
- `failed`

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
- `background`: 后台辅助阶段。

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
