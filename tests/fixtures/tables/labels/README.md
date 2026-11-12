# 表格评测集的标准答案

每张表一个文件 `<样例 PDF 去掉 .pdf>-p<原文页码，三位>-t<这页第几张表>.json`，例如 `d3cs00837a-69p-p011-t2.json`。
这页第几张表：从上到下数（同一高度从左到右），从 1 开始。

标准答案**对着原文 PDF 定，不照抄任何一家 OCR**（两家给的结构差很多）。OCR 记录（`../ocr/*.tables.json`）只用来找表在哪。

## 格式 `table_label.v1`

```json
{
  "label_version": "table_label.v1",
  "label_id": "d3cs00837a-69p-p011-t2",
  "fixture": "d3cs00837a-69p.pdf",
  "source_page": 11,
  "bbox_pt": [x0, y0, x1, y1],
  "source_kind": "text_layer",
  "caption": "Table 2 ...",
  "footnotes": ["a Determined by ...", "b ..."],
  "rows": [
    [
      {"text": "Entry", "rowspan": 1, "colspan": 1, "role": "header", "action": "translate", "reference": "序号"},
      {"text": "Yield<sup>a</sup> (%)", "rowspan": 1, "colspan": 1, "role": "header", "action": "translate", "reference": "产率<sup>a</sup> (%)"}
    ],
    [
      {"text": "1", "rowspan": 1, "colspan": 1, "role": "data", "action": "keep", "reference": null},
      {"text": "92", "rowspan": 1, "colspan": 1, "role": "data", "action": "keep", "reference": null}
    ]
  ],
  "tags": ["superscript_markers", "units_in_header"],
  "notes": ""
}
```

- `bbox_pt`：表格本体（不含表题、表注）的框，PDF point，左上角原点，按页面显示的方向。
- `source_kind`：`text_layer`（框里有文字层）/ `vector_paths`（字转成了曲线）/ `image`（表格是图片）。
- `rows`：按行列出；被合并单元格占住的位置**不重复写**（和 HTML 的 `rowspan`/`colspan` 一样）。
- `text`：原文，**从 PDF 文字层抄**，一字不差；上标、下标写成 `<sup>…</sup>`、`<sub>…</sub>`；格子里换行写成一个空格。
  没有文字层时照着图抄。
- `role`：`header`（列表头，含多层表头）/ `stub`（行标签，通常是第一列）/ `data` / `empty`。
- `action`：`translate` 或 `keep`。
  - `keep`：数字和带单位的数、纯单位、正负号和百分号、化学式（`CH2Cl2`）、样品或化合物编号（`SB-3`、`1a`）、
    参考文献号（`[12]`、`ref. 5`）、DOI 和网址、空格子、表注里定义过的缩写（`THF`、`n.d.`）、人名和方法名的专有缩写。
  - `translate`：表头和行标签里的普通词、文字描述格。表头里的单位保留（`Temperature (°C)` → `温度 (°C)`）。
  - 拿不准的（比如 `Control`）按学术中文的习惯定，在 `notes` 里写一句为什么。
- `reference`：`translate` 的格子给参考译文（学术中文，术语用领域通用译法，化学试剂按中文习惯：`toluene` → `甲苯`）；
  上标原样保留；`keep` 的格子为 `null`。
- `tags`（用到的都标）：`spanning_cells`、`multi_level_header`、`superscript_markers`、`units_in_header`、`chemical_formulas`、
  `inline_math`、`narrow_columns`、`long_table`、`continued_table`、`rotated`、`image_table`、`vector_text`。
- `notes`：OCR 两家明显认错的地方、标的时候拿不准的地方。
