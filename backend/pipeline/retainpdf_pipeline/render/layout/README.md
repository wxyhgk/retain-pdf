# rendering/layout

## 负责什么

排版层。这里把翻译后的 payload 转成可渲染块，计算字体、行距、bbox 适配和正文块布局。

## 对外入口

- `page_specs.py`
- `font_fit.py`
- `chinese_body_fit.py`
- `fit_decision/`
- `title_fit.py`
- `title_source_size.py`：标题的原文字号（原 PDF 文字层，读不到按原文塞满框反推）。标题不超过它、排不下才缩，Typst 路线和 rpr_fit 引擎（随条目传 `source_font_size_pt`）同一个值（2026-11-09）
- `payload/`
- `typography/`

## 不该做什么

- 不操作 PDF 原始页面。
- 不删除英文原文。
- 不调用 OCR provider 或翻译模型。
- 不决定整页 redaction/background 路线。

