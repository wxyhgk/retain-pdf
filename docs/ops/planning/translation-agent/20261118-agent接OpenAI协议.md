# agent 接 OpenAI 协议

2026-11-18。用户：「agent 翻译貌似只支持 anthropic 协议的」，要处理。同一时期 issue #161 用 OpenAI 官方接口（gpt-5.6-luna）。

## 以前

- 建任务校验：`translation.engine=agent` 而 `api_protocol` 不是 `anthropic` 就 400。
- 前端：协议不是 Anthropic 时「翻译引擎」里选不了 agent。
- agent 包（`backend/translation-agent`）自己用标准库发 Anthropic Messages 请求（`make_http_transport`），请求体、回答都是 Anthropic 的样子：
  系统提示块带缓存断点；通读、审校强制用工具（`tool_use`）交回；初译、重翻、改稿交纯文本（`@@ 块号` 一节一块）。

## 做法：在翻译包里换算，不动 agent 包

agent 包只许用标准库，各家 OpenAI 兼容服务的差异（不收 temperature、思考字段、json_schema 不支持退到 json_object、流式、Rust 执行器、重试、
Key 失效的闩）都已经在翻译共用的 `request_chat_content` 里。再在 agent 包里写一遍 OpenAI 客户端就是两份。所以：

- 新文件 `backend/translation/retainpdf_translation/workflow/agent_openai.py`：agent 的 transport（收 Anthropic 请求体、交回 Anthropic 回答），
  中间换成一次 `request_chat_content`：
  - system 块 → 一条 system 消息，用户消息原样；`cache_control`、`thinking`、`output_config`、`max_tokens`、`strict` 不往下传；
  - 强制用工具的请求 → `response_format` 按工具 schema 要 JSON（不加 strict：OpenAI 的 strict 要每个属性都列进 required），系统提示末尾附上
    schema（退到 json_object 的服务商只能靠提示）；回答去掉代码块围栏、解析成 JSON 包成 `tool_use`，解析不了就不交 `tool_use`（agent 按没交回处理，和
    Anthropic 下一样）；
  - 纯文本请求 → 不带 `response_format`，回答包成 `text`；
  - 请求标签：`submit_reading` → `agent-read`，`submit_review` → `agent-review`，其余 `agent-translate`，用量台账照旧分「翻译 / 通读 / 审校」；
  - 每次请求一份自己的诊断，拿这一次的 token 换成 Anthropic 的字段名（`input_tokens` 不含缓存命中、`cache_read_input_tokens`、`output_tokens`），
    agent 的计数、编辑部事件照常；用量台账由共用请求层记，`agent_flow` 的 `_UsageRecorder` 在 OpenAI 协议下不再记（不然重了）；
  - 错误：401/403 → `AuthFailed`，402 → `QuotaExhausted`，429、5xx、网络断（共用请求层自己重试完以后）→ `RateLimited`，都是 agent 的 `StopRun`：
    保存进度、阶段失败，重试从断点接着翻。别的错误原样抛（和 Anthropic 下 400 一样）。
  - temperature 0.0（和 legacy 翻译请求一样），不收的模型由共用请求层挨一次 400 后记住、不再带（#161 的问题一）。
  - 每次请求开一个单元范围（`agent` + 请求体哈希），Rust 执行器模式下也能发。
- `agent_flow.translate_book_with_agent`：协议看阶段入口登记的连接（`model_wire.registered_profile`，新加的，没登记返回 None）。`anthropic`
  或没登记（老入口、开发工具）→ 和以前完全一样；`openai` / `openai_responses` → 上面的 transport，`effort` 不发（思考档位由共用请求层按任务的
  thinking 换算，`auto` 下 qwen3.8-flash 关思考、glm-5.3-flash 用 low，和 legacy 一样）。
- 建任务校验去掉那条 400；契约里 `engine` 的说明改了（两份）；`docs/api/04-翻译/01-翻译参数.md`、前端交接文档写了前端要改哪里。

agent 包没改，`PROMPT_VERSION`、检查规则、断点指纹都没变：Anthropic 任务的请求体、请求缓存键和以前逐字节一样。

## 已知差别

- 共用请求层只交回文本，拿不到 `finish_reason`：回答被长度截断时 agent 不知道（Anthropic 下会把最后一块当没交、重翻）。半块译文靠 agent 的校验
  （长度比例、`$` 成对、标记）兜。也没有发 `max_tokens`（legacy 也不发），服务商默认上限小的（如 DeepSeek 的 4K）一整页可能被截。
- 请求缓存键是 Anthropic 请求体的哈希，里面有模型名、没有地址：同一个模型名经两个服务商调，缓存共用（Anthropic 下本来也这样）。
- 思考：Anthropic 下实测思考帮公式原样保住（97.1% 对 88.1%，见 [初译交回纯文本](./20261031-初译交回纯文本.md)）；OpenAI 协议 `auto` 下按 legacy
  的口径多半关思考。要质量可以在设置里把思考深度调到 low。

## 测试

`backend/pipeline/devtools/tests/translation/test_agent_openai.py`：工具请求要 JSON、回答包成 `tool_use`（带代码块围栏也认）；纯文本请求不带
Anthropic 专有字段；不是 JSON 不算工具调用；401/402/403/429/503/断网 → 对应的 `StopRun`，400 原样抛；任务登记成 `openai_responses` 时整条
agent 跑通（不走 Anthropic transport，用量台账不重记）。Rust：`build_translation_job_snapshot_accepts_agent_engine_with_every_protocol`。
