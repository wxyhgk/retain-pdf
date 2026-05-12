# rendering/analysis/route

## 负责什么

单页路线决策层。这里消费 `RenderPageProfile`，输出 `RenderPageRoute`。

## 对外入口

- `builder.py`
- `models.py`

## 不该做什么

- 不重新扫描 PDF。
- 不执行 redaction。
- 不生成 Typst。
- 不改变实际渲染行为，除非上层显式接入 route。

新增路线判断时，保持一个判断一个文件，例如 `redaction_route.py`、`background_route.py`。
