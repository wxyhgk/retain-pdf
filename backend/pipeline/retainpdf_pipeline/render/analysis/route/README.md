# rendering/analysis/route

## 负责什么

单页路线决策层。这里消费 `RenderPageProfile`，输出 `RenderPageRoute`。

上层执行代码只能消费这里的路线或 profile 中的事实字段。比如伪 PDF
是否走 `typst_visual`、hidden text 是否剥离、source cleanup 是否物理删字，
都应该由同一份 page profile 派生，不能在 overlay/source cleanup 中各自再扫
`page_has_large_background_image()` 后做局部判断。

## 对外入口

- `builder.py`
- `models.py`

## 不该做什么

- 不重新扫描 PDF。
- 不执行 redaction。
- 不生成 Typst。
- 不改变实际渲染行为，除非上层显式接入 route。

新增路线判断时，保持一个判断一个文件，例如 `redaction_route.py`、`background_route.py`。
