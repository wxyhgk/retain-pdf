# rendering/workflow

## 负责什么

渲染流程编排层。这里负责组织渲染任务、选择渲染模式、准备上下文并调度具体模块。

## 对外入口

- `executor.py`
- `direct_overlay.py`
- `modes.py`
- `context.py`

## 不该做什么

- 不实现具体 redaction 算法。
- 不实现 Typst 源码模板细节。
- 不实现 bbox 字体适配算法。
