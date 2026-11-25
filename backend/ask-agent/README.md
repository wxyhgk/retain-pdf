# retainpdf-ask-agent

RetainPDF 阅读页提问的自带 agent：在 stdio 上说 [ACP](https://agentclientprotocol.com/protocol/overview)，用设置里配好的模型流式回答。
后端的 ACP 桥（`retainpdf-providers` 的 `acp`，`GET /api/v1/ai/agents/retainpdf/acp`）用 `python -m retainpdf_ask_agent` 起它，
模型配置和密钥经环境变量给（`RETAIN_ASK_MODEL`、`RETAIN_ASK_BASE_URL`、`RETAIN_ASK_API_PROTOCOL`、`RETAIN_ASK_THINKING`、`RETAIN_ASK_API_KEY`）。
方案见 [后端 ACP 桥和自带 agent](../../docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md)。

- `initialize`（`promptCapabilities.image`、`embeddedContext` 为真；`loadSession` 等问答记录做好再开）、`session/new`、
  `session/prompt`、`session/cancel`。
- 回答边收边发：思考 `agent_thought_chunk`，正文 `agent_message_chunk`；最后 `usage_update`（ACP 的 `used`、`size`），
  输入 / 输出 / 缓存命中 / 思考 token、模型、用时、首字用时放在 `_meta.retainpdf.usage`，`session/prompt` 的结果里也有一份。
- 一个会话的前几轮（最多 20 条消息，只留文字）带进下一问；Anthropic 在上一轮回答上打缓存断点，OpenAI 兼容的服务商自动前缀缓存。
- 出错回 JSON-RPC 错误（-32603，服务商的状态码和一句说明），会话照常能接着问；被取消的回 `stopReason: cancelled`。

包里两个 Python 包：

- `retainpdf_ask_agent`：核心（ACP 服务端、内容块转换、系统提示词），**只用标准库**；模型的流式调用由调用方传进来
  （`AskAgent(stream_fn)`，`stream_fn(messages, cancel)` 产出 `("thought" | "text", 文字)`、`("usage", dict)`、`("stop", 原因)`）。
  入口 `__main__.py` 例外（它是接线的入口）。
- `retainpdf_ask_agent_engine`：三种协议（OpenAI Chat、Responses、Anthropic Messages）的流式请求，请求体用翻译底座的 `model_wire`。

## 测试

```bash
python -m pytest backend/ask-agent/tests
```

花钱的实测（真模型）只在本机跑、先问用户，用 claude-haiku-5-5 或 qwen3.8-flash。
