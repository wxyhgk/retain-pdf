# LLM 目录约定

当前目录按“provider 专属实现”和“跨 provider 公共逻辑”拆分。

## 新人先读

- 想看 provider API 请求和默认模型：
  `providers/deepseek/client.py`
- 想看“当前激活 provider”的统一运行时入口：
  `shared/provider_runtime.py`
- 想看 provider registry/capability 装配：
  `shared/provider_registry.py`
- 想切换激活 provider（默认 `deepseek`，可选 `atlascloud`）：
  设环境变量 `RETAIN_TRANSLATION_PROVIDER`，在 `shared/provider_registry.py` 解析
- 想看 provider 侧翻译实现：
  `providers/deepseek/translation_client.py`
- 想看翻译控制上下文、术语和提示拼装入口：
  `shared/control_context.py`
- 想看翻译 prompt/message 构造：
  `shared/prompt_building.py`
- 想看主翻译编排和 batch 重试：
  `shared/orchestration/retrying_translator.py`
- 想看 plain-text 降级、placeholder 稳定策略：
  `shared/orchestration/single_item_flow.py`
- 想看单条 direct-typst/heavy-formula/tagged-placeholder 路由包装：
  `shared/orchestration/single_item_routes.py`
- 想看 fallback facade：
  `shared/orchestration/fallbacks.py`
- 想看编排目录的完整职责地图：
  `shared/orchestration/README.md`
- 想看公式切窗、segment 路由：
  `shared/orchestration/segment_routing.py`
- 想看占位符校验与降级原因：
  `placeholder_guard.py`

## 目录地图

- `providers/`
  只放 provider 专属 API 适配、请求/响应处理、provider 默认值。
  不应该承载跨 provider 的重试编排、公共结构化解析规则、页面级 workflow、policy 决策、memory 状态和渲染/落盘。
- `shared/`
  只放跨 provider 共用能力，例如控制上下文、缓存、结构化 schema 与解析器。
- `shared/prompt_building.py`
  放跨 provider 的 prompt/message 构造逻辑，不再堆在 provider transport 文件里。
- `shared/provider_runtime.py`
  是 shared 层访问当前激活 provider 的稳定适配口。
- `shared/provider_registry.py`
  放 provider runtime 定义、provider family/default model/base url 和 transport/translation 能力装配。
- `shared/provider_protocol.py`
  放 provider runtime 的协议类型和 capability 描述。Provider 新增能力时先扩这里，再让 registry 装配。
- `shared/orchestration/`
  只放跨 provider 的翻译编排、fallback、segment routing。
  这里应优先依赖 `shared/provider_runtime.py`，不要直接 import `providers/deepseek/*`。
  目录内更细的模块边界说明见 `shared/orchestration/README.md`。
- 顶层 `llm/`
  现在只保留稳定聚合入口和少量顶层公共模块。
  新代码应优先直接依赖 `providers/` 或 `shared/` 下的真实实现。

## 目录

- `providers/deepseek/`
  放 DeepSeek 专属 API 适配、默认值、请求/响应处理
- `providers/atlascloud/`
  放 Atlas Cloud 默认值（base_url、默认模型、API key env），复用 DeepSeek 的 OpenAI 兼容 transport
- `shared/`
  放跨 provider 的缓存、控制上下文、结构化 schema 与解析器
- `shared/prompt_building.py`
  放 prompt 与 message builder
- `shared/provider_runtime.py`
  放 shared 到当前 active provider 的运行时适配层
- `shared/provider_registry.py`
  放 active provider registry 与 capability runtime
- `shared/orchestration/`
  放跨 provider 的翻译编排、fallback、公式分段路由
- 顶层 `llm/`
  保留稳定聚合入口与少量顶层公共逻辑

## 当前分层

- provider 专属
  - `providers/deepseek/client.py`
  - `providers/deepseek/translation_client.py`
- shared 公共层
  - `shared/control_context.py`
  - `shared/cache.py`
  - `shared/prompt_building.py`
  - `shared/provider_registry.py`
  - `shared/provider_runtime.py`
  - `shared/structured_models.py`
  - `shared/structured_output.py`
  - `shared/structured_parsers.py`
- shared 编排层
  - `shared/orchestration/README.md`
  - `shared/orchestration/retrying_translator.py`
  - `shared/orchestration/single_item_flow.py`
  - `shared/orchestration/single_item_deps.py`
  - `shared/orchestration/single_item_routes.py`
  - `shared/orchestration/fallbacks.py`
  - `shared/orchestration/segment_request.py`
  - `shared/orchestration/segment_windows.py`
  - `shared/orchestration/segment_executor.py`
  - `shared/orchestration/segment_failures.py`
  - `shared/orchestration/batched_plain.py`
  - `shared/orchestration/direct_typst.py`
  - `shared/orchestration/direct_typst_long_text.py`
  - `shared/orchestration/direct_typst_salvage.py`
  - `shared/orchestration/heavy_formula.py`
  - `shared/orchestration/plain_text_validation.py`
  - `shared/orchestration/sentence_level.py`
  - `shared/orchestration/transport.py`
  - `shared/orchestration/keep_origin.py`
  - `shared/orchestration/metadata.py`
  - `shared/orchestration/common.py`
  - `shared/orchestration/segment_routing.py`
- 公共逻辑
  - `placeholder_guard.py`
  - `domain_context.py`

## 稳定入口与兼容入口

- 稳定聚合入口
  - `llm/__init__.py`
  - `providers/deepseek/__init__.py`
  - `shared/__init__.py`
  - `shared/orchestration/__init__.py`

## Provider 运行时分层

- `providers/<provider>/`
  只关心 provider 专属 transport、默认值和 provider 自己的翻译细节
- `shared/provider_registry.py`
  把 provider 专属能力装配成 `TranslationProviderRuntimeProtocol`
- `shared/provider_runtime.py`
  暴露“当前 active provider”的稳定别名给业务层和 orchestration 层
- 业务层
  默认只依赖 `shared/provider_runtime.py`，不直接 import `providers/deepseek/*`

## 关键调用链

- 主翻译链：
  `workflow/translation_workflow.py`
  -> `services.translation.llm.translate_batch`
  -> `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `providers/deepseek/translation_client.py`
  -> `providers/deepseek/client.py`
- 领域提示链：
  `domain_context.py`
  -> `shared/control_context.py`
  -> `providers/deepseek/client.py`
- 公式降级链：
  `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/segment_routing.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `placeholder_guard.py`

## 排错入口

- placeholder 异常、keep-origin 降级：
  `placeholder_guard.py`
- 批次重试、单 item 降级：
  `shared/orchestration/retrying_translator.py`
  `shared/orchestration/single_item_flow.py`
  `shared/orchestration/fallbacks.py`
  `shared/orchestration/README.md`
- 结构化输出解析失败：
  `shared/structured_output.py`
  `shared/structured_parsers.py`
- 调试与 replay：
  `backend/scripts/devtools/replay_translation_item.py`
  `backend/scripts/devtools/tests/translation/`

## 后续约定

- 新增 provider 时，优先在 `providers/<provider>/` 下新增实现
- 新增 provider 时，同时在 `shared/provider_protocol.py` 声明能力，在 `shared/provider_registry.py` 注册 runtime
- 公共能力优先放 `shared/`
- 顶层 `llm/` 只保留稳定聚合入口与少量顶层公共模块，不继续堆 provider 特例
- 业务代码默认经由 `shared/provider_runtime.py` 访问默认模型、base_url、api_key 解析和通用 chat transport
