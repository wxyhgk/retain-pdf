# rendering/source/cleanup

## 负责什么

PDF 原页面清理层。这里直接操作 PyMuPDF 页面对象，处理原文删除、视觉遮盖、背景填充和相关诊断。

## 对外入口

- `redaction.py`
- `strategy.py`
- `routes.py`
- `plan.py`
- `analysis.py`
- `fill.py`
- `geometry.py`
- `config.py`

## 不该做什么

- 不生成 Typst 源码。
- 不做翻译质量判断。
- 不读取 OCR provider 原始 JSON。
- 不把页面类型判断散落到各处；优先从 `analysis/profile/` 和 `analysis/route/` 接收结论。
