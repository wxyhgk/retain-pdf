# PDF Structure Profile

`pdf_structure_profile` 记录原始 PDF 自带的结构框，而不是 OCR 框，也不记录颜色。

它适合在 OCR normalized 完成后、翻译开始前生成，因为它只依赖：

- 原始 PDF
- normalized item 的 `item_id/bbox`，用于建立 OCR item 到 PDF 内置 text object 的映射

输出文件建议命名为 `pdf_structure_profile.v1.json`，后续删除阶段可以直接读取：

- `text_objects`：来自 `page.get_bboxlog()` 的 PDF text object 框。
- `text_spans`：来自 `page.get_text("dict")` 的可见文本 span 框。
- `path_objects`：来自 bboxlog 的 path/vector 框，包含会阻塞物理删除的标记。
- `image_objects`：来自 bboxlog 的 image 框。
- `form_xobjects`：来自 `page.get_xobjects()` 的 XObject 框。
- `item_hits`：OCR item 与 PDF text object 的最佳 overlap 映射。

这个 profile 是删除策略的事实层，不决定删不删，也不修改 PDF。
