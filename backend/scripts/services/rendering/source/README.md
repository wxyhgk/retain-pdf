# rendering/source

## 负责什么

原 PDF 改造层。这里负责把源 PDF 变成可承载译文的底板。

## 对外入口

- `render_source.py`
- `preparation/`
- `cleanup/`
- `background/`
- `compression/`

## 不该做什么

- 不生成 Typst。
- 不计算译文排版。
- 不调用翻译模型。
- 不承担 workflow 编排职责。
