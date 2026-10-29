# OCR 分类查看器

讨论、修改 RetainPDF 自己的块分类用的开发工具。不进生产流水线。

- `taxonomy.py`：分类草案 v1。每个块一个类别（29 类，分在 9 个大类里），可带属性（标题级别、图类型、横竖排），另记区（前言、正文、文末、版面）
  和关系（题注属于、注释属于、编号属于、目录指向、接续）；行内片段（行内公式、脚注标记、引用标记、注音）单独列。和任何一家 OCR 服务商的标签无关，
  但对照过 PaddleOCR（PP-DocLayoutV2）和 MinerU 的全部标签，它们的每种标签都有地方放。改分类只改这里，查看器跟着变。
- `complex_sample.py`：造一份 3 页（目录页 + 2 页双栏正文）论文 PDF，每个元素在排版时就按分类记下标准答案（`truth.json`：块框、行框、行内片段框、区、关系）。
  只用 PyMuPDF 自带字体，生成结果是确定的。
- `viewer.py` + `viewer_template.html`：把 PDF 页面和标准答案画成一个离线 HTML，按大类、区或翻不翻上色，画关系箭头，点框看类别定义和待定问题。

```bash
cd backend/pipeline
../.venv/bin/python -m devtools.ocr_viewer --out /tmp/ocr_viewer      # 造样例 + 生成查看器
open /tmp/ocr_viewer/viewer.html

# 用别的 PDF 和答案
../.venv/bin/python -m devtools.ocr_viewer.viewer --pdf X.pdf --truth truth.json --out viewer.html
```

测试在 `devtools/tests/ocr_viewer/`：分类表自洽、样例用到除 `unknown` 外的全部类别、目录条目指向的标题和页码对得上、答案的框都落在画出来的字上、
有跨栏和跨页的接续、生成结果确定。

还没做：把真实 OCR 的 `document.v1.json` 叠到同一页上和答案对照（要先定各家标签到这套分类的映射）。
