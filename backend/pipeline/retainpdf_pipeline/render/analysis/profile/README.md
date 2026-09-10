# rendering/analysis/profile

## 负责什么

单页事实画像层。这里只采集事实，例如页面尺寸、文字层、背景图、矢量对象和 OCR bbox 摘要。

伪可编辑 PDF、图片型 PDF、混合复杂页、矢量重页都必须先在这里归一成
`RenderPageProfile.kind`。执行层不要重新组合“背景图 + 文字层 + 矢量对象”
这类判断，否则后续 source cleanup、hidden text strip、overlay route 会再次分叉。

## 对外入口

- `builder.py`
- `models.py`
- `registry.py`

## 不该做什么

- 不决定 redaction 策略。
- 不操作 PDF 页面内容。
- 不生成 Typst 或布局块。
- 不根据调用场景改变同一页的分类。

新增画像维度时，优先新增一个独立 `.py` 文件，再由 `builder.py` 汇总。
