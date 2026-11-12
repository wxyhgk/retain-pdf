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

2026-11-12 跑的 OCR：8 份样例共 52 页，两家各认出 55 张表，GLM-OCR 7025 个格子、PaddleOCR 6929 个。总数接近，但逐张的
结构（合并单元格、多层表头、格子切分）会不一样——标准答案不取任何一家，对着原文定（见 `labels/`）。

## 怎么重新生成

OCR 要花钱，跑之前先问用户。子集 PDF 和 OCR 任务放在临时目录，不进仓库：

```bash
backend/.venv/bin/python backend/pipeline/devtools/build_table_eval_set.py \
  --ocr-jobs <OCR 任务根目录> --subsets <subsets.json> --out tests/fixtures/tables
```

## 标准答案（`labels/`）

55 张表都标了（2026-11-12，三个 agent 对着原文页的图和文字层标，抽查过；格式和规则见 `labels/README.md`）：6980 个格子，
要翻 1105、不翻 5875；全部是文字层的表。

拿标准答案量两家 OCR（粗算：比格子文字时去掉空白、`$`、HTML 标签，大小写不分）：

| 服务商 | 行数×列数和标准答案一样 | 标准答案的格子原文能在 OCR 里原样找到 |
|---|---|---|
| GLM-OCR | 49/55（89%） | 63% |
| PaddleOCR | 50/55（91%） | 61% |

结构大多对，但约四成格子的文字和原文对不上（上标并进正文、破折号认成"一"或负号、`—/数值` 丢斜杠、符号字体认错……
也有一部分是这个粗算把写法差异算成了不一样）——格子原文要从 PDF 文字层取，不能用 OCR 的。

## 还没做

- 合成样例（横排页、字转曲线、图片表、续表）：公开样例里没有这几类，T1 里做，带标准答案。
