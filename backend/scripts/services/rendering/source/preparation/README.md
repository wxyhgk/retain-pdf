# rendering/source/preparation

## 负责什么

渲染前 PDF 预处理层。目前主要处理隐藏文本层剥离等前置准备。

## 对外入口

- `hidden_text_strip.py`

## 不该做什么

- 不做最终 redaction。
- 不生成 Typst。
- 不修改翻译 payload。
