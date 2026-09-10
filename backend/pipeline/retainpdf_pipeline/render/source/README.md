# rendering/source

## 负责什么

原 PDF 改造层。这里负责把源 PDF 变成可承载译文的底板。

## 对外入口

- `render_source.py`
- `rects.py`
- `items.py`
- `document_ops.py`
- `redaction.py`
- `text_redaction.py`
- `vector_profile.py`
- `vector_text.py`
- `preparation/`
- `cleanup/`
- `background/`
- `compression/`
- `dev_overlay/`

## 不该做什么

- 不生成 Typst。
- 不计算译文排版。
- 不调用翻译模型。
- 不承担 workflow 编排职责。

## 边界约定

- `rects.py` 放 source 层共享的矩形基础工具，`background/`、
  `cleanup/`、`preparation/` 可以依赖它。
- `items.py` 放 source 层共享的 translated item 读取、token 拆分和文本归一化 helper。
- `document_ops.py` 放 source 层共享的 PDF 文档操作 primitive。
- `redaction.py` 是 source 层对 cleanup redaction 策略的门面；外部子包不要直接
  import `cleanup.redaction`。
- `text_redaction.py` 放 source 层共享的文本层删除 primitive。
- `vector_profile.py` 放 source 层共享的页面 vector drawing 统计 primitive。
- `vector_text.py` 放 source 层共享的 vector text 检测 primitive；具体删除和
  背景修补由 cleanup/background 执行层决定。
- `dev_overlay/` 是旧 PyMuPDF 直绘译文路径，仅用于 direct overlay 和单页调试；
  主渲染路径不要在这里扩展正文排版规则。
- 子包之间不要为了共享基础 geometry 互相 import；需要共享时先上移到
  `rects.py`。
