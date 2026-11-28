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
- 读书（2026-11-25，握手带了 `job_id`，桥另给 `RETAIN_ASK_JOB_ID`、`RETAIN_ASK_DOCUMENT_ID`、`RETAIN_ASK_BACKEND_URL`、`RETAIN_ASK_BACKEND_KEY`）：
  经后端的 `reader/regions` 和页图接口读书（`tools.py`，只用标准库）。代码先把材料放进这一问（带字的补所在的节、同页前后各一块；
  不带字的取那一页，没有文字层附页图；系统提示词加目录），工具（`read_pages` / `search_book` / `view_page`）一直给，用不用由模型按提示词定，
  只有防失控的上限（4 轮）。方案见 [自带 agent 读书](../../docs/ops/planning/reader-ask/20261125-自带agent读书.md)。

- 思考强度（2026-11-26）：`session/new` 的结果带 ACP 的 `configOptions`（一项 `thought_level`，档位是这个模型实际有的，从翻译底座
  `model_wire.thinking_menu` 来），`session/set_config_option` 改这个会话下一问的档位；认不出的模型（OpenAI Chat 和 Responses、不是 api.openai.com）报通用的 off / on（2026-11-27），
  api.openai.com 上认不出的不报。不报选模型那一项。
  2026-11-27 用户：「只有开和关……太诡异了」。每档报英文名（Off / On / Low …，用户：「思考不要用中文!」）和一句中文说明（接线的 `THINKING_LABELS`）；DashScope 的 Qwen 按思考预算分五档；
  用户改过的档按模型连接记在桥给的 `RETAIN_ASK_THINKING_FILE` 里（接线的 `thinking_choice.py`），下次默认它；每问答完 `_meta.retainpdf.usage.thinking`
  报 `{level, thought}`，档位是猜的（自己部署的 Qwen3、通用开关）开了却没思考时多一句 `notice`。
  档位先问服务商的接口（`thinking_probe.py`：Anthropic、OpenRouter、Ollama，结果缓存），问不到查我们维护的表
  （翻译底座的 `thinking_models.json`，Qwen3.8 在那里），再是代码里的规则。

- 回答里的互动块（2026-11-26，`openui.py`，只用标准库）：桥给了 `RETAIN_OPENUI_PROMPT` 等（说明文件 `contracts/openui/`、检查器
  `backend/openui-check`、Node）就开：系统提示词在 `ask_system.txt` 后面接 L0（运行时从说明文件读，不复制），工具多 `openui_spec`（按 id 取说明）、
  `openui_check`（起 Node 跑 `@openuidev/lang-core` 的解析器，关掉遥测），没有书也有。额度和读书分开：取说明 2 次、检查 3 次。
  方案见 [互动块后端实现](../../docs/ops/planning/reader-ask/20261126-互动块后端实现.md)。

- 改译（2026-11-27）：用户问译文准不准、要改译时，系统提示词让模型把建议的整段译文单独放进 ```` ```译文 ```` 代码块（只放译文）。
  前端回答底下的「改这段译文」取最后一个 `译文` / `translation` / `zh` / `zh-CN` 代码块，填进那一块的编辑框，用户自己保存。
  pi（`backend/pi-agent`）用的是同一个 `ask_system.txt`，不用另改。

包里两个 Python 包：

- `retainpdf_ask_agent`：核心（ACP 服务端、内容块转换、系统提示词），**只用标准库**；模型的流式调用由调用方传进来
  （`AskAgent(stream_fn, tools=…)`，`stream_fn(messages, cancel, **options)` 产出 `("thought" | "text", 文字)`、`("usage", dict)`、`("stop", 原因)`，给了工具时还有 `("tool_call", …)`、`("native", …)`）；工具循环也在核心里。
  入口 `__main__.py` 例外（它是接线的入口）。
- `retainpdf_ask_agent_engine`：三种协议（OpenAI Chat、Responses、Anthropic Messages）的流式请求，请求体用翻译底座的 `model_wire`。

## 测试

```bash
python -m pytest backend/ask-agent/tests
```

花钱的实测（真模型）只在本机跑、先问用户，用 claude-haiku-5-5 或 qwen3.8-flash。
