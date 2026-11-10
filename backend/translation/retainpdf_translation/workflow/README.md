# 翻译 Workflow 边界

`retainpdf_translation.workflow` 是全书翻译的编排层。
它负责把稳定协议、策略/上下文准备、LLM 执行、结果回填、落盘、诊断和事件串起来，
但不应该让某一个文件同时承担所有职责。

## 入口和整书流程

- `execution.py`
  对外请求对象和执行入口。
- `execution_plan.py`
  根据 OCR JSON、策略配置、术语表、上下文和 provider 诊断配置生成不可变执行计划。
- `execution_runner.py`
  执行计划，并写出 manifest、review、diagnostics 等汇总产物；整份一块都没译成时把最常见的上游错误带进报错。
- 整书流程，三选一：
  - `book_flow.py`：默认的全书翻译阶段顺序。
  - `streaming_flow.py`：OCR 和翻译并行时用，OCR 每公布一批页就翻一轮。
  - `agent_flow.py`：`translation.engine=agent` 时，逐页翻交给 `retainpdf-translation-agent`，其余照旧。
- `stages.py`
  把 `phases/` 里的阶段函数汇到一处，`book_flow`、`streaming_flow` 从这里取。

## 子目录

- `phases/`
  整书的各个阶段：批量翻译、续句、页面策略、修复、事件。
- `batching/`
  批次构造规则：去重、低风险可合批判断、fast-path 规划和 pending-unit 选择、批次执行。
  不负责 provider transport，也不负责页面文件落盘。
- `scheduling/`
  队列分配、tail retry、失败兜底、页序、指标。`batch_runner.py` 用它跑顺序或并行的批次 worker。
- `checkpoint/`
  断点续翻：身份、准备、续跑、提交前检查、存储。

## 其他文件

- `pages.py`、`page_policies.py`、`page_range.py`
  逐页 payload 的读取、页面策略和续句复核、页码范围。
- `translation_workflow.py`
  只剩每页译文的文件名约定（`page_translation_path`）。
- `refine.py`、`editorial.py`
  渲染前在已提交译文之上的精修（挑错 → 定点修改）和多轮编辑部修订。
- `revision.py`
  单块译文修订写回：校验 → 原子改写页 payload → 推进 checkpoint → 追加修订记录。
- `recovery.py`
  把已完成的译文离线搬进一个新的、未发布的任务副本。

## 边界规则

- Workflow 可以编排 services，但不应该包含 provider 专属 HTTP 逻辑。
- Workflow 可以发送 pipeline events，但事件契约必须稳定，不能靠 log message 推断阶段。
- Batch scheduling 不应该决定翻译质量策略，只负责执行已准备好的 units，并暴露结构化失败。
- Result flush 不应该重建全局 translation-unit 状态，除非调用方明确要求。
- 渲染预热属于流水线的渲染准备阶段，翻译包内部不 import 渲染模块。
