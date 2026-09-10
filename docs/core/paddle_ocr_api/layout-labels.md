# PaddleOCR 官方布局标签与 RetainPDF 归一化基线

> 核对日期：2026-09-03
> 适用边界：PaddleOCR 布局分析结果进入 `document.v1` 之前的 provider adapter。
> 当前状态：官方 25 类中 21 类已有显式映射，4 类仍会降级为 `unknown`。

## 1. 为什么维护这份基线

PaddleOCR 的布局标签描述“页面上检测到了什么”，而 RetainPDF 的
`document.v1` 描述“翻译、渲染和前端可以稳定依赖什么”。两套类型不是同一份
契约，因此不能只保留一张基于有限样本整理出的映射表。

这份文档固定三件事：

1. Paddle 官方模型公布的布局标签全集；
2. RetainPDF 当前对每个标签的归一化结果；
3. provider 新增或改变标签时必须执行的兼容检查。

它不描述 Paddle 的任务提交、轮询、`jobId`、`extractProgress` 或结果下载协议。
这些字段属于 provider transport 层，不进入 `document.v1`。

## 2. 官方来源与版本范围

官方 Layout Analysis 文档说明，PP-DocLayoutV2 覆盖 25 种常见布局元素，并负责
恢复这些元素的阅读顺序：

- [PaddleOCR Layout Analysis Module User Guide](https://www.paddleocr.ai/latest/en/version3.x/module_usage/layout_analysis.html)
- [上述文档在 PaddleOCR 官方仓库中的源文件](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/module_usage/layout_analysis.en.md)
- [PP-DocLayoutV2 官方模型配置中的 `label_list`](https://huggingface.co/PaddlePaddle/PP-DocLayoutV2/blob/main/inference.yml)

RetainPDF 当前默认接入的 PaddleOCR-VL-1.6 配置使用 PP-DocLayoutV3；其官方
pipeline 配置仍沿用相同的 25 个类别编号和名称：

- [PaddleOCR-VL-1.6 官方 pipeline 配置](https://github.com/PaddlePaddle/PaddleX/blob/release/3.7/paddlex/configs/pipelines/PaddleOCR-VL-1.6.yaml)

因此，下表是当前接入的兼容基线，不是对未来版本的永久承诺。升级 Paddle 模型、
PaddleX 或官方 API 时，必须重新比对实际模型配置和真实返回数据。

## 3. 官方 25 类与当前映射

当前实现以
`backend/pipeline/retainpdf_pipeline/ocr/document_schema/provider_adapters/paddle/block_labels.py`
中的 `map_block_kind` 为准。

| Paddle `block_label` | 含义 | 当前 `document.v1` 映射 | 状态与说明 |
| --- | --- | --- | --- |
| `abstract` | 摘要 | `text/body` | 已映射，并保留 abstract 角色 |
| `algorithm` | 算法或代码块 | `code/code_block` | 已映射 |
| `aside_text` | 侧栏或旁注文字 | `text/metadata` | 已映射，默认跳过翻译 |
| `chart` | 图表 | `image/image_body` | 已映射，但 canonical 语义被压成普通图片 |
| `content` | 目录 | `text/table_of_contents` | 已映射 |
| `display_formula` | 行间公式 | `formula/display_formula` | 已映射 |
| `doc_title` | 文档主标题 | `text/title` | 已映射 |
| `figure_title` | 图、表或图表标题 | `text/figure_caption` | 已映射；关系层可继续判断实际目标 |
| `footer` | 页脚文字 | `text/footer` | 已映射，默认跳过翻译 |
| `footer_image` | 页脚图片 | `image/image_body` | 已映射，但 canonical 语义被压成普通图片 |
| `footnote` | 页面脚注 | `text/footnote` | 已映射，默认跳过翻译 |
| `formula_number` | 公式编号 | `text/formula_number` | 已映射，默认跳过翻译 |
| `header` | 页眉文字 | `text/header` | 已映射，默认跳过翻译 |
| `header_image` | 页眉图片 | `image/image_body` | 已映射，但 canonical 语义被压成普通图片 |
| `image` | 图片 | `image/image_body` | 已映射 |
| `inline_formula` | 行内公式 | `unknown` | **未映射；真实任务已经出现** |
| `number` | 页码 | `text/page_number` | 已映射，默认跳过翻译 |
| `paragraph_title` | 章节或段落标题 | `text/heading` | 已映射 |
| `reference` | 参考文献区域或容器 | `unknown` | **未映射**；可能只出现在检测层而不形成解析块 |
| `reference_content` | 参考文献条目 | `text/reference_entry` | 已映射，默认跳过翻译 |
| `seal` | 印章 | `unknown` | **未映射** |
| `table` | 表格 | `table/table_html` | 已映射；当前保留 HTML，未拆成单元格 schema |
| `text` | 普通正文 | `text/body` | 已映射 |
| `vertical_text` | 竖排文字 | `unknown` | **未映射** |
| `vision_footnote` | 图、表或图表附近的视觉附注 | `text/footnote` | 已映射；目标对象需由关系层判断 |

`formula` 是 RetainPDF 当前额外接受的兼容别名，会映射到
`formula/display_formula`；它不属于上面的官方 25 类。

## 4. “已映射”的准确含义

“已映射”只表示 adapter 不会把该标签直接变成 `unknown`，不表示所有 provider
语义都进入了 canonical core：

- `chart`、`header_image` 和 `footer_image` 当前都归一化为普通 `image_body`；
- `table` 保留表格 HTML，但没有统一的行、列和单元格对象；
- `figure_title` 需要依赖邻接关系才能区分图片标题、表格标题或图表标题；
- Paddle 原始标签、坐标、polygon、顺序和 block id 应继续保留在
  provenance/provider trace 中，以便排错和未来重建。

即使 canonical 映射暂时不完整，也不应丢弃原始 block。未知标签必须进入
`unknown` block 并保留 raw label，而不是静默删除。

## 5. 归一化完整性的验收规则

Paddle adapter 后续应满足以下门禁：

1. 官方 25 个 label 都有显式映射决策；允许映射到保守类型，但不能依赖默认分支。
2. 为 25 类建立参数化契约测试；官方新增 label 时测试必须失败并提示更新映射。
3. `document.v1.report.json` 记录 `unmapped_provider_labels` 及每种 label 的数量。
4. 出现未知 label 时至少产生 warning；严格模式下 `complete` 必须为 `false`。
5. 回归语料必须包含 `inline_formula`，并逐步补齐 `seal`、`vertical_text` 和
   `reference` 的真实或官方 fixture。
6. 校验 block/page 数量守恒，确认归一化没有静默丢块。
7. provider transport 字段继续留在 API 边界，不因补标签而写入 `document.v1`。

## 6. 变更流程

升级 Paddle 版本或观察到新 label 时：

1. 保存脱敏后的 provider raw fixture；
2. 对照官方模型配置确认 label 名称与语义；
3. 更新 `block_labels.py` 的显式映射；
4. 更新本表、归一化报告和全量标签契约测试；
5. 验证 translation、rendering 和前端 overlay 是否正确处理新 canonical 类型；
6. 对真实任务执行 raw block 与 normalized block 数量守恒检查。

旧的样本统计文档
`backend/packages/retain-data/src/ocr_provider/paddle/JSON_README/block_label_mapping_README.md`
仍用于说明仓库样本，但不再作为官方标签全集。
