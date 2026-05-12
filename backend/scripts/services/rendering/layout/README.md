# rendering/layout

## 负责什么

排版层。这里把翻译后的 payload 转成可渲染块，计算字体、行距、bbox 适配和正文块布局。

## 对外入口

- `page_specs.py`
- `font_fit.py`
- `chinese_body_fit.py`
- `fit_decision/`
- `title_fit.py`
- `payload/`
- `typography/`

## 不该做什么

- 不操作 PDF 原始页面。
- 不删除英文原文。
- 不调用 OCR provider 或翻译模型。
- 不决定整页 redaction/background 路线。
