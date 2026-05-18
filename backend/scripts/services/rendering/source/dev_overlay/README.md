# rendering/source/dev_overlay

旧的 PyMuPDF 直绘译文路径，仅用于 direct overlay、单页调试 PDF 和兼容旧
`services.rendering.legacy.pdf_overlay` 调用。

这里不是主渲染路径。新的图书/页面正式渲染逻辑应走 Typst overlay 和
`source.redaction` / `source.render_source`，不要在这里继续扩展正文排版规则。

## 边界

- 可以调用 source 层 primitive/facade，例如 `source.redaction`、`source.items`、
  `source.background.fill`。
- 不要直接依赖 `source.cleanup.redaction`；需要原文清理时走 source 层 facade。
- 不要新增 Typst 生成、OCR provider 解析或翻译策略逻辑。
