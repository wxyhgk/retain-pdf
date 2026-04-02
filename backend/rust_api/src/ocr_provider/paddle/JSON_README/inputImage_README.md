# inputImage 说明

## 结构与对齐关系
- `json_full.json` 的顶层包含 `layoutParsingResults`、`preprocessedImages` 和 `dataInfo` 三个主要区块。本例里 `layoutParsingResults` 是一个按页展开的数组，每一项都包含 `prunedResult`、`markdown`、`outputImages` 以及 `inputImage` 等字段，`inputImage` 里的 URL 形如 `…/input_img_{页号}.jpg`，和 `preprocessedImages` 里 `preprocessed_img_{页号}.jpg` 保持严格一一对应（两者数组长度相同）。  
- `dataInfo.pages` 列表则只保留每页的 `width` 与 `height`，用于确保后端解析出来的坐标系可以映射回这些 `inputImage`/`preprocessedImages` 所描述的画布尺寸。也就是说：`layoutParsingResults[i]`、`preprocessedImages[i]`、`dataInfo.pages[i]` 都代表同一张源页，`inputImage` 是用于 layout parser 的即时输入。

## inputImage 在链路各处的作用
- **Provider adapter**：在 `document_schema` 适配器里，`layoutParsingResults` 是主结构，`inputImage` 可以帮助 adapter 把解析的 layout 与原始图像一一映射（可以用来校验 pageIndex、dimensions 或计算展现比例）。如果需要做 page-level trace（比如 `layoutParserResult` 里每个 box 的 `page_id`），这个字段确认了当前数据的「源图片」，对齐 `dataInfo.pages` 的 `width/height` 后便能生成与 visual preview 一致的 normalized document。
- **Trace / 日志链路**：排查时我们会把 `inputImage` 和 `preprocessedImages` 的 URL 绑定到 `trace_point` 或 `reporting` 里，便于在后续观察 layout 结果（尤其是对抗 OCR 误判或 provider 升级后复现）。layout parser 报错时，提供的 `inputImage` 还能直接喂给 `renderer` 或 `debug explorer`，确认当时的输入是否被裁切或缩放。
- **前端预览**：前端需要展示 layout overlay，这里应优先使用与 layout parser 同一张 `inputImage`（输入经过 provider 的标准预处理后再送入分析）。`preprocessedImages` 更适合展示 provider 输出的“标准化视图”，但 `inputImage` 才是 layout parser 实际读入的图，前端用它做 canvas 背景可以避免画布大小与检测结果不一致的问题。
- **重跑 / 缓存**：`inputImage` 附带巨量 query-string（包括授权/签名与时间戳），说明它可能有有效期；但由于它标识了 layout parser 的真实输入，缓存策略应至少缓存 URL（或者下载一份本地副本）以便后续重跑不再依赖 provider 的线上资源。重跑 pipeline 时，provider adapter 检查 `inputImage` 一致性，有助于确认新旧 layout 输出是否一致；缓存器可以把 `inputImage` 与 `layoutParsingResults` 绑定，方便重新生成 `normalized_document` 或 `reporting` 而不重新叫 OCR。

## 保留策略建议
1. `layoutParsingResults.inputImage` 与 `preprocessedImages` 的数组顺序必须保持同步；任何 provider adapter 或 regression 工具在用到其中一项时都要校验 `page_count`/`numPages`。
2. `inputImage` 链接较短期有效，建议在归档时做二选一：要么下载、要么把 URL + 版本信息写入储存（例如 `reporting` 的 metadata 里），确保 trace/renderer 能在未来重新请求。
3. `preprocessedImages` 可以用于展示 provider 处理后的结果，但 layout 重现或调试时优先使用 `inputImage`，因为它是 layout parser 的真实输入；若同时保留两者，前端可以交替展示「原始 viewport（`inputImage`）」与「标准化视图（`preprocessedImages`）」。
4. rerun/caching 层如果要复用旧路径，务必确认对应的 `dataInfo.pages` 尺寸和 `layoutParsingResults` 页数一致，避免因为 `inputImage` 过期导致 `preprocessedImages`/`layoutParserResult` 不能完整回放。

通过以上说明，我们把 `layoutParsingResults.inputImage` 视作 layout parser 的 canonical input，`preprocessedImages` 作为 provider 给出的 normalized preview，两者与 `dataInfo.pages` 形成 page 对齐的三角关系，为 adapter、trace、前端以及重跑/缓存提供一致的视觉基准。
