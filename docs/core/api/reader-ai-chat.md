# AI 问答与文档操作 API

RetainPDF 的推荐 AI 入口是 Rust API 代理：

```text
POST /api/v1/ai/ask
```

Rust 保持统一的 `X-API-Key` 鉴权，并将请求代理给 `retainpdf-ai`。客户端不应
直连 Python 服务，也不应通过解析模型文案来判断操作是否已经执行。

旧接口 `POST /api/v1/jobs/{job_id}/reader/ai/chat` 仍保留兼容，但只支持已完成
任务上的一次性 Markdown 阅读问答；新功能不得继续基于它开发。

## 请求

最小阅读请求：

```json
{
  "question": "这篇文章的核心贡献是什么？",
  "document_id": "sha256-document-id",
  "assistant_mode": "reading",
  "stream": true
}
```

文档操作请求使用同一个入口：

```json
{
  "question": "把第 4 页旋转 180 度",
  "document_id": "sha256-document-id",
  "conversation_id": "conv-id",
  "user_message_id": "client-user-message-id",
  "assistant_message_id": "client-assistant-message-id",
  "assistant_mode": "operations",
  "stream": true
}
```

主要字段：

- `document_id` 或 `job_id`：限定当前文档。操作模式必须能解析到文档身份。
- `conversation_id`：续接持久化会话；省略时服务端可以创建会话并在响应中返回。
- `parent_id`：从指定消息节点继续，用于分支对话。
- `regenerate`：从既有父节点重新生成另一个回答分支。
- `user_message_id` / `assistant_message_id`：客户端稳定消息 ID。重试请求应复用
  原 ID，便于后端识别已经持久化但响应丢失的写入。
- `assistant_mode`：`reading` 只开放检索，`operations` 开放受限 PDF 操作，
  `auto` 由服务端保守路由：明确修改 PDF 才进入 operations，其余及歧义请求进入 reading。
- `confirm_document_operation`：仅表示用户对本次 `run` 或 `commit` 的明确授权；
  模型不能自行设置此权限。
- `llm_api_key` / `llm_base_url` / `llm_model`：兼容的单请求覆盖字段。常规产品
  配置应优先使用 runtime config；任何响应都不会回显密钥。

完整字段和事件枚举以
[`ai-ask.v1.schema.json`](../../../backend/contracts/ai-ask.v1.schema.json) 为准。

## 响应与 SSE

非流式响应的 `data` 至少包含：

```json
{
  "answer": "……[1]",
  "citations": [],
  "tool_trace": [],
  "rounds": 2,
  "persisted": true,
  "conversation_id": "conv-id",
  "agent_runtime": "python",
  "operation_refs": [],
  "confirmation_requests": []
}
```

`persisted=false` 表示回答已经返回，但本轮历史没有可靠写入；客户端应明确提示
用户，不要把屏幕上的内容误认为 durable history。

流式请求返回 `text/event-stream`。每条 `data:` JSON 的 `type` 可能是：

| `type` | 用途 |
| --- | --- |
| `progress` | 首先返回 routing，阅读请求随后返回 retrieval |
| `heartbeat` | 无其他事件时返回 `elapsed_ms`，默认每 5 秒一次 |
| `agent_session` | 返回会话 ID、requested/resolved mode、内容源、实际 runtime 和确认模式 |
| `tool` | Python 阅读 Agent 的检索过程 |
| `agent_tool` | OpenAI / FX runtime 的安全工具投影 |
| `agent_operation` | operation 身份与状态刷新提示 |
| `agent_confirmation_required` | 后端生成的结构化待确认动作 |
| `answer_delta` | 回答的增量文本片段，不是累积全文 |
| `compress` | 本轮发生了对话历史压缩 |
| `done` | 非空最终权威回答载荷；持久化在发送前完成 |
| `error` | 结构化失败终态，包含 `code/message/retryable` |
| `cancelled` | 取消终态；客户端断开时后端仍会停止未完成的模型/工具任务 |

每次 SSE 必须且只能以 `done`、`error` 或 `cancelled` 之一结束，默认总 deadline
为 90 秒。`agent_session` 中的 `resolved_mode` 与 `content_source` 是服务端最终决策。
SSE 是通知通道，不是 operation 状态真源。断线或刷新后，应通过 conversation 和
operation 查询接口恢复状态，不能只依赖已经接收过的事件。

