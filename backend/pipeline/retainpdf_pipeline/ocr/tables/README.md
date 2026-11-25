# ocr/tables

## 负责什么

表格模型（表格翻译 T1）：一张表的 OCR 结果（document.v1 的 table block）加上原文 PDF 那一页 → `table.v1`：
结构（行、列、合并单元格）来自 OCR 的 HTML，每格的位置和原文来自 PDF 文字层，再标上内容类型、角色和"翻不翻"的规则建议。
方案见 [表格翻译](../../../../../docs/ops/planning/table-translation/README.md)。

## 对外入口

- `build_table_model(block, page)`：返回 `table.v1` 字典（`cells` 每格有 `id`、`row`、`col`、`rowspan`、`colspan`、`text`、
  `ocr_text`、`bbox`、`font_size`、`content_kind`、`suggested_action`、`role`；整表有 `confidence`、`issues`）。
- `content_kind(text)` / `suggested_action(kind)`：数字、化学式、编号、文字的粗分和对应的翻 / 不翻建议。
- `table_structure(block, page)`（`structure.py`，表格 agent 定结构用，G4）：结构初稿（每格起始行列和跨度、每行表格占哪几行文字）
  和 `rebuild(draft)`——按 agent 改过的初稿重新从文字层取格子原文、重算 issues（多带 `suspect_rows`、`caption_lines`，
  表题表注移出去以后框收到表格本体）。初稿原样交回重建和 `build_table_model` 一字不差（评测集 110 张钉着）。

## 怎么做

1. `html_grid.py`：HTML → 逻辑网格；OCR 把表题、表注当成第一行、最后一行的，去掉（`dropped_caption_row`）。
2. `text_layer.py`：表格框里的文字层逐字取出，拼成词、标上下标（字号小、或者抬高 / 压低的零星片段），按基线分行；
   斜着、竖着的字（水印）不要。`symbol_fonts.py` 把符号字体的错码换成页面上画的字（每一项都看图核对过）。
3. `assemble.py`：文字行对到表格行（动态规划）；列界取竖向空白通道（几乎所有行都没字的地方），找不够时退回按空隙切；
   每个词按位置落进格子。
4. `model.py`：拼成 `table.v1`（`assemble_table_model`，建表和定结构以后重建共用）；结构可能有错、规则修不了的打上 `issues`
   （`empty_column`、`row_swallows_rows`、`unassigned_text_lines`、`row_without_text`、`columns_not_found`），交给表格 agent
   看图定结构（`row_swallows_rows`、`columns_not_found` 这一版修得了）。

## 不该做什么

- 不用 OCR 的格子文字当原文（评测集量过：约四成和原文对不上）。
- 不处理没有文字层的表（字转曲线、图片表）：标 `no_text_layer`，以后看图做。
- 不调模型、不写文件。

## 水平

对着评测集（`tests/fixtures/tables/`）打分：`backend/pipeline/devtools/table_model_eval.py`，测试
`devtools/tests/document_schema/test_table_model.py` 钉着不许退步。
