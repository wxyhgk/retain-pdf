# rendering/output/typst

## 负责什么

Typst 输出实现层。这里负责生成 Typst 源码、调用 Typst 编译、处理 overlay 合成所需的 Typst/PDF 辅助逻辑。

## 对外入口

- `book_renderer.py`
- `book_support.py`
- `compiler.py`
- `source_builder.py`
- `overlay_ops.py`
- `source_page_overlay.py`

## 不该做什么

- 不执行 OCR 或翻译。
- 不做原 PDF 清理策略。
- 不计算译文 bbox 字体适配。
