# source_cleanup 策略

`render.source_cleanup_strategy` 控制渲染前如何处理原 PDF 里的原文。

## 当前可选值

- `pikepdf_text_strip`
- `typst_fill`
- `bbox_text_strip`
- `legacy`
- `redact_restore_formulas`

## 当前语义

- `pikepdf_text_strip`: 默认策略。先做 content-stream text-op 删除，再由 Typst 翻译块背景做视觉覆盖。
- `typst_fill`: 不做物理删除，只用 Typst 背景块覆盖原文。
- `bbox_text_strip`、`legacy`、`redact_restore_formulas`: 兼容别名，当前行为等同 `pikepdf_text_strip`。

## 前端规则

- 默认使用后端默认值，不需要普通用户理解策略细节。
- 调试或高级设置里可以暴露 `typst_fill`，用于处理删除策略不适合的 PDF。
- 不要把兼容别名作为新 UI 选项展示。
