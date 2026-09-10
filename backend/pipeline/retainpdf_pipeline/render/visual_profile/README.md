# 渲染视觉画像

`visual_profile` 是渲染前的通用视觉采样层，职责是从页面像素中得到每个 OCR item 的背景色和前景文字色。

它不判断 PDF 是否可编辑，也不决定是否物理删除原文。后续渲染策略只消费它输出的稳定契约：

- `background_rgb`：覆盖原文时应该使用的局部背景色。
- `text_rgb`：Typst 重新绘制译文时应该使用的文字颜色。
- `confidence`：当前颜色判断可信度。
- `method`：采样来源，例如 `background_pixels+span_color` 或 `background_pixels+foreground_pixels`。
- `warnings`：无法识别前景等可诊断信息。

设计边界：

- 视觉层始终可以运行，适用于可编辑 PDF、伪可编辑 PDF、图片型 PDF。
- 删除层只是优化项，失败时也应该由视觉覆盖保证最终效果。
- 该包只生成画像，不修改 PDF，不写渲染策略。

预热阶段会把完整画像落到 `render_prewarm/visual_profile.v1.json`。主预热 manifest 只保存相对路径和轻量的 `colors_by_item_id`，这样取色、删除、Typst 渲染可以在不同时间读取同一份本地 JSON，而不是依赖内存里的临时对象。
