# rendering/output

## 负责什么

最终输出生成层。这里放 Typst 之外的输出写入、overlay 合成和 PDF 写出辅助能力。

## 对外入口

- `pdf_writer.py`
- `tables/`：表格译文放回译文 PDF（表格翻译 T5），排完正文后用 rpr 引擎（`rpr-table.js`）按原表的框重排整表，换掉原表
- 后续 `typst/` 会逐步迁入这里。

## 不该做什么

- 不做 OCR/翻译判断。
- 不做页面 redaction 策略。
- 不做 bbox 字体适配。
