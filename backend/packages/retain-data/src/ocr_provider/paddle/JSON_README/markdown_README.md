# Markdown 层说明

## 1. 层定义

`layoutParsingResults[*].markdown` 是在 `prunedResult` 的基础上，再生成的可读 Markdown/HTML 字符串，用来给人快速预览 OCR 的文本、段落结构和内嵌资源。每个 `layoutParsingResults` 项都可以附带自己的 `markdown.text`（整个页面的 Markdown 内容）和 `markdown.images`（被 `<img>` 标签引用的图像资产），所以它不是一个新的 OCR schema，而是对 `prunedResult` 中信息的“扁平化、可阅读化”展示。

## 2. 字段结构

- `text`：一个完整的 Markdown/HTML 脚本。实际内容自带标题（如 `## 1. JSON Split Profile`）、段落、英文/中文混排、行内公式（`$ \lambda = 1.5 $`、`$ E = mc^{2} $`）以及 `<div>`/`<img>` 标签，几乎就是把页面的文本片段拼起来的连贯叙述。这个字符串里没有任何坐标或类型标记，所有布局/类别信息都被扔掉了，只有顺序与格式。
- `images`：字典，键是 Markdown 里用到的相对路径（例如 `imgs/img_in_image_box_256_840_937_1091.jpg`），值是可以直接访问的 HTTP URL（往往带有授权签名）。你可以把它当作 `text` 中 `<img>` 标签的引用表：每当 Markdown 里出现 `src="imgs/...jpg"`，`images[key]` 就能拿到实际图片文件的位置，便于在渲染层嵌入预览图。

## 3. 与 `prunedResult` 的关系

`markdown` 并不是原始 OCR 的结构化输出，它是从 `prunedResult` 派生出来的“软格式”视图。`prunedResult` 仍然是上下游接口应该信任的 canonical 结构体，保存了 page size、`parsing_res_list`（带 `block_bbox`、`block_label`、`block_order`）、布局/段落的抽象和其他 metadata，而 `markdown` 只是把其中文本内容和图片引用串成可读文档。二者的差异意味着：如果你需要定位到某个 block、恢复 X/Y、判断是标题还是表格，就必须去看 `prunedResult`，不能靠 `markdown`。

## 4. 适用与禁忌

- **适合**：调试/排错时快速人眼确认 OCR 输出；给前端或文档工具展示页面概览；用 `text` 里的 Markdown/HTML 层级（标题、`<img>`、公式）简易替代截图；验证 `images` 引用的 asset 是否能访问。
- **不适合**：当作 adapter 的主输入；当作 downstream schema（如 `document.v1`、normalized document）；用来判断结构 tag/type、段落边界或表格/配图关系——这些信息在 `markdown` 中都只剩顺序，不再包含原始类别和坐标。
- **谨慎**：`markdown.images` 只是 URL 映射，不包含 `block_bbox` 等定位信息。如果要在某处重建图片所处的区域，依然要组合 `prunedResult` + `outputImages` 的元数据。

## 5. 后续 adapter 的接入建议

新接入的 adapter 或 provider 实现应当把 `prunedResult`（或 `normalized_document`）当作主链路输入，`markdown.text`/`markdown.images` 只作为辅助的调试视图。常见流程是：

1. 利用 `prunedResult` 里的 `parsing_res_list`、`block_label`、`block_bbox` 等字段完成结构化编排。
2. 如果需要人工确认提取结果，在调试脚本里再读取 `markdown.text`，快速看标题、正文、公式是否连贯。
3. `markdown.images` 可用于渲染 preview 或把图片作为 markdown 里的 `![alt](URL)` 输出，但不要用它决定图像归属或坐标。

保持这一条线索有助于控制 schema 主链路不会因为某个 “看起来像文档” 的 Markdown 而偏离规范。
