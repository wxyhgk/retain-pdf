# rendering/source/preparation

## 负责什么

渲染前 PDF 预处理层。目前只保留通用 PDF 预处理能力，例如隐藏文本层剥离、
公式 redaction 回贴和 XObject 清理。

bbox text strip 已迁移到 `render.source_cleanup`。不要在本目录
重新增加 bbox strip 规划、命中判断或 content stream 改写逻辑。

## 对外入口

- `hidden_text_strip.py`
- `redact_restore_formula.py`
- `xobject_sanitize.py`

## 与 source_cleanup 的边界

- `source_cleanup/planning` 负责从 translated items 生成删除候选和保护区。
- `source_cleanup/pdf` 负责 pikepdf content stream 删除和 Form XObject 递归。
- `source_cleanup/executor.py` 是渲染流程调用 source cleanup 的入口。
- 本目录如果需要调用 bbox strip，只能通过 `source_cleanup` 包入口，不直接
  import 其内部 planning/pdf 模块。

## 不该做什么

- 不做最终 redaction。
- 不生成 Typst。
- 不修改翻译 payload。
- 不新增 bbox text strip 规则；规则应先进 `render.policy` 或
  `render.source_cleanup` 对应层。
