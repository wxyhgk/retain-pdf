# rendering/source/dev_overlay

旧的 PyMuPDF 直绘译文路径（`text_draw.py`）。

原来的三个消费方都已经没了：

- `entrypoints/build_page.py` 单页调试入口在 `8d3f0dfe` 被删；
- 它依赖的 `builders.py`（`build_dev_pdf` / `build_single_page_dev_pdf`）和
  `render.legacy.pdf_overlay` 兼容层随后一并删除；
- `workflow/direct_overlay.py`（`render_translated_pages_map`）从来没有调用方，
  也已删除。

所以 `text_draw.py` 现在只剩 `devtools/tests/rendering/test_typst_direct_math_layout.py`
在用（`_build_direct_draw_tokens` / `_fit_segment_layout` 两个 token 切分与字号
回退函数），生产渲染路径不再经过这里。

这里不是主渲染路径。新的图书/页面正式渲染逻辑应走 Typst overlay 和
`source.redaction` / `source.render_source`，不要在这里继续扩展正文排版规则。

## 边界

- 可以调用 source 层 primitive/facade，例如 `source.redaction`、`source.items`、
  `source.background.fill`。
- 不要直接依赖 `source.cleanup.redaction`；需要原文清理时走 source 层 facade。
- 不要新增 Typst 生成、OCR provider 解析或翻译策略逻辑。
