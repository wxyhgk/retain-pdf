# Paddle block_label 首版映射表

这份文档基于 [json_full.json](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/json_full.json) 的 `layoutParsingResults[*].prunedResult.parsing_res_list[*].block_label` 实际枚举结果整理，目标是给后续 `Paddle -> document.v1` adapter 提供第一版稳定映射。

## 1. 当前样本中观察到的 block_label

从当前三页样本里枚举到的 label 如下：

| block_label | 次数 | 说明 |
| --- | ---: | --- |
| `text` | 25 | 普通正文段落 |
| `paragraph_title` | 12 | 段落标题/小节标题 |
| `header` | 6 | 页眉 |
| `footer` | 6 | 页脚 |
| `figure_title` | 4 | 图片标题或表格标题 |
| `table` | 2 | 表格主体，内容是 HTML table |
| `image` | 1 | 图片主体，内容通常是 `<img>` HTML |
| `algorithm` | 1 | 代码/算法块 |
| `display_formula` | 1 | 行间公式 |
| `vision_footnote` | 1 | 视觉脚注/表注/附注 |

## 2. 实际样例摘录

### `text`
- 页 1 / block 4
  正文中英混排的大段文字
- 页 1 / block 6
  带行内公式和解释文字的普通正文

建议：
- 直接作为 normalized 的正文块主入口。

### `paragraph_title`
- 页 1 / block 3
  `## 1. JSON Split Profile`
- 页 1 / block 5
  `### 1.1. 结构概览`

建议：
- 作为标题类块，不要并入普通 `text`。

### `header`
- `PaddleOCR JSON Split Research`
- `March 31, 2026 · Provider: Paddle`

建议：
- 默认保留为结构块，但翻译主链路通常应跳过。

### `footer`
- `Confidential Draft`
- `Page page.number / pages.count`

建议：
- 默认保留为结构块，翻译主链路通常也应跳过。

### `figure_title`
- Figure caption
- Table caption

注意：
- 这个 label 在 Paddle 样本里同时覆盖了“图片标题”和“表格标题”，不能简单等价成 `image_caption`。

### `table`
- 内容是完整 HTML table 字符串

建议：
- 先保留原始 HTML 内容
- 后续再决定是否把单元格进一步拆成结构化 table schema

### `image`
- 内容通常是 `<img src=...>` 片段

建议：
- 视为图片区主块，不要拿 `block_content` 当正文文本

### `algorithm`
- 当前样本里是代码块/命令行块

建议：
- 先统一映射到 `code`
- 后续如果 Paddle 里还有真正算法伪代码，再决定是否细分 `algorithm_block`

### `display_formula`
- 内容是 `$$ ... $$`

建议：
- 直接映射到 `formula`
- 保留原始 LaTeX/Math 字符串

### `vision_footnote`
- 当前样本是 `表注：数值只是示意，不代表真实 benchmark 结论。`

建议：
- 先统一看成 footnote/caption_note 类
- 这类字段常在图表附近出现，应保留相邻关系线索

## 3. 首版 normalized_document_v1 映射建议

这里先给“保守、稳定”的映射，不追求一次到位。

| Paddle block_label | normalized type | normalized sub_type | 备注 |
| --- | --- | --- | --- |
| `text` | `text` | `body` | 主体正文 |
| `paragraph_title` | `text` | `heading` | 后续可根据编号/层级再细分 |
| `header` | `text` | `header` | 通常跳过翻译 |
| `footer` | `text` | `footer` | 通常跳过翻译 |
| `figure_title` | `text` | `caption` | 先统一 caption，再通过邻接块判断图/表标题 |
| `table` | `table` | `table_html` | 保留 HTML 原文 |
| `image` | `image` | `image_body` | 不以文本逻辑处理 |
| `algorithm` | `code` | `code_block` | 先统一到代码块 |
| `display_formula` | `formula` | `display_formula` | 行间公式 |
| `vision_footnote` | `text` | `footnote` | 图注/表注/脚注先统一入这一类 |

## 4. 哪些字段需要额外保留到 raw trace

建议每个 normalized block 都保留以下 provider trace：

- `provider = "paddle"`
- `source_page_index`
- `source_block_index`
- `source_block_label`
- `source_block_id`（如果有）
- `source_group_id`（如果有）
- `source_bbox`
- `source_polygon`

原因：
- `figure_title` 需要靠邻接关系区分图标题还是表格标题
- `vision_footnote` 后续可能要再分成 `table_footnote` / `image_footnote`
- `table` 当前是 HTML 字符串，后续若做结构化拆表，需要追溯到原始块

## 5. 当前最值得先做的三件事

1. 先写 `block_label -> normalized type/sub_type` 的纯映射函数
2. 先把 `figure_title` 和 `vision_footnote` 保守落到 `caption/footnote`
3. 不要立刻把 `table` 和 `image` 深拆，先稳定把它们作为块保留下来

## 6. 当前样本暴露出的几个工程结论

- Paddle 的 `figure_title` 明显是混合类标签，后面必须结合前后块关系判断“图标题/表格标题”。
- `table` 和 `image` 的 `block_content` 更像“富文本或嵌入片段”，不能直接走普通正文抽取逻辑。
- `algorithm` 目前更像代码块，不要单独再开一套复杂分支。
- `display_formula` 单独有标签，这比 MinerU 更直接，应该优先利用。

## 7. 建议的后续文件

如果下一步开始写 adapter，建议直接新增：

- `paddle/block_labels.py`
  只管 label 映射和标签判定
- `paddle/adapter.py`
  只管 `json_full -> document.v1`
- `paddle/trace.py`
  只管 provider raw trace 的落点

这样后面遇到新 label，只改 `block_labels.py`，不会污染主 adapter。
