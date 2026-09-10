# Pipeline Shared 说明

`services/pipeline_shared/` 放的是跨阶段共享、但不属于任何单一 provider 的通用协议层。

当前主要承载三类东西：

- `events.py`
  Python worker 统一阶段事件 writer。所有 OCR / translation / render 细粒度事件都应通过这里写入 `logs/pipeline_events.jsonl`。
- `contracts.py`
  provider / translate / render worker 共用的 stdout label 与 summary 文件名。
- `io.py`
  中性的 JSON 落盘 helper。
- `source_json.py`
  主线如何在 raw provider layout 与 normalized document 之间选择正式输入的中性规则。
- `summary.py`
  主线 worker 共用的 pipeline summary 生成与打印逻辑。

设计边界：

- 这里只放阶段级共享协议，不放 MinerU、Paddle 之类 provider 私有语义。
- 这里只放主线都需要的通用能力，不放翻译策略、渲染实现或 OCR 适配细节。
- `ocr/mineru/` 可以继续保留兼容壳，但新的主线依赖应优先指向这里。
- 事件主语义必须写成顶层字段，不要只塞进 `payload`。
- `message` 只给人看，前端和 Rust API canonicalize 都不应该靠它猜阶段。

## 事件字段约定

Python 原始事件必须稳定带：

- `user_stage`：`ocr | translation | render | done`
- `stage`：Python 内部机器阶段
- `substage`：机器可读子阶段
- `stage_detail`：用户可读短文案
- `event_type`：原始事件类型，例如 `stage_progress`
- `semantic_event_type`：语义事件类型，例如 `progress`
- `progress_current`
- `progress_total`
- `progress_unit`
- `payload`

当前稳定子阶段包括：

- `ocr_processing`
- `normalizing`
- `translation_prepare`
- `domain_inference`
- `page_policies`
- `continuation_review`
- `translation_batches`
- `translation_tail_retry`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

新增子阶段时，需要同步更新 Rust 映射：

- `backend/packages/retain-core/src/models/job/stage.rs`
- `backend/api/src/services/jobs/live_stage/canonical_events.rs`

更完整的协议见：

- `docs/core/rust_api/11-阶段事件与失败协议.md`

这层的目标不是增加一层抽象，而是把原来挂在 `ocr/mineru/*` 名字下、实际已经被全流程共用的能力收口到中性模块，方便后续把后端继续演进成“模块化单体”。
