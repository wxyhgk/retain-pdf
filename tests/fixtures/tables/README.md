# 表格翻译评测集

表格翻译（[方案](../../../docs/ops/planning/table-translation/README.md)）的评测样本。只用仓库里已有的公开样例 PDF
（`tests/fixtures/pdfs/`），不放用户的文件。

## 里面有什么

| 文件 | 内容 |
|---|---|
| `subsets.json` | 从哪几份样例 PDF 挑了哪些页（按表题 "Table N" 找有表格的页，原文页码从 1 数） |
| `ocr/glm_ocr.tables.json` | GLM-OCR 对这些页的结果里每张表的记录 |
| `ocr/paddle.tables.json` | PaddleOCR 的同样记录 |

每条记录（`table_eval_record.v1`）：`table_id`、`provider`、`fixture`（样例 PDF 文件名）、`source_page`（原文页码）、
`page_size_pt`、`bbox_pt`（表格框，PDF point，左上角原点）、`block_id`、`html`（OCR 给的表格 HTML）、`captions`、`footnotes`。

2026-11-12 跑的 OCR：8 份样例共 52 页，两家各认出 55 张表。同一批表，GLM-OCR 给了 957 个格子、PaddleOCR 给了 545 个，
**两家的结构差很多**——标准答案不能取任何一家，要对着原文定（见下）。

## 怎么重新生成

OCR 要花钱，跑之前先问用户。子集 PDF 和 OCR 任务放在临时目录，不进仓库：

```bash
backend/.venv/bin/python backend/pipeline/devtools/build_table_eval_set.py \
  --ocr-jobs <OCR 任务根目录> --subsets <subsets.json> --out tests/fixtures/tables
```

## 还没做

- 标准答案（`labels/`）：每张表对着原文页定结构（行、列、合并单元格），每格标"翻 / 不翻"，要翻的给参考译文。
- 合成样例（横排页、字转曲线、图片表、续表）：T1 里做，带标准答案。
