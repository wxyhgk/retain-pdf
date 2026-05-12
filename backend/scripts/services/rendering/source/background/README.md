# rendering/source/background

## 负责什么

背景处理层。这里负责大背景图检测、图像提取、局部背景重建和背景页面叠加。

## 对外入口

- `detect.py`
- `extract.py`
- `patch.py`
- `stage.py`
- `redaction_items.py`

## 不该做什么

- 不决定翻译文字怎么排版。
- 不执行文本层删除策略。
- 不调用 Typst 编译。
- 不替代 `page_profile/` 做全局页面分类。
