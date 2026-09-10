#set page(
  margin: 18mm,
  header: context {
    box(width: 100%)[
      #set text(font: "Noto Sans", size: 9pt)
      PaddleOCR JSON Split Research #h(1fr) March 31, 2026 · Provider: Paddle
    ]
  },
  footer: context {
    box(width: 100%)[
      #set text(font: "Noto Sans", size: 9pt)
      Confidential Draft #h(1fr) Page page.number / pages.count
    ]
  },
)

#set text(font: "Noto Serif CJK SC", size: 10.5pt)
#set heading(numbering: "1.")

= JSON Split Profile

PaddleOCR 的 JSON 拆分调研文件，目标是让 layout、segments、metadata、table、formula、image 等层级在后续适配时更容易拆开。This document deliberately mixes English and 中文 to cover bilingual metadata, while the inline formula $lambda = 1.5$ simulates the confidence bias used in split heuristics.

== 结构概览

This paragraph mixes short English phrases and 中文短句 to imitate how OCR records title, body text, and side metadata in one page. 下面这一段包含行内公式 $E = m c^2$，也包含简短提示文字，适合观察 PaddleOCR 对 text span 和 inline math 的切分行为。

调研步骤如下：

+ Define the core JSON slice labels: `layout`, `text_segments`, and `metadata`.
+ Map each slice to either the normalized document or the report cache.
+ Document how downstream services consume these slices without re-parsing raw OCR.

注意事项：验证集采用 line-based text field，以便 benchmark 与离线调试可以复用同一批 JSON。

== 关键词与流程

下列项目用于覆盖短项目符号列表、代码样式单词和中英文混排：

- `text_segments`：用于翻译和渲染提示词。
- `layout_hierarchy`：只保留在规范化文档的结构层。
- `report_summary`：只能通过共享 helper 产生，不能在业务代码里重复推导。

The visual cue in Figure 1 shows how the split occurs between layout and metadata. The inline formula $s_i = e^(x_i) / sum_(j) e^(x_j)$ highlights the confidence distribution used for selecting segments.

#figure(
  image("diagram.svg", width: 120mm),
  caption: [Figure 1. PaddleOCR JSON split flow between layout, text, and metadata.]
)

== 表格与脚注

Use this table to keep downstream document consumers consistent with field semantics.

#figure(
  table(
    columns: (24%, 38%, 38%),
    align: left + horizon,
    stroke: 0.4pt,
    inset: 5pt,
    [*Field*], [*Description*], [*Example*],
    [`layout.json`], [Raw bounding boxes and tokens], [`[[x, y, w, h, text]]`],
    [`document.v1.json`], [Normalized hierarchical document], [`{"pages": [...]}`],
    [`report.json`], [Summary and confidence statistics], [`{"summary": "...", "confidence": 0.96}`],
  ),
  caption: [Table 1. Core JSON documents and their intended consumers.]
)

表格脚注：这里假设共享 helper 统一负责命名，后续 provider 的扩展字段也应优先进入 report，而不是直接污染主 schema。

== 代码块与引用

下面的代码块用于测试 PaddleOCR 对 monospace、命令行参数和长横线的处理。

```bash
python scripts/entrypoints/validate_document_schema.py \
  --adapt sample_layout.json \
  --write-report sample_report.json
```

引用块用于观察 indentation、leading 和引用标记的检测：

#quote(block: true)[
  说明：请务必先触发 regression_check，确认 provider fixture 已登记在 registry，
  然后再比较 normalized document 与 raw provider JSON 的字段差异。
]

== 行间公式与总结

下面的行间公式用于覆盖 display math 场景：

$
N = (sum_(i = 1)^n c_i w_i) / (sum_(i = 1)^n w_i)
$

为了让第一页内容自然结束，这里追加一段简短的中文和英文摘要。The first page intentionally contains mixed paragraph lengths, figure caption text, a table block, and a code block so that OCR can expose differences in block typing.

#pagebreak()

== 第二页：综合示例

本页继续覆盖图片标题、表格标题、编号列表、警示框样式文本，以及更长的正文块。A longer paragraph is useful because PaddleOCR often changes segmentation strategy once line count and punctuation density increase. 这也有助于后续拆分 `paragraph -> line -> token` 三层 JSON。

=== 小节 A：实验记录

1. The experiment started at 08:30 with a synthetic document bundle.
2. 第二步记录 layout 节点与 metadata 节点的边界位置。
3. The final step compares raw provider spans against normalized segments.

=== 小节 B：警示信息

#figure(
  rect(
    width: 100%,
    inset: 10pt,
    radius: 4pt,
    fill: rgb("#f7f1e3"),
    stroke: rgb("#c17c00"),
    [
      *Warning.* 如果某个 block 同时带有表格边框和文字内容，应先保留 raw geometry，
      再决定是否在 normalize 阶段把它拆成 `table` 与 `caption` 两个对象。
    ],
  ),
  caption: [Figure 2. A warning-style block that behaves like a callout.]
)

=== 小节 C：小型数据表

这里再放一个更学术一点的表，用于测试数字、单位、英文缩写和中文说明是否会被混成同一列。

#figure(
  table(
    columns: (20%, 18%, 24%, 38%),
    align: left + horizon,
    stroke: 0.4pt,
    inset: 5pt,
    [*Sample*], [*Pages*], [*Confidence*], [*Comment*],
    [Doc-A], [12], [0.97], [Mostly clean scientific article with equations.],
    [Doc-B], [2], [0.91], [Contains screenshots and heavy mixed language labels.],
    [Doc-C], [36], [0.88], [Code block and table border overlap need special handling.],
  ),
  caption: [Table 2. Example benchmark summary for provider comparison.]
)

表注：数值只是示意，不代表真实 benchmark 结论。

=== 小节 D：结尾段落

This closing paragraph keeps a natural reading flow while still covering mixed punctuation, abbreviations such as API, OCR, PDF, and a final inline formula $p(x) = a x + b$. 末尾再加入一句中文说明：结果仅供调研使用，方便你后续把 PDF 上传到 PaddleOCR 服务，再对照它的 JSON 结构做拆分设计。
