# rendering/document

## 负责什么

渲染阶段的 PDF 文档级辅助能力，包括源 PDF 准备、页码映射和目录/书签复制。

## 对外入口

- `source_pdf.py`
- `page_map.py`
- `metadata.py`

## 不该做什么

- 不做页面 redaction。
- 不生成 Typst。
- 不做 OCR/翻译判断。
