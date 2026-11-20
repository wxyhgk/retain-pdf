"""翻译引擎 agent 的接线（`translation.engine=agent`），2026-11-20 拆包第 3 步从翻译包的 `workflow/` 挪来。

- `agent_flow`：整本翻，把翻译包准备好的逐页记录交给 agent 核心 `retainpdf_translation_agent`，结果写回；
- `agent_openai`：agent 接 OpenAI 兼容服务（Anthropic 请求体 ↔ 翻译包的共用请求层）；
- `identity`：断点身份里 agent 的版本号。

和核心不一样，接线依赖翻译包（底座）和 requests，装的时候要带 `engine` 这个 extra（`retainpdf-translation-agent[engine]`）；
核心照旧只用标准库。翻译包经引擎登记表 `retainpdf_translation.workflow.engines` 按字符串加载这里，不 import 这里。
"""
