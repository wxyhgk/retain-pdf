# Translation LLM Orchestration

这一层只负责一件事：
把“单个 block / 单批 items 的翻译请求”编排成稳定、可回退、可诊断的 provider 调用流程。

它不负责：

- provider 专属 HTTP 细节
- OCR payload 抽取
- page payload 回填落盘
- PDF 渲染

## 新人先读

- 想看总入口：
  `retrying_translator.py`
- 想看 plain-text 单条降级主链：
  `single_item_flow.py`
- 想看单条编排的路由包装：
  `single_item_routes.py`
- 想看 fallback facade：
  `fallbacks.py`
- 想看公式 segment 路由：
  `segment_routing.py`
- 想看公式 segment 请求/切窗执行：
  `segment_request.py` / `segment_windows.py` / `segment_executor.py`
- 想看 direct-typst 特殊路径：
  `direct_typst.py`
- 想看 batch/cache/tail retry：
  `batched_plain.py`

## 当前边界

- `retrying_translator.py`
  shared orchestration 稳定入口。
  只负责 `translate_batch` / `translate_items_to_text_map`，不承载真实编排逻辑，也不再暴露历史 `_xxx` 私有 API。

- `fallbacks.py`
  plain-text 单条编排 facade。
  负责：
  - 保留顶层测试/调用入口
  - 通过显式依赖注入把 facade 上的测试替身传给 `single_item_flow.py`
  - 转发到 `single_item_flow.py`
  不再保留 tagged-placeholder 等旧私有路径包装。

- `single_item_flow.py`
  plain-text 单条编排主链。
  负责：
  - 选择 direct-typst / segmented / plain-text 主路径
  - tagged placeholder first 决策
  - 单条 plain-text attempt loop
  - sentence-level fallback 接入

- `single_item_deps.py`
  单条编排的显式依赖注入对象。
  只负责把 provider 调用、segment 调用、sentence fallback、validation 等可替换函数集中传入 `single_item_flow.py`。

- `single_item_routes.py`
  单条编排的路由包装。
  只负责 direct-typst、heavy-formula、tagged-placeholder 这些可替换 route 的调用形状，避免 `single_item_flow.py` 继续承载测试替身和历史包装入口。

- `batched_plain.py`
  batched plain-text 编排。
  负责：
  - cache hit / cache drop
  - low-risk batch 决策
  - batch partial accept + retry split
  - transport tail retry pass

- `direct_typst.py`
  direct-typst 主 retry loop。
  负责：
  - direct-typst plain/raw 两条路径的 attempt loop
  - validation failure 后的最终收口
  - sentence fallback / transport degrade 接入

- `direct_typst_long_text.py`
  direct-typst 长文本预切分。
  只负责拆块和 chunk 级拼回，不处理 provider transport。

- `direct_typst_salvage.py`
  direct-typst protocol/json shell salvage。
  只负责从异常文本中提取可接受译文并做 partial accept。

- `heavy_formula.py`
  heavy formula block 预拆分。
  只负责：
  - 是否需要 heavy split
  - 如何按 placeholder 密度拆块
  - chunk 级重试后再拼回

- `plain_text_validation.py`
  plain-text validation 失败后的收口逻辑。
  只负责：
  - protocol shell salvage
  - English residue partial salvage
  - repeated validation failure 最终 degrade 决策

- `sentence_level.py`
  sentence-level fallback。
  只负责句级拆分、逐句请求、部分成功拼回。

- `segment_routing.py`
  公式 segment 对外路由 facade。
  只负责暴露 routing / risk / plan 入口，并把执行转发给 executor。

- `segment_request.py`
  公式 segment provider 请求。
  只负责 tagged/json 双格式请求、响应解析和格式错误收口。

- `segment_windows.py`
  公式 segment 单窗口重试。
  只负责窗口上下文合并、窗口级 attempt loop 和 provider 请求调用。

- `segment_executor.py`
  公式 segment 执行编排。
  只负责单窗口/多窗口整体流程、结果拼回、validation 和窗口失败收口。

- `segment_failures.py`
  公式 segment 失败 payload 构造。
  只负责把窗口失败诊断写成统一 `failed` payload。

- `transport.py`
  transport tail retry / DLQ 公共逻辑。

- `terminal_payloads.py`
  翻译终态 payload 构造器。
  约定：
  - 明确不可译/可跳过内容才使用 `kept_origin`
  - provider、transport、validation、chunk/window 失败统一使用 `failed`
  - `failed` 默认带 `fallback_to=retry_required`，让导出门禁拦住半成品

- `keep_origin.py`
  keep-origin 兼容入口。
  新增失败终态时优先使用 `terminal_payloads.py`，不要再把失败写成 keep-origin。

- `metadata.py`
  translation_diagnostics / formula diagnostics / runtime term restore。

- `common.py`
  文本长度、continuation、CJK、placeholder 数量等纯判定工具。

## 调用链

最常见的调用链是：

`retrying_translator.py`
-> `fallbacks.py` / `single_item_flow.py`
-> `direct_typst.py` / `segment_routing.py` / plain-text provider runtime
-> `terminal_payloads.py` / `plain_text_validation.py` / `sentence_level.py`

batch 路径是：

`retrying_translator.py`
-> `batched_plain.py`
-> `fallbacks.py`

## 后续约定

- 新的降级策略，优先放进对应的责任模块，不要再回堆到 `fallbacks.py` 或 `retrying_translator.py`
- 失败不是 keep-origin。除 fast-path metadata、短非正文标签、明确中文原文等有意保留场景外，所有异常终态都应写成 `failed`。
- `fallbacks.py` 保持薄 facade 定位，不再塞真实流程或旧私有别名
- `retrying_translator.py` 保持稳定入口定位，不再塞 `_xxx_impl` 历史别名和真实流程
- provider 专属逻辑不要进入这里，统一留在 `shared/provider_runtime.py` 之后的 provider 实现里
- 如果某个模块再次超过 400-500 行，优先按责任切，不按代码块机械切
