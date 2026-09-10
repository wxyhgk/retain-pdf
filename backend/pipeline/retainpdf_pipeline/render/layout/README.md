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
- `typography_memory/`
  跨书字体/行距经验库。只缓存量化几何特征对应的 `font_size_pt`、`leading_em` 统计值，用作渲染 seed 的快速先验。

## 不该做什么

- 不操作 PDF 原始页面。
- 不删除英文原文。
- 不调用 OCR provider 或翻译模型。
- 不决定整页 redaction/background 路线。

## typography memory

`typography_memory/` 是全局、增量学习的排版标量库，默认存放在 `data/_render_typography_memory/typography_memory.sqlite3`。

边界：

- 只允许记录字体大小、行间距这类标量决策。
- key 只能由量化后的 bbox、页面尺寸、角色、行数、公式比例、译文密度等结构特征生成。
- 不缓存原文、译文、公式内容、颜色、删除策略、page spec 或 PDF 对象。
- 命中条件必须保守；样本数不足或方差过大时回退原算法。

开关：

- `RETAIN_RENDER_TYPOGRAPHY_MEMORY=0` 可关闭读写。
- `RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS` 可调命中所需最小样本数。
