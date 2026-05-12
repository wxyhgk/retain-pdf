# rendering/source/compression

## 负责什么

PDF 压缩层。这里负责图片压缩、Ghostscript 压缩和压缩前分析。

## 对外入口

- `image_pipeline.py`
- `ghostscript.py`
- `analysis.py`

## 不该做什么

- 不改变页面内容。
- 不做 redaction。
- 不参与 OCR/翻译/排版决策。
