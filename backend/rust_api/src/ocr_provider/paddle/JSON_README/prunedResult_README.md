# prunedResult 结构与 normalized_document_v1 值映射

该 README 针对 `rust_api/src/ocr_provider/paddle/json_full.json` 中 `layoutParsingResults[*].prunedResult` 的输出而写，供 adapter 实现者快速定位 key 字段、理解语义与归一化时的映射思路；同时指明哪些字段适合作为 trace/debug 保留。

## JSON 层级

- `layoutParsingResults` 是 Paddle OCR 在同一份输入上可能产生的多套 layout 结果（通常会有若干 `split`/`merge` 版本）
- 每个条目都含 `prunedResult`（我们关心的归一化起点）以及源码的 `markdown`/`outputImages`/`inputImage` 等调试片段
- `prunedResult` 直接包含：
  - `page_count`（总页数）
  - `width`、`height`（当前 layout 解析对应的画布尺寸，单位 px）
  - `model_settings`（此轮推理使用的各类开关，用于复现/排错）
  - `parsing_res_list`（Paddle 原生的 block 结构列表）
  - `layout_det_res`（底层 layout detector 的 box 输出，便于 trace 到具体检测结果）

## 关键字段说明

### `page_count` / `width` / `height`
- 直接提供 document 级的页数和画布尺寸，建议在 normalized document 中映射到 `document.page_count` 以及每页默认的 `page.width/page.height`，用于 overflow/缩放判断。

### `model_settings`
- 包含本次解析的开关字段，字段名与实际值如下：
  - `use_doc_preprocessor`: 是否使用文档预处理
  - `use_layout_detection`: 是否启用了 layout 检测器
  - `use_chart_recognition`: 是否尝试识别图表
  - `use_seal_recognition`: 是否开启印章识别
  - `use_ocr_for_image_block`: 是否对 image block 再做 OCR
  - `format_block_content`: 是否对文本内容执行格式化（如 trim）
  - `merge_layout_blocks`: 是否合并 layout 中相邻的 block
  - `markdown_ignore_labels`: 对应 markdown 生成时会忽略的 block label，例如 `number/footnote/header/...`
  - `return_layout_polygon_points`: 是否在每个 block 中附带 polygon 信息
- 建议将该结构作为 adapter 的 trace metadata（写入 normalized document 的 `meta.ocr_settings` 或类似字段），以便后续问题追踪或与 Rust layer 的 `normalization_report` 对齐。

### `parsing_res_list`
- 核心的 block 列表，是 normalized_document 的第一手输入。每项字段：
  - `block_label`: Paddle 预测的 label（如 `header/paragraph_title/text/table/figure_title/footer`），可以映射到 normalized block 的 `type`/`sub_type` 或 `tags`
  - `block_content`: 文字内容，直接填入 normalized block 的 `text_content` 或 `lines` 之类字段
  - `block_bbox`: `[x0,y0,x1,y1]`，对应 block 的 axis-aligned bounding box
  - `block_polygon_points`: 同 `block_bbox`，但支持 polygon（每个 point 为 `[x,y]`），适合落在 normalized block 的 `polygon` 字段
  - `block_id`、`group_id`：局部 block/组 ID，可用于生成 normalized block 的 `provider_id` 或 `group_id`
  - `global_block_id`、`global_group_id`: 含全局偏移的 ID，在多个 layout 版本/页之间保持唯一，建议在 normalized document 中作为 `meta.global_id` 追踪
  - `block_order`: Paddle 推断的阅读顺序（此示例中部分值为 `null`），可用来填充 `normalized_document.pages[].items[].order`
- 建议 adapter 采用如下思路：
  1. 将 `parsing_res_list` 按 `block_order` 或 `block_id` 分页划分（若存在 `group_id`，可作为 `Page.blocks` 的 `group` 维度）
  2. 使用 `block_label` 区分类别（`header`/`paragraph_title`/`text` 等），确定 normalized block 的 `type/sub_type`（例如 `text` 核心内容，`paragraph_title` 可当作 `title` 类型）
  3. `block_content` 直接赋值为 normalized block 的 `text`，并保留 `block_polygon_points` 作为 `geometry.polygon`
  4. `block_bbox` 同步填充到 normalized block 的 `bounding_box`，以便前端/渲染复用

### `layout_det_res`
- 包含 layout detector 原始 box，当前结构是：
  - `boxes`: list of objects
  - 每个 box 拥有 `cls_id`（分类器 ID）、`label`（类别名称）、`score`（置信度）、`coordinate`（`[x0,y0,x1,y1]`）、`order`（预测阅读顺序，可为 `null`）、`polygon_points`
- 建议 adapter 将 `layout_det_res` 作为原始检测 trace：
  - 可在 normalized document 的 `meta.raw_traces.layout_det_res` 中保留 `boxes`，便于回溯 label 与 score
  - `coordinate` / `polygon_points` 对应 `parsing_res_list` 的 geometry，可用于验证两者是否一致（如 `merge_layout_blocks` 开启时会产生差异）
  - `score` 适合写入 trace 而非 normalized block 的核心字段，保持 `document.normalization_trace` 供排查漏检/误检

## 适配建议

1. Adapter 首先读 `page_count`/`width`/`height` 作为 normalized document 的基本页面信息；`layout_det_res.boxes` 可同步提供 `page_count` 的上下游一致性校验。
2. `parsing_res_list` 每项生成一个 normalized block，`block_label` 决定 `type`（如 `table`、`image`、`text`），`block_content` 变成主要文本内容，`block_order`/`group_id` 用于构建 block 的阅读顺序/分群。
3. 所有 polygon/bbox/cursor 相关字段（`block_bbox` + `block_polygon_points` + `layout_det_res.boxes coordinate/polygon_points`）都应该同步贴到 normalized block 的 geometry 和 trace，避免不同入口对坐标的理解แตก开。
4. `model_settings` 和 `layout_det_res` 直接写 a debug trace（例如 `normalized_document.meta.provider_trace.paddle.pruned_result`），以便在 `normalization_report` 中复现该字段；只有 `parsing_res_list` 的 `block_content`/`label`/`geometry` 才需要真正映射到 normalized document 主链路。
5. 如果后续走 `normalized_document_v1` 的 schema，建议在 `blocks[].meta` 里保存原始的 `block_id/global_block_id` 和 `group_id/global_group_id`，以便与不同 provider 的 ID 做对齐。

## Trace 保留的字段

- `model_settings`：完整保存，便于对齐实验参数与 `normalization_summary`
- `layout_det_res.boxes`：作为 `debug.traces.layout_detector`，保留 `label/score/coordinate/order`
- `parsing_res_list` 中的 `block_polygon_points` 与 `block_id` 是往后排错时定位 block 的基础
- 其余如 `global_block_id/global_group_id` 可直接写入 `blocks[].meta.source_ids`

保持以上约定，能让 adapter 在生成 normalized document 时既不丢失 Paddle 提供的细粒度语义，也能在 trace 中完整还原 detection 过程，便于后续渲染、调试和 schema 回归。
