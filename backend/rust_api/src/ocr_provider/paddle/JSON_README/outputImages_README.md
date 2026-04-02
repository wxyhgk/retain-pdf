# layoutParsingResults[*].outputImages 使用说明

`json_full.json` 中的 `layoutParsingResults` 是每页 OCR 输出的最外层结构。拿到这个数组之后，adapter/调试脚本会依次对每一页的 `prunedResult` 做结构化、`markdown` 做策略判断，最终还会把一些视觉辅助图像挂在 `outputImages` 上。当前 paddle provider 的样例里，每个页面的 `outputImages` 只有一项：

| 键名 | 内容示例 | 描述 |
| --- | --- | --- |
| `layout_det_res` | `https://.../layout_det_res_0.jpg?...` | layout detection 的叠加图，将 `prunedResult.parsing_res_list` 里所有 block 的 polygon/bbox 画回原图；URL 为 Paddle OCR 线上 CDN（带临时授权） |

如果后续增加其它 key（例如某种 `crop_*.jpg` / `summary_vis` 之类）也会跟着放在这个字典里，命名上建议继续按照 `<stage>_<purpose>` 的语义级别来区分。`outputImages` 不是必须的字段，但一旦存在就代表 provider 在当前 stage 产出了一张有意义的可视图，可用于帮助理解分割结果。

## 各类消费者的采纳策略

### Adapter（schema 适配器）
- 建议在 `document_schema` 的 regression 或 fixture 检查中把 `layout_det_res` 作为结构校验的辅助对照。借助该图可以快速确认 `prunedResult` 中所记录的 `block_bbox`/`polygon_points` 是否和实际检测出的版面一致，尤其当 normalized document 出现多余/少的 block 时再回头对照这张图会更快定位问题。
- 不推荐把任意 image URL 直接写入 normalized document。此类图属于“调试级”产物，不影响 downstream schema 的字段，但可以在 regression report 旁边附一个链接，方便新 provider 审核自己是否漏掉关键版式。

### 调试工具（脚本、运行时日志）
- `layout_det_res` 是最直接的可视化调试入口：重现某个 case 时，把该 URL 下载到本地就能看到 layout detection 的 overlay。建议在 `regression_check.py`、`validate_document_schema.py` 等脚本输出 summary 时同步打印这份 URL（或把它写入 `reporting.py` 生成的 summary），这样操作者看到 normalized document 出问题时会自然而然地打开对应页面的视觉结果。
- 其他潜在的 `outputImages`（如 future 版面裁剪图）也应该只在 debug 模式下才写到日志/文件系统，避免将大量临时图片留存到正式数据管道。

### 前端预览/诊断
- `layout_det_res` 非常适合做 “layout QA” 的可视化面板（例如在调试控制台里把原图、检测 overlay、normalized tree 串联起来）。因为 URL 带有授权且大小较大，应将它视为点击可选项，不要在主流程自动拉取，防止前端在正式运行时频繁触发 CDN 验证。
- 如果未来希望给用户展示 “裁剪后图” 或 “可视化只读图”，可以在 `outputImages` 中新增 `crop_*`、`vis_fit_res` 等字段，说明它们是专门给前端/报表用的，依然通过 README 约束只在 QA/diagnostic 页面读取即可。

## 字段保留建议

- `layout_det_res`: 保留。即便不是主链路数据，也应该在 provider attachment/regression report 里保留一份 URL 或落地文件（如 `artifacts.py` 的 `layout_det_res_*` 目录），用于后续的视觉对齐检查。
- 其他 `outputImages`：如果字段名称明确对应某类调试/裁剪场景（例如 `block_crop_res`, `layout_vis`），可以依据需要选择是否持久化；但原则上只要不是用来构建 normalized document，都是 “调试/可视化” 的范畴，按需开启并在 README 中说明它们不应该被解析到 schema。

## 关联字段提示

- `inputImage`：每个 `layoutParsingResults` 同时也提供原始输入图（`input_img_N.jpg`），前端在展示 overlay 时应先加载这个 image，再把 `layout_det_res` 作为 overlay 层。
- `preprocessedImages`：整体 JSON 最外层给出的 preprocessed 图（如 `preprocessed_img_0.jpg`）是检测前的稿件，适合作为排查模型预处理效果的参考，不属于 `outputImages`，因此在 README 中只做补充说明即可。

把这些约定写在 README 中后，adapter/调试脚本就能直接回看本文件，无需在多个脚本里重复判断哪些图可用。这也契合当前主线：文档/脚本/回归都以统一 schema 为核心，而可视化图片仅作为辅助信息存在。
