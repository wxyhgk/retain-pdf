# 翻译 Workflow 边界

`translate.workflow` 是全书翻译的编排层。
它负责把稳定协议、策略/上下文准备、LLM 执行、结果回填、落盘、诊断和事件串起来，
但不应该让某一个文件同时承担所有职责。

## 当前入口

- `execution.py`
  对外请求对象和执行入口。
- `execution_plan.py`
  根据 OCR JSON、策略配置、术语表、上下文和 provider 诊断配置生成不可变执行计划。
- `execution_runner.py`
  执行计划，并写出 manifest、review、diagnostics 等汇总产物。
- `book_flow.py`
  当前全书翻译阶段顺序。

## 目标目录

- `phases/`
  后续承接目前集中在 `stages.py` 里的阶段实现。
  一个 phase 可以调用 policy、continuation、LLM 或 repair 服务，但事件格式和落盘细节要收窄。

- `scheduling/`
  后续承接队列分配、批次 worker、结果 drain、tail retry 和 flush 策略。
  这些逻辑目前分散在 `batch_runner.py`、`workers.py` 和 `batching/pending_units.py`。

- `legacy/`
  后续承接旧的逐页翻译兼容路径。
  当前主要是 `translation_workflow.py`，以及仍然需要它的 debug-only 调用方。

- `batching/`
  批次构造规则：去重、低风险可合批判断、fast-path 规划和 pending-unit 选择。
  它不应该负责 provider transport，也不应该负责页面文件落盘。

## 边界规则

- Workflow 可以编排 services，但不应该包含 provider 专属 HTTP 逻辑。
- Workflow 可以发送 pipeline events，但事件契约必须稳定，不能靠 log message 推断阶段。
- Batch scheduling 不应该决定翻译质量策略，只负责执行已准备好的 units，并暴露结构化失败。
- Result flush 不应该重建全局 translation-unit 状态，除非调用方明确要求。
- Rendering prewarm 属于 runtime/pipeline 职责，translation 内部不应 import rendering 模块。

## 迁移顺序

1. 按职责把 `stages.py` 的阶段实现迁到 `phases/`。
2. 把 `batch_runner.py` 里的 queue worker / tail retry 迁到 `scheduling/`。
3. 把旧逐页 helper 迁到 `legacy/`；等没有生产调用后，再移除相关 production export。
