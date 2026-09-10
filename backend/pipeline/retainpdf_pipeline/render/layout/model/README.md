# rendering/layout/model

## 负责什么

译文排版阶段使用的数据模型和文本保护 helper，例如 `RenderBlock`、`RenderLayoutBlock`、`RenderPageSpec`。

## 对外入口

- `models.py`
- `render_text.py`

## 不该做什么

- 不操作 PDF。
- 不生成 Typst。
- 不做 redaction。
