# rendering/analysis/profile

## 负责什么

单页事实画像层。这里只采集事实，例如页面尺寸、文字层、背景图、矢量对象和 OCR bbox 摘要。

## 对外入口

- `builder.py`
- `models.py`
- `registry.py`

## 不该做什么

- 不决定 redaction 策略。
- 不操作 PDF 页面内容。
- 不生成 Typst 或布局块。

新增画像维度时，优先新增一个独立 `.py` 文件，再由 `builder.py` 汇总。