## 会话与分支

```text
POST   /api/v1/ai/conversations
GET    /api/v1/ai/conversations?document_id=&limit=50&offset=0
POST   /api/v1/ai/conversations/fork
GET    /api/v1/ai/conversations/{conversation_id}
PATCH  /api/v1/ai/conversations/{conversation_id}
DELETE /api/v1/ai/conversations/{conversation_id}
POST   /api/v1/ai/conversations/{conversation_id}/messages
```

会话消息是树而不是只追加的线性数组。`parent_id` 表示父节点，conversation 的
`head_id` 表示当前可见分支叶节点。切换分支应 `PATCH` 新的 `head_id`；服务端会
据此重建从根到 head 的可见路径。正常问答由 AI 服务自动写入 user/assistant
消息，客户端不需要额外调用 messages 接口复制一份。

引用是消息快照中的软锚点：它不阻止 job 删除，目标不存在时客户端应保留
snippet，但禁用跳转。

## 文档 operation

Agent 创建 operation 后，客户端通过公共查询与动作接口驱动 UI：

```text
GET  /api/v1/ai/conversations/{conversation_id}/operations?limit=50&offset=0
GET  /api/v1/ai/operations/{operation_id}
POST /api/v1/ai/operations/{operation_id}/run
POST /api/v1/ai/operations/{operation_id}/retry
POST /api/v1/ai/operations/{operation_id}/cancel
POST /api/v1/ai/operations/{operation_id}/commit
GET  /api/v1/ai/operations/{operation_id}/candidate.pdf
```

动作请求必须携带稳定 `idempotency_key`，并带上刚查询到的
`expected_status`、`expected_attempt` 和 `expected_program_sha256`。状态已变化时
后端返回 409，客户端应刷新 operation，而不是用旧状态继续提交。

operation 列表返回 `operations`、`total`、`limit`、`offset` 和 `has_more`，并按
`updated_at DESC, operation_id DESC` 稳定排序。公开字段以
[`public-document-operation.v1.schema.json`](../../../contracts/public-document-operation.v1.schema.json)
为准；浏览器不应依赖内部 manifest、workspace 或 dispatch 回执。

默认 `explicit` 模式下，`run` 与 `commit` 必须来自明确的结构化确认。
`green_light` 只省略这一步人工授权，不会绕过固定命令语法、能力令牌、幂等、
候选校验和 commit 的并发保护。候选 PDF 生成后仍要单独 commit 才成为文档活动版本。

详细状态机和安全边界见
[`agent-document-operations.md`](../../../backend/api/docs/api-spec/agent-document-operations.md)。

## Runtime 配置

```text
GET /api/v1/ai/runtime-config
PUT /api/v1/ai/runtime-config
```

可选 runtime：

- `python`：本地 Markdown/结构化文档检索问答。
- `openai`：OpenAI-compatible 文档 Agent，可配置远程 `llm_base_url`。
- `fx`：FX Gateway Agent。FX CLI 0.0.5 的自定义 Gateway URL 只允许带端口的
  loopback HTTP 薄桥接地址；远程 DeepSeek/OpenAI-compatible 地址应使用
  `openai` runtime。

更新接口支持 `expected_revision` 的 compare-and-swap。查询响应只返回
`*_configured` 等状态，不回显任何 API key。部分变更需要进程重启；客户端应同时
观察 configured revision、active revision 和 readiness 诊断。

更新请求和脱敏视图以
[`runtime-config.v1.schema.json`](../../../contracts/runtime-config.v1.schema.json)
为准。该契约不包含原始模型 Key 或 Gateway Key。

实现与恢复语义见
[`AI_RUNTIME.md`](../../../docs/core/ai-runtime/AI_RUNTIME.md) 和
[`SESSION_AND_MEMORY.md`](../../../docs/core/ai-runtime/SESSION_AND_MEMORY.md)。

## 旧接口兼容范围

`POST /api/v1/jobs/{job_id}/reader/ai/chat` 只接受旧的 `message/scope/context/history`
结构，要求 job 已成功，并从翻译 manifest 或 `md/full.md` 检索后调用单一模型。
它没有持久化会话、分支、结构化确认、durable operation、SSE 恢复或 runtime
切换能力。现有调用方可以渐进迁移，但新调用方应直接使用 `/api/v1/ai/ask`。
